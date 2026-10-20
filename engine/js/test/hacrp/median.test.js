import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { zFromValue } from '../../hacrp/params.js';
import { totalFromZ } from '../../hacrp/score.js';
import { whatIf } from '../../hacrp/whatif.js';
import { MEDIAN_CCN, isMedianHospital, medianHospital } from '../../hacrp/median.js';
import { loadHacrp } from './helpers.js';

const { model } = loadHacrp();
const round4 = (x) => Math.round(x * 1e4) / 1e4;

test('the median hospital has the shape of a Hospital record', () => {
  const h = medianHospital(model);
  assert.equal(h.ccn, '000000');
  assert.equal(h.name, null);
  assert.equal(h.state, null);
  assert.deepEqual(Object.keys(h.measures), [...MEASURE_IDS]);
  for (const id of MEASURE_IDS) {
    const m = h.measures[id];
    assert.deepEqual(Object.keys(m), ['value', 'valueText', 'valueFootnote', 'z', 'zText', 'zFootnote']);
    assert.equal(m.valueFootnote, '');
    assert.equal(m.zFootnote, '');
    assert.equal(m.zText, m.z.toFixed(4));
  }
  assert.equal(h.totalText, h.total.toFixed(4));
  assert.equal(h.totalFootnote, '');
  assert.equal(h.paymentReductionFootnote, '');
});

test('each value is the measure median, rounded to the measure decimals (float noise snapped)', () => {
  const h = medianHospital(model);
  for (const id of MEASURE_IDS) {
    const p = model.params[id];
    const m = h.measures[id];
    assert.equal(m.valueText, m.value.toFixed(p.decimals), id);
    assert.ok(Math.abs(m.value - p.median) <= 0.5 * 10 ** -p.decimals + 1e-9, id);
    assert.equal(Number(m.valueText), m.value, id);
  }
  // Medians sitting on a half step round up, not to the noisy float neighbour.
  assert.equal(h.measures.MRSA.valueText, '0.641');
  assert.equal(h.measures.SSI.valueText, '0.795');
});

test('every z is the fitted z of the median value to 4 dp; total and decision follow', () => {
  const h = medianHospital(model);
  const zs = [];
  for (const id of MEASURE_IDS) {
    const m = h.measures[id];
    const z = round4(zFromValue(m.value, model.params[id]));
    assert.equal(m.z, z, id);
    zs.push(z);
  }
  assert.equal(h.total, round4(totalFromZ(zs)));
  assert.equal(h.paymentReduction, 'No');
});

test('the what-if runs on it with no change', () => {
  const h = medianHospital(model);
  const r = whatIf(h, model);
  assert.equal(r.available, true);
  assert.equal(r.n, MEASURE_IDS.length);
  assert.equal(r.before.flag, 'No');
  assert.equal(r.after.flag, 'No');
  assert.equal(r.before.score, h.total);
  assert.equal(r.after.score, h.total);
  assert.equal(r.band, 0);
  for (const id of MEASURE_IDS) assert.equal(r.measures[id].changed, false);
});

test('optional fiscal year and periods are carried through', () => {
  const periods = { psi90: { start: 'a', end: 'b' }, hai: { start: 'c', end: 'd' } };
  const h = medianHospital(model, { fiscalYear: '2026', periods });
  assert.equal(h.fiscalYear, '2026');
  assert.deepEqual(h.periods, periods);
  const bare = medianHospital(model);
  assert.equal(bare.fiscalYear, null);
  assert.deepEqual(bare.periods, { psi90: { start: null, end: null }, hai: { start: null, end: null } });
});

test('isMedianHospital tells the median hospital from every row in the file', () => {
  const { hospitals } = loadHacrp();
  assert.equal(MEDIAN_CCN, '000000');
  assert.equal(isMedianHospital(medianHospital(model)), true);
  assert.equal(hospitals.some(isMedianHospital), false);
  assert.equal(isMedianHospital(null), false);
});
