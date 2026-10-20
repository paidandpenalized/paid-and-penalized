// Acceptance check A1 as a build gate: the published z-scores reproduce each Total HAC Score, and the model's
// boundary reproduces every Yes/No decision. Pure: the build throws on !ok and prints a, b and info.
import { scoredMeasures } from './hospital.js';
import { totalFromZ } from './score.js';
import { percentileInc } from '../stats.js';

const Z_TOLERANCE = 0.0001; // (a): mean of published z vs Total HAC Score
const MIN_WITHIN = 0.99; // (a): share of scored hospitals that must be within tolerance

const ascending = (xs) => [...xs].sort((x, y) => x - y);

export function checkA1(hospitals, model, estimate) {
  const scored = hospitals.filter((h) => h.total !== null);

  let maxError = 0;
  let within = 0;
  for (const h of scored) {
    const err = Math.abs(totalFromZ(scoredMeasures(h).map((id) => h.measures[id].z)) - h.total);
    maxError = Math.max(maxError, err);
    if (err < Z_TOLERANCE) within++;
  }

  // Yes/No decisions on scored hospitals; a "Yes" with no published score has nothing to compare.
  const decided = scored.filter((h) => h.paymentReduction === 'Yes' || h.paymentReduction === 'No');
  const mismatches = decided
    .filter((h) => h.paymentReduction !== (h.total > model.boundary.highestNo ? 'Yes' : 'No'))
    .map((h) => h.ccn);

  const pct = (hs) => (hs.length ? percentileInc(ascending(hs.map((h) => h.total)), 0.75) : null);

  return {
    ok: scored.length > 0 && within / scored.length >= MIN_WITHIN && mismatches.length === 0,
    a: { n: scored.length, maxError, within },
    b: { n: decided.length, mismatches },
    c: { ...estimate },
    info: { pctAllScored: pct(scored), pctDecided: pct(decided) },
  };
}
