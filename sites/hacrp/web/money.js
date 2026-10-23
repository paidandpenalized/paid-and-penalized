// A hospital's dollars as the pages show them: this site's estimate (data/emitted/dollars, loaded by data.js), never
// CMS's. Plain numbers and the few facts the words need; the pages format them. A hospital without an estimate
// (Maryland's, the Pennsylvania Rural Health Model's, or one with no usable impact-file row) carries only its status.

import { money } from '../../../web/render/format.js';
import { fill } from './copy.js';

// What the inpatient payment is made of, in the order the statement lists it: the base the readmissions and
// value-based programs adjust (the federal DRG payment and the Medicare-dependent hospital add-on), then the rest
// (imeMa: the teaching payments on Medicare Advantage stays, which the HAC cut is taken on and the others are not).
export const BASE_PARTS = ['fed', 'mdhAddon'];
export const OTHER_PARTS = ['ime', 'imeMa', 'dsh', 'outlierOp', 'schDiff', 'lowVolume', 'capital', 'uc'];

// A hospital's HAC cut as the tables and the figures show it, this site's estimate in whole dollars: the size of the
// HAC adjustment (the dollars at stake for a hospital CMS cut, 0 for one it didn't), 0 for Maryland's (exempt), null
// with no estimate. row: the hospital's row of the dollar estimates.
export function cutDollars(row) {
  if (!row) throw new RangeError('cutDollars: a row of the dollar estimates is required');
  if (row.status === 'maryland') return 0;
  return row.status === 'estimated' ? -row.hac + 0 : null; // + 0: never -0
}

// A hospital's HAC cut in a table cell (cutDollars's number): the dollars, or the words where there is no estimate.
export const cutText = (dollars) => (Number.isFinite(dollars) ? money(dollars) : fill('tableMoneyNone'));

// ---------- the likely ranges (the back-test's bands: dollars.json `bands`) ----------

// [low, high] in whole dollars, low first: an estimate times two multipliers. A range has two ends: an estimate of $0
// (a net with nothing to net, a hospital no program moves) has none, so null.
function scaled(estimate, a, b) {
  if (!Number.isFinite(estimate)) throw new RangeError(`a likely range needs an estimate, not ${estimate}`);
  if (estimate === 0) return null;
  const [x, y] = [Math.round(estimate * a), Math.round(estimate * b)];
  return x <= y ? [x, y] : [y, x];
}

// A hospital's likely range for one measure ('hac' for its dollars at stake, 'net' for the net of the three programs):
// its estimate times its stratum's two multipliers for that measure, from the back-test (each stratum's `low` and
// `high`: in the back-test, the actual figure of 8 in 10 hospitals of the stratum fell in such a range around the
// model's). bands: dollars.json's; stratum: the hospital's row's.
export function rangeOf(bands, measure, stratum, estimate) {
  const band = bands?.measures?.[measure]?.strata.find((s) => s.stratum === stratum);
  if (!band) throw new RangeError(`rangeOf: no ${measure} band for stratum ${stratum}`);
  return scaled(estimate, band.low, band.high);
}

// The national range: a national sum of the cut times the back-test's resampled ratio of what cost reports recorded
// to what the model estimated, its 10th and 90th percentiles (bands.national).
export function nationalRange(bands, estimate) {
  if (!bands?.national) throw new RangeError('nationalRange: the bands have no national ratio');
  return scaled(estimate, bands.national.p10, bands.national.p90);
}

// What a likely range means: the share of the back-test's hospitals whose actual figure fell inside one (the spread
// between its two percentiles, bands.lowPct and bands.highPct).
export const rangeShare = (bands) => bands.highPct - bands.lowPct;

// A place's range: its hospitals' ranges added up, low ends and high ends, from each hospital's [low, high] (null for
// none). As wide as if every hospital's estimate erred the same way, so wider than a sum's errors usually run (the
// nation's own range, resampled, is narrower). null when no hospital has one.
export function sumRanges(ranges) {
  const some = ranges.filter(Boolean);
  if (!some.length) return null;
  return [some.reduce((a, r) => a + r[0], 0), some.reduce((a, r) => a + r[1], 0)];
}

// Whether the hospital's payment includes teaching payments on Medicare Advantage stays: the words that call the
// payment "everything traditional Medicare pays it" then say so. m: an estimated hospitalMoney().
export const hasMaTeaching = (m) => m.parts.imeMa > 0;

// The copy key for a hospital's payment words: `key`, or its twin `keyMa` (the same words, saying the teaching payments
// on Medicare Advantage stays are in the payment) where it has them.
export const maKey = (m, key) => (hasMaTeaching(m) ? `${key}Ma` : key);

// row: the hospital's row of the dollar estimates (dollarsData's: an estimated one carries its likely ranges). status:
// 'estimated', 'maryland', 'parhm' or 'no-inputs'; cut: CMS's decision is Yes. An estimated hospital is its row (every
// dollar figure the pages draw, in whole dollars; negative is money Medicare keeps; ranges: the likely range (rangeOf)
// of its dollars at stake (hac) and of its net (net, null for a net of $0)) and perStay: the dollars at stake per
// Medicare stay (bill).
export function hospitalMoney(row) {
  if (!row) throw new TypeError('hospitalMoney: a row of the dollar estimates is required');
  if (row.status !== 'estimated') return { status: row.status, cut: row.cut, estimated: false };
  if (!(row.bills > 0)) throw new RangeError(`hospitalMoney: ${row.ccn} has no Medicare bills to divide by`);
  return { ...row, estimated: true, perStay: row.atStake / row.bills };
}
