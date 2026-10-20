import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital } from '../../hacrp/hospital.js';
import { fitMeasureParams, estimateTagged } from '../../hacrp/params.js';
import { buildModel } from '../../hacrp/model.js';
import { whatIf } from '../../hacrp/whatif.js';
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

test('a move off the cap carries the starting row\'s own miss; an uncapped move on an exact line carries none', () => {
  // z = (v - 0.5) / 0.25 exactly between the bounds; CMS's cap (1.495) falls between the observed 1.5 and 1.6.
  const rows = ['0.000', '0.300', '0.500', '0.700', '0.900', '1.100', '1.300'].map((v, i) =>
    syntheticRow({ 'Facility ID': `00010${i}`, 'CDI SIR': v, 'CDI W Z Score': ((Number(v) - 0.5) / 0.25).toFixed(4) }));
  for (const [i, v] of ['1.500', '1.600'].entries()) {
    rows.push(syntheticRow({ 'Facility ID': `00020${i}`, 'CDI SIR': v, 'CDI W Z Score': '3.9800' }));
  }
  const hs = rows.map(toHospital);
  const p = fitMeasureParams(hs, 'CDI');
  assert.equal(p.cap, 1.5);
  assert.ok(p.fitError < 1e-9, `fitError ${p.fitError}`); // exact on uncapped rows; the line gives 4.00 at 1.5, CMS 3.98

  // A capped hospital moving to 1.3: the line says z 3.18, CMS's own map would say 3.20, past the line. The band
  // must cover that, so the flag reads too-close, not No.
  const params = Object.fromEntries(MEASURE_IDS.map((id) => [id, { ...p, id }]));
  const capped = { ...hs.find((h) => h.measures.CDI.value === 1.6) };
  capped.measures = Object.fromEntries(MEASURE_IDS.map((id) => [id, id === 'CDI' ? capped.measures.CDI : { value: null, z: null }]));
  capped.total = 3.98;
  capped.paymentReduction = 'Yes';
  const r = whatIf(capped, { params, boundary: { highestNo: 3.19, lowestYes: 3.21 } }, { CDI: 1.3 });
  assert.equal(r.after.flag, 'too-close');

  // An uncapped hospital moving between uncapped values is exact here: 0.300 -> 0.595 gives 0.38, at most 0.39.
  const inside = { ...hs.find((h) => h.measures.CDI.value === 0.3) };
  inside.measures = Object.fromEntries(MEASURE_IDS.map((id) => [id, id === 'CDI' ? inside.measures.CDI : { value: null, z: null }]));
  inside.total = -0.8;
  inside.paymentReduction = 'No';
  assert.equal(whatIf(inside, { params, boundary: { highestNo: 0.39, lowestYes: 0.41 } }, { CDI: 0.595 }).after.flag, 'No');
});

test('opposite moves that cancel are still re-judged with the band, not handed CMS\'s flag', () => {
  const p = { mean: 0.5, sd: 0.25, floor: 0, cap: 1, zMin: -2, zMax: 2, decimals: 3, fitError: 0.001 };
  const params = Object.fromEntries(MEASURE_IDS.map((id) => [id, { ...p, id }]));
  const [a, b] = MEASURE_IDS;
  const measures = Object.fromEntries(MEASURE_IDS.map((id) => [id, id === a || id === b ? { value: 0.5, z: 0 } : { value: null, z: null }]));
  const h = { ccn: 'S1', total: 0.41, paymentReduction: 'Yes', measures };
  const r = whatIf(h, { params, boundary: { highestNo: 0.4, lowestYes: 0.41 } }, { [a]: 0.6, [b]: 0.4 });
  assert.ok(Math.abs(r.band - 0.001) < 1e-15);
  assert.equal(r.after.flag, 'too-close');
});
