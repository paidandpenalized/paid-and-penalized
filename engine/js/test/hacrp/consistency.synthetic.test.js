// Synthetic hospitals whose published z sits off the fitted line by up to the fit error, in both directions,
// so the cases FY2026 happens not to contain still get exercised: the solver's answers must round-trip
// through the what-if, and the what-if must move in one direction only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { zFromValue } from '../../hacrp/params.js';
import { whatIf } from '../../hacrp/whatif.js';
import { solveMeasure } from '../../hacrp/solver.js';

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const p = { mean: 0.5, sd: 0.25, zMin: -2, zMax: 2, floor: 0, cap: 1, decimals: 3, fitError: 0.0005, boundTolerance: 0.25 * 0.0005 };
const model = { params: Object.fromEntries(MEASURE_IDS.map((id) => [id, { ...p, id }])), boundary: { highestNo: 0.4, lowestYes: 0.41 } };

function syntheticHospital(rand, i) {
  const n = 1 + Math.floor(rand() * 3);
  const measures = {};
  MEASURE_IDS.forEach((id, k) => {
    if (k >= n) {
      measures[id] = { value: null, z: null };
      return;
    }
    const value = Math.round(rand() * 1.3 * 1000) / 1000; // some past the cap
    // The fitted bounds can sit a fit error away from CMS's, so a published z at a bound can be off by that much too.
    const offset = (rand() * 2 - 1) * p.fitError;
    const z = Math.min(p.zMax, Math.max(p.zMin, zFromValue(value, p) + offset));
    measures[id] = { value, z };
  });
  const zs = MEASURE_IDS.slice(0, n).map((id) => measures[id].z);
  const total = zs.reduce((s, z) => s + z, 0) / n;
  const paymentReduction = total <= 0.4 ? 'No' : total >= 0.41 ? 'Yes' : null;
  return { ccn: `S${i}`, total, paymentReduction, measures };
}

const rand = mulberry32(42);
const hospitals = Array.from({ length: 4000 }, (_, i) => syntheticHospital(rand, i)).filter((h) => h.paymentReduction);

test('synthetic: every solver answer round-trips through the what-if to No, and unlimited never crosses', () => {
  let answers = 0;
  for (const h of hospitals) {
    for (const id of MEASURE_IDS.filter((x) => h.measures[x].z !== null)) {
      const r = solveMeasure(h, model, id);
      const msg = `${h.ccn} ${id} ${JSON.stringify(h.measures[id])} total ${h.total} -> ${JSON.stringify(r)}`;
      if (r.unlimited) {
        assert.equal(whatIf(h, model, { [id]: p.cap * 2 }).after.flag, 'No', msg);
      } else if (r.possible) {
        answers++;
        assert.equal(whatIf(h, model, { [id]: r.value }).after.flag, 'No', msg);
      }
    }
  }
  assert.ok(answers > 500);
});

test('synthetic: the what-if never moves against the direction of a change', () => {
  const r2 = mulberry32(7);
  for (let i = 0; i < 5000; i++) {
    const h = hospitals[Math.floor(r2() * hospitals.length)];
    const id = MEASURE_IDS[0];
    const [a, b] = [r2() * 1.5, r2() * 1.5].sort((x, y) => x - y);
    const sa = whatIf(h, model, { [id]: a }).after.score;
    const sb = whatIf(h, model, { [id]: b }).after.score;
    assert.ok(sa <= sb + 1e-12, `${h.ccn} a=${a} b=${b}`);
  }
});
