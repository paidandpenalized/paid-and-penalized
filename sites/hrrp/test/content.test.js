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

// The pinned notes include one about a later year ("Coming in ..."): the site prints nothing that promises a date to come
// (pipeline/test/helpers.js FUTURE_WORDS), and the sources disagree on the year, so that note is left out.
const LATER = /^Coming in /;

test("whats_new.json's items are the pinned Thirty Day Readmissions output's meta.whatsNew, less the note about a later year, when the fiscal years match", () => {
  const whatsNew = readJson(CONTENT + 'whats_new.json');
  const { meta } = readJson(REPO_ROOT + 'data/pinned/tdr/hrrp.json');
  assert.equal(whatsNew.fy, meta.fy, 'the copy is for a different fiscal year than the pin; update one');
  // An item may carry a `claim` id (the claims register row behind it), which the pin does not have.
  // One item is reworded on purpose: the pin says the pandemic-era exclusion "ended", but the register's source (HRRP-20) is CMS's
  // notice that it would stop excluding COVID-19 patients, and no FY2027 source confirming it was found. Matched by position.
  const REWORDED = 'COVID-19 patients are back in.';
  const reworded = whatsNew.items.filter((i) => i.claim === 'HRRP-20');
  assert.equal(reworded.length, 1);
  const pinned = meta.whatsNew.filter((i) => !LATER.test(i.title));
  assert.equal(pinned.filter((i) => i.title === REWORDED).length, 1, 'the pin still holds the item this one rewords');
  assert.deepEqual(whatsNew.items.filter((i) => i.claim !== 'HRRP-20').map(({ claim, ...item }) => item), pinned.filter((i) => i.title !== REWORDED));
  assert.ok(whatsNew.items.every((i) => !LATER.test(i.title)));
});
