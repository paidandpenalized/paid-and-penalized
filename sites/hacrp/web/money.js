// A hospital's dollars as the pages show them: this site's estimate (data/emitted/dollars, loaded by data.js), never
// CMS's. Plain numbers and the few facts the words need; the pages format them. A hospital without an estimate
// (Maryland's, or one with no usable impact-file row) carries only its status.

import { count, money } from '../../../web/render/format.js';
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

// The hospitals a group's estimate covers, as the copy's {cut} of the {yes} placeholders take them: those whose cut this
// site estimates and those CMS cut, estimated or not. group: { cut, cmsCut }, any group's rollup (money-data.js) or the
// file's headline (data.js dollarsData names CMS's count cmsCut there too). The words round the two stay in the copy.
export const cutCounts = ({ cut, cmsCut }) => ({ cut: count(cut), yes: count(cmsCut) });

// ---------- the likely ranges: the engine's (engine/js/dollars/ranges.js), shared with the hub ----------

export { ALL_STRATUM, nationalRange, rangeOf, rangeShare, sumRanges } from '../../../engine/js/dollars/ranges.js';

// Whether the hospital's payment includes teaching payments on Medicare Advantage stays: the words that name the payment
// as what traditional Medicare pays it then say so. m: an estimated hospitalMoney().
export const hasMaTeaching = (m) => m.parts.imeMa > 0;

// The copy key for a hospital's payment words: `key`, or its twin `keyMa` (the same words, saying the teaching payments
// on Medicare Advantage stays are in the payment) where it has them.
export const maKey = (m, key) => (hasMaTeaching(m) ? `${key}Ma` : key);

// row: the hospital's row of the dollar estimates (dollarsData's: an estimated one carries its likely ranges). status:
// 'estimated', 'maryland' or 'no-inputs' (the statuses the pages have words for: data.js dollarsData); cut: CMS's decision is Yes. An estimated hospital is its row (every
// dollar figure the pages draw, in whole dollars; negative is money Medicare keeps; ranges: the likely range (rangeOf)
// of its dollars at stake (hac) and of its net (net, null for a net of $0)) and perStay: the dollars at stake per
// Medicare stay (bill).
export function hospitalMoney(row) {
  if (!row) throw new TypeError('hospitalMoney: a row of the dollar estimates is required');
  if (row.status !== 'estimated') return { status: row.status, cut: row.cut, estimated: false };
  if (!(row.bills > 0)) throw new RangeError(`hospitalMoney: ${row.ccn} has no Medicare bills to divide by`);
  return { ...row, estimated: true, perStay: row.atStake / row.bills };
}
