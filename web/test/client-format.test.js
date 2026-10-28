import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { count as clientCount, factor, money as clientMoney, pct as clientPct } from '../client/format.js';
import { count, decimal, money, pct } from '../render/format.js';

// 40 values from -2e9 to 2e9: the rounding edges of money() on both sides of zero, zero, and amounts that read as zero.
const VALUES = [
  -2e9, -1.5e9, -999_500_000, -999_499_999, -1e9, -342_400_000, -99_950_000, -99_949_999, -5e7, -1_234_567, -999_500,
  -999_499, -614_565, -48_210, -999.5, -999.4, -640, -12, -0.4, -0.0004, 0, 0.0004, 0.4, 12, 640, 999.4, 999.5, 48_210, 614_565,
  999_499, 999_500, 1_234_567, 5e7, 99_949_999, 99_950_000, 342_400_000, 999_499_999, 999_500_000, 1.5e9, 2e9,
];

test('the client formats print exactly what the build\'s formats print, on 40 values from -2e9 to 2e9', () => {
  assert.equal(VALUES.length, 40);
  for (const x of VALUES) {
    assert.equal(clientMoney(x), money(x), `money ${x}`);
    assert.equal(clientMoney(x, { sign: true }), money(x, { sign: true }), `money +${x}`);
    // A share: the same values read as fractions, so the rounding edges of the percent are covered too.
    for (const dp of [0, 1, 2, 3]) {
      const f = x / 1e9;
      assert.equal(clientPct(f, dp), pct(f, dp), `pct ${f} ${dp}`);
      assert.equal(clientPct(f, dp, { sign: true }), pct(f, dp, { sign: true }), `pct +${f} ${dp}`);
    }
    assert.equal(clientCount(Math.round(x)), count(Math.round(x)), `count ${x}`);
  }
});

test('the client\'s percent has two decimals unless told otherwise, and a true minus', () => {
  assert.equal(clientPct(0.0053), '0.53%');
  assert.equal(clientPct(-0.0053), '−0.53%');
  assert.equal(clientPct(-0.0053, 1), '−0.5%');
  assert.equal(clientPct(0.0053, 2, { sign: true }), '+0.53%');
  assert.equal(clientPct(-0.0004), '−0.04%');
  assert.equal(clientPct(0.00004), '0.00%', 'a share that reads zero has no sign');
  assert.equal(clientPct(0.00004, 2, { sign: true }), '0.00%');
  assert.ok(!clientPct(-0.0053).includes('-'), 'no hyphen-minus');
  assert.ok(!clientMoney(-5000).includes('-'), 'no hyphen-minus');
});

test('money and count print the K, M and B steps, a true minus and thousands separators', () => {
  assert.equal(clientMoney(-336_607_197), '−$337M');
  assert.equal(clientMoney(129_108_924_630), '$129.1B');
  assert.equal(clientMoney(47_823), '$48K');
  assert.equal(clientCount(2971), '2,971');
  assert.equal(clientCount(0), '0');
  assert.throws(() => clientMoney(NaN), RangeError);
});

test('factor is a payment factor to four decimals', () => {
  assert.equal(factor(0.9988), '0.9988');
  assert.equal(factor(1), '1.0000');
  assert.equal(factor(1.0021821642), '1.0022');
  assert.equal(factor(0.98), '0.9800');
  assert.equal(factor(0.99999), '1.0000');
  for (const x of VALUES) assert.equal(factor(x / 1e9), decimal(x / 1e9, 4), String(x));
});

test('the client formats import nothing but the build\'s formats (no Node module, so the browser can bundle them)', () => {
  const src = readFileSync(new URL('../client/format.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../render/format.js']);
});
