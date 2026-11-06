// The place page's hospitals table, as plain functions the page's script (place-tables.js) calls and a test can run: the rows of the
// rows asset (figures/place-table-data.js placeRowsAsset) kept for one place, filtered and sorted, and the CSV file cut down to the
// rows that pass. No DOM here.
import { CCN } from '../../../engine/js/ccn.js';
import { CONDS } from '../../../engine/js/hrrp/formula.js';
import { applyFilters } from '../../../engine/js/hrrp/filters.js';
import { STATE_OF } from '../web/figures/glyph.js';
import { PLACE_ROW_FIELDS } from '../web/figures/place-table-data.js';

// asset: the parsed JSON; scope: { cbsa }, { states: [codes] } (a place page's data attributes) or { all: true } (the program page's explorer). Returns [{ h, states, rank, text }] in the
// asset's order (largest cut first), ranked from 1 within the scope. A row with a bad CCN or condition string is dropped; an asset
// without the fields it should have throws.
export function placeRows(asset, scope) {
  const at = Object.fromEntries(PLACE_ROW_FIELDS.map((k) => [k, asset.fields.indexOf(k)]));
  if (Object.values(at).includes(-1) || !Array.isArray(asset.rows) || !Array.isArray(asset.conditions)) throw new Error('place rows: the asset is missing fields');
  const states = new Set(scope.states ?? []);
  const kept = asset.rows.filter((r) => CCN.test(r[at.id]) && /^[cbfn]{6}$/.test(r[at.conds]) && (scope.all || (scope.cbsa ? r[at.cbsa] === scope.cbsa : states.has(r[at.st]))));
  return kept.map((r, i) => {
    const h = Object.fromEntries(PLACE_ROW_FIELDS.filter((k) => k !== 'conds').map((k) => [k, r[at[k]]]));
    const states = [...r[at.conds]].map((c) => STATE_OF[c]);
    // The shape applyFilters reads: a condition "counts" for the filter when the glyph shows it counted (the same word the reader sees).
    h.c = Object.fromEntries(CONDS.map((k, j) => [k, { flag: states[j] === 'counted' ? 1 : 0 }]));
    return { h, states, rank: i + 1 };
  });
}

// want: { text, st, peer, cond (a condition's index in program order), teach, beds (a band), loc ('urban' | 'rural'), pen (penalized only) };
// an empty value filters nothing. The program page's rules, not a copy of them: engine/js/hrrp/filters.js applyFilters.
export function filterRows(rows, want) {
  const kept = new Set(applyFilters(rows.map((r) => r.h), {
    text: want.text, penalized: Boolean(want.pen), st: want.st || null, peer: want.peer ? Number(want.peer) : null, teach: want.teach || null,
    beds: want.beds || null, urban: want.loc ? want.loc === 'urban' : null, cond: want.cond ? CONDS[Number(want.cond)] : null,
  }));
  return rows.filter((r) => kept.has(r.h));
}

// Highest first, a blank last, ties in the table's own order (rank: cut, then dollars, then CCN).
const SORTS = {
  cut: (a, b) => a.rank - b.rank,
  dollars: (a, b) => (b.h.pen ?? -1) - (a.h.pen ?? -1) || a.rank - b.rank,
  name: (a, b) => a.h.name.localeCompare(b.h.name, 'en') || a.rank - b.rank,
  beds: (a, b) => (b.h.beds ?? -1) - (a.h.beds ?? -1) || a.rank - b.rank,
};
export const sortRows = (rows, key) => [...rows].sort(SORTS[key] ?? SORTS.cut);

// The file's records (a quoted cell may hold a line break), each with its line end.
function records(text) {
  const out = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    else if (text[i] === '\n' && !quoted) { out.push(text.slice(start, i + 1)); start = i + 1; }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// The CSV text cut to the hospitals in ids, in that order, the header kept; each line exactly as the file wrote it (its guards and
// quotes). The CCN is the first cell, plain text. A hospital the file does not hold is skipped.
export function csvSubset(text, ids) {
  const [header, ...lines] = records(text);
  const byCcn = new Map(lines.map((line) => [line.slice(0, line.indexOf(',')), line]));
  return [header, ...ids.map((id) => byCcn.get(id)).filter(Boolean)].join('');
}
