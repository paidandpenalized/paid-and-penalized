// The corrections log's one naming rule, read by the change gate (tools/ci/change-gate.js), which keeps the log
// append-only, and by the hub's corrections page (hub/corrections.js), which shows it: the folder, and the path a
// dated entry has. Pure: no file access.
export const CORRECTIONS = 'corrections/';
const ENTRY_NAME = /^corrections\/((\d{4})-(\d{2})-(\d{2}))-([a-z0-9][a-z0-9-]*)\.md$/;

// A dated entry's path, corrections/YYYY-MM-DD-<slug>.md with a date from 2000 on that exists on the calendar:
// { date: 'YYYY-MM-DD', slug }. null for any other path.
export function parseEntry(path) {
  const m = ENTRY_NAME.exec(path);
  if (!m) return null;
  const [y, mo, d] = m.slice(2, 5).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = y >= 2000 && date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return real ? { date: m[1], slug: m[5] } : null;
}

export const isEntry = (path) => parseEntry(path) !== null;
