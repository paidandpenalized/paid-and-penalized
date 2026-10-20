// CI change gate: emitted data (the golden snapshots) may change only with a reason on record in the same
// change: new source data (every changed emitted file's own source_manifest changed, or the "new-cms-release"
// PR label), a new methods_version heading in the methods log, or a corrections entry. The label exists only on
// PR runs; a re-pin also shows on the push to main after the merge.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const EMITTED = 'data/emitted/';
const LABEL = 'new-cms-release';
export const METHODS_LOG = 'docs/METHODS-LOG.md';
const CORRECTIONS = 'corrections/';
const ADDED_HEADING = /^\+## \S+ methods_version \d+ /m;

const SOURCE_LINE = /^\+"source_manifest": /m;

// True when every changed emitted file's diff section rewrites its source_manifest line (formatEmitted puts it
// on a line of its own).
function allRepinned(changedEmitted, emittedDiff) {
  const sections = new Map(
    emittedDiff
      .split(/^(?=diff --git )/m)
      .map((s) => [/^diff --git a\/(\S+) /.exec(s)?.[1], s])
      .filter(([path]) => path),
  );
  return changedEmitted.every((p) => SOURCE_LINE.test(sections.get(p) ?? ''));
}

// emittedDiff / logDiff: unified diffs of data/emitted/ and of the methods log over the same range.
export function changeGate({ changed, labels, emittedDiff = '', logDiff = '' }) {
  const changedEmitted = changed.filter((p) => p.startsWith(EMITTED));
  if (changedEmitted.length === 0) return { ok: true, reason: 'no emitted data changed' };
  if (allRepinned(changedEmitted, emittedDiff)) return { ok: true, reason: 'emitted data changed with new pinned inputs' };
  if (labels.includes(LABEL)) return { ok: true, reason: `emitted data changed; PR labeled ${LABEL}` };
  if (ADDED_HEADING.test(logDiff)) return { ok: true, reason: 'emitted data changed with a new methods_version' };
  if (changed.some((p) => p.startsWith(CORRECTIONS))) return { ok: true, reason: 'emitted data changed with a corrections entry' };
  return {
    ok: false,
    reason: `${EMITTED} changed without a reason on record: re-pin the inputs (new CMS data), add a new methods_version heading to ${METHODS_LOG} (methods change), or add a file under ${CORRECTIONS} (correction)`,
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

const MAX_DIFF = 512 * 1024 * 1024; // a new site's emitted file arrives as one large added-file diff
const ZERO_SHA = /^0{40}$/;

function main() {
  const given = process.env.GATE_BASE ?? '';
  const base = given === '' || ZERO_SHA.test(given) ? 'HEAD~1' : given;
  const diff = (flags, path = []) => execFileSync('git', ['diff', ...flags, `${base}...HEAD`, '--', ...path], { encoding: 'utf8', maxBuffer: MAX_DIFF });
  const changed = diff(['--name-only', '-z']).split('\0').filter(Boolean);
  const result = changeGate({
    changed,
    labels: parseLabels(process.env.PR_LABELS),
    emittedDiff: diff(['--unified=0'], [EMITTED]),
    logDiff: diff(['--unified=0'], [METHODS_LOG]),
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
