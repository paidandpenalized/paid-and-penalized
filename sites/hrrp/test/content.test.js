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

// The notes are the pinned Thirty Day Readmissions output's meta.whatsNew, less the titles listed in `skipped` (a note about a later
// year: the site prints nothing that promises a date to come (pipeline/test/helpers.js FUTURE_WORDS), and the sources disagree on
// the year). An item that rewords a pinned note names its title in `pin`; the register's source (HRRP-20) is CMS's notice that it
// would stop excluding COVID-19 patients, and no FY2027 source confirming the pin's "ended" was found. An item may also carry a
// `claim` id (the claims register row behind it), which the pin does not have.
test("whats_new.json's items are the pinned Thirty Day Readmissions output's meta.whatsNew, less the skipped notes, when the fiscal years match", () => {
  const whatsNew = readJson(CONTENT + 'whats_new.json');
  const { meta } = readJson(REPO_ROOT + 'data/pinned/tdr/hrrp.json');
  assert.equal(whatsNew.fy, meta.fy, 'the copy is for a different fiscal year than the pin; update one');
  const pinTitles = meta.whatsNew.map((i) => i.title);
  for (const title of whatsNew.skipped) assert.ok(pinTitles.includes(title), `the pin no longer holds the skipped note "${title}"`);
  const pinned = meta.whatsNew.filter((i) => !whatsNew.skipped.includes(i.title));
  assert.deepEqual(whatsNew.items.map((i) => i.pin ?? i.title), pinned.map((i) => i.title), 'the same notes, in the pin\'s order');
  for (const [n, { claim, pin, ...item }] of whatsNew.items.entries()) {
    if (pin) assert.notEqual(item.title, pin, 'a reworded note differs from the pin');
    else assert.deepEqual(item, pinned[n]);
  }
  assert.ok(whatsNew.items.every((i) => !whatsNew.skipped.includes(i.title)));
});
