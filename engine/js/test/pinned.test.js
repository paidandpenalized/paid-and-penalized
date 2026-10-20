import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PINNED_DIR, readManifest } from '../../../pipeline/files.js';
import { loadHacrpFy2026 } from './fixtures.js';

for (const entry of readManifest()) {
  test(`pinned file ${entry.id} is byte-identical to its manifest entry`, () => {
    const bytes = readFileSync(PINNED_DIR + entry.path);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  });
}

test('the HACRP file parses into rows that all carry a Facility ID', () => {
  const { rows } = loadHacrpFy2026();
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => /^[0-9A-Z]{6}$/.test(r['Facility ID'])));
});
