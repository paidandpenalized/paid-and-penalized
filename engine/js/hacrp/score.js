// Total HAC Score and the payment-reduction line.
import { mean } from '../stats.js';

// The Total HAC Score is the equally weighted mean of a hospital's measure z-scores.
export function totalFromZ(zs) {
  if (zs.length === 0) throw new RangeError('HACRP: no z-scores to average');
  return mean(zs);
}

// The line as CMS's own decisions show it: the highest score CMS marked "No" and the lowest it marked "Yes".
// CMS flags scores greater than its 75th-percentile cutoff, which lies in [highestNo, lowestYes).
export function cutoffBoundary(hospitals) {
  let highestNo = -Infinity;
  let lowestYes = Infinity;
  for (const h of hospitals) {
    if (h.total === null) continue;
    if (h.paymentReduction === 'No') highestNo = Math.max(highestNo, h.total);
    else if (h.paymentReduction === 'Yes') lowestYes = Math.min(lowestYes, h.total);
  }
  if (!Number.isFinite(highestNo) || !Number.isFinite(lowestYes)) {
    throw new RangeError('HACRP: need scored hospitals on both sides of the line to place the cutoff');
  }
  return { highestNo, lowestYes };
}

// The highest score that still reads 'No' when the score carries an error band.
export function noCeiling({ highestNo }, band = 0) {
  return highestNo - band;
}

// 'No' at or below noCeiling, 'Yes' at or above lowestYes + band, otherwise 'too-close'.
export function classify(score, boundary, band = 0) {
  if (score <= noCeiling(boundary, band)) return 'No';
  if (score >= boundary.lowestYes + band) return 'Yes';
  return 'too-close';
}
