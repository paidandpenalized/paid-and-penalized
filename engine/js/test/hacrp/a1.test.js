// Acceptance test A1 (a) and (b) on the pinned FY2026 file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHacrpFy2026 } from '../fixtures.js';
import { toHospital, scoredMeasures } from '../../hacrp/hospital.js';
import { totalFromZ, cutoffBoundary, classify } from '../../hacrp/score.js';
import { percentileInc } from '../../stats.js';

const hospitals = loadHacrpFy2026().rows.map(toHospital);
const scored = hospitals.filter((h) => h.total !== null);
const decided = scored.filter((h) => h.paymentReduction === 'Yes' || h.paymentReduction === 'No');

test('A1(a): mean of published z = Total HAC Score within 0.0001 for at least 99% of scored hospitals', (t) => {
  const errors = scored.map((h) => Math.abs(totalFromZ(scoredMeasures(h).map((id) => h.measures[id].z)) - h.total));
  const share = errors.filter((e) => e < 0.0001).length / errors.length;
  t.diagnostic(`${scored.length} scored; share within 0.0001 = ${share}; max error = ${Math.max(...errors)}`);
  assert.ok(share >= 0.99);
});

test('every scored hospital has at least one published z', () => {
  assert.ok(scored.every((h) => scoredMeasures(h).length > 0));
});

test('A1(b): CMS decisions split cleanly; classify(total) reproduces every Yes/No flag', () => {
  const boundary = cutoffBoundary(hospitals);
  assert.ok(boundary.lowestYes > boundary.highestNo);
  for (const h of decided) assert.equal(classify(h.total, boundary), h.paymentReduction, h.ccn);
});

test('A1(b): the 75th percentile of all published scores lies in the boundary, and "> p75" reproduces every flag', () => {
  const { highestNo, lowestYes } = cutoffBoundary(hospitals);
  const p75 = percentileInc(scored.map((h) => h.total).sort((a, b) => a - b), 0.75);
  assert.ok(p75 >= highestNo && p75 < lowestYes, `p75 ${p75}`);
  for (const h of decided) assert.equal(h.total > p75 ? 'Yes' : 'No', h.paymentReduction, h.ccn);
});
