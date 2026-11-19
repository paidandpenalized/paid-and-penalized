// CATEGORIES mirrors the Python list; the emitted file is the check that the two cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../../team/params.js';

const emitted = JSON.parse(readFileSync(new URL('../../../../data/emitted/team/fy2027/team.json', import.meta.url), 'utf8'));

test('params: CATEGORIES are the emitted drgCategory values, in the order of the file\'s categoryAvg keys', () => {
  assert.deepEqual([...CATEGORIES].sort(), [...new Set(Object.values(emitted.drgCategory))].sort());
  assert.deepEqual([...CATEGORIES], Object.keys(emitted.categoryAvg));
});
