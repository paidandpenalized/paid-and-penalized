import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalFromZ, cutoffBoundary, classify } from '../../hacrp/score.js';

const boundary = { highestNo: 0.4, lowestYes: 0.41 }; // synthetic

test('totalFromZ is the equally weighted mean', () => {
  assert.equal(totalFromZ([1, 0, -1, 2]), 0.5);
  assert.throws(() => totalFromZ([]), RangeError);
});

test('cutoffBoundary ignores N/A flags and unscored rows', () => {
  const hs = [
    { total: 0.1, paymentReduction: 'No' },
    { total: 0.5, paymentReduction: 'Yes' },
    { total: 0.9, paymentReduction: 'N/A' },
    { total: null, paymentReduction: 'Yes' },
    { total: 0.2, paymentReduction: 'No' },
  ];
  assert.deepEqual(cutoffBoundary(hs), { highestNo: 0.2, lowestYes: 0.5 });
});

test('classify: at or below highestNo is No, at or above lowestYes is Yes, between is too-close', () => {
  assert.equal(classify(0.4, boundary), 'No');
  assert.equal(classify(0.41, boundary), 'Yes');
  assert.equal(classify(0.405, boundary), 'too-close');
});

test('cutoffBoundary throws when either side of the line has no hospitals', () => {
  assert.throws(() => cutoffBoundary([{ total: 0.1, paymentReduction: 'No' }]), RangeError);
  assert.throws(() => cutoffBoundary([{ total: 0.5, paymentReduction: 'Yes' }]), RangeError);
});
