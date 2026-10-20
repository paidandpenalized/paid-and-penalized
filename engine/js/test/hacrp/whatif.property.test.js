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

const RANK = { No: 0, 'too-close': 1, Yes: 2 };

test('with another measure already changed, improving a second measure never moves the flag toward Yes', async () => {
  const { solveMeasure } = await import('../../hacrp/solver.js');
  const { submittedMeasures } = await import('./helpers.js');
  let checked = 0;
  for (const h of hospitals.filter((x) => x.total !== null && x.paymentReduction === 'No' && submittedMeasures(x).length >= 2)) {
    const ids = submittedMeasures(h);
    for (const a of ids) {
      const s = solveMeasure(h, model, a);
      if (!s.possible || s.unlimited) continue;
      const base = { [a]: s.value };
      const before = whatIf(h, model, base).after.flag;
      for (const b of ids.filter((x) => x !== a)) {
        const unit = 10 ** -model.params[b].decimals;
        const vb = h.measures[b].value;
        if (vb < unit) continue;
        const after = whatIf(h, model, { ...base, [b]: Math.round((vb - unit) / unit) * unit }).after.flag;
        assert.ok(RANK[after] <= RANK[before], `${h.ccn} ${a}=${s.value} then ${b} ${vb}->${vb - unit}: ${before} -> ${after}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100);
});
