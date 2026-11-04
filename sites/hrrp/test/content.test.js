import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT, readJson } from '../../../pipeline/files.js';

const CONTENT = REPO_ROOT + 'sites/hrrp/content/';
const FILES = ['research', 'timeline', 'whats_new'];

for (const name of FILES) {
  test(`${name}.json is valid JSON`, () => {
    assert.doesNotThrow(() => readJson(`${CONTENT}${name}.json`));
  });
}

test("whats_new.json's items are the pinned Thirty Day Readmissions output's meta.whatsNew when the fiscal years match", () => {
  const whatsNew = readJson(CONTENT + 'whats_new.json');
  const { meta } = readJson(REPO_ROOT + 'data/pinned/tdr/hrrp.json');
  assert.equal(whatsNew.fy, meta.fy, 'the copy is for a different fiscal year than the pin; update one');
  assert.deepEqual(whatsNew.items, meta.whatsNew);
});
