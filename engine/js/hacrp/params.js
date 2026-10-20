// Per-measure parameters behind CMS's z-scores, and the public-method recompute.
//
// CMS winsorizes each measure at its 5th/95th percentile and standardizes it: z = (w - mean) / sd. Between the
// caps, z is linear in the value, so CMS's own mean, sd, floor and cap can be fit from the published value-z
// pairs. That fit reproduces CMS's z far more closely than recomputing the parameters from the public file,
// whose hospital population differs slightly from the one CMS scored.
import { linearFit, mean, median, percentileSas5, sampleSd } from '../stats.js';
import { isAssigned } from './hospital.js';

const EDGE = 1e-9;
const ESTIMATE_THRESHOLD = 0.001;

function withValueAndZ(hospitals, id) {
  return hospitals.map((h) => ({ ccn: h.ccn, m: h.measures[id] })).filter(({ m }) => m.value !== null && m.z !== null);
}

function decimalsOf(text) {
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function zFromValue(value, p) {
  const v = Math.min(Math.max(value, p.floor), p.cap);
  return (v - p.mean) / p.sd;
}

export function fitMeasureParams(hospitals, id) {
  const pairs = withValueAndZ(hospitals, id);
  const zs = hospitals.map((h) => h.measures[id].z).filter((z) => z !== null);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const inside = pairs.filter(({ m }) => m.z > zMin + EDGE && m.z < zMax - EDGE);
  const { slope: sd, intercept } = linearFit(inside.map(({ m }) => m.z), inside.map(({ m }) => m.value));

  const p = {
    id,
    n: pairs.length,
    mean: intercept,
    sd,
    floor: intercept + sd * zMin,
    cap: intercept + sd * zMax,
    zMin,
    zMax,
    median: median(pairs.map(({ m }) => m.value)),
    decimals: Math.max(...pairs.map(({ m }) => decimalsOf(m.valueText))),
  };
  p.fitError = Math.max(...pairs.map(({ m }) => Math.abs(zFromValue(m.value, p) - m.z)));
  return p;
}

// The method applied to the public file alone: SAS default percentiles (PCTLDEF=5) at 5/95, winsorize, then
// standardize with the mean and sample SD of the winsorized values, over hospitals with a published value.
export function publicMethodZ(hospitals, id) {
  const pairs = withValueAndZ(hospitals, id);
  const sorted = pairs.map(({ m }) => m.value).sort((a, b) => a - b);
  const lo = percentileSas5(sorted, 0.05);
  const hi = percentileSas5(sorted, 0.95);
  const w = pairs.map(({ m }) => Math.min(Math.max(m.value, lo), hi));
  const mu = mean(w);
  const sd = sampleSd(w);
  return new Map(pairs.map(({ ccn }, i) => [ccn, (w[i] - mu) / sd]));
}

// A measure carries the estimate tag when the public-method recompute misses any published z by more than 0.001.
export function estimateTagged(hospitals, id) {
  const z = publicMethodZ(hospitals, id);
  const maxError = Math.max(...withValueAndZ(hospitals, id).map(({ ccn, m }) => Math.abs(z.get(ccn) - m.z)));
  return { tagged: maxError > ESTIMATE_THRESHOLD, maxError };
}
