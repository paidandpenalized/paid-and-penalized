// HACRP what-if: change one or more measure values and see the Total HAC Score and flag move.
//
// Anchored on CMS: with nothing changed, every output is CMS's published value. A change moves the score by
// the change in that measure's z, using CMS's fitted parameters, divided by the number of measures the hospital
// has (n). Everything else is held fixed: other hospitals, CMS's parameters, and the line between CMS's
// "No" and "Yes" decisions.
import { scoredMeasures, isAssigned } from './hospital.js';
import { EDGE, hypotheticalZ } from './params.js';
import { classify } from './score.js';

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
  const measures = {};
  for (const id of ids) {
    const m = hospital.measures[id];
    const p = model.params[id];
    const assigned = isAssigned(m);
    const changed = Object.hasOwn(changes, id) && changes[id] !== m.value;
    const afterValue = changed ? changes[id] : m.value;

    let afterZ = m.z;
    if (changed) {
      const { z, exact } = hypotheticalZ(m, p, afterValue);
      // A move smaller than float noise is no move. Only the fitted (inexact) part of a move carries fit error.
      if (Math.abs(z - m.z) >= EDGE) {
        afterZ = z;
        deltaZ += z - m.z;
        if (!exact) fitErrors += p.fitError;
      }
    }

    measures[id] = {
      assigned,
      beforeValue: m.value,
      afterValue,
      beforeZ: m.z,
      afterZ,
      changed,
      atCap: afterValue === null ? afterZ >= p.zMax : afterValue >= p.cap - p.boundTolerance,
      contribution: afterZ / n,
      leveragePerTenth: 0.1 / (n * p.sd),
    };
  }

  const cms = hospital.paymentReduction;
  const moved = Math.abs(deltaZ) >= EDGE;
  const band = moved ? fitErrors / n : 0;
  const score = moved ? hospital.total + deltaZ / n : hospital.total;
  // A score that moves away from the line keeps CMS's decision; only a move toward it is re-judged.
  const awayFromLine = (cms === 'No' && score <= hospital.total) || (cms === 'Yes' && score >= hospital.total);
  const flag = cms === 'N/A' || awayFromLine ? cms : classify(score, model.boundary, band);

  return {
    available: true,
    n,
    band,
    before: { score: hospital.total, flag: cms },
    after: { score, flag },
    measures,
  };
}
