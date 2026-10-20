// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change. Per changed emitted file: its own source_manifest changed (new pinned inputs), or its site gained a
// new methods_version heading in the methods log. For the whole change: the "new-cms-release" PR label, or a
// corrections entry. The label exists only on PR runs; a re-pin also shows on the push to main after the merge.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { METHODS_LOG, sitesWithAddedHeading } from '../../pipeline/methods-log.js';

const EMITTED = 'data/emitted/';
const LABEL = 'new-cms-release';
const CORRECTIONS = 'corrections/';

// data/emitted/<site>/fy<YYYY>/<file>.json → <site>
const siteOf = (path) => path.slice(EMITTED.length).split('/')[0];

// repinned: emitted paths whose source_manifest differs from the base. logDiff: unified diff of the methods log.
export function changeGate({ changed, labels, repinned = new Set(), logDiff = '' }) {
  const changedEmitted = changed.filter((p) => p.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (labels.includes(LABEL)) return { ok: true, reason: `emitted data changed; PR labeled ${LABEL}` };
  if (changed.some((p) => p.startsWith(CORRECTIONS))) return { ok: true, reason: 'emitted data changed with a corrections entry' };
  const bumped = sitesWithAddedHeading(logDiff);
  const unexplained = changedEmitted.filter((p) => !repinned.has(p) && !bumped.has(siteOf(p)));
  if (unexplained.length === 0) return { ok: true, reason: 'every emitted change has new pinned inputs or a new methods_version' };
  return {
    ok: false,
    reason: `${unexplained.join(', ')} changed without a reason on record: re-pin the inputs (new CMS data), add a new methods_version heading for the site to ${METHODS_LOG} (methods change), or add a file under ${CORRECTIONS} (correction)`,
  };
}

// PR_LABELS comes from toJSON(github.event.pull_request.labels.*.name): a JSON array, or null on a push.
export function parseLabels(text) {
  if (text === undefined || text === '') return [];
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RangeError('PR_LABELS is not JSON');
  }
  if (value === null) return [];
  if (!Array.isArray(value) || !value.every((l) => typeof l === 'string')) throw new RangeError('PR_LABELS is not an array of strings');
  return value;
}

const ZERO_SHA = /^0{40}$/;
const MAX_FILE = 32 * 1024 * 1024; // emitted files stay under the hook's 10 MiB limit

function main() {
  const given = process.env.GATE_BASE ?? '';
  const base = given === '' || ZERO_SHA.test(given) ? 'HEAD~1' : given;
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_FILE });
  // source_manifest at a revision, or undefined when the file doesn't exist there (added or deleted).
  const sourceAt = (rev, path) => {
    try {
      return JSON.parse(git('show', `${rev}:${path}`)).source_manifest;
    } catch {
      return undefined;
    }
  };
  const changed = git('diff', '--name-only', '-z', `${base}...HEAD`).split('\0').filter(Boolean);
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  const repinned = new Set(
    changed.filter((p) => {
      if (!p.startsWith(EMITTED)) return false;
      const now = sourceAt('HEAD', p);
      return now !== undefined && now !== sourceAt(mergeBase, p);
    }),
  );
  const result = changeGate({
    changed,
    labels: parseLabels(process.env.PR_LABELS),
    repinned,
    logDiff: git('diff', '--unified=0', `${base}...HEAD`, '--', METHODS_LOG),
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
