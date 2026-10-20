// Everything the what-if and solver need from the whole file: each measure's parameters and the cutoff boundary.
import { MEASURE_IDS } from './measures.js';
import { fitMeasureParams } from './params.js';
import { cutoffBoundary } from './score.js';

export function buildModel(hospitals) {
  return {
    params: Object.fromEntries(MEASURE_IDS.map((id) => [id, fitMeasureParams(hospitals, id)])),
    boundary: cutoffBoundary(hospitals),
  };
}
