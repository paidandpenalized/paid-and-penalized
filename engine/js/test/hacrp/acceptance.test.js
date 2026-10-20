// checkA1: passes on the pinned FY2026 file; names the CCN when a decision falls on the wrong side of the line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHospital } from '../../hacrp/hospital.js';
import { MEASURES } from '../../hacrp/measures.js';
import { checkA1 } from '../../hacrp/acceptance.js';
import { loadHacrp } from './helpers.js';
import { syntheticRow } from './synthetic.js';

function synthetic(ccn, total, paymentReduction) {
  const row = syntheticRow({ 'Facility ID': ccn, 'Total HAC Score': total, 'Payment Reduction': paymentReduction });
  for (const m of MEASURES) row[m.z] = total;
  return toHospital(row);
}

const boundary = { highestNo: 0.5, lowestYes: 0.6 };
const model = { params: {}, boundary };
const base = [
  synthetic('990001', '0.1000', 'No'),
  synthetic('990002', '0.5000', 'No'),
  synthetic('990003', '0.6000', 'Yes'),
  synthetic('990004', '0.9000', 'Yes'),
];

test('pinned FY2026 file: ok, every decision reproduced', () => {
  const { hospitals, model: pinned } = loadHacrp();
  const r = checkA1(hospitals, pinned);
  assert.equal(r.ok, true);
  assert.equal(r.b.mismatches.length, 0);
  assert.equal(r.a.within, r.a.n);
  assert.ok(r.a.maxError < 0.0001);
  assert.ok(r.b.n > 0 && r.b.n <= r.a.n);
  assert.ok(r.b.yes > 0 && r.b.yes < r.b.n);
  assert.ok(r.info.pctAllScored >= pinned.boundary.highestNo && r.info.pctAllScored < pinned.boundary.lowestYes);
  assert.ok(Number.isFinite(r.info.pctDecided));
});

test('a coherent synthetic set passes', () => {
  const r = checkA1(base, model);
  assert.equal(r.ok, true);
  assert.deepEqual(r.b, { n: 4, yes: 2, mismatches: [] });
});

test('a "No" row moved above the line fails (b) and names its CCN', () => {
  const r = checkA1([...base, synthetic('990005', '0.8000', 'No')], model);
  assert.equal(r.ok, false);
  assert.deepEqual(r.b.mismatches, ['990005']);
  assert.equal(r.a.within, r.a.n);
});

test('a "Yes" row at or below the highest "No" fails (b)', () => {
  const r = checkA1([...base, synthetic('990006', '0.4000', 'Yes')], model);
  assert.equal(r.ok, false);
  assert.deepEqual(r.b.mismatches, ['990006']);
});

test('a total that disagrees with its published z-scores fails (a)', () => {
  const off = synthetic('990007', '0.2000', 'No');
  off.total = 0.3;
  const r = checkA1([...base, off], model);
  assert.equal(r.a.within, r.a.n - 1);
  assert.ok(r.a.maxError > 0.09);
  assert.equal(r.ok, false); // 4 of 5 within is below 99%
});

test('unscored rows are skipped: a "Yes" with no score is not a mismatch', () => {
  const none = toHospital(syntheticRow({ 'Facility ID': '990008', 'Total HAC Score': 'N/A', 'Payment Reduction': 'Yes' }));
  const r = checkA1([...base, none], model);
  assert.equal(r.ok, true);
  assert.equal(r.a.n, 4);
  assert.equal(r.b.n, 4);
});
