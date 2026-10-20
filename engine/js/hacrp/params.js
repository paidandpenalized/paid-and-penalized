// Per-measure parameters behind CMS's z-scores, and the public-method recompute.
//
// CMS winsorizes each measure at its 5th/95th percentile and standardizes it: z = (w - mean) / sd. Between the
// bounds, z is linear in the value, so CMS's own mean and sd can be fit from the published value-z pairs; the
// floor and cap are read directly from the values CMS published at the minimum and maximum z. That reproduces
// CMS's z far more closely than recomputing the parameters from the public file, whose hospital population
// differs slightly from the one CMS scored.
import { clamp, linearFit, mean, median, percentileSas5, sampleSd } from '../stats.js';

// Tolerance for comparing z-scores that CMS published to 4 decimals against the measure's min and max.
export const EDGE = 1e-9;
const ESTIMATE_THRESHOLD = 0.001;

function withValueAndZ(hospitals, id) {
  return hospitals.map((h) => ({ ccn: h.ccn, m: h.measures[id] })).filter(({ m }) => m.value !== null && m.z !== null);
}

function decimalsOf(text) {
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function zFromValue(value, p) {
  return (clamp(value, p.floor, p.cap) - p.mean) / p.sd;
}

// Where a change to a measure starts from: the fitted z of the published value, or, for a measure CMS assigned
// because it wasn't submitted, CMS's assigned z.
export function baselineZ(measure, p) {
  return measure.value === null ? measure.z : zFromValue(measure.value, p);
}

// The z a measure would have at a hypothetical value. At or past the cap, CMS's worst z; at or below the floor,
// its best. In between, the change-only step from the published z, kept in CMS's z range. A published value
// already past a bound stays anchored at its published z while the new value is past it too, so the mapping
// never moves against the direction of a change.
export function hypotheticalZ(measure, p, value) {
  const current = measure.value;
  if (value >= p.cap) return current !== null && current >= p.cap ? measure.z : p.zMax;
  if (value <= p.floor) return current !== null && current <= p.floor ? measure.z : p.zMin;
  return clamp(measure.z + zFromValue(value, p) - baselineZ(measure, p), p.zMin, p.zMax);
}

export function fitMeasureParams(hospitals, id) {
  const pairs = withValueAndZ(hospitals, id);
  // Bounds come from hospitals with a published value; assigned (non-submitted) z-scores are checked against them.
  const zs = pairs.map(({ m }) => m.z);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const inside = pairs.filter(({ m }) => m.z > zMin + EDGE && m.z < zMax - EDGE);
  if (inside.length < 2) throw new RangeError(`${id}: fit needs at least 2 uncapped hospitals, found ${inside.length}`);
  const { slope: sd, intercept } = linearFit(inside.map(({ m }) => m.z), inside.map(({ m }) => m.value));
  if (!(sd > 0) || !Number.isFinite(intercept)) throw new RangeError(`${id}: fit gave sd ${sd}, mean ${intercept}`);

  const p = {
    id,
    n: pairs.length,
    mean: intercept,
    sd,
    // CMS's own bounds, as published: the highest value scored at the minimum z and the lowest at the maximum.
    floor: Math.max(...pairs.filter(({ m }) => m.z === zMin).map(({ m }) => m.value)),
    cap: Math.min(...pairs.filter(({ m }) => m.z === zMax).map(({ m }) => m.value)),
    zMin,
    zMax,
    median: median(pairs.map(({ m }) => m.value)),
    decimals: Math.max(...pairs.map(({ m }) => decimalsOf(m.valueText))),
  };
  // Measured where the fitted line is used: capped and floored rows are mapped exactly by hypotheticalZ.
  p.fitError = Math.max(...inside.map(({ m }) => Math.abs(zFromValue(m.value, p) - m.z)));
  return p;
}

// The method applied to the public file alone: SAS default percentiles (PCTLDEF=5) at 5/95, winsorize, then
// standardize with the mean and sample SD of the winsorized values, over hospitals with a published value.
export function publicMethodZ(hospitals, id) {
  const pairs = withValueAndZ(hospitals, id);
  const sorted = pairs.map(({ m }) => m.value).sort((a, b) => a - b);
  const lo = percentileSas5(sorted, 0.05);
  const hi = percentileSas5(sorted, 0.95);
  const w = pairs.map(({ m }) => clamp(m.value, lo, hi));
  const mu = mean(w);
  const sd = sampleSd(w);
  return new Map(pairs.map(({ ccn }, i) => [ccn, (w[i] - mu) / sd]));
}

// A measure carries the estimate tag when the public-method recompute misses any published z by more than 0.001.
export function estimateTagged(hospitals, id) {
  const z = publicMethodZ(hospitals, id);
  const maxError = Math.max(...withValueAndZ(hospitals, id).map(({ ccn, m }) => Math.abs(z.get(ccn) - m.z)));
  if (!Number.isFinite(maxError)) throw new RangeError(`${id}: public-method recompute is undefined (max error ${maxError})`);
  return { tagged: maxError > ESTIMATE_THRESHOLD, maxError };
}
