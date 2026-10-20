import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimal, ordinal, pct, signed } from '../render/format.js';

test('decimal keeps the given decimals, a true minus and no plus sign', () => {
  assert.equal(decimal(0.38, 4), '0.3800');
  assert.equal(decimal(-0.00123, 4), '−0.0012');
  assert.equal(decimal(0.0007000000000000339, 4), '0.0007');
  assert.equal(decimal(1234.5, 1), '1,234.5');
  assert.equal(decimal(-0.00001, 4), '0.0000');
});

test('ordinal: st, nd, rd and th, with the teens all th', () => {
  const got = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 75, 101, 111, 112].map(ordinal);
  assert.deepEqual(got, ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '75th', '101st', '111th', '112th']);
});

test('cached formatters keep each call\'s style and decimals apart', () => {
  assert.deepEqual([decimal(0.5, 1), pct(0.5, 1), decimal(0.5, 2), pct(0.5, 0), signed(0.5, 1)], ['0.5', '50.0%', '0.50', '50%', '+0.5']);
});
