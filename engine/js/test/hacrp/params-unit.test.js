import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zFromValue, baselineZ } from '../../hacrp/params.js';

const p = { mean: 0.5, sd: 0.25, floor: 0, cap: 1, zMin: -2, zMax: 2 };

test('baselineZ: a submitted measure moves from its fitted z, an assigned one from CMS\'s assigned z', () => {
  assert.equal(baselineZ({ value: 0.75, z: 1.0001 }, p), 1);
  assert.equal(baselineZ({ value: null, z: 2.3 }, p), 2.3);
});
