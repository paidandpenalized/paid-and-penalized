// One program year's self-check, in any era of the program: how close this site's recomputed Total HAC Scores land
// to CMS's published ones, and whether CMS's decisions follow its scores (every hospital it cut scored higher than
// every hospital it didn't). Pure: records in, result out.
//   records  [{ ccn, total, recomputed, decision }]: total, CMS's published score (null: none); recomputed, this site's
//            (null: none); decision, CMS's 'Yes', 'No' or 'N/A' (null: CMS published no decision that year)
// A recomputed score that misses CMS's is let pass only when CMS withheld a part it used (withheldPart: a part missing
// from the file, footnoted, that the published total works out to a valid score for); those rows are counted as
// withheld, never hidden. Any other miss fails the year.
import { domainsOf, publishedParts } from './eras.js';
import { percentileInc } from '../stats.js';

// A recomputed score may miss CMS's by less than this: CMS rounds the parts and the total to 4 decimals, so a miss at
// or past it is a reproduction failure, not rounding.
export const SCORE_TOLERANCE = 0.001;
// CMS cuts the hospitals whose score is above this percentile of the scores of hospitals outside Maryland.
export const LINE_PERCENTILE = 0.75;

const byTotal = (a, b) => a.total - b.total || (a.ccn < b.ccn ? -1 : a.ccn > b.ccn ? 1 : 0);
// CMS's Yes or No: Maryland's hospitals are N/A, so in every year the decided are the scored hospitals outside
// Maryland, the scores CMS takes its percentile over.
const isDecided = (r) => r.total !== null && (r.decision === 'Yes' || r.decision === 'No');

// The 75th percentile (inclusive definition) of the scores of the hospitals CMS made a decision on that year; null
// with none.
export function percentileLine(records) {
  const totals = records.filter(isDecided).map((r) => r.total).sort((a, b) => a - b);
  return totals.length ? percentileInc(totals, LINE_PERCENTILE) : null;
}

// Where CMS's line sits as a percentile of every published score: the share of them at or below the highest score
// CMS did not cut.
function linePercentile(records, highestNo) {
  const totals = records.filter((r) => r.total !== null).map((r) => r.total);
  return totals.filter((t) => t <= highestNo).length / totals.length;
}

// Each part's [lowest, highest] value CMS published that year, by part: measure ids, and 'D1' and 'D2' for the domain
// scores. records: eras.js toRecord() shapes.
export function partRanges(records) {
  const out = {};
  const add = (key, v) => {
    if (v === null || v === undefined) return;
    const r = (out[key] ??= [v, v]);
    if (v < r[0]) r[0] = v;
    if (v > r[1]) r[1] = v;
  };
  for (const rec of records) {
    for (const [id, v] of Object.entries(rec.z)) add(id, v);
    add('D1', rec.d1);
    add('D2', rec.d2);
  }
  return out;
}

// The part CMS used but didn't publish that a row's total implies, when the parts it did publish don't add up to the
// total: a part missing from the file whose own footnote CMS filled (it withheld the part), and whose value, solved
// from the total and the published parts by the year's rule, is a score that part takes that year: within the year's
// published range of it and, in a year scored in tenths, a whole score from 1 to 10. CMS rounds the total, so the
// solved part is known to within SCORE_TOLERANCE over the part's weight in it. null when no such part explains the row.
//   rec     eras.js toRecord() with notes: the set of parts CMS footnoted (eras.js partNotes)
//   rule    eras.js ruleFor(fy); ranges: partRanges() of the year; scale: the year's, 'z' or 'tenths'
//   'equal' solves for the one missing z-score; 'domains' for the missing domain (Domain 1 or Domain 2).
export function withheldPart(rec, rule, ranges, scale) {
  if (rec.total === null) return null;
  // A solved part must lie in the year's published range for it; a single measure's score in tenths (Domain 1 is
  // PSI 90's alone) must also be a whole number from 1 to 10. Domain 2, an average, need not be whole.
  const valid = (key, v, weight, single) => {
    const slack = SCORE_TOLERANCE / weight;
    if (!ranges[key] || v < ranges[key][0] - slack || v > ranges[key][1] + slack) return false;
    const whole = Math.round(v);
    return scale !== 'tenths' || !single || (Math.abs(v - whole) < slack && whole >= 1 && whole <= 10);
  };
  if (rule.rule === 'equal') {
    const have = publishedParts(rec);
    const weight = 1 / (have.length + 1);
    const v = rec.total / weight - have.reduce((s, z) => s + z, 0);
    return Object.keys(rec.z).find((id) => rec.z[id] === null && rec.notes.has(id) && valid(id, v, weight, true)) ?? null;
  }
  const [d1, d2] = domainsOf(rec);
  const [w1, w2] = rule.weights;
  // Domain 1 is withheld when CMS footnoted it or PSI 90, its one measure.
  if (d1 === null && d2 !== null && (rec.notes.has('D1') || rec.notes.has('PSI90'))) return valid('D1', (rec.total - w2 * d2) / w1, w1, true) ? 'D1' : null;
  if (d2 === null && d1 !== null && rec.notes.has('D2')) return valid('D2', (rec.total - w1 * d1) / w2, w2, false) ? 'D2' : null;
  return null;
}

// withheldOf(record): the part CMS withheld that explains a record's miss (withheldPart), or null; by default none is.
export function yearCheck(records, withheldOf = () => null) {
  const both = records.filter((r) => r.total !== null && r.recomputed !== null);
  const misses = (r) => Math.abs(r.recomputed - r.total) >= SCORE_TOLERANCE;
  const explained = new Set(both.filter((r) => misses(r) && withheldOf(r) !== null));
  const withheld = both.filter((r) => explained.has(r)).map((r) => r.ccn);
  const unexplained = both.filter((r) => misses(r) && !explained.has(r)).map((r) => r.ccn);
  const scored = both.filter((r) => !explained.has(r));
  const diffs = scored.map((r) => r.recomputed - r.total);
  const maxError = diffs.reduce((m, d) => Math.max(m, Math.abs(d)), 0);
  // The decided: a score and a Yes or No from CMS, sorted lowest score first, as the rules draw them.
  const decided = records.filter(isDecided).sort(byTotal);
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
    // The 75th percentile of the decided scores; whether it falls in CMS's gap (the published scores reproduce the
    // cut); how many hospitals scored above it and were not cut (CMS's line sits that many hospitals higher); and
    // where CMS's line sits among every published score (Maryland's too), as the hospital page draws it.
    p75,
    p75InGap: yes.length > 0 && no.length > 0 && p75 >= highestNo && p75 < lowestYes,
    aboveNotCut: yes.length && no.length ? no.filter((r) => r.total > p75).length : null,
    linePct: yes.length && no.length ? linePercentile(records, highestNo) : null,
    lineShare: yes.length && no.length ? no.length / decided.length : null,
    sorted: { scores: decided.map((r) => r.total), yes: decided.map((r) => r.decision === 'Yes') },
    // A year CMS scored no one (FY2023) checks nothing and passes.
    ok: unexplained.length === 0 && maxError < SCORE_TOLERANCE && wrongSide.length === 0,
  };
}
