// The family's page types by address (page-types.js), which the size budget and the browser checks' sample pages read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACEHOLDER_PROGRAMS, SITE, hospitalPathOf } from '../../web/site.js';
import { hospitalPath, pageType, placeKind } from '../ci/page-types.js';

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
    // A hospital's page across the programs: its CCN, lowercase, under /hospital/.
    '/hospital/990001/': 'hubHospital',
    '/hospital/99a001/': 'hubHospital',
    // The interim Readmissions pages: the program's folder, and a hospital's page under it.
    '/hrrp/': 'hrrp',
    '/hrrp/hospital/990001/': 'hrrpHospital',
    '/hrrp/hospital/99a001/': 'hrrpHospital',
  };
  for (const path of Object.values(SITE.pages)) sorted[path] = 'policy';
  // Every program with no page here has a placeholder at its folder; Readmissions' folder holds the interim page, not a
  // placeholder.
  for (const { path } of PLACEHOLDER_PROGRAMS) sorted[path] = 'coming';
  assert.equal(sorted['/hvbp/'], 'coming');
  assert.equal(sorted['/hrrp/'], 'hrrp');
  for (const [path, type] of Object.entries(sorted)) assert.equal(pageType(path), type, path);
  // The hub's methods page and the program's are different pages.
  assert.equal(pageType('/methods/'), 'policy');
  assert.equal(pageType('/hacrp/methods/'), 'methods');
});

test('pageType: a hospital\'s page across the programs is hubHospital only at a valid CCN\'s lowercase folder', () => {
  for (const ccn of ['990001', '99A001']) assert.equal(pageType(hospitalPathOf('hub', ccn)), 'hubHospital', ccn);
  for (const path of ['/hospital/', '/hospital/99A001/', '/hospital/12345/', '/hospital/9900011/', '/hospital/99-001/', '/hospital/990001/extra/', '/hospital/990001', '/hospitals/990001/'])
    assert.equal(pageType(path), null, path);
});

test('pageType: an interim Readmissions hospital page is hrrpHospital only at a valid CCN\'s lowercase folder under /hrrp/hospital/', () => {
  for (const ccn of ['990001', '99A001']) assert.equal(pageType(hospitalPathOf('hrrp', ccn, { inTdr: true })), 'hrrpHospital', ccn);
  for (const path of ['/hrrp/hospital/', '/hrrp/hospital/99A001/', '/hrrp/hospital/12345/', '/hrrp/hospital/9900011/', '/hrrp/hospital/990001/extra/', '/hrrp/hospital/990001', '/hrrp/hospitals/990001/', '/hrrp', '/hrrp/x/'])
    assert.equal(pageType(path), null, path);
});

test('the family\'s address for a HACRP hospital page (web/site.js hospitalPathOf) is the one the HACRP site writes', () => {
  for (const ccn of ['990001', '99A001']) assert.equal(hospitalPathOf('hacrp', ccn), hospitalPath(ccn), ccn);
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
