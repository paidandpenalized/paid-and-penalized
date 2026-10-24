// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. The corrections log is append-only: any change that edits, retypes or deletes a dated entry fails. A new
// entry covers the whole change: an added regular file corrections/YYYY-MM-DD-<slug>.md (a real date, under
// 1 MiB) whose text, whitespace aside, is non-empty and not already a readable .md under corrections/ at the merge
// base (readableMarkdown). Otherwise each changed emitted file needs one of:
//   - added: a first emission (nothing published to differ from);
//   - re-pinned: one of its inputs has a new SHA-256 in this change's manifest diff, its sources and
//     methods_version are unchanged, and its new source_manifest is the true hash of those inputs at HEAD. Pin and
//     re-emit go in the same change (a pin alone already fails the golden test); adding or dropping an input is
//     a methods change;
//   - bumped: its own methods_version moved to its site's new newest version, added to the methods log in this
//     change.
// A deleted or renamed file (git reports a rename as delete + add) needs a corrections entry. The evidence is all
// in the tree, so PR runs and the push to main after the merge reach the same verdict.
import { execFileSync } from 'node:child_process';
import { CORRECTIONS, isEntry } from '../../pipeline/corrections.js';
import { isMain } from '../../pipeline/files.js';
import { METHODS_LOG, latestMethodsVersion } from '../../pipeline/methods-log.js';
import { sourceManifestHash } from '../../pipeline/contract.js';

const EMITTED = 'data/emitted/';
const MANIFEST = 'data/pinned/manifest.json';

// Dated entries this change edits, retypes or deletes.
export function entryRewrites(changed) {
  return changed.filter(({ status, path }) => status !== 'A' && isEntry(path)).map(({ path }) => path);
}

const MAX_ENTRY = 1024 * 1024; // a corrections entry is a short note

// The files under corrections/ whose text the gate reads: regular .md files under 1 MiB. A symlink's "text" is
// its target and a submodule has none; evidence such as PDFs is never an entry or a copy of one. records come
// from `git ls-tree -r -l -z`.
export function readableMarkdown(lsTree) {
  return lsTree
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const [mode, , blob, size] = record.slice(0, record.indexOf('\t')).split(/\s+/);
      return { mode, blob, size: Number(size), path: record.slice(record.indexOf('\t') + 1) };
    })
    .filter(({ mode, size, path }) => (mode === '100644' || mode === '100755') && /\.md$/i.test(path) && size < MAX_ENTRY);
}

// The text of each record's blob, from one `git cat-file --batch` ("<id> blob <size>\n<bytes>\n" per blob). Each
// header must name the requested blob and its size, or this throws: a missing object never reads as text.
export function batchTexts(exec, records) {
  if (records.length === 0) return [];
  const maxBuffer = records.reduce((sum, r) => sum + r.size + r.blob.length + 32, 1024);
  const out = exec('git', ['cat-file', '--batch'], { input: records.map((r) => r.blob).join('\n') + '\n', maxBuffer });
  let at = 0;
  return records.map(({ blob, size }) => {
    const end = out.indexOf(0x0a, at);
    const header = out.subarray(at, end).toString('utf8');
    if (header !== `${blob} blob ${size}`) throw new Error(`git cat-file: expected "${blob} blob ${size}", got "${header}"`);
    const text = out.subarray(end + 1, end + 1 + size).toString('utf8');
    at = end + 1 + size + 1;
    return text;
  });
}

const plural = (paths, one, many) => `${paths.join(', ')} ${paths.length === 1 ? one : many}`;

// changed: [{ status, path }] from git (A added, M modified, D deleted, T type change). explained: emitted paths
// with a per-file reason (see above). freshEntries: added entry paths whose text, whitespace aside, is non-empty
// and not already a readable .md under corrections/ at the base (this function re-checks status and the name).
export function changeGate({ changed, explained = new Set(), freshEntries = new Set() }) {
  const rewrites = entryRewrites(changed);
  if (rewrites.length > 0) {
    return { ok: false, reason: `the corrections log is append-only: this change edits, retypes or removes ${rewrites.join(', ')}; add a new entry instead` };
  }
  const changedEmitted = changed.filter(({ path }) => path.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some(({ status, path }) => status === 'A' && isEntry(path) && freshEntries.has(path))) {
    return { ok: true, reason: 'emitted data changed with a new corrections entry' };
  }
  const addedMarkdown = changed
    .filter(({ status, path }) => status === 'A' && path.startsWith(CORRECTIONS) && /\.md$/i.test(path))
    .map(({ path }) => path);
  const misnamed = addedMarkdown.filter((p) => !isEntry(p) && !/^corrections\/readme\.md$/i.test(p));
  const unusable = addedMarkdown.filter((p) => isEntry(p) && !freshEntries.has(p));
  const hints = [
    misnamed.length > 0 && `${plural(misnamed, 'is not a dated entry', 'are not dated entries')} (corrections/YYYY-MM-DD-<slug>.md directly under corrections/, a real date).`,
    unusable.length > 0 && `${plural(unusable, "doesn't count", "don't count")}: blank, a copy of an earlier file, a link, or 1 MiB or more.`,
  ].filter(Boolean);
  const unexplained = changedEmitted.filter(({ status, path }) => status === 'D' || !explained.has(path)).map(({ path }) => path);
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change is new, re-pinned, or a new methods_version' };
  return {
    ok: false,
    reason: `${hints.map((h) => `${h} `).join('')}${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), bump the site's methods_version with a new heading in ${METHODS_LOG} (methods change), or add a new entry ${CORRECTIONS}YYYY-MM-DD-<slug>.md (correction or removal)`,
  };
}

// Why one emitted file changed: 'added', 're-pinned', 'bumped', or null (no reason). before/now are the parsed
// file (undefined when it isn't valid JSON); pins.now/pins.before map input id → SHA-256 in each manifest;
// latest.now/latest.before are the site's newest methods_version in each log.
export function reasonFor({ added, before, now, pins, latest }) {
  const isFile = (d) => d !== null && typeof d === 'object' && typeof d.source_manifest === 'string' && Array.isArray(d.sources);
  if (!isFile(now)) return null;
  if (added) return 'added';
  if (!isFile(before)) return null;
  const sameSources = now.sources.length === before.sources.length && now.sources.every((id, i) => id === before.sources[i]);
  const truthful = now.sources.every((id) => pins.now.has(id)) &&
    now.source_manifest === sourceManifestHash(now.sources.map((id) => ({ id, sha256: pins.now.get(id) })));
  const newData = now.sources.some((id) => pins.before.has(id) && pins.now.get(id) !== pins.before.get(id));
  if (sameSources && truthful && newData && now.methods_version === before.methods_version) return 're-pinned';
  if (now.methods_version !== before.methods_version && now.methods_version === latest.now && latest.now > (latest.before ?? 0)) return 'bumped';
  return null;
}

// git's -z name-status with --no-renames → [{ status, path }]: "A\0path\0M\0path\0".
export function parseNameStatus(text) {
  const parts = text.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ status: parts[i][0], path: parts[i + 1] });
  return out;
}

const ZERO_SHA = /^0{40}$/;
const MAX_FILE = 32 * 1024 * 1024; // emitted files stay under the hook's 10 MiB limit

function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_FILE });
  process.chdir(git('rev-parse', '--show-toplevel').trim()); // every path below is repo-relative
  const given = process.env.GATE_BASE ?? '';
  // Push runs happen only on main; only main's first push has no base, and then only its last commit is checked.
  // A base that can't be found (a force-push) fails the gate rather than shrinking the range it checks.
  const base = given === '' || ZERO_SHA.test(given) ? 'HEAD~1' : given;
  try {
    execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { stdio: 'ignore' });
  } catch {
    throw new Error(
      base === 'HEAD~1' ? 'HEAD has no parent commit; check this first commit by hand' : `base ${base} is not in this history (force-push?); check the range by hand`,
    );
  }
  const changed = parseNameStatus(git('diff', '--name-status', '--no-renames', '-z', `${base}...HEAD`));
  const emitted = changed.filter(({ path }) => path.startsWith(EMITTED));
  const explained = new Set();
  const freshEntries = new Set();
  if (emitted.length > 0 && entryRewrites(changed).length === 0) {
    const mergeBase = git('merge-base', base, 'HEAD').trim();
    const markdownAt = (rev, paths) => readableMarkdown(git('ls-tree', '-r', '-l', '-z', rev, '--', ...paths));
    const addedEntries = changed.filter(({ status, path }) => status === 'A' && isEntry(path)).map(({ path }) => path);
    if (addedEntries.length > 0) {
      const old = markdownAt(mergeBase, [CORRECTIONS]);
      const added = markdownAt('HEAD', addedEntries);
      const all = batchTexts(execFileSync, [...old, ...added]).map((text) => text.replace(/\s+/g, ' ').trim());
      const oldTexts = new Set(all.slice(0, old.length));
      all.slice(old.length).forEach((text, i) => {
        if (text !== '' && !oldTexts.has(text)) freshEntries.add(added[i].path);
      });
    }
    const parse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    };
    // A path that is absent at a revision reads as ''; any other git failure throws.
    const read = (rev, path) => (git('ls-tree', '--name-only', rev, '--', path).trim() === '' ? '' : git('show', `${rev}:${path}`));
    const pinsAt = (rev) => {
      const manifest = parse(read(rev, MANIFEST));
      return new Map((Array.isArray(manifest) ? manifest : []).filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e.sha256]));
    };
    const pins = { now: pinsAt('HEAD'), before: pinsAt(mergeBase) };
    const logs = { now: read('HEAD', METHODS_LOG), before: read(mergeBase, METHODS_LOG) };
    const latest = {};
    const latestFor = (site) =>
      (latest[site] ??= { now: latestMethodsVersion(logs.now, site), before: latestMethodsVersion(logs.before, site) });
    for (const { status, path } of emitted) {
      if (status === 'D') continue; // a deletion needs a corrections entry
      const isNew = status === 'A';
      const before = isNew ? undefined : parse(git('show', `${mergeBase}:${path}`));
      const now = parse(git('show', `HEAD:${path}`));
      if (reasonFor({ added: isNew, before, now, pins, latest: latestFor(path.slice(EMITTED.length).split('/')[0]) })) explained.add(path);
    }
  }
  const result = changeGate({ changed, explained, freshEntries });
  console.log(`change gate (${base}...HEAD): ${result.reason}`);
  if (!result.ok) process.exit(1);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`change gate: ${err.message}`);
    process.exit(1);
  }
}
