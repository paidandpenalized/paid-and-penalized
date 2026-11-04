import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatIfPaf, niceDomain, sliderRange } from '../../hrrp/whatif.js';

// Synthetic: one peer group, one measured condition above its median.
const META = { nm: 1, peerMedians: { 1: { HF: 1.0 } } };
const H = { peer: 1, paf: 0.99, c: { HF: { n: 100, err: 1.1, flag: 1, ratio: 0.1 } } };

test('whatIfPaf with no change returns the published factor', () => {
  assert.equal(whatIfPaf(H, META, {}), 0.99);
});

test('whatIfPaf: no measured condition above its median means no cut', () => {
  assert.equal(whatIfPaf(H, META, { HF: 0.95 }), 1);
});

test('whatIfPaf moves the published factor by the recomputed change, clamped to [0.97, 1]', () => {
  assert.equal(whatIfPaf(H, META, { HF: 1.05 }), 0.995);
  assert.equal(whatIfPaf(H, META, { HF: 9 }), 0.97);
  const above = { ...H, paf: 1 };
  assert.equal(whatIfPaf(above, META, { HF: 1.05 }), 1);
});

test('niceDomain widens to contain the values plus pad, snapped outward to the step', () => {
  assert.deepEqual(niceDomain([1.0], [0.8, 1.25], 0.05, 0.05), [0.8, 1.25]);
  assert.deepEqual(niceDomain([1.32], [0.8, 1.25], 0.05, 0.05), [0.8, 1.4]);
  assert.deepEqual(niceDomain([0.71], [0.8, 1.25], 0.05, 0.05), [0.65, 1.25]);
});

test('sliderRange always contains the ratio', () => {
  for (const e of [0.5, 0.9, 1, 1.3, 2]) {
    const [lo, hi] = sliderRange(e);
    assert.ok(lo <= e && e <= hi);
  }
});
