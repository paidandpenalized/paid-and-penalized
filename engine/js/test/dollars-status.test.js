import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, dollarsPath, readJson } from '../../../pipeline/files.js';
import { SHOWN_STATUSES } from '../dollars/status.js';

test('the statuses a page has words for are the three a hospital has', () => {
  const dollars = readJson(REPO_ROOT + dollarsPath(2026));
  assert.deepEqual([...SHOWN_STATUSES], ['estimated', 'maryland', 'no-inputs']);
  assert.ok(Object.isFrozen(SHOWN_STATUSES));
  for (const h of dollars.hospitals) assert.ok(SHOWN_STATUSES.includes(h.status), h.ccn);
});
