import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, STATE_NAMES, US_STATES } from '../states.js';

test('the table is the fifty states, DC and Puerto Rico, each once, by postal code, FIPS code and name', () => {
  assert.equal(STATES.length, 52);
  for (const [code, fips, name] of STATES) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.match(fips, /^\d{2}$/);
    assert.ok(name.length > 3, code);
  }
  for (let col = 0; col < 3; col++) assert.equal(new Set(STATES.map((row) => row[col])).size, STATES.length, `column ${col} is unique`);
  assert.equal(STATE_NAMES.DC, 'District of Columbia');
  assert.equal(Object.keys(STATE_NAMES).length, STATES.length);
});

test('US_STATES is the fifty states and DC: the table without Puerto Rico, in the table\'s order', () => {
  assert.equal(US_STATES.length, 51);
  assert.deepEqual(US_STATES, STATES.filter(([code]) => code !== 'PR'));
  assert.ok(US_STATES.some(([code]) => code === 'DC'));
  assert.ok(!US_STATES.some(([code]) => code === 'PR'));
  assert.ok(Object.isFrozen(STATES) && Object.isFrozen(US_STATES));
});
