// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. A file under corrections/ covers the whole change. Otherwise each changed emitted file needs one of:
//   - added: a first emission (nothing published to differ from);
//   - re-pinned: its source_manifest (a hash of its inputs' ids and SHA-256s) changed: new source data;
//   - bumped: its own methods_version moved to its site's new newest version in the methods log.
// A deleted or renamed file (git reports a rename as delete + add) needs a corrections entry. The evidence is all
// in the tree, so PR runs and the push to main after the merge reach the same verdict.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { METHODS_LOG, latestMethodsVersion } from '../../pipeline/methods-log.js';

const EMITTED = 'data/emitted/';
const CORRECTIONS = 'corrections/';

// changed: [{ status, path }] from git (A added, M modified, D deleted, T type change). explained: emitted paths
// with a per-file reason (see above).
export function changeGate({ changed, explained = new Set() }) {
  const changedEmitted = changed.filter(({ path }) => path.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some(({ path }) => path.startsWith(CORRECTIONS))) return { ok: true, reason: 'emitted data changed with a corrections entry' };
  const unexplained = changedEmitted.filter(({ status, path }) => status === 'D' || !explained.has(path)).map(({ path }) => path);
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change is new, re-pinned, or a new methods_version' };
  return {
    ok: false,
    reason: `${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), bump the site's methods_version with a new heading in ${METHODS_LOG} (methods change), or add a file under ${CORRECTIONS} (correction or removal)`,
  };
}

// Why one emitted file changed, given its parsed content before and after (null when absent): 'added',
// 're-pinned', 'bumped', or null (no reason). Content that isn't an emitted file explains nothing.
export function reasonFor(before, now, latest) {
  const isFile = (d) => d !== null && typeof d === 'object' && typeof d.source_manifest === 'string';
  if (now === undefined || !isFile(now)) return null;
  if (before === null) return 'added';
  if (!isFile(before)) return null;
  if (now.source_manifest !== before.source_manifest) return 're-pinned';
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
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  // Statuses say which side a path exists on, so a failing git show is a real error and throws.
  const parse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };
  const logAt = (rev, status) => (status === 'A' ? '' : git('show', `${rev}:${METHODS_LOG}`));
  const logChange = changed.find(({ path }) => path === METHODS_LOG);
  const logNow = logChange?.status === 'D' ? '' : git('show', `HEAD:${METHODS_LOG}`);
  const logBefore = logChange ? logAt(mergeBase, logChange.status) : logNow;
  const latest = {};
  const latestFor = (site) =>
    (latest[site] ??= { now: latestMethodsVersion(logNow, site), before: latestMethodsVersion(logBefore, site) });

  const explained = new Set();
  for (const { status, path } of changed) {
    if (!path.startsWith(EMITTED) || status === 'D') continue;
    const now = parse(git('show', `HEAD:${path}`));
    const before = status === 'A' ? null : parse(git('show', `${mergeBase}:${path}`));
    if (reasonFor(before, now, latestFor(path.slice(EMITTED.length).split('/')[0]))) explained.add(path);
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
