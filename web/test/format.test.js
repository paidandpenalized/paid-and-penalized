import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimal } from '../render/format.js';

test('decimal keeps the given decimals, a true minus and no plus sign', () => {
  assert.equal(decimal(0.38, 4), '0.3800');
  assert.equal(decimal(-0.00123, 4), '−0.0012');
  assert.equal(decimal(0.0007000000000000339, 4), '0.0007');
  assert.equal(decimal(1234.5, 1), '1,234.5');
  assert.equal(decimal(-0.00001, 4), '0.0000');
});
