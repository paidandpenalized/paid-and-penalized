import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, dollarsPath, readJson } from '../../../pipeline/files.js';
import { HAC_RATE, derivedDollars, netShare, pctOf, pctOfPay, programDollars, roundHalfEven } from '../dollars/whatif.js';
import { mulberry32 } from './prng.js';

// The hub's common fiscal year.
const dollars = readJson(REPO_ROOT + dollarsPath(2026));
const estimated = dollars.hospitals.filter((h) => h.status === 'estimated');

const SHOWN = ['hrrp', 'hvbp', 'hac', 'net', 'after', 'atStake'];
const shown = (row) => Object.fromEntries(SHOWN.map((k) => [k, row[k]]));

// A synthetic row, its figures worked from the rule: hrrp = round(1e6 x -0.01), hvbp = round(1e6 x 0.01),
// after = total + hrrp + hvbp, atStake = round(0.01 x after), hac = -atStake, net = hrrp + hvbp + hac.
const synthetic = (over = {}) => ({
  base: 1e6, total: 1.4e6, hrrpFactor: 0.99, vbpFactor: 1.01, cut: true,
  hrrp: -10000, hvbp: 10000, hac: -14000, net: -14000, after: 1.4e6, atStake: 14000, ...over,
});

test('HAC_RATE is the 1% of what a hospital is paid after the other two programs', () => assert.equal(HAC_RATE, 0.01));

test('with no scenario, one equal to the actual values, or one within 1e-9 of them, every estimated row in the file is reproduced exactly', () => {
  assert.equal(estimated.length, dollars.national.hospitals);
  for (const row of estimated) {
    const want = shown(row);
    assert.deepEqual(programDollars(row), want, row.ccn);
    assert.deepEqual(programDollars(row, null), want, row.ccn);
    assert.deepEqual(programDollars(row, {}), want, row.ccn);
    const same = { hrrpFactor: row.hrrpFactor, vbpFactor: row.vbpFactor, cut: row.cut };
    assert.deepEqual(programDollars(row, same), want, row.ccn);
    const near = { hrrpFactor: row.hrrpFactor + 5e-10, vbpFactor: row.vbpFactor - 5e-10 };
    assert.deepEqual(programDollars(row, near), want, row.ccn);
  }
});

test('changing one program leaves the others as the row has them, and nothing is negative zero', () => {
  const alone = estimated.find((r) => r.hrrp < 0 && r.vbpListed && r.hvbp > 0);
  assert.ok(alone, 'the file has a row with a penalty and a bonus');
  const moved = programDollars(alone, { hrrpFactor: 1 });
  assert.ok(Object.is(moved.hrrp, 0));
  assert.equal(moved.hvbp, alone.hvbp);
  for (const row of estimated) {
    for (const v of Object.values(programDollars(row, { hrrpFactor: 1, vbpFactor: 1, cut: false }))) {
      assert.ok(!Object.is(v, -0), row.ccn);
    }
  }
});

test('roundHalfEven: ties go to the even integer, like Python round', () => {
  assert.equal(roundHalfEven(2.5), 2);
  assert.equal(roundHalfEven(3.5), 4);
  assert.equal(roundHalfEven(-2.5), -2);
  assert.equal(roundHalfEven(-3.5), -4);
  assert.equal(roundHalfEven(2.5001), 3);
  assert.equal(roundHalfEven(-2.5001), -3);
  assert.equal(roundHalfEven(1e9 + 0.5), 1e9);
  assert.equal(roundHalfEven(1e9 + 1.5), 1e9 + 2);
});

test('roundHalfEven never returns negative zero, and refuses what is not a finite number', () => {
  for (const x of [-0.4, -0.5, -0, 0, 0.4, 0.5]) assert.ok(Object.is(roundHalfEven(x), 0), String(x));
  for (const x of [NaN, Infinity, -Infinity]) assert.throws(() => roundHalfEven(x), RangeError, String(x));
});

test('derivedDollars: the pay after Readmissions and value-based purchasing, and 1% of it rounded half to even', () => {
  assert.deepEqual(derivedDollars({ total: 1.4e6, hrrp: -30000, hvbp: 10000 }), { after: 1380000, atStake: 13800 });
  // 1% of 250 is 2.5, a tie: the even whole dollar.
  assert.deepEqual(derivedDollars({ total: 300, hrrp: -40, hvbp: -10 }), { after: 250, atStake: 2 });
  assert.throws(() => derivedDollars({ total: NaN, hrrp: 0, hvbp: 0 }), RangeError);
  // A row's own after and atStake are what the rule gives, for every estimated row in the file.
  for (const row of estimated) assert.deepEqual(derivedDollars(row), { after: row.after, atStake: row.atStake }, row.ccn);
});

test('a synthetic row: the actual figures, then a changed HRRP factor', () => {
  const row = synthetic();
  assert.deepEqual(programDollars(row), shown(row));
  // hrrp = round(1e6 x (0.97 - 1)) = -30000; after = 1.4e6 - 30000 + 10000 = 1,380,000; atStake = 13800.
  assert.deepEqual(programDollars(row, { hrrpFactor: 0.97 }),
    { hrrp: -30000, hvbp: 10000, hac: -13800, net: -33800, after: 1380000, atStake: 13800 });
});

test('a synthetic row: no cut gives a plain zero HAC and keeps the other programs and the at-stake figure', () => {
  const row = synthetic();
  const r = programDollars(row, { cut: false });
  assert.ok(Object.is(r.hac, 0));
  assert.equal(r.hrrp, row.hrrp);
  assert.equal(r.hvbp, row.hvbp);
  assert.equal(r.atStake, row.atStake);
  assert.equal(r.after, row.after);
  assert.equal(r.net, 0);
  // A row with no cut, given one: hac = -atStake.
  const none = synthetic({ cut: false, hac: 0, net: 0 });
  assert.equal(programDollars(none, { cut: true }).hac, -14000);
  assert.equal(programDollars(none, { cut: true }).net, -14000);
});

test('a synthetic row: a changed VBP factor moves hvbp and, through after, the HAC figure', () => {
  // hvbp = round(1e6 x (0.98 - 1)) = -20000; after = 1.4e6 - 10000 - 20000 = 1,370,000; atStake = 13700.
  assert.deepEqual(programDollars(synthetic(), { vbpFactor: 0.98 }),
    { hrrp: -10000, hvbp: -20000, hac: -13700, net: -43700, after: 1370000, atStake: 13700 });
});

test('a changed factor with no cut recomputes after and atStake but pays no HAC', () => {
  const r = programDollars(synthetic({ cut: false, hac: 0, net: 0 }), { hrrpFactor: 0.97 });
  assert.ok(Object.is(r.hac, 0));
  assert.equal(r.atStake, 13800);
  assert.equal(r.net, -20000);
});

test('a changed factor that rounds to zero dollars gives a plain zero, not negative zero', () => {
  const r = programDollars(synthetic({ base: 10, total: 14, hrrp: 0, hvbp: 0, hac: 0, net: 0, after: 14, atStake: 0 }),
    { hrrpFactor: 0.99, vbpFactor: 1 });
  assert.ok(Object.is(r.hrrp, 0));
  assert.ok(Object.is(r.hac, 0));
  assert.ok(Object.is(r.net, 0));
});

test('lowering the HRRP factor never raises the net', () => {
  const rand = mulberry32(2026);
  const factors = Array.from({ length: 100 }, () => 0.97 + rand() * 0.03).sort((a, b) => b - a);
  for (const cut of [true, false]) {
    const row = synthetic({ cut });
    const nets = factors.map((hrrpFactor) => programDollars(row, { hrrpFactor }).net);
    nets.slice(1).forEach((net, i) => assert.ok(net <= nets[i], `cut ${cut}: ${factors[i]} -> ${factors[i + 1]}`));
  }
});

test('a scenario that is not a number or not a boolean throws instead of printing NaN', () => {
  const row = synthetic();
  assert.throws(() => programDollars(row, { hrrpFactor: NaN }), RangeError);
  assert.throws(() => programDollars(row, { vbpFactor: Infinity }), RangeError);
  assert.throws(() => programDollars(row, { cut: 'yes' }), TypeError);
});

test('a changed factor must be a positive adjustment factor, as the Python twin\'s _factor requires: zero and negatives throw', () => {
  const row = synthetic();
  for (const key of ['hrrpFactor', 'vbpFactor']) {
    for (const bad of [0, -0, -0.5, -1]) {
      assert.throws(() => programDollars(row, { [key]: bad }), (e) => e instanceof RangeError && e.message.includes(key), `${key} ${bad}`);
    }
  }
  // Even a value equal to the row's own factor is refused when it is not positive: the check is on the scenario.
  assert.throws(() => programDollars(synthetic({ hrrpFactor: 0 }), { hrrpFactor: 0 }), RangeError);
  // A small positive factor is a legal (if extreme) scenario: the whole base is taken.
  assert.equal(programDollars(row, { hrrpFactor: 0.000001 }).hrrp, -1000000 + 1);
  assert.equal(programDollars(row, { hrrpFactor: 1e-9 * 2 }).hrrp, -1000000);
});

test('pctOf: each program\'s dollars and the net as a percent of the estimated pay', () => {
  assert.deepEqual(pctOf({ total: 1000, hrrp: -30, hac: -10, hvbp: 20, net: -20, base: 800 }), { hrrp: -3, hac: -1, hvbp: 2, net: -2 });
  // pctOfPay: any dollars that way (a sum of two programs').
  assert.equal(pctOfPay(-30 + -10, 1000), -4);
});

test('netShare is a fraction of the estimated Medicare inpatient pay', () => {
  assert.equal(netShare(-5, 1000), -0.005);
  assert.equal(netShare(0, 1000), 0);
  assert.equal(netShare(250, 1000), 0.25);
});

test('netShare throws unless the pay is above zero', () => {
  assert.throws(() => netShare(1, 0), RangeError);
  assert.throws(() => netShare(1, -10), RangeError);
  assert.throws(() => netShare(1, NaN), RangeError);
});
