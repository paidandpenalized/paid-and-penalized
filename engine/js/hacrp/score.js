// Total HAC Score and the payment-reduction line.
import { mean } from '../stats.js';

// CMS publishes z-scores and Total HAC Scores to this many decimals.
export const SCORE_DECIMALS = 4;

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

// 'No' at or below highestNo, 'Yes' at or above lowestYes, otherwise 'too-close' (CMS's cutoff lies between).
export function classify(score, { highestNo, lowestYes }) {
  if (score <= highestNo) return 'No';
  if (score >= lowestYes) return 'Yes';
  return 'too-close';
}
