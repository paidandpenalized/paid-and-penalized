// Ported from Thirty Day Readmissions (web/src/js/model.js at 33d1959).
// Pure functions: the HRRP formula. No DOM, no files, no clock.

export const CONDS = ['AMI', 'COPD', 'HF', 'PN', 'CABG', 'THA_TKA'];
export const PEERS = [1, 2, 3, 4, 5];
export const MIN_DISCHARGES = 25;
export const CAP = 0.03;
export const CAP_PCT = CAP * 100;

const round4 = (v) => Math.round(v * 1e4) / 1e4;
// Payment reduction in percent (2 dp) from a payment adjustment factor.
export const cutPct = (paf) => Math.round((1 - paf) * 1e4) / 100;
// A condition counts only with at least 25 eligible cases and a published ratio.
export const isMeasured = (c) => (c?.n ?? 0) >= MIN_DISCHARGES && c.err != null;

// CMS can flag a condition without publishing its payment weight; its share of the cut then can't be recomputed.
export const weightPublished = (c) => c?.ratio != null;
export const WEIGHT_MISSING = 'flagged by CMS; payment weight not published';

export function peerMedian(meta, peer, cond) {
  return meta.peerMedians[peer]?.[cond] ?? null;
}

// One condition's contribution: NM x DRG ratio x max(ERR - peer median, 0), when discharges >= 25.
export function conditionContribution(c, med, nm, errOverride) {
  if (!isMeasured(c)) return 0;
  const err = errOverride ?? c.err;
  if (med == null || !weightPublished(c)) return 0;
  return nm * c.ratio * Math.max(err - med, 0);
}

export function contrib(h, meta, errOverride = {}) {
  const byCond = {};
  let sum = 0;
  for (const k of CONDS) {
    byCond[k] = conditionContribution(h.c[k], peerMedian(meta, h.peer, k), meta.nm, errOverride[k]);
    sum += byCond[k];
  }
  const reduction = Math.min(sum, CAP);
  return { byCond, sum, reduction, paf: round4(1 - round4(reduction)) };
}

// 'counted' (adds to the penalty) | 'below' (measured, at or below median) | 'few' (under 25 cases) | 'none'
export function condState(h, k, meta, byCond = contrib(h, meta).byCond) {
  const c = h.c[k];
  if (!c) return 'none';
  if (!isMeasured(c)) return 'few';
  return byCond[k] > 0 || c.flag === 1 ? 'counted' : 'below';
}

// Why a hospital got (or avoided) its penalty.
export function verdict(h, meta) {
  const r = contrib(h, meta);
  const measured = CONDS.filter((k) => isMeasured(h.c[k]));
  const above = measured.filter((k) => condState(h, k, meta, r.byCond) === 'counted');
  const top = above.reduce((best, k) => (best == null || r.byCond[k] > r.byCond[best] ? k : best), null);
  let status = 'penalized';
  if (h.paf >= 1) status = !measured.length ? 'none-measured' : above.length ? 'none-rounded' : 'none-below';
  return { status, top, nAbove: above.length, nMeasured: measured.length, measured, above };
}
