import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital } from '../../hacrp/hospital.js';
import { fitMeasureParams } from '../../hacrp/params.js';
import { buildModel } from '../../hacrp/model.js';
import { syntheticRow } from './synthetic.js';

test('buildModel returns params for all six measures and the cutoff boundary', () => {
  const model = buildModel(loadHacrpFy2026().rows.map(toHospital));
  assert.deepEqual(Object.keys(model.params), MEASURE_IDS);
  assert.ok(model.boundary.lowestYes > model.boundary.highestNo);
});

test('a fit with too few uncapped points throws instead of returning NaN parameters', () => {
  const hs = [
    syntheticRow({ 'Facility ID': '000001', 'CDI SIR': '0.100', 'CDI W Z Score': '-1.0000' }),
    syntheticRow({ 'Facility ID': '000002', 'CDI SIR': '0.500', 'CDI W Z Score': '0.0000' }),
    syntheticRow({ 'Facility ID': '000003', 'CDI SIR': '0.900', 'CDI W Z Score': '1.0000' }),
  ].map(toHospital);
  assert.throws(() => fitMeasureParams(hs, 'CDI'), /CDI: fit/);
});
