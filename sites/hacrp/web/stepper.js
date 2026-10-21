// The program page's formula stepper, as display text: the median hospital's numbers at each step of CMS's
// formula (pages/program.js lays them out; its last step is a figure, figures.js lineFigure).
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { clamp, toUnit } from '../../../engine/js/stats.js';
import { cmsText, decimal } from '../../../web/render/format.js';
import { SHORT_NAMES } from './constants.js';

// z-scores at CMS's four decimals; the fitted mean and SD from four decimals up.
const DP = 4;
const MAX_FIT_DP = 10;

// The stepper's numbers for the median hospital (medianHospital), measure by measure: its value, CMS's floor and
// cap, the value limited to them, the fitted mean and SD, and its z-score. All as display text. The mean and SD
// show the fewest decimals, from DP up, at which every row's z-score follows from its own shown cells (fitDp).
export function stepRows(hospital, model) {
  const rows = MEASURE_IDS.map((id) => {
    const m = hospital.measures[id];
    const p = model.params[id];
    return { id, m, p, limited: toUnit(clamp(m.value, p.floor, p.cap), p.decimals) };
  });
  const reproduces = (dp) => rows.every(({ m, p, limited }) =>
    decimal(toUnit((limited - toUnit(p.mean, dp)) / toUnit(p.sd, dp), DP), DP) === cmsText(m.zText));
  let fitDp = DP;
  while (!reproduces(fitDp)) {
    if (++fitDp > MAX_FIT_DP) throw new RangeError('stepRows: no display precision reproduces the z-scores');
  }
  return rows.map(({ id, m, p, limited }) => {
    const at = (v) => decimal(v, p.decimals);
    return {
      id, short: SHORT_NAMES[id], valueText: cmsText(m.valueText), floorText: at(p.floor), capText: at(p.cap),
      limitedText: at(limited), meanText: decimal(p.mean, fitDp), sdText: decimal(p.sd, fitDp), zText: cmsText(m.zText), fitDp,
    };
  });
}

// The stepper's average step: how many z-scores, and their sum as text (each z is CMS-style text at four
// decimals, so the sum is exact at that unit and the sum divided by n rounds to the total).
export function stepSum(hospital) {
  const zs = MEASURE_IDS.map((id) => hospital.measures[id].z).filter((z) => z !== null);
  return { n: zs.length, sumText: decimal(toUnit(zs.reduce((a, b) => a + b, 0), DP), DP) };
}
