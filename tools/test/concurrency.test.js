// The browser checks' concurrency: E2E_CONCURRENCY when set, else one fewer than the cores, up to four.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { e2eConcurrency } from '../e2e/concurrency.js';

test('e2eConcurrency: one fewer than the cores, between one and four, unless E2E_CONCURRENCY says', () => {
  for (const [cores, want] of [[1, 1], [2, 1], [4, 3], [5, 4], [12, 4]]) assert.equal(e2eConcurrency({}, cores), want, `${cores} cores`);
  assert.equal(e2eConcurrency({ E2E_CONCURRENCY: '1' }, 12), 1);
  assert.equal(e2eConcurrency({ E2E_CONCURRENCY: ' 2 ' }, 4), 2);
  assert.equal(e2eConcurrency({ E2E_CONCURRENCY: '' }, 4), 3);
  for (const bad of ['0', '-1', '1.5', 'two']) assert.throws(() => e2eConcurrency({ E2E_CONCURRENCY: bad }, 4), RangeError, bad);
});

