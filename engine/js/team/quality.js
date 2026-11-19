// The composite quality score (CQS), 42 CFR 512.547(b): each measure's scaled score (a percentile, 0 to 100) weighted by
// the hospital's episodes the measure applies to, over the sum of those volumes across measures, then summed. CMS's
// worked example (650/650/400 episodes, scaled scores 60/50/40) settles that the denominator is the sum of measure
// volumes, not the hospital's episode count. Pure: imports only params.js.
import { MEASURES, MISSING_QUALITY } from './params.js';

const volumeOf = (v, key) => {
  if (!Number.isFinite(v?.[key]) || v[key] < 0) throw new RangeError(`volumes.${key} must be a non-negative number`);
  return v[key];
};

/**
 * @param {Object<string, number|null|undefined>} pcts scaled score (percentile, 0-100) per measure key; a missing, null
 *   or undefined entry counts as MISSING_QUALITY, as CMS scores a measure with no raw score
 * @param {{inpatient: number, lejr: number}} volumes attributed episodes the inpatient and the LEJR measures apply to
 * @param {Object<string, {appliesTo: 'inpatient'|'lejr'}>} [measures] the measure table (default: PY2's MEASURES)
 * @returns {{cqs: number, weights: Object<string, number>}} the score, and every measure's weight. With no volume at
 *   all every weight is 0 and cqs is MISSING_QUALITY (nothing to weight; CMS's own missing-data score).
 */
export function compositeQuality(pcts, volumes, measures = MEASURES) {
  const keys = Object.keys(measures);
  const vol = Object.fromEntries(keys.map((k) => [k, volumeOf(volumes, measures[k].appliesTo)]));
  const total = keys.reduce((s, k) => s + vol[k], 0);
  if (total === 0) return { cqs: MISSING_QUALITY, weights: Object.fromEntries(keys.map((k) => [k, 0])) };
  const weights = Object.fromEntries(keys.map((k) => [k, vol[k] / total]));
  const cqs = keys.reduce((s, k) => s + (pcts?.[k] ?? MISSING_QUALITY) * weights[k], 0);
  return { cqs, weights };
}
