// Ported, largely, from Thirty Day Readmissions (web/test/model.test.mjs at 33d1959).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeFilter, applyFilters, bedBand, BED_BANDS, slug, TEACH_LABEL } from '../../hrrp/filters.js';

test('scope filters match state, metro, division slug, region', () => {
  const h = { st: 'UT', cbsa: '41620', division: 'Mountain', region: 'West' };
  assert.ok(scopeFilter({ view: 'state', key: 'UT' })(h));
  assert.ok(scopeFilter({ view: 'metro', key: '41620' })(h));
  assert.ok(scopeFilter({ view: 'division', key: 'mountain' })(h));
  assert.ok(scopeFilter({ view: 'region', key: 'west' })(h));
  assert.ok(!scopeFilter({ view: 'state', key: 'CA' })(h));
  assert.ok(scopeFilter({ view: 'home' })(h));
});

test('slug lowercases and hyphenates letters runs', () => {
  assert.equal(slug('East North Central'), 'east-north-central');
  assert.equal(slug(null), '');
});

test('explorer filters combine', () => {
  const list = [
    { id: 'a', name: 'Alpha General', city: 'Provo', st: 'UT', paf: 0.99, peer: 1, teach: 'none', beds: 50, urban: false, c: { HF: { flag: 1 } } },
    { id: 'b', name: 'Beta Medical', city: 'Ogden', st: 'UT', paf: 1, peer: 2, teach: 'major', beds: 600, urban: true, c: {} },
  ];
  assert.deepEqual(applyFilters(list, { penalized: true }).map((h) => h.id), ['a']);
  assert.deepEqual(applyFilters(list, { cond: 'HF' }).map((h) => h.id), ['a']);
  assert.deepEqual(applyFilters(list, { beds: '500+', urban: true }).map((h) => h.id), ['b']);
  assert.deepEqual(applyFilters(list, { text: 'ogd' }).map((h) => h.id), ['b']);
  assert.deepEqual(applyFilters([...list, { ...list[0], id: 'c', st: 'ID' }], { st: 'ID' }).map((h) => h.id), ['c']);
  assert.equal(bedBand(99), '<100');
  assert.equal(bedBand(null), null);
  assert.deepEqual([bedBand(100), bedBand(300), bedBand(500)], BED_BANDS.slice(1));
  assert.deepEqual(Object.keys(TEACH_LABEL), ['none', 'minor', 'major']);
});

test('a hospital with no city is not found by the text "null"', () => {
  const list = [{ id: 'a', name: 'Alpha General', city: null, st: 'UT' }, { id: 'b', name: 'Beta Medical', city: 'Ogden', st: 'UT' }];
  assert.deepEqual(applyFilters(list, { text: 'null' }), []);
  assert.deepEqual(applyFilters(list, { text: 'alpha' }).map((h) => h.id), ['a']);
});
