// Small statistics helpers shared across programs. Percentile functions take an ascending-sorted array.

export function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

// Half away from zero on both sides of zero (Math.round alone rounds -2.5 to -2).
const halfAway = (y) => Math.sign(y) * Math.round(Math.abs(y));

// x at `decimals` places. Float noise is snapped first, so 0.6405000000000001 reads 0.641. round: half away from
// zero, or Math.ceil through ceilToUnit.
export function toUnit(x, decimals, round = halfAway) {
  const scale = 10 ** decimals;
  return round(Number((x * scale).toPrecision(9))) / scale;
}

// x rounded up to `decimals` places, float noise snapped first.
export const ceilToUnit = (x, decimals) => toUnit(x, decimals, Math.ceil);

export function mean(xs) {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function sampleSd(xs) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1));
}

// Excel PERCENTILE.INC: linear interpolation between order statistics.
export function percentileInc(sorted, p) {
  const k = (sorted.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.min(f + 1, sorted.length - 1);
  return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
}

// SAS PROC UNIVARIATE PCTLDEF=5 (SAS's default): an observation, or the mean of two when n*p is a whole number.
export function percentileSas5(sorted, p) {
  if (sorted.length === 0) throw new RangeError('percentile of an empty array');
  const np = sorted.length * p;
  const j = Math.floor(np);
  if (j === 0) return sorted[0];
  if (j >= sorted.length) return sorted[sorted.length - 1];
  return np === j ? (sorted[j - 1] + sorted[j]) / 2 : sorted[j];
}

// Ordinary least squares fit of ys on xs.
export function linearFit(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}
