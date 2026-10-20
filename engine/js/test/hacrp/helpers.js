// Shared HACRP test setup: the pinned FY2026 file as Hospital records, its model, and row pickers by property.
import { loadHacrpFy2026 } from '../fixtures.js';
import { toHospital, scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { buildModel } from '../../hacrp/model.js';

export function loadHacrp() {
  const hospitals = loadHacrpFy2026().rows.map(toHospital);
  return { hospitals, model: buildModel(hospitals) };
}

// Measures with a published z and a published value (not assigned by CMS).
export function submittedMeasures(h) {
  return scoredMeasures(h).filter((id) => !isAssigned(h.measures[id]));
}

// One { h, id } per submitted measure of every scored hospital that passes keep.
export function submittedPairs(hospitals, keep = () => true) {
  return hospitals.filter((h) => h.total !== null && keep(h)).flatMap((h) => submittedMeasures(h).map((id) => ({ h, id })));
}
