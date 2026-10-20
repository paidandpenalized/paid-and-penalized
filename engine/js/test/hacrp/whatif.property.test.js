// Property test: the what-if moves in one direction only. Seeded, so failures reproduce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatIf } from '../../hacrp/whatif.js';
import { solveMeasure } from '../../hacrp/solver.js';
import { loadHacrp, submittedMeasures, submittedPairs } from './helpers.js';

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

const RANK = { No: 0, 'too-close': 1, Yes: 2 };

// With measure a set to its solver answer, move every other measure b one display unit in direction dir and check
// the flag never moves the opposite way.
function secondMoveFlags(flag, dir) {
  let checked = 0;
  for (const h of hospitals.filter((x) => x.total !== null && x.paymentReduction === flag && submittedMeasures(x).length >= 2)) {
    const ids = submittedMeasures(h);
    for (const a of ids) {
      const s = solveMeasure(h, model, a);
      if (!s.possible || s.unlimited) continue;
      const base = { [a]: s.value };
      const before = whatIf(h, model, base).after.flag;
      for (const b of ids.filter((x) => x !== a)) {
        const unit = 10 ** -model.params[b].decimals;
        const vb = Math.round((h.measures[b].value + dir * unit) / unit) * unit;
        if (vb < 0) continue;
        const after = whatIf(h, model, { ...base, [b]: vb }).after.flag;
        const msg = `${h.ccn} ${a}=${s.value} then ${b} ${h.measures[b].value}->${vb}: ${before} -> ${after}`;
        assert.ok(dir < 0 ? RANK[after] <= RANK[before] : RANK[after] >= RANK[before], msg);
        checked++;
      }
    }
  }
  return checked;
}

test('with another measure already changed, improving a second measure never moves the flag toward Yes', () => {
  assert.ok(secondMoveFlags('No', -1) > 100);
});

test('with another measure already changed, worsening a second measure never moves the flag toward No', () => {
  assert.ok(secondMoveFlags('Yes', 1) > 100);
});
