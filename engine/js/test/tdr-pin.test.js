// The pinned Thirty Day Readmissions data: the shape this repo relies on until that site folds in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../schema.js';
import { PINNED_DIR, readManifest, loadSchemas } from './fixtures.js';

const entry = readManifest().find((e) => e.id === 'tdr-hrrp-fy2027');
const data = JSON.parse(readFileSync(PINNED_DIR + entry.path, 'utf8'));

test('the TDR pin names the exact source commit in its download URL', () => {
  assert.match(entry.sourceCommit, /^[0-9a-f]{40}$/);
  assert.ok(entry.downloadUrl.includes(`/${entry.sourceCommit}/`));
});

test('TDR data: an integer fiscal year and hospitals keyed by unique 6-character CCN text', () => {
  assert.ok(Number.isInteger(data.meta.fy));
  assert.ok(data.hospitals.length > 0);
  const errors = validate({ type: 'array', items: { $ref: 'common.schema.json#/$defs/ccn' } }, data.hospitals.map((h) => h.id), {
    schemas: loadSchemas(),
  });
  assert.deepEqual(errors, []);
  assert.equal(new Set(data.hospitals.map((h) => h.id)).size, data.hospitals.length);
});
