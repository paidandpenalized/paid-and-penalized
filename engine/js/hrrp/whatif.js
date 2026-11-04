// Ported from Thirty Day Readmissions (web/src/js/model.js at 33d1959).
import { CAP, CONDS, contrib, isMeasured, peerMedian } from './formula.js';

// What-if factor: CMS's published factor moved by the recomputed change. When no measured condition is
// above its median any more the cut is zero by CMS's rule; this also absorbs any gap left by rounded inputs and
// any share CMS counted that cannot be recomputed (a flagged condition with no published payment weight).
export function whatIfPaf(h, meta, over) {
  const anyAbove = CONDS.some((k) => {
    const c = h.c[k];
    if (!isMeasured(c)) return false;
    return (over[k] ?? c.err) > peerMedian(meta, h.peer, k);
  });
  if (!anyAbove) return 1;
  const moved = h.paf + (contrib(h, meta, over).paf - contrib(h, meta).paf);
  return Math.round(Math.min(1, Math.max(1 - CAP, moved)) * 1e4) / 1e4;
}

// [lo, hi] widened as needed to contain `values` plus `pad`, snapped outward to multiples of `step`.
export function niceDomain(values, [lo, hi], step, pad) {
  const snap = (v) => Math.round(v * 1e6) / 1e6;
  return [snap(Math.min(lo, Math.floor((Math.min(...values) - pad) / step + 1e-9) * step)),
    snap(Math.max(hi, Math.ceil((Math.max(...values) + pad) / step - 1e-9) * step))];
}

// Slider bounds that always contain the actual ratio, with room on both sides.
export const sliderRange = (err) => niceDomain([err], [0.8, 1.25], 0.05, 0.05);
