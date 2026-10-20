// The median hospital: a synthetic Hospital record the what-if sandbox runs on. Each measure sits at its median
// published value; z-scores, total and decision come from the fitted model, so it behaves like any real record.
import { MEASURE_IDS } from './measures.js';
import { zFromValue } from './params.js';
import { classify, totalFromZ } from './score.js';

// Round half away from zero; the toPrecision snap removes float noise first (a median of 0.6405000000000001).
function roundTo(x, decimals) {
  return Math.round(Number((x * 10 ** decimals).toPrecision(9))) / 10 ** decimals;
}

// The median hospital's CCN: state code 00 is unassigned, so no real hospital has it.
export const MEDIAN_CCN = '000000';

// Whether a record is the median hospital: words about it must never call its values CMS's.
export const isMedianHospital = (h) => h?.ccn === MEDIAN_CCN;

// fiscalYear and periods are optional; without them the record carries nulls in the same shape.
export function medianHospital(model, { fiscalYear = null, periods } = {}) {
  const measures = {};
  const zs = [];
  for (const id of MEASURE_IDS) {
    const p = model.params[id];
    const value = roundTo(p.median, p.decimals);
    const z = roundTo(zFromValue(value, p), 4);
    zs.push(z);
    measures[id] = { value, valueText: value.toFixed(p.decimals), valueFootnote: '', z, zText: z.toFixed(4), zFootnote: '' };
  }
  const total = roundTo(totalFromZ(zs), 4);
  return {
    ccn: MEDIAN_CCN,
    name: null,
    state: null,
    fiscalYear,
    measures,
    total,
    totalText: total.toFixed(4),
    totalFootnote: '',
    paymentReduction: classify(total, model.boundary),
    paymentReductionFootnote: '',
    periods: periods ?? { psi90: { start: null, end: null }, hai: { start: null, end: null } },
  };
}
