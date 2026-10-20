import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital, isAssigned } from '../../hacrp/hospital.js';
import { fitMeasureParams, zFromValue, estimateTagged } from '../../hacrp/params.js';
import { buildModel } from '../../hacrp/model.js';

const hospitals = loadHacrpFy2026().rows.map(toHospital);
const params = Object.fromEntries(MEASURE_IDS.map((id) => [id, fitMeasureParams(hospitals, id)]));

// Documented fit tolerances: CMS's own parameters reproduce every SIR z within 0.0001 and PSI-90 within 0.0004
// (PSI-90 was scored on unrounded values; the public file has 4 decimals).
const FIT_TOLERANCE = { PSI90: 0.0004, CLABSI: 0.0001, CAUTI: 0.0001, SSI: 0.0001, CDI: 0.0001, MRSA: 0.0001 };

for (const id of MEASURE_IDS) {
  test(`${id}: CMS's parameters, fit from published value-z pairs, reproduce every published z within tolerance`, (t) => {
    const p = params[id];
    t.diagnostic(JSON.stringify(p));
    assert.ok(p.fitError <= FIT_TOLERANCE[id], `fitError ${p.fitError}`);
    assert.ok(p.sd > 0 && p.floor < p.cap && p.zMin < p.zMax);
  });

  test(`${id}: zFromValue clamps at the cap and the floor and never decreases`, () => {
    const p = params[id];
    assert.equal(zFromValue(p.cap + 1, p), zFromValue(p.cap, p));
    assert.equal(zFromValue(p.floor - 1, p), zFromValue(p.floor, p));
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const z = zFromValue((p.cap * 1.5 * i) / 1000, p);
      assert.ok(z >= prev);
      prev = z;
    }
  });

  test(`${id}: every assigned (non-submitted) measure sits at the measure's maximum z`, () => {
    const assigned = hospitals.filter((h) => isAssigned(h.measures[id]));
    for (const h of assigned) assert.ok(Math.abs(h.measures[id].z - params[id].zMax) < 1e-9, h.ccn);
  });
}

test('display decimals follow CMS: 4 for PSI-90, 3 for the SIRs', () => {
  assert.equal(params.PSI90.decimals, 4);
  for (const id of MEASURE_IDS.slice(1)) assert.equal(params[id].decimals, 3);
});

test('median lies between floor and cap', () => {
  for (const id of MEASURE_IDS) assert.ok(params[id].median >= params[id].floor && params[id].median <= params[id].cap, id);
});

test('A1(c) estimate tag: FY2026 tags exactly PSI-90 and CDI; SSI and MRSA recompute within 0.0001', (t) => {
  const result = Object.fromEntries(MEASURE_IDS.map((id) => [id, estimateTagged(hospitals, id)]));
  t.diagnostic(JSON.stringify(result));
  assert.deepEqual(MEASURE_IDS.filter((id) => result[id].tagged), ['PSI90', 'CDI']);
  assert.ok(result.SSI.maxError <= 0.0001);
  assert.ok(result.MRSA.maxError <= 0.0001);
});

test('buildModel returns params for all six measures and the cutoff boundary', () => {
  const model = buildModel(hospitals);
  assert.deepEqual(Object.keys(model.params), MEASURE_IDS);
  assert.ok(model.boundary.lowestYes > model.boundary.highestNo);
});
