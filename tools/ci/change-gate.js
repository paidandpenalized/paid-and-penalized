// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. A new file under corrections/ (not a rename of an old one) covers the whole change. Otherwise each
// changed emitted file needs one of:
//   - added: a first emission (nothing published to differ from);
//   - re-pinned: same sources, a different source_manifest, and the new one is the true hash of those inputs in
//     the manifest at HEAD. The hash covers only ids and SHA-256s, so with the same ids a new hash means a new
//     SHA-256, even if the manifest changed in an earlier push. Adding or dropping an input is a methods change;
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
  const corrections = (st) => changed.some(({ status, path }) => status === st && path.startsWith(CORRECTIONS));
  if (corrections('A') && !corrections('D')) {
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
// file (undefined when it isn't valid JSON); pins maps input id → SHA-256 in the manifest at HEAD;
// latest.now/latest.before are the site's newest methods_version in each log.
export function reasonFor({ added, before, now, pins, latest }) {
  const isFile = (d) => d !== null && typeof d === 'object' && typeof d.source_manifest === 'string' && Array.isArray(d.sources);
  if (!isFile(now)) return null;
  if (added) return 'added';
  if (!isFile(before)) return null;
  const sameSources = now.sources.length === before.sources.length && now.sources.every((id, i) => id === before.sources[i]);
  const truthful = now.sources.every((id) => pins.has(id)) &&
    now.source_manifest === sourceManifestHash(now.sources.map((id) => ({ id, sha256: pins.get(id) })));
  if (sameSources && truthful && now.source_manifest !== before.source_manifest) return 're-pinned';
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
    const parse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    };
    // An emitted file at a revision: git's statuses say whether it exists there, so a git failure throws.
    const emittedAt = (rev, path) => {
      const s = status(path);
      return (rev === 'HEAD' ? s === 'D' : s === 'A') ? undefined : parse(git('show', `${rev}:${path}`));
    };
    // The manifest and the log only ever add explanations, so reading a missing one as empty fails closed.
    const optional = (rev, path) => {
      try {
        return execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8', maxBuffer: MAX_FILE, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        return '';
      }
    };
    const manifest = parse(optional('HEAD', MANIFEST));
    const pins = new Map(
      (Array.isArray(manifest) ? manifest : []).filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e.sha256]),
    );
    const logs = { now: optional('HEAD', METHODS_LOG), before: optional(mergeBase, METHODS_LOG) };
    const latest = {};
    const latestFor = (site) =>
      (latest[site] ??= { now: latestMethodsVersion(logs.now, site), before: latestMethodsVersion(logs.before, site) });
    for (const { status: s, path } of emitted) {
      const added = s === 'A';
      const args = { added, before: emittedAt(mergeBase, path), now: emittedAt('HEAD', path), pins };
      if (reasonFor({ ...args, latest: latestFor(path.slice(EMITTED.length).split('/')[0]) })) explained.add(path);
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
