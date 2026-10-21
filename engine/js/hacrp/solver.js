// HACRP solver: for one measure on its own, the value that would clear CMS's line ("What would it take?",
// for a hospital CMS flagged, or a recomputed start too close to call) or the highest value that would stay clear
// of it ("How much cushion?", for one it didn't). It searches the what-if itself, one display unit at a time by bisection, so every answer is
// exactly what the what-if shows: it reads "No", and one display unit higher does not.
import { scoredMeasures, isAssigned } from './hospital.js';
import { whatIf } from './whatif.js';

function result(kind, id, fields = {}) {
  return { kind, id, possible: false, value: null, unlimited: false, note: null, ...fields };
}

export function solveMeasure(hospital, model, id) {
  if (hospital.total === null || hospital.paymentReduction === 'N/A') return result(null, id, { note: 'not-applicable' });
  if (!scoredMeasures(hospital).includes(id)) throw new RangeError(`HACRP solver: ${id} has no published z-score for this hospital`);
  const m = hospital.measures[id];
  if (isAssigned(m)) return result(null, id, { note: 'assigned' });

  const p = model.params[id];
  const scale = 10 ** p.decimals;
  const reads = (k) => whatIf(hospital, model, { [id]: k / scale }).after.flag === 'No';
  const current = Math.round(m.value * scale);

  // Largest k in [lo, hi) that reads No, given reads(lo) and not reads(hi). The flag only changes once as the
  // value rises, so bisection finds the last No exactly.
  const lastNo = (lo, hi) => {
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (reads(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  // A start too close to call (the sandbox's recomputed median hospital, in some year) does not read No either.
  if (hospital.paymentReduction === 'Yes' || hospital.paymentReduction === 'too-close') {
    if (!reads(0)) return result('needed', id);
    return result('needed', id, { possible: true, value: lastNo(0, current) / scale });
  }

  const beyond = Math.ceil(Math.max(p.cap, m.value) * scale) + 1;
  if (reads(beyond)) return result('cushion', id, { possible: true, unlimited: true });
  const k = lastNo(current, beyond);
  return k === current ? result('cushion', id, { value: m.value, note: 'no-cushion' }) : result('cushion', id, { possible: true, value: k / scale });
}
