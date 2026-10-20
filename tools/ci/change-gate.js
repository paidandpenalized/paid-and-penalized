// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. Per changed emitted file, one of:
//   - it is new (a first emission: nothing published to differ from);
//   - one of its pinned inputs has a new SHA-256 (new source data);
//   - its methods_version moved to its site's new newest version in the methods log (a methods change).
// Or, for the whole change, a file under corrections/. The evidence is all in the tree, so PR runs and the push
// to main after the merge reach the same verdict.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { METHODS_LOG, latestMethodsVersion } from '../../pipeline/methods-log.js';

const EMITTED = 'data/emitted/';
const CORRECTIONS = 'corrections/';
const MANIFEST = 'data/pinned/manifest.json';

// added, repinned, bumped: sets of emitted paths explained by each reason.
export function changeGate({ changed, added = new Set(), repinned = new Set(), bumped = new Set() }) {
  const changedEmitted = changed.filter((p) => p.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some((p) => p.startsWith(CORRECTIONS))) return { ok: true, reason: 'emitted data changed with a corrections entry' };
  const unexplained = changedEmitted.filter((p) => !added.has(p) && !repinned.has(p) && !bumped.has(p));
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change is new, re-pinned, or a new methods_version' };
  return {
    ok: false,
    reason: `${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), bump the site's methods_version with a new heading in ${METHODS_LOG} (methods change), or add a file under ${CORRECTIONS} (correction)`,
  };
}

const ZERO_SHA = /^0{40}$/;
const MAX_FILE = 32 * 1024 * 1024; // emitted files stay under the hook's 10 MiB limit

function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_FILE });
  const exists = (object) => {
    try {
      execFileSync('git', ['cat-file', '-e', object], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  const given = process.env.GATE_BASE ?? '';
  // Only the first push of a branch has no base. A base that can't be found (a force-push) fails the gate
  // rather than shrinking the range it checks.
  const base = given === '' || ZERO_SHA.test(given) ? 'HEAD~1' : given;
  if (!exists(`${base}^{commit}`)) throw new Error(`base ${base} is not in this history (force-push?); check the range by hand`);
  // A file's content at a revision, or null only when the path is absent there; other git errors throw.
  const read = (rev, path) => (exists(`${rev}:${path}`) ? git('show', `${rev}:${path}`) : null);
  const json = (rev, path) => JSON.parse(read(rev, path) ?? 'null');

  const changed = git('diff', '--name-only', '-z', `${base}...HEAD`).split('\0').filter(Boolean);
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  const pins = (rev) => new Map((json(rev, MANIFEST) ?? []).map((e) => [e.id, e.sha256]));
  const [pinsNow, pinsBefore] = [pins('HEAD'), pins(mergeBase)];
  const inputs = (data, map) => data.sources.map((id) => map.get(id) ?? '').join(',');
  const logNow = read('HEAD', METHODS_LOG) ?? '';
  const logBefore = read(mergeBase, METHODS_LOG) ?? '';

  const added = new Set();
  const repinned = new Set();
  const bumped = new Set();
  for (const p of changed.filter((path) => path.startsWith(EMITTED))) {
    const now = json('HEAD', p);
    const before = json(mergeBase, p);
    if (now === null) continue; // deleted: needs a corrections entry
    if (before === null) {
      added.add(p);
      continue;
    }
    if (inputs(now, pinsNow) !== inputs(before, pinsBefore)) repinned.add(p);
    const site = p.slice(EMITTED.length).split('/')[0];
    const latest = latestMethodsVersion(logNow, site);
    if (now.methods_version !== before.methods_version && now.methods_version === latest && latest > (latestMethodsVersion(logBefore, site) ?? 0)) {
      bumped.add(p);
    }
  }
  const result = changeGate({ changed, added, repinned, bumped });
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
