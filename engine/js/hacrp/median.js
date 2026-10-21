// The median hospital: a synthetic Hospital record the what-if sandbox runs on. Each measure sits at its median
// published value; z-scores, total and decision come from the fitted model, so it behaves like any real record.
import { toUnit } from '../stats.js';
import { MEASURE_IDS } from './measures.js';
import { zFromValue } from './params.js';
import { classify, totalFromZ } from './score.js';

// The median hospital's CCN: state code 00 is unassigned, so no real hospital has it.
export const MEDIAN_CCN = '000000';

// Whether a record is the median hospital: words about it must never call its values CMS's.
export const isMedianHospital = (h) => h?.ccn === MEDIAN_CCN;

// fiscalYear: CMS's text for the year; periods: { psi90, hai }, each { start, end }, as on every Hospital record.
export function medianHospital(model, { fiscalYear, periods } = {}) {
  if (typeof fiscalYear !== 'string' || !periods) throw new TypeError('medianHospital: fiscalYear and periods are required');
  const measures = {};
  const zs = [];
  for (const id of MEASURE_IDS) {
    const p = model.params[id];
    const value = toUnit(p.median, p.decimals);
    const z = toUnit(zFromValue(value, p), 4);
    zs.push(z);
    measures[id] = { value, valueText: value.toFixed(p.decimals), valueFootnote: '', z, zText: z.toFixed(4), zFootnote: '' };
  }
  const total = toUnit(totalFromZ(zs), 4);
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
    periods,
  };
}
