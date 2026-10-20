// HACRP what-if: change one or more measure values and see the Total HAC Score and flag move.
//
// Anchored on CMS: with nothing changed, every output is CMS's published value. A change moves the score by
// the change in that measure's z, using CMS's fitted parameters, divided by the number of measures the hospital
// has (n). Everything else is held fixed: other hospitals, CMS's parameters, and the line between CMS's
// "No" and "Yes" decisions.
import { scoredMeasures, isAssigned } from './hospital.js';
import { EDGE, bandTerm, hypotheticalZ } from './params.js';
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
  let anyUp = false;
  let anyDown = false;
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
      // A move smaller than float noise is no move. The band term is the same for every move of this measure,
      // so the flag changes in one direction only as a value rises.
      if (Math.abs(z - m.z) >= EDGE) {
        afterZ = z;
        deltaZ += z - m.z;
        fitErrors += bandTerm(m, p);
        if (z > m.z) anyUp = true;
        else anyDown = true;
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
      leveragePerTenth: 0.1 / (n * p.sd),
    };
  }

  const cms = hospital.paymentReduction;
  // Opposite moves that cancel are still moves: each can miss CMS's z, so they are re-judged with the band.
  const moved = (anyUp && anyDown) || Math.abs(deltaZ) >= EDGE;
  const band = moved ? fitErrors / n : 0;
  const score = moved ? hospital.total + deltaZ / n : hospital.total;
  // CMS's own value -> z map only rises with the value, so when every change moves away from the line (all
  // lower for a "No", all higher for a "Yes"), CMS's decision stands. Anything else is re-judged with the band.
  const awayFromLine = (cms === 'No' && !anyUp) || (cms === 'Yes' && !anyDown);
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
