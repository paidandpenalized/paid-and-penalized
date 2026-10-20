import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { baselineZ, zFromValue } from '../../hacrp/params.js';
import { whatIf } from '../../hacrp/whatif.js';
import { loadHacrp, submittedMeasures as submitted, submittedPairs } from './helpers.js';

const { hospitals, model } = loadHacrp();
const scored = hospitals.filter((h) => h.total !== null);

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
  const pick = submittedPairs(hospitals).find(({ h, id }) => h.measures[id].value > model.params[id].cap);
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
  const zFor = ({ h, id }) => baselineZ(h.measures[id], model.params[id]) + (target - h.total) * scoredMeasures(h).length;
  const found = submittedPairs(hospitals, (h) => h.paymentReduction === 'Yes').find((pair) => {
    const z = zFor(pair);
    return z > model.params[pair.id].zMin && z < model.params[pair.id].zMax;
  });
  const { h, id } = found;
  const value = model.params[id].mean + model.params[id].sd * zFor(found);
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

test('a value past the cap gets exactly CMS\'s maximum z and reads atCap; 0 gets exactly CMS\'s minimum z', () => {
  for (const { h, id } of submittedPairs(hospitals)) {
    const p = model.params[id];
    const up = whatIf(h, model, { [id]: p.cap * 2 + 1 }).measures[id];
    assert.equal(up.atCap, true, `${h.ccn} ${id}`);
    assert.equal(up.afterZ, p.zMax, `${h.ccn} ${id}`);
    const down = whatIf(h, model, { [id]: 0 }).measures[id];
    assert.equal(down.afterZ, p.zMin, `${h.ccn} ${id}`);
  }
});

test('an assigned measure entered above the cap is no change: score === CMS, band 0, CMS flag', () => {
  for (const h of scored) {
    for (const id of scoredMeasures(h).filter((x) => isAssigned(h.measures[x]))) {
      const r = whatIf(h, model, { [id]: model.params[id].cap * 3 });
      assert.equal(r.after.score, h.total, `${h.ccn} ${id}`);
      assert.equal(r.band, 0, `${h.ccn} ${id}`);
      assert.equal(r.after.flag, h.paymentReduction, `${h.ccn} ${id}`);
    }
  }
});

test('a move away from the line keeps CMS\'s flag: No stays No when a measure improves, Yes stays Yes when one worsens', () => {
  for (const { h, id } of submittedPairs(hospitals, (x) => x.paymentReduction !== 'N/A')) {
    const v = h.measures[id].value;
    if (h.paymentReduction === 'No' && v > 0) assert.equal(whatIf(h, model, { [id]: Math.max(0, v - 0.00001) }).after.flag, 'No', `${h.ccn} ${id}`);
    if (h.paymentReduction === 'Yes') assert.equal(whatIf(h, model, { [id]: v + 0.00001 }).after.flag, 'Yes', `${h.ccn} ${id}`);
  }
});

test('mixed changes: a net move away from the line keeps CMS\'s flag; every move carries its measure\'s fit error', () => {
  const h = scored.find((x) => x.paymentReduction === 'No' && submitted(x).length === 6 && submitted(x).every((id) => x.measures[id].value < model.params[id].cap));
  const [a, b] = submitted(h);
  const pa = model.params[a];
  const pb = model.params[b];
  // a worsens a little, b improves to 0: net away from the line.
  const r = whatIf(h, model, { [a]: h.measures[a].value + 0.001, [b]: 0 });
  assert.ok(r.after.score < h.total);
  assert.equal(r.after.flag, 'No');
  assert.ok(Math.abs(r.band - (pa.fitError + pb.fitError) / 6) < 1e-15);
  assert.ok(Math.abs(whatIf(h, model, { [b]: 0 }).band - pb.fitError / 6) < 1e-15);
});

test('rows CMS published at the cap read atCap with no change', () => {
  const capped = submittedPairs(hospitals).filter(({ h, id }) => h.measures[id].z === model.params[id].zMax);
  assert.ok(capped.length > 100);
  for (const { h, id } of capped) assert.equal(whatIf(h, model).measures[id].atCap, true, `${h.ccn} ${id}`);
});

test('entering the value CMS capped at gives exactly CMS\'s maximum z', () => {
  for (const { h, id } of submittedPairs(hospitals)) {
    const p = model.params[id];
    const capValues = hospitals.map((x) => x.measures[id]).filter((m) => m.value !== null && m.z === p.zMax).map((m) => m.value);
    const cmsCap = Math.min(...capValues);
    const r = whatIf(h, model, { [id]: cmsCap }).measures[id];
    assert.equal(r.afterZ, p.zMax, `${h.ccn} ${id}`);
    assert.equal(r.atCap, true, `${h.ccn} ${id}`);
  }
});

test('PSI-90 one display unit above its floor takes the change-only step, not the floor', () => {
  const p = model.params.PSI90;
  const v = p.floor + 10 ** -p.decimals;
  const h = scored.find((x) => x.measures.PSI90.value > v + 0.01 && x.measures.PSI90.z >= baselineZ(x.measures.PSI90, p));
  assert.ok(whatIf(h, model, { PSI90: v }).measures.PSI90.afterZ > p.zMin);
});
