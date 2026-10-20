import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital, scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { buildModel } from '../../hacrp/model.js';
import { zFromValue } from '../../hacrp/params.js';
import { whatIf } from '../../hacrp/whatif.js';

const hospitals = loadHacrpFy2026().rows.map(toHospital);
const model = buildModel(hospitals);
const scored = hospitals.filter((h) => h.total !== null);
const submitted = (h) => scoredMeasures(h).filter((id) => !isAssigned(h.measures[id]));

test('no change = CMS exactly, for every row in the file', () => {
  for (const h of hospitals) {
    const r = whatIf(h, model);
    if (h.total === null) {
      assert.equal(r.available, false, h.ccn);
      assert.equal(r.reason, 'no-score');
      assert.deepEqual(r.cms, { totalText: h.totalText, totalFootnote: h.totalFootnote, paymentReduction: h.paymentReduction });
      continue;
    }
    assert.equal(r.available, true, h.ccn);
    assert.equal(r.before.score, h.total, h.ccn);
    assert.equal(r.after.score, h.total, h.ccn);
    assert.equal(r.before.flag, h.paymentReduction, h.ccn);
    assert.equal(r.after.flag, h.paymentReduction, h.ccn);
    assert.equal(r.band, 0);
    assert.deepEqual(Object.keys(r.measures), scoredMeasures(h));
    for (const id of scoredMeasures(h)) {
      assert.equal(r.measures[id].afterZ, h.measures[id].z, `${h.ccn} ${id}`);
      assert.equal(r.measures[id].changed, false);
    }
  }
});

test('setting a value to its published value is no change', () => {
  for (const h of scored) {
    const changes = Object.fromEntries(submitted(h).map((id) => [id, h.measures[id].value]));
    const r = whatIf(h, model, changes);
    assert.equal(r.after.score, h.total, h.ccn);
    assert.equal(r.after.flag, h.paymentReduction, h.ccn);
    assert.equal(r.band, 0);
  }
});

test('no movement between two values above the cap', () => {
  const pick = scored.flatMap((h) => submitted(h).map((id) => ({ h, id }))).find(({ h, id }) => h.measures[id].value > model.params[id].cap);
  assert.ok(pick, 'FY2026 has a measure above its cap');
  const { h, id } = pick;
  const r = whatIf(h, model, { [id]: model.params[id].cap * 1.2 + 0.5 });
  assert.equal(r.after.score, h.total);
  assert.equal(r.measures[id].atCap, true);
});

test('an assigned measure starts at CMS and moves only when the reader enters a value', () => {
  const h = scored.find((x) => x.paymentReduction !== 'N/A' && scoredMeasures(x).some((id) => isAssigned(x.measures[id])));
  const id = scoredMeasures(h).find((x) => isAssigned(h.measures[x]));
  assert.equal(whatIf(h, model).after.score, h.total);
  const r = whatIf(h, model, { [id]: model.params[id].median });
  assert.equal(r.measures[id].assigned, true);
  assert.ok(r.after.score < h.total);
  const n = scoredMeasures(h).length;
  assert.ok(Math.abs(r.after.score - (h.total + (zFromValue(model.params[id].median, model.params[id]) - h.measures[id].z) / n)) < 1e-12);
});

test('Maryland (scored, flag N/A) keeps N/A under any change', () => {
  const h = scored.find((x) => x.paymentReduction === 'N/A');
  const id = submitted(h)[0];
  for (const v of [0, model.params[id].median, model.params[id].cap * 2]) {
    assert.equal(whatIf(h, model, { [id]: v }).after.flag, 'N/A');
  }
});

test('a one-measure hospital uses n = 1 for band and leverage', () => {
  const h = scored.find((x) => scoredMeasures(x).length === 1 && submitted(x).length === 1 && x.paymentReduction !== 'N/A');
  const id = submitted(h)[0];
  const p = model.params[id];
  const r = whatIf(h, model, { [id]: p.median });
  assert.equal(r.n, 1);
  assert.equal(r.band, p.fitError);
  assert.ok(Math.abs(r.measures[id].leveragePerTenth - 0.1 / p.sd) < 1e-12);
});

test('contribution is z / n and band sums the changed measures\' fit errors over n', () => {
  const h = scored.find((x) => submitted(x).length === 6);
  const [a, b] = submitted(h);
  const r = whatIf(h, model, { [a]: model.params[a].median, [b]: model.params[b].median });
  assert.ok(Math.abs(r.band - (model.params[a].fitError + model.params[b].fitError) / 6) < 1e-15);
  for (const id of MEASURE_IDS) assert.ok(Math.abs(r.measures[id].contribution - r.measures[id].afterZ / 6) < 1e-15);
});

test('a hypothetical score between highestNo and lowestYes reads too-close', () => {
  const { highestNo, lowestYes } = model.boundary;
  const target = (highestNo + lowestYes) / 2;
  const found = scored.filter((h) => h.paymentReduction === 'Yes').flatMap((h) => submitted(h).map((id) => ({ h, id }))).find(({ h, id }) => {
    const p = model.params[id];
    const z = zFromValue(h.measures[id].value, p) + (target - h.total) * scoredMeasures(h).length;
    return z > p.zMin && z < p.zMax;
  });
  const { h, id } = found;
  const p = model.params[id];
  const value = p.mean + p.sd * (zFromValue(h.measures[id].value, p) + (target - h.total) * scoredMeasures(h).length);
  const r = whatIf(h, model, { [id]: value });
  assert.ok(Math.abs(r.after.score - target) < 1e-9);
  assert.equal(r.after.flag, 'too-close');
});

test('invalid changes throw RangeError', () => {
  const h = scored.find((x) => scoredMeasures(x).length < 6);
  const missing = MEASURE_IDS.find((id) => h.measures[id].z === null);
  const present = scoredMeasures(h)[0];
  assert.throws(() => whatIf(h, model, { [missing]: 1 }), RangeError);
  assert.throws(() => whatIf(h, model, { NOPE: 1 }), RangeError);
  assert.throws(() => whatIf(h, model, { [present]: -0.1 }), RangeError);
  assert.throws(() => whatIf(h, model, { [present]: Number.NaN }), RangeError);
  assert.throws(() => whatIf(h, model, { [present]: Infinity }), RangeError);
});
