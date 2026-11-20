// Property tests for the reconciliation, the band and the solver, over thousands of random made-up hospitals-years.
// Seeded, so failures reproduce; messages print the trial number only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, bandOf, solveSpend, resultAt } from '../../team/reconcile.js';
import { BAND_MAX, BAND_MIN, SOLVE_SPAN, TRACKS } from '../../team/params.js';
import { mulberry32 } from '../prng.js';

const TRIALS = 4000;
const EPS = 1e-6;

// A random year: up to five categories (sometimes none), some with a $0 target, some low volume.
function randomCase(rand) {
  const n = Math.floor(rand() * 6);
  const cats = Array.from({ length: n }, (_, i) => ({
    key: `c${i}`,
    target: rand() < 0.1 ? 0 : rand() * 5e7,
    spend: (rand() * 2 - 1) * SOLVE_SPAN,
    lowVolume: rand() < 0.3,
  }));
  const cqs = rand() < 0.1 ? Math.round(rand()) * 100 : rand() * 100;
  return { cats, cqs, track: 1 + Math.floor(rand() * 3) };
}

test(`monotone: raising one category's spend never raises the result (${TRIALS} trials)`, () => {
  const rand = mulberry32(20261119);
  for (let t = 0; t < TRIALS; t++) {
    const input = randomCase(rand);
    if (input.cats.length === 0) continue;
    const i = Math.floor(rand() * input.cats.length);
    const up = input.cats.map((c, j) => (j === i ? { ...c, spend: c.spend + rand() * 0.3 } : c));
    assert.ok(reconcile({ ...input, cats: up }).result <= reconcile(input).result + EPS, `trial ${t}`);
  }
});

test(`the limits always hold, Track 1 is never negative, and low volume never pushes raw below zero (${TRIALS} trials)`, () => {
  const rand = mulberry32(1119);
  for (let t = 0; t < TRIALS; t++) {
    const input = randomCase(rand);
    const r = reconcile(input);
    const { gain, loss } = TRACKS[input.track];
    const msg = `trial ${t}`;
    assert.ok(Number.isFinite(r.result) && Number.isFinite(r.raw) && Number.isFinite(r.qadj), msg);
    near(r.limits.gain, gain * r.target, msg);
    near(r.limits.loss, loss * r.target, msg);
    assert.ok(r.result <= r.limits.gain && r.result >= -r.limits.loss, msg);
    assert.equal(r.capped, r.quality > r.limits.gain ? 'gain' : r.quality < -r.limits.loss ? 'loss' : null, msg);
    if (input.track === 1) assert.ok(r.result >= 0 && r.raw >= 0, msg);
    // Every category low volume: raw can only be zero or a gain.
    const allLow = reconcile({ ...input, cats: input.cats.map((c) => ({ ...c, lowVolume: true })) });
    assert.ok(allLow.raw >= 0, msg);
    // Flipping one category to low volume never lowers raw.
    if (input.cats.length) {
      const i = Math.floor(rand() * input.cats.length);
      const flipped = reconcile({ ...input, cats: input.cats.map((c, j) => (j === i ? { ...c, lowVolume: true } : c)) });
      assert.ok(flipped.raw >= r.raw - EPS, msg);
    }
  }
});

function near(a, b, msg) {
  assert.ok(Math.abs(a - b) <= EPS * Math.max(1, Math.abs(b)), msg);
}

// The most and least a uniform spend within the search range can give, worked out in closed form from the rule rather
// than by calling the solver's own edge test: every category SOLVE_SPAN under target is a gain on the whole target;
// SOLVE_SPAN over is a loss on the non-low-volume targets only, and none at all on Track 1.
function reach({ cats, cqs, track }) {
  const t = TRACKS[track];
  const total = cats.reduce((s, c) => s + c.target, 0);
  const losing = cats.reduce((s, c) => s + (c.lowVolume ? 0 : c.target), 0);
  const hi = Math.min(t.gain * total, (1 - t.qGain * (1 - cqs / 100)) * SOLVE_SPAN * total);
  const lo = t.loss === 0 ? 0 : Math.max(-t.loss * total, -(1 - t.qLoss * (cqs / 100)) * SOLVE_SPAN * losing);
  return { lo, hi };
}

test(`solveSpend round-trips within $1, and null only when the result is out of reach (${TRIALS} trials)`, () => {
  const rand = mulberry32(5512550);
  let solved = 0;
  for (let t = 0; t < TRIALS; t++) {
    const input = randomCase(rand);
    const r0 = reconcile(input);
    const pick = rand();
    // Mostly inside the limits, sometimes exactly at one, sometimes past it.
    const result = pick < 0.1 ? r0.limits.gain : pick < 0.2 ? -r0.limits.loss : pick < 0.25 ? 0 : (rand() * 2 - 1) * 0.3 * r0.target;
    const s = solveSpend({ ...input, result });
    const msg = `trial ${t}`;
    if (s === null) {
      const { lo, hi } = reach(input);
      const slack = EPS * Math.max(1, Math.abs(result));
      assert.ok(result > hi - slack || result < lo + slack, msg);
      continue;
    }
    solved++;
    assert.ok(s >= -SOLVE_SPAN && s <= SOLVE_SPAN, msg);
    assert.ok(Math.abs(resultAt(input, s) - result) <= 1, msg);
    // At a limit the answer is the spend closest to zero that reaches it: one step toward zero falls short.
    if (result !== 0 && result === r0.limits.gain) assert.ok(resultAt(input, s * (1 - 1e-6)) < result, msg);
    if (result !== 0 && result === -r0.limits.loss) assert.ok(resultAt(input, s * (1 - 1e-6)) > result, msg);
    if (result === 0) assert.equal(s, 0, msg);
    if (input.track === 1) assert.ok(result >= 0, msg);
  }
  assert.ok(solved > TRIALS / 2, `only ${solved} solved`);
});

test(`the band brackets break-even, and a $0 target gives all zeros (${TRIALS} trials)`, () => {
  const rand = mulberry32(512505);
  for (let t = 0; t < TRIALS; t++) {
    const input = randomCase(rand);
    const width = BAND_MIN + rand() * (BAND_MAX - BAND_MIN);
    const { low, high } = bandOf({ ...input, width });
    const mid = resultAt(input, 0);
    const msg = `trial ${t}`;
    assert.ok(low <= mid && mid <= high, msg);
    const zero = { ...input, cats: input.cats.map((c) => ({ ...c, target: 0 })) };
    const r = reconcile(zero);
    for (const k of ['target', 'raw', 'qadj', 'quality', 'result']) assert.ok(Object.is(r[k], 0), `${msg} ${k}`);
    assert.deepEqual(bandOf({ ...zero, width }), { low: 0, high: 0 }, msg);
  }
});
