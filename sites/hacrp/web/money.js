// A hospital's dollars as the pages show them: this site's estimate (data/emitted/dollars, loaded by data.js), never
// CMS's. Plain numbers and the few facts the words need; the pages format them. A hospital without an estimate
// (Maryland's, the Pennsylvania Rural Health Model's, or one with no usable impact-file row) carries only its status.

import { money } from '../../../web/render/format.js';
import { fill } from './copy.js';

// What the inpatient payment is made of, in the order the statement lists it: the base the readmissions and
// value-based programs adjust (the federal DRG payment and the Medicare-dependent hospital add-on), then the rest.
export const BASE_PARTS = ['fed', 'mdhAddon'];
export const OTHER_PARTS = ['ime', 'dsh', 'outlierOp', 'schDiff', 'lowVolume', 'capital', 'uc'];

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

// row: the hospital's row of the dollar estimates. status: 'estimated', 'maryland', 'parhm' or 'no-inputs'; cut: CMS's
// decision is Yes. An estimated hospital is its row (every dollar figure the pages draw, in whole dollars; negative is
// money Medicare keeps) and perStay: the dollars at stake per Medicare stay (bill).
export function hospitalMoney(row) {
  if (!row) throw new TypeError('hospitalMoney: a row of the dollar estimates is required');
  if (row.status !== 'estimated') return { status: row.status, cut: row.cut, estimated: false };
  if (!(row.bills > 0)) throw new RangeError(`hospitalMoney: ${row.ccn} has no Medicare bills to divide by`);
  return { ...row, estimated: true, perStay: row.atStake / row.bills };
}
