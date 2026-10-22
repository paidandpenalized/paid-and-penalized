// One program year's self-check, in any era of the program: how close this site's recomputed Total HAC Scores land
// to CMS's published ones, and whether CMS's decisions follow its scores (every hospital it cut scored higher than
// every hospital it didn't). Pure: records in, result out.
//   records  [{ ccn, total, recomputed, decision, noted }]: total, CMS's published score (null: none); recomputed, this
//            site's (null: none); decision, CMS's 'Yes', 'No' or 'N/A' (null: CMS published no decision that year);
//            noted, CMS footnoted the row's score or parts
// A recomputed score that misses CMS's is let pass only on a footnoted row (CMS used a part its file withholds, such as
// a PSI 90 score it marks as not shown); those rows are counted as withheld, never hidden.
import { percentileInc } from '../stats.js';

// A recomputed score may miss CMS's by less than this: CMS rounds the parts and the total to 4 decimals, so a miss at
// or past it is a reproduction failure, not rounding.
export const SCORE_TOLERANCE = 0.001;
// CMS cuts the hospitals whose score is above this percentile of the year's scores.
export const LINE_PERCENTILE = 0.75;

const byTotal = (a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : a.ccn > b.ccn ? 1 : 0);

// The 75th percentile (inclusive definition) of every score CMS published that year; null with none.
export function percentileLine(records) {
  const totals = records.filter((r) => r.total !== null).map((r) => r.total).sort((a, b) => a - b);
  return totals.length ? percentileInc(totals, LINE_PERCENTILE) : null;
}

// Where CMS's line sits as a percentile of every published score: the share of them at or below the highest score
// CMS did not cut.
function linePercentile(records, highestNo) {
  const totals = records.filter((r) => r.total !== null).map((r) => r.total);
  return totals.filter((t) => t <= highestNo).length / totals.length;
}

export function yearCheck(records) {
  const both = records.filter((r) => r.total !== null && r.recomputed !== null);
  const misses = (r) => Math.abs(r.recomputed - r.total) >= SCORE_TOLERANCE;
  const withheld = both.filter((r) => misses(r) && r.noted).map((r) => r.ccn);
  const unexplained = both.filter((r) => misses(r) && !r.noted).map((r) => r.ccn);
  const scored = both.filter((r) => !misses(r) || !r.noted);
  const diffs = scored.map((r) => r.recomputed - r.total);
  const maxError = diffs.reduce((m, d) => Math.max(m, Math.abs(d)), 0);
  // The decided: a score and a Yes or No from CMS, sorted lowest score first, as the rules draw them.
  const decided = records.filter((r) => r.total !== null && (r.decision === 'Yes' || r.decision === 'No')).sort(byTotal);
  const yes = decided.filter((r) => r.decision === 'Yes');
  const no = decided.filter((r) => r.decision === 'No');
  const highestNo = no.length ? no[no.length - 1].total : null;
  const lowestYes = yes.length ? yes[0].total : null;
  // Decisions out of order: a hospital CMS did not cut scoring at or above one it cut. Both ends of any overlap
  // count, so a single swap shows as two.
  const wrongSide = yes.length && no.length && highestNo >= lowestYes
    ? decided.filter((r) => (r.decision === 'No' ? r.total >= lowestYes : r.total <= highestNo)).map((r) => r.ccn)
    : [];
  const p75 = percentileLine(records);
  return {
    scored: scored.length,
    diffs,
    maxError,
    within: diffs.filter((d) => Math.abs(d) < SCORE_TOLERANCE).length,
    withheld,
    unexplained,
    decided: decided.length,
    yes: yes.length,
    highestNo,
    lowestYes,
    wrongSide,
    // Hospitals CMS did not cut that scored exactly at its line (ties at the highest score not cut).
    atLine: no.filter((r) => r.total === highestNo).length,
    // The 75th percentile of the published scores, and whether it falls in CMS's gap (CMS's file reproduces the
    // line), and where CMS's line sits among the published scores.
    p75,
    p75InGap: yes.length > 0 && no.length > 0 && p75 >= highestNo && p75 < lowestYes,
    linePct: yes.length && no.length ? linePercentile(records, highestNo) : null,
    sorted: { scores: decided.map((r) => r.total), yes: decided.map((r) => r.decision === 'Yes') },
    // A year CMS scored no one (FY2023) checks nothing and passes.
    ok: unexplained.length === 0 && maxError < SCORE_TOLERANCE && wrongSide.length === 0,
  };
}
