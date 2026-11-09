// Ported from Thirty Day Readmissions (web/src/js/model.js at 33d1959).
import { CAP, CONDS, isMeasured } from './formula.js';
import { mean, median, percentileInc } from '../stats.js';

// stats.js's mean and median give NaN on an empty list; a summary of nothing reads 0 instead.
const meanOr0 = (a) => (a.length ? mean(a) : 0);
const medianOr0 = (a) => (a.length ? median(a) : 0);

// Hospitals with no dollar estimate (missing from the IPPS impact file); dollar totals leave them out.
export const noEstimate = (list) => list.filter((h) => h.pen == null).length;

// Measured on at least one condition: only these hospitals can be penalized.
export const measuredAny = (h) => CONDS.some((k) => isMeasured(h.c?.[k]));

export function summarize(list) {
  const reds = list.map((h) => h.red);
  const pen = reds.filter((r) => r > 0);
  const nMeasured = list.filter(measuredAny).length;
  return {
    n: list.length,
    nPen: pen.length,
    nMeasured,
    // Share of hospitals measured on at least one condition that take a cut; null when none is measured.
    pctPen: nMeasured ? (100 * pen.length) / nMeasured : null,
    meanRed: meanOr0(reds),
    get medianRed() { return medianOr0(reds); },
    meanRedPen: meanOr0(pen),
    get medianRedPen() { return medianOr0(pen); },
    nMax: list.filter((h) => h.paf <= 1 - CAP + 1e-9).length,
    nGe1: reds.filter((r) => r >= 1).length,
    penTotal: list.reduce((s, h) => s + (h.pen ?? 0), 0),
    baseTotal: list.reduce((s, h) => s + (h.base ?? 0), 0),
  };
}

// Share (0-100) of values strictly below v; `sorted` ascending.
export function percentileRank(sorted, v) {
  if (!sorted.length) return 0;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return (100 * lo) / sorted.length;
}

// "Larger cut than N% of hospitals": floored and never 100 (a hospital is never above itself). rankPctOf takes the
// percentile percentileRank gives, for a caller that also needs to know whether it is above none at all.
export const rankPctOf = (p) => Math.min(99, Math.floor(p));
export function rankPct(sorted, v) {
  return rankPctOf(percentileRank(sorted, v));
}

// {peer: {cond: [p10, p90]}} of ERRs among hospitals with >= 25 cases.
export function peerBands(list) {
  const acc = {};
  for (const x of list) {
    for (const [k, c] of Object.entries(x.c)) {
      if (!isMeasured(c)) continue;
      ((acc[x.peer] ??= {})[k] ??= []).push(c.err);
    }
  }
  const out = {};
  for (const [p, conds] of Object.entries(acc)) {
    out[p] = {};
    for (const [k, v] of Object.entries(conds)) {
      v.sort((a, b) => a - b);
      out[p][k] = [percentileInc(v, 0.1), percentileInc(v, 0.9)];
    }
  }
  return out;
}
