// HACRP solver: for one measure on its own, the value that would clear CMS's line ("What would it take?",
// for a hospital CMS flagged) or the highest value that would stay clear of it ("How much cushion?", for one
// it didn't). Uses the same change-only math as the what-if, and targets the bottom of the too-close band so
// applying the answer reads "No", not "too close to call".
import { scoredMeasures, isAssigned } from './hospital.js';
import { zFromValue } from './params.js';

// Round down to the measure's display decimals. Lower is the safe direction for both questions: a lower value
// never raises the score. The small nudge keeps an answer that is already exact from rounding back up.
function floorTo(x, decimals) {
  const scale = 10 ** decimals;
  return Math.floor((x - 1e-9) * scale) / scale;
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
  const target = model.boundary.highestNo - p.fitError / n;
  const zNeeded = zFromValue(m.value, p) + (target - hospital.total) * n;
  const raw = p.mean + p.sd * zNeeded;

  if (hospital.paymentReduction === 'Yes') {
    // total > target here, so zNeeded is below the current z and the answer is always under the cap.
    if (zNeeded < p.zMin) return result('needed', id);
    const value = floorTo(raw, p.decimals);
    if (value < 0) return result('needed', id);
    return result('needed', id, { possible: true, value });
  }

  // The measure can rise to its cap, and past it, without crossing the line.
  if (zNeeded >= p.zMax) return result('cushion', id, { possible: true, unlimited: true });
  const value = floorTo(raw, p.decimals);
  if (value < m.value || value < 0) return result('cushion', id, { value: Math.max(value, 0), note: 'no-cushion' });
  return result('cushion', id, { possible: true, value });
}
