// HACRP what-if: change one or more measure values and see the Total HAC Score and flag move.
//
// Anchored on CMS: with nothing changed, every output is CMS's published value. A change moves the score by
// the change in that measure's z, using CMS's fitted parameters, divided by the number of measures the hospital
// has (n). Everything else is held fixed: other hospitals, CMS's parameters, and the line between CMS's
// "No" and "Yes" decisions.
import { scoredMeasures, isAssigned } from './hospital.js';
import { EDGE, baselineZ, zFromValue } from './params.js';
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
      const d = zFromValue(afterValue, p) - baselineZ(m, p);
      if (d !== 0) {
        afterZ = m.z + d;
        deltaZ += d;
        fitErrors += p.fitError;
      }
    }

    measures[id] = {
      assigned,
      beforeValue: m.value,
      afterValue,
      beforeZ: m.z,
      afterZ,
      changed,
      atCap: afterZ >= p.zMax - EDGE,
      contribution: afterZ / n,
      leveragePerTenth: 0.1 / (n * p.sd),
    };
  }

  const band = fitErrors / n;
  const score = hospital.total + deltaZ / n;
  let flag = hospital.paymentReduction;
  if (flag !== 'N/A' && deltaZ !== 0) flag = classify(score, model.boundary, band);

  return {
    available: true,
    n,
    band,
    before: { score: hospital.total, flag: hospital.paymentReduction },
    after: { score, flag },
    measures,
  };
}
