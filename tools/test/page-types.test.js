// The family's page types by address (page-types.js), which the size budget and the browser checks' sample pages read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE } from '../../web/site.js';
import { pageType, placeKind } from '../ci/page-types.js';

test('pageType: every page of the site sorts into one type', () => {
  const sorted = {
    '/': 'hub',
    '/404': 'notFound',
    '/hacrp/': 'program',
    '/hacrp/methods/': 'methods',
    '/hacrp/data/': 'dictionary',
    '/hacrp/hospital/990001/': 'hospital',
    '/hacrp/hospital/99a001/': 'hospital',
    '/hacrp/region/northeast/': 'place',
    '/hacrp/division/south-atlantic/': 'place',
    '/hacrp/state/ca/': 'place',
    '/hacrp/metro/new-york-newark-jersey-city-ny-nj/': 'place',
  };
  for (const path of Object.values(SITE.pages)) sorted[path] = 'policy';
  // Every program without a site here has a placeholder at its folder until its own page is built.
  for (const { path, stage } of SITE.programs) if (stage !== 'live') sorted[path] = 'coming';
  assert.equal(sorted['/hvbp/'], 'coming');
  for (const [path, type] of Object.entries(sorted)) assert.equal(pageType(path), type, path);
  // The hub's methods page and the program's are different pages.
  assert.equal(pageType('/methods/'), 'policy');
  assert.equal(pageType('/hacrp/methods/'), 'methods');
});

test('pageType: a path that matches no type is none (null)', () => {
  // A hospital's page is at its CCN in lowercase, and a place's at its key in lowercase.
  for (const path of ['/hvbp/x/', '/hvbp', '/hacrp/hospital/', '/hacrp/hospital/12345/', '/hacrp/hospital/9900011/', '/hacrp/hospital/99A001/', '/hacrp/county/x/',
    '/hacrp/state/', '/hacrp/state/CA/', '/new/', '/other.html', '/hacrp/hospital/990001/extra/', '/hacrp/state/ca/extra/'])
    assert.equal(pageType(path), null, path);
});

test('placeKind: a place page\'s kind, from its address; null for any other page', () => {
  assert.equal(placeKind('/hacrp/region/northeast/'), 'region');
  assert.equal(placeKind('/hacrp/division/south-atlantic/'), 'division');
  assert.equal(placeKind('/hacrp/state/ca/'), 'state');
  assert.equal(placeKind('/hacrp/metro/new-york-newark-jersey-city-ny-nj/'), 'metro');
  for (const path of ['/hacrp/', '/hacrp/state/', '/hacrp/state/CA/', '/hacrp/state/ca/extra/', '/hacrp/hospital/990001/']) assert.equal(placeKind(path), null, path);
});
