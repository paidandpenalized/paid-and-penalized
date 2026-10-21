// The program page's formula stepper, as display text: the median hospital's numbers at each step of CMS's
// formula (pages/program.js lays them out).
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { clamp, toUnit } from '../../../engine/js/stats.js';
import { cmsText, decimal } from '../../../web/render/format.js';
import { SHORT_NAMES } from './constants.js';
import { fill } from './copy.js';

// z-scores at CMS's decimals (DP); the fitted mean and SD from DP decimals up.
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

// The stepper's last step in words: the median hospital's score against CMS's line (boundaryText: CMS's text for
// the two scores). The decision is the hospital's own (hospital.paymentReduction).
export function lineStep(hospital, boundaryText) {
  const total = cmsText(hospital.totalText);
  const words = {
    No: ['stepLineNo', { total, highestNo: boundaryText.highestNo }],
    Yes: ['stepLineYes', { total, lowestYes: boundaryText.lowestYes }],
    'too-close': ['stepLineClose', { total, ...boundaryText }],
  }[hospital.paymentReduction];
  if (!words) throw new RangeError(`lineStep: unexpected decision "${hospital.paymentReduction}"`);
  return fill(...words);
}
