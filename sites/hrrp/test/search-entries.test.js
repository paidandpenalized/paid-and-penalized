// The program page's hospital search entries (client/search.js): a hospital with no city reads "ST", not "null, ST", and
// the word "null" finds nothing. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search } from '../../../web/client/search.js';
import { hospitalEntries } from '../client/search.js';

const ASSET = {
  hospitalPath: '/hrrp/hospital/',
  hospitals: [
    { id: '990001', name: 'Example General Hospital', city: 'Exampleton', st: 'AL', zip: '35000' },
    { id: '990002', name: 'Sample Medical Center', city: null, st: 'MD', zip: '' },
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
