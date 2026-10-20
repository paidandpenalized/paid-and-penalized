import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zFromValue, valueFromZ, baselineZ } from '../../hacrp/params.js';

const p = { mean: 0.5, sd: 0.25, floor: 0, cap: 1, zMin: -2, zMax: 2 };

test('valueFromZ inverts zFromValue between the caps', () => {
  for (const v of [0, 0.1, 0.5, 0.99, 1]) assert.ok(Math.abs(valueFromZ(zFromValue(v, p), p) - v) < 1e-12);
});

test('baselineZ: a submitted measure moves from its fitted z, an assigned one from CMS\'s assigned z', () => {
  assert.equal(baselineZ({ value: 0.75, z: 1.0001 }, p), 1);
  assert.equal(baselineZ({ value: null, z: 2.3 }, p), 2.3);
});
