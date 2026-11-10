// The program page's hospital search entries (client/search.js): a hospital with no city (empty text, as the reader gives
// it: web/render/format.js hospitalRecord) reads "ST", not ", ST", and the word "null" finds nothing. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search } from '../../../web/client/search.js';
import { hospitalEntries, namesStateOut, searchWords } from '../client/search.js';

const ASSET = {
  hospitalPath: '/hrrp/hospital/',
  hospitals: [
    { id: '990001', name: 'Example General Hospital', city: 'Exampleton', st: 'AL', zip: '35000' },
    { id: '990002', name: 'Sample Medical Center', city: '', st: 'MD', zip: '' },
  ],
};

test('a hospital with no city lists as its state alone, and the word "null" finds nothing', () => {
  const entries = hospitalEntries(ASSET);
  assert.equal(entries[0].sub, 'Exampleton, AL 35000');
  assert.equal(entries[1].sub, 'MD');
  assert.ok(!entries.some((e) => /null|undefined/.test(`${e.sub} ${e.extra}`)));
  assert.deepEqual(search('null', buildIndex(entries)).results, []);
  assert.deepEqual(search('sample', buildIndex(entries)).results.map((r) => r.key), ['990002']);
});

test('a query that names the state the program leaves out, and finds nothing, says why; any other says what to try', () => {
  const words = searchWords();
  for (const q of ['Maryland', 'maryland ', 'MD', 'Mary', 'maryl']) assert.ok(namesStateOut(q), q);
  for (const q of ['Mar', 'm', 'Maryville', 'Virginia', '']) assert.ok(!namesStateOut(q), q);
  assert.match(words.empty('Maryland'), /^No matches\. The program covers non-Maryland subsection \(d\) hospitals, so Maryland’s hospitals are not in it\.$/);
  assert.equal(words.count(0, 'md'), words.empty('Maryland'));
  assert.match(words.empty('Zzyzx'), /^No matches\. Try a city, a ZIP code or the hospital’s CCN\.$/);
  assert.equal(words.count(0), words.empty('Zzyzx'), 'no query: the usual words');
  assert.equal(words.count(2, 'Maryland'), '2 matches', 'matches list as usual');
});
