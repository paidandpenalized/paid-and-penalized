import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count as clientCount, factor, money as clientMoney, pct as clientPct } from '../client/format.js';
import { count, money, pct } from '../render/format.js';

test('money and count are the build\'s own, re-exported rather than copied (web/test/format.test.js holds their steps and minus)', () => {
  assert.equal(clientMoney, money);
  assert.equal(clientCount, count);
  assert.equal(clientCount(2971), '2,971');
});

test('the client\'s percent is the build\'s with two decimals unless told otherwise, and a true minus', () => {
  assert.equal(clientPct(0.0053), '0.53%');
  assert.equal(clientPct(-0.0053), '−0.53%');
  assert.equal(clientPct(-0.0053, 1), '−0.5%');
  assert.equal(clientPct(0.0053, 2, { sign: true }), '+0.53%');
  assert.equal(clientPct(-0.0004), '−0.04%');
  assert.equal(clientPct(0.00004), '0.00%', 'a share that reads zero has no sign');
  assert.equal(clientPct(0.00004, 2, { sign: true }), '0.00%');
  assert.ok(!clientPct(-0.0053).includes('-'), 'no hyphen-minus');
  for (const f of [-0.0053, -0.0004, 0, 0.00004, 0.0053, 0.25]) {
    assert.equal(clientPct(f, 2), pct(f, 2), String(f));
    assert.equal(clientPct(f, 2, { sign: true }), pct(f, 2, { sign: true }), String(f));
  }
});

test('factor is a payment factor to four decimals', () => {
  assert.equal(factor(0.9988), '0.9988');
  assert.equal(factor(1), '1.0000');
  assert.equal(factor(1.0021821642), '1.0022');
  assert.equal(factor(0.98), '0.9800');
  assert.equal(factor(0.99999), '1.0000');
});
