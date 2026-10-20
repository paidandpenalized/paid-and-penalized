// HACRP solver: for one measure on its own, the value that would clear CMS's line ("What would it take?",
// for a hospital CMS flagged) or the highest value that would stay clear of it ("How much cushion?", for one
// it didn't). It inverts the what-if's own value -> z mapping and checks each answer against it, targeting the
// bottom of the too-close band so applying the answer reads "No", not "too close to call".
import { scoredMeasures, isAssigned } from './hospital.js';
import { baselineZ, hypotheticalZ, valueFromZ } from './params.js';
import { noCeiling } from './score.js';

// A first guess can land just past a snap point (the cap or floor); a few display units down always clears it.
const MAX_STEPS = 3;

function roundTo(x, decimals, round) {
  const scale = 10 ** decimals;
  return round(x * scale + (round === Math.floor ? 1e-6 : 0)) / scale;
}

function result(kind, id, fields = {}) {
  return { kind, id, possible: false, value: null, unlimited: false, note: null, ...fields };
}

export function solveMeasure(hospital, model, id) {
  if (hospital.total === null || hospital.paymentReduction === 'N/A') return result(null, id, { note: 'not-applicable' });
  const ids = scoredMeasures(hospital);
  if (!ids.includes(id)) throw new RangeError(`HACRP solver: ${id} has no published z-score for this hospital`);
  const m = hospital.measures[id];
  if (isAssigned(m)) return result(null, id, { note: 'assigned' });

  const p = model.params[id];
  const n = ids.length;
  // The highest z this measure may take for the score to land on the highest value that still reads No.
  const zLimit = m.z + (noCeiling(model.boundary, p.fitError / n) - hospital.total) * n;

  // The highest display value whose what-if z stays within zLimit: invert the change-only step, round down,
  // then step down until the what-if's own mapping agrees.
  const highestFitting = () => {
    const guess = valueFromZ(zLimit - (m.z - baselineZ(m, p)), p);
    let v = Math.max(0, roundTo(guess, p.decimals, Math.floor));
    for (let i = 0; i <= MAX_STEPS && v >= 0; i++) {
      if (hypotheticalZ(m, p, v).z <= zLimit) return v;
      v = roundTo(v - 10 ** -p.decimals, p.decimals, Math.round);
    }
    return null;
  };

  if (hospital.paymentReduction === 'Yes') {
    const value = highestFitting();
    return value === null ? result('needed', id) : result('needed', id, { possible: true, value });
  }

  // Already at CMS's worst z, or the worst z still fits: no rise can cross the line.
  if (m.z >= p.zMax || p.zMax <= zLimit) return result('cushion', id, { possible: true, unlimited: true });
  const value = highestFitting();
  if (value === null || value < m.value) return result('cushion', id, { value, note: 'no-cushion' });
  return result('cushion', id, { possible: true, value });
}
