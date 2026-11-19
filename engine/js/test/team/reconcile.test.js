// The reconciliation (42 CFR 512.550): CMS's quality-adjustment examples for every track, the limits, the low-volume
// cap, the Track 1 floor, then the band, the solver and the marginal figures. No hospital appears; every input is a
// made-up number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, bandOf, solveSpend, marginal } from '../../team/reconcile.js';
import { BAND_DEFAULT, SOLVE_SPAN } from '../../team/params.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const one = (spend, extra = {}) => [{ key: 'x', target: 1_000_000, spend, lowVolume: false, ...extra }];

// CMS's fact-sheet examples: a reconciliation amount of plus or minus ten thousand dollars at a CQS of 100, 50 and 0.
// One category, target a million, so a 1% spending miss is the amount and no limit binds.
const GOLDEN = [
  // [track, amount, result at CQS 100, at 50, at 0]
  [1, 10_000, 10_000, 9_500, 9_000],
  [1, -10_000, 0, 0, 0],
  [2, 10_000, 10_000, 9_500, 9_000],
  [2, -10_000, -8_500, -9_250, -10_000],
  [3, 10_000, 10_000, 9_500, 9_000],
  [3, -10_000, -9_000, -9_500, -10_000],
];

for (const [track, amount, ...want] of GOLDEN) {
  test(`golden: Track ${track}, amount ${amount > 0 ? 'positive' : 'negative'}, CQS 100/50/0`, () => {
    [100, 50, 0].forEach((cqs, i) => {
      const r = reconcile({ cats: one(-amount / 1_000_000), cqs, track });
      near(r.result, want[i]);
      near(r.quality, want[i]);
      near(r.raw + r.qadj, r.quality);
      assert.equal(r.capped, null);
      assert.equal(r.postEpisode, 0);
      assert.equal(r.target, 1_000_000);
    });
  });
}

test('the limits are shares of the summed target, and bind on both sides', () => {
  const t3loss = reconcile({ cats: one(0.5), cqs: 0, track: 3 });
  near(t3loss.quality, -500_000);
  assert.equal(t3loss.result, -200_000);
  assert.equal(t3loss.capped, 'loss');
  assert.deepEqual(t3loss.limits, { gain: 200_000, loss: 200_000 });

  const t2gain = reconcile({ cats: one(-0.3), cqs: 100, track: 2 });
  near(t2gain.quality, 300_000);
  assert.equal(t2gain.result, 50_000);
  assert.equal(t2gain.capped, 'gain');

  const t1gain = reconcile({ cats: one(-0.2), cqs: 50, track: 1 });
  near(t1gain.quality, 190_000);
  assert.equal(t1gain.result, 100_000);
  assert.equal(t1gain.capped, 'gain');
  assert.deepEqual(t1gain.limits, { gain: 100_000, loss: 0 });
});

test('Track 1 floors a negative amount at 0 before quality: nothing owed, no quality adjustment', () => {
  const r = reconcile({ cats: one(0.4), cqs: 0, track: 1 });
  assert.deepEqual([r.raw, r.qadj, r.quality, r.result, r.capped], [0, 0, 0, 0, null]);
});

test('low volume: a category over target adds nothing, under target still counts, and its target is in the base', () => {
  const cats = [
    { key: 'a', target: 1_000_000, spend: -0.01, lowVolume: false },
    { key: 'b', target: 3_000_000, spend: 0.10, lowVolume: true },
  ];
  const r = reconcile({ cats, cqs: 100, track: 3 });
  near(r.raw, 10_000);
  assert.equal(r.target, 4_000_000);
  assert.deepEqual(r.limits, { gain: 800_000, loss: 800_000 });
  const under = reconcile({ cats: [cats[0], { ...cats[1], spend: -0.01 }], cqs: 100, track: 3 });
  near(under.raw, 40_000);
});

test('categories add: two over and one under net out before quality', () => {
  const cats = [
    { key: 'a', target: 2_000_000, spend: 0.02, lowVolume: false },
    { key: 'b', target: 1_000_000, spend: -0.03, lowVolume: false },
    { key: 'c', target: 500_000, spend: 0.02, lowVolume: false },
  ];
  const r = reconcile({ cats, cqs: 50, track: 3 });
  near(r.raw, -40_000 + 30_000 - 10_000);
  near(r.result, -20_000 * 0.95);
});

test('a $0 target or no categories: every output 0, never NaN, never -0', () => {
  const zero = [{ key: 'a', target: 0, spend: 0.3, lowVolume: false }, { key: 'b', target: 0, spend: -0.4, lowVolume: true }];
  for (const cats of [zero, []]) {
    for (const track of [1, 2, 3]) {
      const r = reconcile({ cats, cqs: 37, track });
      for (const k of ['target', 'raw', 'qadj', 'quality', 'result']) assert.ok(Object.is(r[k], 0), `${k} is ${r[k]}`);
      assert.deepEqual(r.limits, { gain: 0, loss: 0 });
      assert.equal(r.capped, null);
      assert.deepEqual(bandOf({ cats, cqs: 37, track, width: BAND_DEFAULT }), { low: 0, high: 0 });
      assert.deepEqual(marginal({ cats, cqs: 37, track }), { perPctUnder: 0, perPctOver: 0, per10Quality: 0 });
      assert.equal(solveSpend({ cats, cqs: 37, track, result: 0 }), 0);
      assert.equal(solveSpend({ cats, cqs: 37, track, result: 1 }), null);
    }
  }
  // Break-even exactly: no -0 in qadj.
  assert.ok(Object.is(reconcile({ cats: one(0), cqs: 20, track: 2 }).qadj, 0));
});

test('bad input is refused with a RangeError that names no hospital', () => {
  const bad = [
    { cats: one(NaN), cqs: 50, track: 3 },
    { cats: one(Infinity), cqs: 50, track: 3 },
    { cats: one(0, { target: NaN }), cqs: 50, track: 3 },
    { cats: one(0, { target: -Infinity }), cqs: 50, track: 3 },
    { cats: one(0, { target: -1 }), cqs: 50, track: 3 },
    { cats: one(0), cqs: NaN, track: 3 },
    { cats: one(0), cqs: Infinity, track: 3 },
    { cats: one(0), cqs: -1, track: 3 },
    { cats: one(0), cqs: 101, track: 3 },
    { cats: one(0), cqs: 50, track: 0 },
    { cats: one(0), cqs: 50, track: 4 },
    { cats: one(0), cqs: 50, track: 1.5 },
    { cats: one(0), cqs: 50, track: '2' },
    { cats: one(0), cqs: 50, track: undefined },
    { cats: null, cqs: 50, track: 3 },
  ];
  for (const input of bad) {
    for (const fn of [reconcile, (i) => bandOf({ ...i, width: BAND_DEFAULT }), (i) => solveSpend({ ...i, result: 0 }), marginal]) {
      assert.throws(() => fn(input), (e) => e instanceof RangeError && /^TEAM reconciliation: /.test(e.message) && !/hospital/i.test(e.message));
    }
  }
  for (const width of [NaN, -0.01, Infinity]) assert.throws(() => bandOf({ cats: one(0), cqs: 50, track: 3, width }), RangeError);
  for (const result of [NaN, Infinity]) assert.throws(() => solveSpend({ cats: one(0), cqs: 50, track: 3, result }), RangeError);
});

test('bandOf: every category at plus and minus the width around break-even; given spends are ignored', () => {
  const b = bandOf({ cats: one(0.3), cqs: 50, track: 3, width: 0.05 });
  near(b.low, -47_500);
  near(b.high, 47_500);
  const lv = bandOf({ cats: [...one(0), { key: 'y', target: 1_000_000, spend: 0, lowVolume: true }], cqs: 50, track: 3, width: 0.05 });
  near(lv.low, -47_500);
  near(lv.high, 95_000);
  const t1 = bandOf({ cats: one(0), cqs: 50, track: 1, width: 0.05 });
  assert.equal(t1.low, 0);
  near(t1.high, 47_500);
});

test('solveSpend inverts the reconciliation for a uniform spend', () => {
  const base = { cats: one(0.2), cqs: 50, track: 3 };
  near(solveSpend({ ...base, result: 9_500 }), -0.01, 1e-9);
  near(solveSpend({ ...base, result: -9_500 }), 0.01, 1e-9);
  assert.equal(solveSpend({ ...base, result: 0 }), 0);
});

test('solveSpend at a limit gives the spend closest to zero that reaches it; past it, null', () => {
  const base = { cats: one(0), cqs: 50, track: 3 };
  near(solveSpend({ ...base, result: 200_000 }), -200_000 / 950_000, 1e-9);
  near(solveSpend({ ...base, result: -200_000 }), 200_000 / 950_000, 1e-9);
  assert.equal(solveSpend({ ...base, result: 200_001 }), null);
  assert.equal(solveSpend({ ...base, result: -200_001 }), null);
});

test('solveSpend: null for a Track 1 loss, and for a result the search range cannot reach', () => {
  assert.equal(solveSpend({ cats: one(0), cqs: 50, track: 1, result: -1 }), null);
  // Loss limit 20% of $10M, but only the $1M category can lose: at most about $570k at the range's edge.
  const cats = [...one(0), { key: 'y', target: 9_000_000, spend: 0, lowVolume: true }];
  assert.equal(solveSpend({ cats, cqs: 50, track: 3, result: -1_000_000 }), null);
  assert.ok(solveSpend({ cats, cqs: 50, track: 3, result: -500_000 }) > 0);
  // All low volume: no loss is reachable at all.
  assert.equal(solveSpend({ cats: one(0, { lowVolume: true }), cqs: 50, track: 3, result: -1 }), null);
});

test('marginal: dollars per 1% under and over at break-even, and per 10 quality points', () => {
  const m3 = marginal({ cats: one(0), cqs: 50, track: 3 });
  near(m3.perPctUnder, 9_500);
  near(m3.perPctOver, 9_500);
  // Default scenario: every category BAND_DEFAULT over. -$50,000 at p 0.05 vs 0.06.
  near(m3.per10Quality, 500);
  const m2 = marginal({ cats: one(0), cqs: 50, track: 2 });
  near(m2.perPctUnder, 9_500);
  near(m2.perPctOver, 9_250);
  // The current scenario when any spend is set: $20,000 under, p 0.05 vs 0.04.
  near(marginal({ cats: one(-0.02), cqs: 50, track: 3 }).per10Quality, 200);
  assert.equal(marginal({ cats: one(-0.02), cqs: 100, track: 3 }).per10Quality, 0);
  const m1 = marginal({ cats: one(0), cqs: 50, track: 1 });
  assert.equal(m1.perPctOver, 0);
  // Track 1 can't lose, so with no scenario set its quality figure is read BAND_DEFAULT under target: $50,000 at p
  // 0.05 vs 0.04.
  assert.ok(m1.per10Quality > 0);
  near(m1.per10Quality, 500);
  // A Track 1 scenario that is set is still used as given.
  assert.equal(marginal({ cats: one(0.02), cqs: 50, track: 1 }).per10Quality, 0);
});

test('floating-point residue under half a cent reads as +0, never -$0', () => {
  const cats = [
    { key: 'a', target: 1.1e6, spend: 0.07, lowVolume: false },
    { key: 'b', target: 7.7e5, spend: -0.10, lowVolume: false },
  ];
  const r = reconcile({ cats, cqs: 50, track: 2 });
  for (const k of ['raw', 'qadj', 'quality', 'result']) assert.ok(Object.is(r[k], 0), `${k} is ${r[k]}`);
  assert.equal(r.capped, null);
});

test('lowVolume must be a boolean', () => {
  for (const lowVolume of ['false', 'true', 0, 1, null, undefined]) {
    assert.throws(() => reconcile({ cats: one(0.1, { lowVolume }), cqs: 50, track: 3 }),
      (e) => e instanceof RangeError && /lowVolume/.test(e.message));
  }
});

test('SOLVE_SPAN is the site\'s search range, sixty percent either way', () => {
  assert.equal(SOLVE_SPAN, 0.6);
});
