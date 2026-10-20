// Property test: the what-if moves in one direction only. Seeded, so failures reproduce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatIf } from '../../hacrp/whatif.js';
import { loadHacrp, submittedPairs } from './helpers.js';

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { hospitals, model } = loadHacrp();
const cases = submittedPairs(hospitals);

test('monotonic: a higher value never gives a lower score, and moves stay on the right side of CMS (5,000 trials)', () => {
  const rand = mulberry32(20261020);
  const EPS = 1e-12;
  for (let i = 0; i < 5000; i++) {
    const { h, id } = cases[Math.floor(rand() * cases.length)];
    const top = model.params[id].cap * 1.5;
    const [a, b] = [rand() * top, rand() * top].sort((x, y) => x - y);
    const sa = whatIf(h, model, { [id]: a }).after.score;
    const sb = whatIf(h, model, { [id]: b }).after.score;
    const msg = `trial ${i}: ${h.ccn} ${id} a=${a} b=${b}`;
    assert.ok(sa <= sb + EPS, msg);
    const current = h.measures[id].value;
    if (a < current) assert.ok(sa <= h.total + EPS, msg);
    if (b > current) assert.ok(sb >= h.total - EPS, msg);
  }
});
