// The composite quality score (42 CFR 512.547(b)): CMS's worked example, the PY2 measure weights, missing data and zero
// volume, plus the method constants in params.js. No hospital appears; every input is a made-up number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { near } from './helpers.js';
import { compositeQuality } from '../../team/quality.js';
import { BAND_DEFAULT, BAND_MAX, BAND_MIN, EPISODE_DAYS, LOW_VOLUME, MEASURES, MISSING_QUALITY, TRACKS } from '../../team/params.js';

const KEYS = ['hybrid_hwr', 'iscmr', 'falls', 'prf', 'thatka_prom'];

test('params: the five PY2 measures, which episodes each applies to, and which are public', () => {
  assert.deepEqual(Object.keys(MEASURES).sort(), [...KEYS].sort());
  for (const k of KEYS) assert.ok(['inpatient', 'lejr'].includes(MEASURES[k].appliesTo), k);
  assert.equal(MEASURES.thatka_prom.appliesTo, 'lejr');
  assert.deepEqual(KEYS.filter((k) => MEASURES[k].appliesTo === 'lejr'), ['thatka_prom']);
  assert.deepEqual(KEYS.filter((k) => MEASURES[k].public).sort(), ['hybrid_hwr', 'iscmr']);
});

test('params: tracks, thresholds and the band are the rule values, frozen', () => {
  assert.deepEqual(TRACKS[1], { gain: 0.10, loss: 0, qGain: 0.10, qLoss: 0 });
  assert.deepEqual(TRACKS[2], { gain: 0.05, loss: 0.05, qGain: 0.10, qLoss: 0.15 });
  assert.deepEqual(TRACKS[3], { gain: 0.20, loss: 0.20, qGain: 0.10, qLoss: 0.10 });
  assert.equal(LOW_VOLUME, 31);
  assert.equal(EPISODE_DAYS, 30);
  assert.equal(MISSING_QUALITY, 50);
  assert.deepEqual([BAND_MIN, BAND_DEFAULT, BAND_MAX], [0.01, 0.05, 0.20]);
  assert.ok(Object.isFrozen(TRACKS) && Object.isFrozen(TRACKS[1]) && Object.isFrozen(MEASURES) && Object.isFrozen(MEASURES.falls));
});

// CMS's example has three measures at 650, 650 and 400 episodes, so it runs on a small measure table of its own (two
// inpatient measures, one LEJR) through compositeQuality's optional third argument.
test('CMS example: 60/50/40 with volumes 650/650/400 gives 51.47 exact, 51.4 with the weights rounded to two places', () => {
  const measures = { a: { appliesTo: 'inpatient' }, b: { appliesTo: 'inpatient' }, c: { appliesTo: 'lejr' } };
  const { cqs, weights } = compositeQuality({ a: 60, b: 50, c: 40 }, { inpatient: 650, lejr: 400 }, measures);
  near(cqs, 51.47, 0.01);
  near(weights.a, 650 / 1700); near(weights.b, 650 / 1700); near(weights.c, 400 / 1700);
  const r = (x) => Math.round(x * 100) / 100;
  assert.deepEqual([r(weights.a), r(weights.b), r(weights.c)], [0.38, 0.38, 0.24]);
  const rounded = 60 * r(weights.a) + 50 * r(weights.b) + 40 * r(weights.c);
  assert.equal(rounded.toFixed(1), '51.4');
});

test('PY2 weights: four inpatient measures N_IP/(4 N_IP + N_LEJR), the PRO-PM N_LEJR/(...)', () => {
  const pcts = { hybrid_hwr: 10, iscmr: 20, falls: 30, prf: 40, thatka_prom: 90 };
  const { weights, cqs } = compositeQuality(pcts, { inpatient: 300, lejr: 120 });
  const total = 4 * 300 + 120;
  for (const k of ['hybrid_hwr', 'iscmr', 'falls', 'prf']) near(weights[k], 300 / total);
  near(weights.thatka_prom, 120 / total);
  near(Object.values(weights).reduce((s, w) => s + w, 0), 1);
  near(cqs, (300 * (10 + 20 + 30 + 40) + 120 * 90) / total);
});

test('missing, null and undefined pcts count as 50', () => {
  const vols = { inpatient: 100, lejr: 100 };
  const all50 = compositeQuality({ hybrid_hwr: 50, iscmr: 50, falls: 50, prf: 50, thatka_prom: 50 }, vols).cqs;
  assert.equal(all50, 50);
  assert.equal(compositeQuality({}, vols).cqs, 50);
  assert.equal(compositeQuality({ hybrid_hwr: null, iscmr: undefined, falls: 50, prf: 50 }, vols).cqs, 50);
  // One scored measure at 100, the rest missing: pulled up by exactly its weight.
  const { cqs, weights } = compositeQuality({ hybrid_hwr: 100 }, vols);
  near(cqs, 50 + 50 * weights.hybrid_hwr);
  assert.equal(compositeQuality({ hybrid_hwr: 0 }, vols).cqs < 50, true, 'a pct of 0 is a score, not missing');
});

test('zero total volume: cqs is 50 and every weight is 0', () => {
  const { cqs, weights } = compositeQuality({ hybrid_hwr: 10, iscmr: 90 }, { inpatient: 0, lejr: 0 });
  assert.equal(cqs, 50);
  assert.deepEqual(Object.keys(weights).sort(), [...KEYS].sort());
  for (const w of Object.values(weights)) assert.equal(w, 0);
});

test('no LEJR volume leaves the PRO-PM weightless; its score cannot move the CQS', () => {
  const a = compositeQuality({ hybrid_hwr: 80, iscmr: 80, falls: 80, prf: 80, thatka_prom: 0 }, { inpatient: 200, lejr: 0 });
  assert.equal(a.weights.thatka_prom, 0);
  near(a.cqs, 80);
});

test('bad volumes are refused', () => {
  for (const v of [{ inpatient: -1, lejr: 0 }, { inpatient: NaN, lejr: 0 }, { inpatient: 1 }, null]) {
    assert.throws(() => compositeQuality({}, v), RangeError);
  }
});

test('the CQS stays in 0..100 for pcts in 0..100', () => {
  for (const p of [0, 100]) {
    const { cqs } = compositeQuality({ hybrid_hwr: p, iscmr: p, falls: p, prf: p, thatka_prom: p }, { inpatient: 5, lejr: 3 });
    near(cqs, p);
  }
});
