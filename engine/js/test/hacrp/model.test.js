import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital } from '../../hacrp/hospital.js';
import { fitMeasureParams, estimateTagged } from '../../hacrp/params.js';
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

test('estimateTagged throws on a degenerate recompute instead of reporting an exact match', () => {
  const hs = ['0.500', '0.500', '0.500', '0.500'].map((v, i) =>
    toHospital(syntheticRow({ 'Facility ID': `00000${i}`, 'CDI SIR': v, 'CDI W Z Score': '0.0000' })));
  assert.throws(() => estimateTagged(hs, 'CDI'), RangeError);
});

test('the cap comes from hospitals with a published value, not from assigned z-scores', () => {
  const rows = [['0.100', '-1.0000'], ['0.300', '-0.5000'], ['0.500', '0.0000'], ['0.700', '0.5000'], ['0.900', '1.0000']]
    .map(([v, z], i) => syntheticRow({ 'Facility ID': `00000${i}`, 'CDI SIR': v, 'CDI W Z Score': z }));
  rows.push(syntheticRow({ 'Facility ID': '000009', 'CDI SIR': 'N/A', 'CDI W Z Score': '3.0000' }));
  const p = fitMeasureParams(rows.map(toHospital), 'CDI');
  assert.equal(p.zMax, 1);
  assert.ok(Math.abs(p.cap - 0.9) < 1e-12);
});
