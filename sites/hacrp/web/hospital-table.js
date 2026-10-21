// The program page's hospital table, as plain functions the page build (generate.js, hospitalRows) and the browser
// (client/program.js) share: the default order, the reader's sort, the state and name filters, and the #state=XX
// fragment that keeps the chosen state in the URL. Rows are the hospitals asset's: [ccn, name, city, state, total,
// decision], the total as CMS published it, with its hyphen-minus ("N/A" when CMS published none); the browser shows
// it with a true minus. No DOM.

import { compareNumbers } from '../../../engine/js/stats.js';

// Each column's place in a row; all but the CCN are sortable.
const INDEX = Object.freeze({ ccn: 0, name: 1, city: 2, state: 3, score: 4, decision: 5 });
const SORTABLE = ['name', 'city', 'state', 'score', 'decision'];
// One collator for every text comparison (building one per comparison is what localeCompare costs).
const text = new Intl.Collator('en').compare;
// Rows by these columns' text, in turn.
const by = (...keys) => (x, y) => keys.reduce((d, k) => d || text(x[INDEX[k]], y[INDEX[k]]), 0);

// The default order: state, then name, then city, then CCN (so it never depends on the input's order).
export const compareDefault = by('state', 'name', 'city', 'ccn');
// The search's order: name, then state, then city.
export const compareByName = by('name', 'state', 'city');

// The state codes in the rows, in order.
export const stateCodes = (rows) => [...new Set(rows.map((r) => r[INDEX.state]))].sort(text);

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

// The fragment with its state= part set to code (or removed when code is null); every other part is kept.
export function withState(hash, code) {
  const parts = String(hash ?? '').replace(/^#/, '').split('&').filter((p) => p && !/^state=/.test(p));
  if (code) parts.push(`state=${code}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

// A Total HAC Score as a number, from CMS's own decimal text (hyphen-minus); NaN for "N/A", blank or anything else.
export function scoreOf(s) {
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// A sorted copy: by key ('name', 'city', 'state', 'score' or 'decision') in dir 1 (ascending) or -1, ties kept in the
// order given; with no key, the default order. Scores sort by value with "N/A" last in either direction. Filtering a
// sorted list keeps its order, so the browser sorts once per sort change and filters that order as the reader types.
export function sortRows(rows, key, dir) {
  if (key === null || key === undefined) return [...rows].sort(compareDefault);
  if (!SORTABLE.includes(key)) throw new RangeError(`sortRows: unknown key "${key}"`);
  const i = INDEX[key];
  if (key !== 'score') return [...rows].sort((a, b) => dir * text(a[i], b[i]));
  return [...rows].sort((a, b) => compareNumbers(scoreOf(a[i]), scoreOf(b[i]), dir));
}

// Rows in state (when given) whose name holds query (trimmed, any case), in the order given.
export function filterRows(rows, { state = null, query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => (!state || r[INDEX.state] === state) && (!q || r[INDEX.name].toLowerCase().includes(q)));
}
