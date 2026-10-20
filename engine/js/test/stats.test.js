import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, mean, median, sampleSd, percentileInc, percentileSas5, linearFit } from '../stats.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('mean', () => close(mean([1, 2, 3, 4]), 2.5));

test('median: odd and even counts, input order ignored', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('sampleSd divides by n - 1', () => close(sampleSd([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7)));

test('percentileInc interpolates like Excel PERCENTILE.INC', () => {
  const xs = [1, 2, 3, 4, 5];
  close(percentileInc(xs, 0.75), 4);
  close(percentileInc(xs, 0.1), 1.4);
  close(percentileInc(xs, 1), 5);
});

test('percentileSas5 returns an observation, or the mean of two at an exact n*p', () => {
  assert.equal(percentileSas5([1, 2, 3, 4, 5], 0.5), 3); // n*p = 2.5 -> 3rd value
  assert.equal(percentileSas5([1, 2, 3, 4], 0.5), 2.5); // n*p = 2 exactly -> mean of 2nd and 3rd
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentileSas5(twenty, 0.05), 1.5); // n*p = 1 exactly
  assert.equal(percentileSas5(twenty, 0.95), 19.5);
});

test('linearFit recovers an exact line', () => {
  const { slope, intercept } = linearFit([0, 1, 2], [1, 3, 5]);
  close(slope, 2);
  close(intercept, 1);
});

test('clamp holds a value inside [lo, hi]', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test('percentileSas5 edges: p = 1 is the maximum; an empty array throws', () => {
  assert.equal(percentileSas5([1, 2, 3, 4], 1), 4);
  assert.throws(() => percentileSas5([], 0.5), RangeError);
});
