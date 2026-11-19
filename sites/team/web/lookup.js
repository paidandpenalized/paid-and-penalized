// The program page's every-hospital lookup, as the browser fetches it: one row per hospital in the hospital master, codes
// only. Names and places come from the family's search asset (hub/search/asset.js), which the page already loads; this
// asset says only where each CCN stands. Pure: the emitted file in, a plain object out.

// The columns, in order: the CCN, the status code, and its argument as the emitted file gives it (a date, a kind, the
// participation type, a CJR-X pair, or null; sites/team/web/lookup-copy.js reasonText reads them).
export const LOOKUP_COLS = Object.freeze(['ccn', 'code', 'arg']);

export function lookupAsset(team) {
  return { cols: LOOKUP_COLS, rows: Object.entries(team.status).map(([ccn, [code, arg]]) => [ccn, code, arg]) };
}
