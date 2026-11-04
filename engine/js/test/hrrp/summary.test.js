// Ported, largely, from Thirty Day Readmissions (web/test/model.test.mjs at 33d1959).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantileSorted } from 'd3-array';
import { summarize, percentileRank, rankPct, peerBands, measuredAny, noEstimate } from '../../hrrp/summary.js';

test('summarize handles empty lists without NaN; share penalized is null with nothing measured', () => {
  const s = summarize([]);
  for (const [k, v] of Object.entries(s)) if (k !== 'pctPen') assert.ok(Number.isFinite(v), JSON.stringify(s));
  assert.equal(s.n, 0);
  assert.equal(s.pctPen, null);
});

const MEASURED = { HF: { n: 40, err: 1.1 } };
test('summarize counts penalties, cap, and dollars', () => {
  const list = [
    { paf: 1, red: 0, pen: 0, base: 100, c: MEASURED },
    { paf: 0.99, red: 1, pen: 10, base: 1000, c: MEASURED },
    { paf: 0.97, red: 3, pen: 30, base: 1000, c: MEASURED },
    { paf: 0.998, red: 0.2, pen: null, base: null, c: MEASURED },
  ];
  const s = summarize(list);
  assert.deepEqual([s.n, s.nPen, s.nMeasured, s.nMax, s.nGe1, s.penTotal, s.baseTotal], [4, 3, 4, 1, 2, 40, 2100]);
  assert.equal(s.pctPen, 75);
  assert.ok(Math.abs(s.meanRed - 1.05) < 1e-9);
  assert.ok(Math.abs(s.meanRedPen - 1.4) < 1e-9);
  assert.equal(s.medianRed, 0.6);
  assert.equal(s.medianRedPen, 1);
  assert.equal(noEstimate(list), 1);
});

test('summarize: share penalized is of hospitals measured on at least one condition', () => {
  const list = [
    { red: 0.5, c: MEASURED },
    { red: 0, c: { HF: { n: 40, err: 0.9 }, AMI: { n: 10, err: 1.2 } } },
    { red: 0, c: { HF: { n: 24, err: 1.3 } } }, // under 25 cases: not measured
    { red: 0, c: { PN: { n: 80, err: null } } }, // no published ratio: not measured
    { red: 0 }, // no conditions at all
  ];
  const s = summarize(list);
  assert.deepEqual([s.n, s.nPen, s.nMeasured], [5, 1, 2]);
  assert.equal(s.pctPen, 50);
  const none = summarize([{ red: 0, c: {} }, { red: 0, c: { HF: { n: 24, err: 1.3 } } }]);
  assert.deepEqual([none.n, none.nMeasured, none.pctPen], [2, 0, null]);
  assert.equal(measuredAny({ c: MEASURED }), true);
  assert.equal(measuredAny({}), false);
});

test('percentileRank is the share of values strictly below', () => {
  assert.equal(percentileRank([0, 0, 1, 2], 1), 50);
  assert.equal(percentileRank([0, 0, 1, 2], 0), 0);
  assert.equal(percentileRank([], 1), 0);
});

test('rankPct is floored and never 100', () => {
  assert.equal(rankPct([0, 1, 2, 3], 3), 75);
  assert.equal(rankPct([0, 1, 2, 3], 99), 99);
});

test("peerBands: [p10, p90] of measured ERRs per peer group and condition, equal to d3's quantileSorted", () => {
  const errs = Array.from({ length: 37 }, (_, i) => 0.9 + ((i * 7) % 37) / 100);
  const list = errs.map((err, i) => ({ peer: 1 + (i % 2), c: { HF: { n: 30, err }, AMI: { n: 5, err } } }));
  const bands = peerBands(list);
  assert.deepEqual(Object.keys(bands).sort(), ['1', '2']);
  for (const p of [1, 2]) {
    const sorted = list.filter((h) => h.peer === p).map((h) => h.c.HF.err).sort((a, b) => a - b);
    assert.deepEqual(bands[p].HF, [quantileSorted(sorted, 0.1), quantileSorted(sorted, 0.9)]);
    assert.equal(bands[p].AMI, undefined, 'under 25 cases is not measured');
  }
});
