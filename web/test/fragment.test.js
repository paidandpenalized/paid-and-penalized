import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../engine/js/hacrp/measures.js';
import { decode, encode, toUnit } from '../whatif/fragment.js';
import { initialState, reduce, changesOf } from '../whatif/state.js';
import { loadHacrp } from '../../engine/js/test/hacrp/helpers.js';
import { modelHospital } from '../../engine/js/test/hacrp/synthetic.js';

const { model } = loadHacrp();
const { params } = model;
const ALL = { ids: [...MEASURE_IDS], params };

test('encode: ids in MEASURE_IDS order, whatever order the changes came in', () => {
  assert.equal(encode({ MRSA: 0.9, CLABSI: 1.2 }), '#whatif&CLABSI=1.2&MRSA=0.9');
  assert.equal(encode({ CDI: 0.25, PSI90: 0.9123 }), '#whatif&PSI90=0.9123&CDI=0.25');
});

test('encode: no changes, no fragment; keys outside MEASURE_IDS are not written', () => {
  assert.equal(encode({}), '');
  assert.equal(encode({ NHSN: 3, CLABSI: 0.5 }), '#whatif&CLABSI=0.5');
});

test('round trip: decode(encode(changes)) gives the changes back, with nothing rejected', () => {
  const changes = { PSI90: 0.9123, CLABSI: 1.2, CAUTI: 0, SSI: 2.5, CDI: 0.346, MRSA: 0.9 };
  assert.deepEqual(decode(encode(changes), ALL), { changes, rejected: [] });
  assert.deepEqual(decode(encode({ MRSA: 1.8 }), ALL), { changes: { MRSA: 1.8 }, rejected: [] });
});

test('decode rounds each value to the measure display unit', () => {
  assert.deepEqual(decode('#whatif&CLABSI=0.12345&PSI90=0.912349', ALL).changes, { CLABSI: 0.123, PSI90: 0.9123 });
});

test('decode keeps the good parts of a tampered link and rejects the rest, never throwing', () => {
  const ids = ['PSI90', 'CLABSI', 'CDI', 'MRSA']; // CAUTI and SSI: measures this hospital lacks
  const hash = '#whatif&CLABSI=abc&CAUTI=0.5&CDI=-1&MRSA=1e9&PSI90=0.95&PSI90=0.9&NHSN=3&SSI=0.4&MRSA=0.8';
  const got = decode(hash, { ids, params });
  // MRSA appears twice (once out of range), PSI90 twice: both dropped.
  assert.deepEqual(got.changes, {});
  assert.deepEqual(got.rejected.sort(), ['CAUTI', 'CDI', 'CLABSI', 'MRSA', 'NHSN', 'PSI90', 'SSI']);

  const one = decode('#whatif&CLABSI=abc&MRSA=0.8', { ids, params });
  assert.deepEqual(one, { changes: { MRSA: 0.8 }, rejected: ['CLABSI'] });
});

test('decode: each bad value on its own', () => {
  const bad = ['abc', '-1', '1e9', '1e1', '', ' 1', '0x1', 'Infinity', 'NaN', '1.2.3', '.5', '1.', '+1'];
  for (const v of bad) {
    assert.deepEqual(decode(`#whatif&CLABSI=${v}`, ALL), { changes: {}, rejected: ['CLABSI'] }, JSON.stringify(v));
  }
  // The range is [0, 10 x cap], PSI 90 included.
  const top = 10 * params.PSI90.cap;
  assert.deepEqual(decode(`#whatif&PSI90=${top.toFixed(4)}`, ALL).changes, { PSI90: toUnit(top, params.PSI90.decimals) });
  assert.deepEqual(decode(`#whatif&PSI90=${(top + 0.001).toFixed(4)}`, ALL).rejected, ['PSI90']);
  assert.deepEqual(decode('#whatif&CLABSI=0', ALL).changes, { CLABSI: 0 });
});

test('decode never throws, whatever it is given', () => {
  const hostile = [undefined, null, 42, {}, '', '#', '#whatif', '#other&CLABSI=1', 'whatif&CLABSI=0.5', '#whatif&',
    '#whatif&&&', '#whatif&=', '#whatif&CLABSI', '#whatif&CLABSI==1', '#whatif&__proto__=1', '#whatif&constructor=1',
    '#whatif&toString=1', '#whatif&%E0%A4%A=1', '#whatif&CLABSI=%31', `#whatif&${'CLABSI=1&'.repeat(5000)}`];
  for (const h of hostile) {
    const got = decode(h, ALL);
    assert.equal(Object.getPrototypeOf(got.changes), Object.prototype);
    assert.ok(Array.isArray(got.rejected));
    for (const id of Object.keys(got.changes)) assert.ok(MEASURE_IDS.includes(id));
  }
  assert.deepEqual(decode('#other&CLABSI=1', ALL), { changes: {}, rejected: [] });
  assert.deepEqual(decode('whatif&CLABSI=0.5', ALL).changes, { CLABSI: 0.5 });
  assert.deepEqual(decode('#whatif&__proto__=1', ALL), { changes: {}, rejected: ['__proto__'] });
  assert.equal(({}).polluted, undefined);
});

test('the NHSN predicted count never appears in the fragment', () => {
  const h = modelHospital(model, '990011', { values: { PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 } });
  let s = initialState(h, model);
  s = reduce(s, { type: 'set', id: 'CLABSI', value: 0.6 });
  s = reduce(s, { type: 'predicted', id: 'CLABSI', count: 7.25 });
  s = reduce(s, { type: 'predicted', id: 'MRSA', count: 3.5 });
  const hash = encode(changesOf(s));
  assert.equal(hash, '#whatif&CLABSI=0.6');
  assert.doesNotMatch(hash, /7\.25|3\.5/);
});
