// HACRP what-if: change one or more measure values and see the Total HAC Score and flag move.
//
// Anchored on CMS: with nothing changed, every output is CMS's published value. A change moves the score by
// the change in that measure's z, using CMS's fitted parameters, divided by the number of measures the hospital
// has (n). Everything else is held fixed: other hospitals, CMS's parameters, and the line between CMS's
// "No" and "Yes" decisions.
import { scoredMeasures, isAssigned } from './hospital.js';
import { EDGE, bandTerm, hypotheticalZ } from './params.js';

function validate(changes, ids) {
  for (const [id, value] of Object.entries(changes)) {
    if (!ids.includes(id)) throw new RangeError(`HACRP what-if: ${id} has no published z-score for this hospital`);
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`HACRP what-if: ${id} value must be a number >= 0, got ${value}`);
  }
}

export function whatIf(hospital, model, changes = {}) {
  if (hospital.total === null) {
    const { totalText, totalFootnote, paymentReduction } = hospital;
    return { available: false, reason: 'no-score', cms: { totalText, totalFootnote, paymentReduction } };
  }

  const ids = scoredMeasures(hospital);
  validate(changes, ids);
  const n = ids.length;

  let deltaZ = 0;
  let fitErrors = 0;
  let moves = 0;
  // Bounds on CMS's true change in z, summed over the moves. Each move's true change lies within its band term
  // of the estimate, and on the same side of zero as the move: CMS's own value -> z map only rises with the value.
  let lowZ = 0;
  let highZ = 0;
  const measures = {};
  for (const id of ids) {
    const m = hospital.measures[id];
    const p = model.params[id];
    const assigned = isAssigned(m);
    const changed = Object.hasOwn(changes, id) && changes[id] !== m.value;
    const afterValue = changed ? changes[id] : m.value;

    let afterZ = m.z;
    if (changed) {
      const z = hypotheticalZ(m, p, afterValue);
      // A move smaller than float noise is no move.
      const d = z - m.z;
      if (Math.abs(d) >= EDGE) {
        const b = bandTerm(m, p);
        afterZ = z;
        deltaZ += d;
        fitErrors += b;
        moves++;
        // An assigned measure has no published value for CMS's map to rise from, so it gets no sign clamp.
        lowZ += d > 0 && !assigned ? Math.max(d - b, 0) : d - b;
        highZ += d < 0 && !assigned ? Math.min(d + b, 0) : d + b;
      }
    }

    measures[id] = {
      assigned,
      beforeValue: m.value,
      afterValue,
      beforeZ: m.z,
      afterZ,
      changed,
      atCap: afterValue === null ? afterZ >= p.zMax : afterValue >= p.cap,
      contribution: afterZ / n,
      // What one unit of the value moves the score, between CMS's floor and cap.
      leverage: 1 / (n * p.sd),
    };
  }

  const cms = hospital.paymentReduction;
  const total = hospital.total;
  const score = moves ? total + deltaZ / n : total;
  // The range CMS's own score could take: "No" only if its top is at or below the highest "No" CMS gave,
  // "Yes" only if its bottom is at or above the lowest "Yes"; otherwise too close to call. A hospital whose
  // changes all move away from the line keeps CMS's decision this way, and cancelling moves still get a range.
  const range = { low: total + lowZ / n, high: total + highZ / n };
  let flag = cms;
  if (cms !== 'N/A' && moves) {
    if (range.high <= model.boundary.highestNo) flag = 'No';
    else if (range.low >= model.boundary.lowestYes) flag = 'Yes';
    else flag = 'too-close';
  }

  return {
    available: true,
    n,
    // Informational: the summed band terms over n. The flag comes from `range`, which can be one-sided.
    band: fitErrors / n,
    range,
    before: { score: hospital.total, flag: cms },
    after: { score, flag },
    measures,
  };
}
