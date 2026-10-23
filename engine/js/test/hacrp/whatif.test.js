import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { bandTerm, baselineZ, zFromValue } from '../../hacrp/params.js';
import * as engine from '../../hacrp/whatif.js';

const { whatIf } = engine;
import { loadHacrp, submittedMeasures as submitted, submittedPairs } from './helpers.js';

const { hospitals, model } = loadHacrp();
const scored = hospitals.filter((h) => h.total !== null);
const moveBand = (h, id) => bandTerm(h.measures[id], model.params[id]);

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
  assert.ok(Math.abs(r.band - moveBand(h, id)) < 1e-15);
  assert.ok(Math.abs(r.measures[id].leverage - 1 / p.sd) < 1e-12);
});

test('leverage is per unit of the value, 1 / (n x sd); the display step is the site\'s, not the engine\'s', () => {
  const h = scored.find((x) => submitted(x).length === 6);
  const r = whatIf(h, model);
  for (const id of scoredMeasures(h)) assert.ok(Math.abs(r.measures[id].leverage - 1 / (r.n * model.params[id].sd)) < 1e-12, id);
  assert.equal(Object.hasOwn(engine, 'LEVERAGE_STEP'), false);
});

test('contribution is z / n and band sums the changed measures\' band terms over n', () => {
  const h = scored.find((x) => submitted(x).length === 6);
  const [a, b] = submitted(h);
  const r = whatIf(h, model, { [a]: model.params[a].median, [b]: model.params[b].median });
  assert.ok(Math.abs(r.band - (moveBand(h, a) + moveBand(h, b)) / 6) < 1e-15);
  for (const id of MEASURE_IDS) assert.ok(Math.abs(r.measures[id].contribution - r.measures[id].afterZ / 6) < 1e-15);
});

test('a hypothetical score between highestNo and lowestYes reads too-close', () => {
  const { highestNo, lowestYes } = model.boundary;
  const target = (highestNo + lowestYes) / 2;
  const step = ({ h }) => (target - h.total) * scoredMeasures(h).length;
  const zFor = (pair) => baselineZ(pair.h.measures[pair.id], model.params[pair.id]) + step(pair);
  const valueFor = (pair) => model.params[pair.id].mean + model.params[pair.id].sd * zFor(pair);
  const found = submittedPairs(hospitals, (h) => h.paymentReduction === 'Yes').find((pair) => {
    const p = model.params[pair.id];
    const v = valueFor(pair);
    const applied = pair.h.measures[pair.id].z + step(pair);
    return v > p.floor && v < p.cap && applied > p.zMin && applied < p.zMax;
  });
  const { h, id } = found;
  const value = valueFor(found);
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

test('mixed changes get a range; every move carries its band term', () => {
  const h = scored.find((x) => x.paymentReduction === 'No' && submitted(x).length === 6 && submitted(x).every((id) => x.measures[id].value < model.params[id].cap));
  const [a, b] = submitted(h);
  // a worsens a little, b improves to 0: mixed directions, judged on the range, still clearly No.
  const r = whatIf(h, model, { [a]: h.measures[a].value + 0.001, [b]: 0 });
  assert.ok(r.after.score < h.total);
  assert.equal(r.after.flag, 'No');
  assert.ok(Math.abs(r.band - (moveBand(h, a) + moveBand(h, b)) / 6) < 1e-15);
  assert.ok(Math.abs(whatIf(h, model, { [b]: 0 }).band - moveBand(h, b) / 6) < 1e-15);
});

test('no ties at the bounds: no row below CMS\'s max z sits at or past the cap, none above its min z at or below the floor', () => {
  for (const { h, id } of submittedPairs(hospitals)) {
    const { value, z } = h.measures[id];
    const p = model.params[id];
    if (z < p.zMax) assert.ok(value < p.cap, `${h.ccn} ${id}`);
    if (z > p.zMin) assert.ok(value > p.floor, `${h.ccn} ${id}`);
  }
});

test('the cap is the lowest value CMS published at its maximum z', () => {
  for (const id of MEASURE_IDS) {
    const p = model.params[id];
    const capped = submittedPairs(hospitals).filter((x) => x.id === id && x.h.measures[id].z === p.zMax).map((x) => x.h.measures[id].value);
    assert.ok(capped.includes(p.cap) && capped.every((v) => v >= p.cap), id);
  }
});

test('entering exactly the cap gives CMS\'s maximum z and reads atCap', () => {
  for (const { h, id } of submittedPairs(hospitals)) {
    const p = model.params[id];
    const r = whatIf(h, model, { [id]: p.cap }).measures[id];
    assert.equal(r.afterZ, p.zMax, `${h.ccn} ${id}`);
    assert.equal(r.atCap, true, `${h.ccn} ${id}`);
  }
});

test('PSI-90 one display unit above its floor takes the change-only step, not the floor', () => {
  const p = model.params.PSI90;
  const v = p.floor + 10 ** -p.decimals;
  const rows = scored.filter((x) => x.measures.PSI90.value > v);
  assert.ok(rows.length > 0);
  for (const h of rows) assert.ok(whatIf(h, model, { PSI90: v }).measures.PSI90.afterZ > p.zMin, h.ccn);
});

test('near the line, the what-if flag never contradicts CMS\'s own z at the new value', () => {
  // For each move to a value some hospital published, the score with CMS's z at that value is the truth the
  // band must cover. Checked wherever that true score lands within 0.002 of either side of the line.
  const { highestNo, lowestYes } = model.boundary;
  let checked = 0;
  for (const id of MEASURE_IDS) {
    const zAt = new Map();
    for (const { h } of submittedPairs(hospitals).filter((x) => x.id === id)) {
      const { value, z } = h.measures[id];
      zAt.set(value, zAt.has(value) && zAt.get(value) !== z ? NaN : z);
    }
    const published = [...zAt].filter(([, z]) => !Number.isNaN(z));
    for (const { h } of submittedPairs(hospitals, (x) => x.paymentReduction !== 'N/A').filter((x) => x.id === id)) {
      const n = scoredMeasures(h).length;
      for (const [v, z] of published) {
        const truth = h.total + (z - h.measures[id].z) / n;
        if (Math.abs(truth - highestNo) > 0.002 && Math.abs(truth - lowestYes) > 0.002) continue;
        checked++;
        const flag = whatIf(h, model, { [id]: v }).after.flag;
        if (flag === 'No') assert.ok(truth <= highestNo, `${h.ccn} ${id} -> ${v}: No but CMS z gives ${truth}`);
        if (flag === 'Yes') assert.ok(truth >= lowestYes, `${h.ccn} ${id} -> ${v}: Yes but CMS z gives ${truth}`);
      }
    }
  }
  assert.ok(checked > 1000);
});

test('dollarsOf: the cut for Yes, nothing for No or N/A, both for too close; whole dollars only', () => {
  const { dollarsOf } = engine;
  assert.equal(dollarsOf('Yes', 614_565), -614_565);
  assert.ok(Object.is(dollarsOf('No', 614_565), 0));
  assert.ok(Object.is(dollarsOf('Yes', 0), 0), 'no negative zero');
  assert.equal(dollarsOf('N/A', 614_565), 0);
  assert.deepEqual(dollarsOf('too-close', 614_565), [0, -614_565]);
  assert.throws(() => dollarsOf('Maybe', 1), RangeError);
  assert.throws(() => dollarsOf('Yes', 1.5), RangeError);
  assert.throws(() => dollarsOf('Yes', -1), RangeError);
  assert.throws(() => dollarsOf('Yes', null), RangeError);
});
