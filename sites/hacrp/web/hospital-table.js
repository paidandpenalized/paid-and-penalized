// The program page's hospital table, as plain functions the page build (generate.js, hospitalRows) and the browser
// (client/program.js) share: the default order, the reader's sort, the state and name filters, and the #state=XX
// fragment that keeps the chosen state in the URL. Rows are the hospitals asset's: [ccn, name, city, state, total,
// decision], the total as CMS's text with a true minus ("N/A" when CMS published none). No DOM.

// Each sortable column's place in a row.
const INDEX = Object.freeze({ name: 1, city: 2, state: 3, score: 4, decision: 5 });
const text = (a, b) => a.localeCompare(b, 'en');

// The default order: state, then name, then city, then CCN (so it never depends on the input's order).
export const compareDefault = (x, y) => text(x[3], y[3]) || text(x[1], y[1]) || text(x[2], y[2]) || text(x[0], y[0]);

// The state codes in the rows, in order.
export const stateCodes = (rows) => [...new Set(rows.map((r) => r[3]))].sort(text);

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

// A Total HAC Score's text as a number (CMS's decimal text with a true or hyphen minus); NaN for "N/A" or blank.
export function scoreOf(s) {
  const t = String(s).replace(/^−/, '-');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// A sorted copy: by key ('name', 'city', 'state', 'score' or 'decision') in dir 1 (ascending) or -1, ties kept in the
// order given; with no key, the default order. Scores sort by value with "N/A" last in either direction.
export function sortRows(rows, key, dir) {
  if (key === null || key === undefined) return [...rows].sort(compareDefault);
  if (!Object.hasOwn(INDEX, key)) throw new RangeError(`sortRows: unknown key "${key}"`);
  const i = INDEX[key];
  if (key !== 'score') return [...rows].sort((a, b) => dir * text(a[i], b[i]));
  return [...rows].sort((a, b) => {
    const [x, y] = [scoreOf(a[i]), scoreOf(b[i])];
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) - Number.isNaN(y);
    return dir * (x - y);
  });
}

// Rows in state (when given) whose name holds query (trimmed, any case), in the order given.
export function filterRows(rows, { state = null, query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => (!state || r[3] === state) && (!q || r[1].toLowerCase().includes(q)));
}
