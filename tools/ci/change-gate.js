// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. Per changed emitted file: the SHA-256 of one of its pinned inputs changed (new source data), or its
// site's newest methods_version in the methods log went up. For the whole change: a corrections entry. The
// same evidence is in the tree on PR runs and on the push to main after the merge.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { METHODS_LOG, sitesBumped } from '../../pipeline/methods-log.js';

const EMITTED = 'data/emitted/';
const CORRECTIONS = 'corrections/';

// data/emitted/<site>/fy<YYYY>/<file>.json → <site>
const siteOf = (path) => path.slice(EMITTED.length).split('/')[0];

// repinned: emitted paths with a pinned input whose SHA-256 changed. bumped: sites whose methods_version went up.
export function changeGate({ changed, repinned = new Set(), bumped = new Set() }) {
  const changedEmitted = changed.filter((p) => p.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (changed.some((p) => p.startsWith(CORRECTIONS))) return { ok: true, reason: 'emitted data changed with a corrections entry' };
  const unexplained = changedEmitted.filter((p) => !repinned.has(p) && !bumped.has(siteOf(p)));
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change has new pinned inputs or a new methods_version' };
  return {
    ok: false,
    reason: `${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), add a new methods_version heading for the site to ${METHODS_LOG} (methods change), or add a file under ${CORRECTIONS} (correction)`,
  };
}

const ZERO_SHA = /^0{40}$/;
const MAX_FILE = 32 * 1024 * 1024; // emitted files stay under the hook's 10 MiB limit

const MANIFEST = 'data/pinned/manifest.json';

function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_FILE });
  const exists = (rev) => {
    try {
      git('cat-file', '-e', `${rev}^{commit}`);
      return true;
    } catch {
      return false;
    }
  };
  const given = process.env.GATE_BASE ?? '';
  // A new branch has no before; after a force-push the old tip is gone. Either way, check the last commit.
  const base = given !== '' && !ZERO_SHA.test(given) && exists(given) ? given : 'HEAD~1';
  const show = (rev, path, fallback) => {
    try {
      return git('show', `${rev}:${path}`);
    } catch {
      return fallback;
    }
  };
  const json = (rev, path) => JSON.parse(show(rev, path, 'null'));
  const changed = git('diff', '--name-only', '-z', `${base}...HEAD`).split('\0').filter(Boolean);
  const mergeBase = git('merge-base', base, 'HEAD').trim();

  // A file is re-pinned when one of its sources has a different SHA-256 (or the file is new). Metadata edits
  // to a manifest entry (dates, titles) don't count.
  const pins = (rev) => new Map((json(rev, MANIFEST) ?? []).map((e) => [e.id, e.sha256]));
  const [pinsNow, pinsBefore] = [pins('HEAD'), pins(mergeBase)];
  const inputs = (data, map) => (data?.sources ?? []).map((id) => map.get(id) ?? '').join(',');
  const repinned = new Set(
    changed.filter((p) => {
      if (!p.startsWith(EMITTED)) return false;
      const now = json('HEAD', p);
      if (now === null) return false;
      const before = json(mergeBase, p);
      return before === null || inputs(now, pinsNow) !== inputs(before, pinsBefore);
    }),
  );
  const result = changeGate({
    changed,
    repinned,
    bumped: sitesBumped(show(mergeBase, METHODS_LOG, ''), show('HEAD', METHODS_LOG, '')),
  });
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
