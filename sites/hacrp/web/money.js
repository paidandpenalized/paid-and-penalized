// A hospital's dollars as the pages show them: this site's estimate (data/emitted/dollars, loaded by data.js), never
// CMS's. Plain numbers and the few facts the words need; the pages format them. A hospital without an estimate
// (Maryland's, the Pennsylvania Rural Health Model's, or one with no usable impact-file row) carries only its status.

// What the inpatient payment is made of, in the order the statement lists it: the base the readmissions and
// value-based programs adjust (the federal DRG payment and the Medicare-dependent hospital add-on), then the rest.
export const BASE_PARTS = ['fed', 'mdhAddon'];
export const OTHER_PARTS = ['ime', 'dsh', 'outlierOp', 'schDiff', 'lowVolume', 'capital', 'uc'];

// The likely range of a hospital's estimate, from the back-test's bands: null while they are pending (the emitted
// file's `bands` is null until the back-test), and the pages then say so. Reading real bands comes with them.
export function rangeOf(bands) {
  if (bands !== null) throw new RangeError('dollar bands: the pages do not read them yet');
  return null;
}

// row: the hospital's row of the dollar estimates; bands: the file's `bands`. status: 'estimated', 'maryland', 'parhm'
// or 'no-inputs'; cut: CMS's decision is Yes. An estimated hospital adds every dollar figure the pages draw, in whole
// dollars (negative is money Medicare keeps), and perStay: the dollars at stake per Medicare stay (bill).
export function hospitalMoney(row, bands) {
  if (!row) throw new TypeError('hospitalMoney: a row of the dollar estimates is required');
  const { status, cut } = row;
  if (status !== 'estimated') return { status, cut, estimated: false };
  const { base, total, after, atStake, hac, hrrp, hvbp, net, parts, bills, hrrpFactor, vbpFactor, hrrpListed, vbpListed } = row;
  if (!(bills > 0)) throw new RangeError(`hospitalMoney: ${row.ccn} has no Medicare bills to divide by`);
  return {
    status, cut, estimated: true,
    base, total, after, atStake, hac, hrrp, hvbp, net, parts, bills,
    hrrpFactor, vbpFactor, hrrpListed, vbpListed,
    perStay: atStake / bills,
    range: rangeOf(bands),
  };
}
