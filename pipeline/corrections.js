// The corrections log's one naming rule, read by the change gate (tools/ci/change-gate.js), which keeps the log
// append-only, and by the hub's corrections page (hub/corrections.js), which shows it: the folder, and the path a
// dated entry has. Pure: no file access.
import { isIsoDate } from '../web/render/format.js';

export const CORRECTIONS = 'corrections/';
const ENTRY_NAME = /^corrections\/((\d{4})-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/;

// A dated entry's path, corrections/YYYY-MM-DD-<slug>.md with a date from 2000 on that exists on the calendar:
// { date: 'YYYY-MM-DD', slug }. null for any other path.
export function parseEntry(path) {
  const m = ENTRY_NAME.exec(path);
  return m && Number(m[2]) >= 2000 && isIsoDate(m[1]) ? { date: m[1], slug: m[3] } : null;
}

export const isEntry = (path) => parseEntry(path) !== null;
