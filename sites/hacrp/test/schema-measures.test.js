// The HACRP schema spells the six measures out by hand (the validator has no patternProperties); they must
// match the engine's list exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { loadSchemas } from '../../../pipeline/files.js';

const s = loadSchemas()['hacrp.schema.json'];
const sorted = (xs) => [...xs].sort();

test('every per-measure object in the schema lists exactly the engine\'s measures', () => {
  const maps = {
    'model.params': s.properties.model.properties.params,
    estimate: s.properties.estimate,
    'hospital.measures': s.$defs.hospital.properties.measures,
  };
  for (const [where, m] of Object.entries(maps)) {
    assert.deepEqual(sorted(m.required), sorted(MEASURE_IDS), where);
    assert.deepEqual(sorted(Object.keys(m.properties)), sorted(MEASURE_IDS), where);
  }
  assert.deepEqual(sorted(s.$defs.measureId.enum), sorted(MEASURE_IDS));
});
