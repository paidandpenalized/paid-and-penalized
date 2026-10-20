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
  return { highestNo, lowestYes };
}

// 'No' at or below highestNo - band, 'Yes' at or above lowestYes + band, otherwise 'too-close'.
export function classify(score, { highestNo, lowestYes }, band = 0) {
  if (score <= highestNo - band) return 'No';
  if (score >= lowestYes + band) return 'Yes';
  return 'too-close';
}
