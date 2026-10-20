// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. A new file under corrections/ covers the whole change. Otherwise each changed emitted file needs one of:
//   - added: a first emission (nothing published to differ from);
//   - re-pinned: one of its inputs has a new SHA-256 in the manifest, and its source_manifest is the true hash of
//     its inputs at HEAD (adding or dropping an input is a methods change, not new data);
//   - bumped: its own methods_version moved to its site's new newest version in the methods log.
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
// with a per-file reason (see above).
export function changeGate({ changed, explained = new Set() }) {
  const changedEmitted = changed.filter(({ path }) => path.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some(({ status, path }) => status === 'A' && path.startsWith(CORRECTIONS))) {
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
  const truthful = now.sources.every((id) => pins.now.has(id)) &&
    now.source_manifest === sourceManifestHash(now.sources.map((id) => ({ id, sha256: pins.now.get(id) })));
  const newData = now.sources.some((id) => pins.before.has(id) && pins.now.get(id) !== pins.before.get(id));
  if (truthful && newData) return 're-pinned';
  if (now.methods_version !== before.methods_version && now.methods_version === latest.now && latest.now > (latest.before ?? 0)) return 'bumped';
  return null;
}

// "A\0path\0M\0path\0" → [{ status, path }]
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
  const explained = new Set();
  if (emitted.length > 0) {
    const mergeBase = git('merge-base', base, 'HEAD').trim();
    const status = (path) => changed.find((c) => c.path === path)?.status;
    // A file's text at a revision; '' when git's statuses say it isn't there. Other git failures throw.
    const at = (rev, path) => {
      const s = status(path);
      if (rev === 'HEAD' ? s === 'D' : s === 'A') return '';
      return git('show', `${rev}:${path}`);
    };
    const parse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    };
    const pinsAt = (rev) => new Map((parse(at(rev, MANIFEST)) ?? []).map((e) => [e.id, e.sha256]));
    const pins = { now: pinsAt('HEAD'), before: pinsAt(mergeBase) };
    const [logNow, logBefore] = [at('HEAD', METHODS_LOG), at(mergeBase, METHODS_LOG)];
    for (const { status: s, path } of emitted) {
      const site = path.slice(EMITTED.length).split('/')[0];
      const latest = { now: latestMethodsVersion(logNow, site), before: latestMethodsVersion(logBefore, site) };
      const added = s === 'A';
      const before = added ? undefined : parse(git('show', `${mergeBase}:${path}`));
      if (reasonFor({ added, before, now: parse(git('show', `HEAD:${path}`)), pins, latest })) explained.add(path);
    }
  }
  const result = changeGate({ changed, explained });
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
