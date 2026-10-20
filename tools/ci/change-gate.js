// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. A new file under corrections/ (not an exact rename of an old one) covers the whole change. Otherwise
// each changed emitted file needs one of:
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
import { pathToFileURL } from 'node:url';
import { METHODS_LOG, latestMethodsVersion } from '../../pipeline/methods-log.js';
import { sourceManifestHash } from '../../pipeline/contract.js';

const EMITTED = 'data/emitted/';
const CORRECTIONS = 'corrections/';
const MANIFEST = 'data/pinned/manifest.json';

// changed: [{ status, path }] from git (A added, M modified, D deleted, T type change). explained: emitted paths
// with a per-file reason (see above). renamed: added paths that are exact renames of deleted ones.
export function changeGate({ changed, explained = new Set(), renamed = new Set() }) {
  const changedEmitted = changed.filter(({ path }) => path.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some(({ status, path }) => status === 'A' && path.startsWith(CORRECTIONS) && !renamed.has(path))) {
    return { ok: true, reason: 'emitted data changed with a new corrections entry' };
  }
  const unexplained = changedEmitted.filter(({ status, path }) => status === 'D' || !explained.has(path)).map(({ path }) => path);
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change is new, re-pinned, or a new methods_version' };
  return {
    ok: false,
    reason: `${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), bump the site's methods_version with a new heading in ${METHODS_LOG} (methods change), or add a new file under ${CORRECTIONS} (correction or removal)`,
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

// git's -z name-status → [{ status, path }]. "A\0path\0" records have 2 fields; renames ("R100\0old\0new\0")
// have 3, and path is the new name.
export function parseNameStatus(text, fields = 2) {
  const parts = text.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i + fields - 1 < parts.length; i += fields) out.push({ status: parts[i][0], path: parts[i + fields - 1] });
  return out;
}

const ZERO_SHA = /^0{40}$/;
const MAX_FILE = 32 * 1024 * 1024; // emitted files stay under the hook's 10 MiB limit

function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_FILE });
  const given = process.env.GATE_BASE ?? '';
  // Only the first push of a branch has no base. A base that can't be found (a force-push) fails the gate
  // rather than shrinking the range it checks.
  const base = given === '' || ZERO_SHA.test(given) ? 'HEAD~1' : given;
  try {
    execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { stdio: 'ignore' });
  } catch {
    throw new Error(`base ${base} is not in this history (force-push?); check the range by hand`);
  }
  const changed = parseNameStatus(git('diff', '--name-status', '--no-renames', '-z', `${base}...HEAD`));
  const emitted = changed.filter(({ status, path }) => path.startsWith(EMITTED) && status !== 'D');
  // Exact renames under corrections/ (100% similar): an old entry under a new name, not a new correction.
  const renamed = new Set(
    parseNameStatus(git('diff', '--name-status', '-M100%', '--diff-filter=R', '-z', `${base}...HEAD`, '--', CORRECTIONS), 3).map(
      ({ path }) => path,
    ),
  );
  const explained = new Set();
  if (emitted.length > 0) {
    const mergeBase = git('merge-base', base, 'HEAD').trim();
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
      const added = status === 'A';
      const before = added ? undefined : parse(git('show', `${mergeBase}:${path}`));
      const now = parse(git('show', `HEAD:${path}`));
      if (reasonFor({ added, before, now, pins, latest: latestFor(path.slice(EMITTED.length).split('/')[0]) })) explained.add(path);
    }
  }
  const result = changeGate({ changed, explained, renamed });
  console.log(`change gate (${base}...HEAD): ${result.reason}`);
  if (!result.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`change gate: ${err.message}`);
    process.exit(1);
  }
}
