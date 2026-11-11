// One hospital of the emitted scenario file (data/emitted/medicaid/fy<YYYY>/medicaid.json) at the reader's use rate:
// its rows by CCN, whether step 1 draws it (its share of patient revenue lost in each case), the three cases' results
// (the file's own middle-case numbers at the default use rate), and, when it has no loss to draw, why. Shared by the
// work-requirement pages (sites/work-requirement/) and the hub's hospital pages (hub/hospital/medicaid.js), so both
// show one hospital the same way. Pure: imports only its sibling.
//
// A record (rec) is a hospital row zipped by the file's column names (scenario.js rowToBase), or the same fields from the
// work-requirement page's per-state asset. declines: the state's { low, middle, high } enrollment declines (the file's
// states[code].declines; null outside a scenario state).
import { PARAMS, rowToBase, scenario } from './scenario.js';

// The three cases, low to high losses (the file's scenarios[].id), in the order every list here gives them.
export const CASES = Object.freeze(['low', 'middle', 'high']);

// The file's hospital rows by CCN, in the file's order. columns: the file's `columns`; rows: its `hospitals`.
export function rowsByCcn(columns, rows) {
  const ccn = columns.indexOf('ccn');
  if (ccn < 0) throw new RangeError('medicaid file: no ccn column');
  return new Map(rows.map((row) => [row[ccn], row]));
}

// ---------- step 1's shares ----------

// Shares are kept to 7 places (a tenth of a basis point), in the build and in the browser's assets, so both lay a
// hospital's dots out from the same numbers.
const SHARE_PLACES = 1e7;
const shareOf = (lost, npr) => Math.round((lost / npr) * SHARE_PLACES) / SHARE_PLACES;

// The share of its patient revenue a hospital could lose in each case at the default use rate, [low, middle, high], or
// null when step 1 does not draw it: outside a scenario state, a filing error screened out, no patient revenue to
// measure against, or a loss that rounds to nothing in a case (no Medicaid revenue, no expansion share, or a few dollars).
export const drawnShares = (rec, declines) => drawnFrom(rec, () => engineResults(rec, declines));
// The same from the engine's results at the default use rate (a thunk, run only for a hospital step 1 may draw).
function drawnFrom(rec, resultsOf) {
  if (rec.cls !== 'scenario' || !rec.scored || !(rec.net_patient_revenue > 0)) return null;
  const shares = resultsOf().map((x) => shareOf(x.lost, rec.net_patient_revenue));
  return shares.every((v) => v > 0) ? shares : null;
}

// ---------- the three cases ----------

// The file's own middle-case results at the default use rate (columns), by the engine's result key.
export const MIDDLE_KEYS = Object.freeze({
  middle_lost: 'lost', middle_added_uncompensated: 'addedUncompensated', middle_operating_margin: 'operatingMargin',
  middle_operating_margin_after: 'operatingMarginAfter', middle_total_margin_after: 'totalMarginAfter',
});

// The engine's result for each case at a use rate, [low, middle, high]. At the default use rate the middle case takes the
// file's own results (MIDDLE_KEYS) where the file gives them, so a page prints the emitted numbers; the engine's agree
// with them to the file's rounding.
export const caseResults = (rec, declines, use = PARAMS.useDefault) => withOwnMiddle(rec, engineResults(rec, declines, use), use);
// The engine's own result for each case, [low, middle, high].
const engineResults = (rec, declines, use = PARAMS.useDefault) => CASES.map((c) => scenario(rec, rec.share, declines[c], { use }));
// results with the middle case's replaced by the file's own (MIDDLE_KEYS) at the default use rate; a new array.
function withOwnMiddle(rec, results, use) {
  if (use !== PARAMS.useDefault) return results;
  const middle = CASES.indexOf('middle');
  const own = { ...results[middle] };
  for (const [col, key] of Object.entries(MIDDLE_KEYS)) if (rec[col] !== null && rec[col] !== undefined) own[key] = rec[col];
  return results.map((x, i) => (i === middle ? own : x));
}

// ---------- why a hospital has no loss to draw ----------

// Why a hospital has no figure, or null when it has a loss to draw (drawn: drawnShares gave its shares): away_<why> (not
// in the file: away is 'inactive', 'kind' or 'newer'), its class (outside a scenario state, or no cost report), or, in a
// scenario state, what its cost report shows: a filing error screened out (negative, exceeds), no Medicaid revenue, no patient
// revenue, no expansion share (no_share), or a loss too small to draw (tiny: under TINY_SHARE of patient revenue in the
// low case, which step 1's 7-place shares round to nothing). Anything else step 1 leaves out has no reason to give, so
// it throws at the build and in tests; the browser passes lenient and gets 'unforeseen', a generic reason, rather than a
// broken page.
const TINY_SHARE = 0.5 / SHARE_PLACES;
export function reasonOf({ away = null, cls, rec, drawn, declines, lenient = false, ccn }) {
  if (away) return `away_${away}`;
  if (cls !== 'scenario') return cls;
  if (drawn) return null;
  if (!rec.scored) return (rec.flags ?? []).includes('negative_medicaid_revenue') ? 'negative' : 'exceeds';
  if (!(rec.medicaid_net_revenue > 0)) return 'no_medicaid';
  if (!(rec.net_patient_revenue > 0)) return 'no_npr';
  if (!(rec.share > 0)) return 'no_share';
  if ((rec.medicaid_net_revenue * rec.share * declines[CASES[0]]) / rec.net_patient_revenue < TINY_SHARE) return 'tiny';
  if (lenient) return 'unforeseen';
  throw new RangeError(`hospital ${ccn}: step 1 leaves it out with no reason to give`);
}

// ---------- one hospital, at the default use rate ----------

// A hospital of the file as a page shows it at the default use rate, or null when the file has no row for it. file:
// { columns, hospitals (rowsByCcn's map), states } (the file's, as its readers decode it). { ccn, state, stateName, cls,
// reason, shares }: reason as reasonOf gives it (null with a loss to draw); shares, with a loss to draw, the share of its
// patient revenue lost in each case, [low, middle, high], from caseResults (the file's own middle case), else null.
export function hospitalScenario(file, ccn) {
  const row = file.hospitals.get(ccn);
  if (!row) return null;
  const rec = rowToBase(file.columns, row);
  const st = file.states[rec.state];
  if (!st) throw new RangeError(`hospital ${ccn}: its state, ${rec.state}, is not in the file's states`);
  // The engine runs once: step 1's drawn test reads its own results, the shares the file's own middle case.
  let results = null;
  const resultsOf = () => (results ??= engineResults(rec, st.declines));
  const drawn = drawnFrom(rec, resultsOf) !== null;
  const reason = reasonOf({ cls: rec.cls, rec, drawn, declines: st.declines, ccn });
  const shares = reason ? null : withOwnMiddle(rec, resultsOf(), PARAMS.useDefault).map((x) => x.lost / rec.net_patient_revenue);
  return { ccn, state: rec.state, stateName: st.name, cls: rec.cls, reason, shares };
}
