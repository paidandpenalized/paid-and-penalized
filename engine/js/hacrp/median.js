// The median hospital: a synthetic Hospital record the what-if sandbox runs on. Each measure sits at its median
// published value; z-scores, total and decision come from the fitted model, so it behaves like any real record.
import { toUnit } from '../stats.js';
import { MEASURE_IDS } from './measures.js';
import { zFromValue } from './params.js';
import { classify, totalFromZ } from './score.js';

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
    // State code 00 is unassigned, so no real hospital has this CCN.
    ccn: '000000',
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
