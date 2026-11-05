import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeFilter } from '../../../engine/js/hrrp/filters.js';
import { buildPlaces } from '../web/places.js';
import { loadHrrpOnce } from './fixtures.js';
import { hospitalPathOf } from '../../../web/site.js';
import { csvPath, hospitalPath, placePath, PROGRAM_PATH, DOLLARS_HREF } from '../web/links.js';

const { hospitals, meta } = loadHrrpOnce();
const P = buildPlaces(hospitals, meta);
const ofKind = (k) => P.list.filter((p) => p.kind === k);

test('paths', () => {
  assert.equal(PROGRAM_PATH, '/hrrp/');
  assert.equal(placePath('state', 'VA'), '/hrrp/state/va/');
  // No CCN in the data has a letter, so one is made from a row's: the path lowercases it.
  const ccn = `${hospitals[0].id}A`;
  assert.equal(hospitalPath(ccn), `/hrrp/hospital/${ccn.toLowerCase()}/`);
  assert.equal(csvPath(2027, 'x'), '/data/hrrp/fy2027/x.csv');
  assert.equal(DOLLARS_HREF, '/hrrp/methods/#methods-dollars');
  assert.throws(() => placePath('county', 'x'), RangeError);
});

test("the site's hospital address and the shared registry's agree for every hospital in the data", () => {
  for (const h of hospitals) assert.equal(hospitalPath(h.id), hospitalPathOf('hrrp', h.id, { inTdr: true }), 'one address');
});

test('the places on the data', () => {
  assert.equal(ofKind('region').length, 4);
  assert.deepEqual(ofKind('region').map((p) => p.key).sort(), ['midwest', 'northeast', 'south', 'west']);
  assert.equal(ofKind('division').length, 9);
  assert.equal(ofKind('state').length, 50);
  assert.ok(!P.byKey.has('state:md') && !P.byKey.has('state:pr'));
  assert.equal(ofKind('metro').length, 406);
  for (const p of P.list) assert.ok(p.hospitals.length > 0);
  for (const m of ofKind('metro')) assert.equal(new Set(m.hospitals.map((h) => h.cbsaName)).size, 1, m.key);
});

test('every hospital resolves to its places', () => {
  for (const h of hospitals) {
    const [r, d, s, m] = P.of(h);
    assert.equal(r.name, h.region);
    assert.equal(d.name, h.division);
    assert.equal(s.key, h.st.toLowerCase());
    assert.equal(m?.key ?? null, h.cbsa ?? null);
  }
});

test('the tree: regions > divisions > states > metros', () => {
  for (const p of P.list) {
    if (p.kind === 'region') assert.equal(p.parent, null);
    else assert.ok(p.parent.children.includes(p));
  }
  assert.ok(ofKind('region').every((r) => r.children.every((c) => c.kind === 'division')));
  assert.ok(ofKind('state').every((s) => s.children.every((c) => c.kind === 'metro')));
});

test('a multi-state metro is a child of each state it reaches and its parent is the home state', () => {
  const multi = ofKind('metro').filter((m) => m.states.length > 1);
  assert.ok(multi.length > 0);
  for (const m of multi) {
    for (const code of m.states) assert.ok(P.byKey.get(`state:${code.toLowerCase()}`).children.includes(m));
    const count = (c) => m.hospitals.filter((h) => h.st === c).length;
    assert.equal(m.parent.key, m.homeState.toLowerCase());
    assert.ok(m.states.every((c) => count(m.homeState) >= count(c)));
  }
});

test('home state ties go to the first code (synthetic)', () => {
  const mk = (id, st) => ({ id, st, cbsa: '11111', cbsaName: 'X', region: 'South', division: 'South Atlantic' });
  const Q = buildPlaces([mk('a', 'VA'), mk('b', 'DC')], { states: { VA: 'Virginia', DC: 'District of Columbia' } });
  assert.equal(Q.byKey.get('metro:11111').homeState, 'DC');
  assert.deepEqual(Q.byKey.get('metro:11111').states, ['DC', 'VA']);
});

test("each place holds the hospitals scopeFilter selects", () => {
  for (const p of P.list) {
    const want = hospitals.filter(scopeFilter({ view: p.kind, key: p.kind === 'state' ? p.key.toUpperCase() : p.key })).map((h) => h.id);
    assert.deepEqual(p.hospitals.map((h) => h.id), want, `${p.kind}:${p.key}`);
  }
});
