// The program page's hospital table, as plain functions the page build (generate.js, hospitalRows) and the browser
// (client/program.js) share: the default order, the reader's sort, the state and name filters, and the #state=XX
// fragment that keeps the chosen state in the URL. Rows are the hospitals asset's: [ccn, name, city, state, total,
// decision, zip, cut], the total as CMS published it, with its hyphen-minus ("N/A" when CMS published none; the browser
// shows it with a true minus), and cut this site's estimate of the HAC cut in whole dollars (null: no estimate). The
// sort and the filters take them through tableRows. No DOM.

import { compareNumbers, numberOrNaN } from '../../../engine/js/stats.js';

// The asset row's columns, in order: each one's key, its place in a row (index), its head's copy key (label; the CCN and
// the ZIP code are not columns of the table) and whether it sorts by value (numeric: with no value (NaN) last either way,
// reading tableRows' field of the same name). Every column shown is sortable.
export const COLUMNS = Object.freeze([
  { key: 'ccn', index: 0 },
  { key: 'name', index: 1, label: 'tableColName' },
  { key: 'city', index: 2, label: 'tableColCity' },
  { key: 'state', index: 3, label: 'tableColState' },
  { key: 'score', index: 4, label: 'tableColScore', numeric: true },
  { key: 'decision', index: 5, label: 'tableColDecision' },
  { key: 'zip', index: 6 },
  { key: 'money', index: 7, label: 'tableColMoney', numeric: true },
]);
const COLUMN = Object.freeze(Object.fromEntries(COLUMNS.map((c) => [c.key, c])));
const INDEX = Object.freeze(Object.fromEntries(COLUMNS.map((c) => [c.key, c.index])));
// The columns the table shows, and the keys of the ones it right-aligns (the numeric ones).
export const SHOWN = Object.freeze(COLUMNS.filter((c) => c.label));
export const NUMERIC = new Set(COLUMNS.filter((c) => c.numeric).map((c) => c.key));
// A row's cell in a column, by key.
export const cellOf = (cells, key) => cells[INDEX[key]];
// One collator for every text comparison (building one per comparison is what localeCompare costs).
const text = new Intl.Collator('en').compare;
// Rows by these columns' text, in turn.
const by = (...keys) => (x, y) => keys.reduce((d, k) => d || text(x[INDEX[k]], y[INDEX[k]]), 0);

// The default order: state, then name, then city, then CCN (so it never depends on the input's order).
export const compareDefault = by('state', 'name', 'city', 'ccn');
// The search's order: name, then state, then city.
export const compareByName = by('name', 'state', 'city');

// A hospital's page: under prefix (the asset's hospitalPath), at its CCN in lowercase.
export const hospitalHref = (prefix, ccn) => `${prefix}${ccn.toLowerCase()}/`;

// The state codes in the rows, in order.
export const stateCodes = (rows) => [...new Set(rows.map((r) => cellOf(r, 'state')))].sort(text);

// The state a fragment names: "#state=xx" (any case) for a code in codes, as an uppercase code; else null. Other
// parts of the fragment are ignored, and the first part that names a known code wins.
export function decodeState(hash, codes) {
  const known = new Set(codes);
  for (const part of String(hash ?? '').replace(/^#/, '').split('&')) {
    const m = /^state=([A-Za-z]{2})$/.exec(part);
    if (m && known.has(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return null;
}

// The fragment that opens the program page on a state (decodeState reads it back): "#state=XX".
export const stateHref = (code) => withState('', code);

// The fragment with its state= part set to code (or removed when code is null); every other part is kept.
export function withState(hash, code) {
  const parts = String(hash ?? '').replace(/^#/, '').split('&').filter((p) => p && !/^state=/.test(p));
  if (code) parts.push(`state=${code}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

// A hospital as the search lists it: "Name, City, ST".
export const hospitalLabel = (cells) => `${cellOf(cells, 'name')}, ${cellOf(cells, 'city')}, ${cellOf(cells, 'state')}`;
// What a query is matched against, in lowercase: the label and the CCN, so a name, a city or a CCN finds the
// hospital. The search box and the table's filter share it, so both find the same hospitals.
export const searchKey = (cells) => `${hospitalLabel(cells)} ${cellOf(cells, 'ccn')}`.toLowerCase();

// The rows the browser sorts and filters, each read once when the asset loads: { cells, key, score }, with cells the
// asset's row, key its searchKey (the text filter) and score as a number (the score sort; NaN for "N/A" or blank).
// The score text is CMS's decimal text, which the build checked when it read CMS's file, so numberOrNaN reads it.
export const tableRows = (rows) =>
  rows.map((cells) => ({ cells, key: searchKey(cells), score: numberOrNaN(cellOf(cells, 'score')), money: Number.isFinite(cellOf(cells, 'money')) ? cellOf(cells, 'money') : NaN }));

// A sorted copy of tableRows: by key ('name', 'city', 'state', 'score', 'decision' or 'money', the estimated cut) in
// dir 1 (ascending) or -1, ties kept in the order given; with no key, the default order. Scores and dollars sort by
// value with none ("N/A", no estimate) last in either direction.
// Filtering a sorted list keeps its order, so the browser sorts once per sort change and filters that order as the
// reader types.
export function sortRows(rows, key, dir) {
  if (key === null || key === undefined) return [...rows].sort((a, b) => compareDefault(a.cells, b.cells));
  if (!COLUMN[key]?.label) throw new RangeError(`sortRows: unknown key "${key}"`);
  if (!NUMERIC.has(key)) return [...rows].sort((a, b) => dir * text(cellOf(a.cells, key), cellOf(b.cells, key)));
  return [...rows].sort((a, b) => compareNumbers(a[key], b[key], dir));
}

// tableRows in state (when given) whose name, city or CCN holds query (trimmed, any case; searchKey), in the order
// given.
export function filterRows(rows, { state = null, query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => (!state || cellOf(r.cells, 'state') === state) && (!q || r.key.includes(q)));
}
