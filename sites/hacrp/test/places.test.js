// The places the HACRP site has pages for (web/places.js): the Census regions, divisions, states and metro areas, built
// from the hospital master. Checked on the pinned data by property (counts add up down the chain, every metro belongs
// to a state it reaches) and on a handful of synthetic hospitals for the edge cases the pinned data may not hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_NAMES } from '../../../web/charts/geo.js';
import { KINDS, ancestors, buildPlaces, placeCounts, placePath, slug } from '../web/places.js';
import { DATA, PLACES } from './pinned.js';

const { hospitals, master } = DATA;
const of = (kind) => PLACES.list.filter((p) => p.kind === kind);
const place = (id) => PLACES.places.get(id);
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
// A hospital the places hold: the master gives it a region, a division and a state the site can name.
const placed = (h) => { const r = master.get(h.ccn); return Boolean(r?.region && r.division && STATE_NAMES[r.state]); };

test('slug and placePath: lowercase words joined by hyphens, /hacrp/<kind>/<key>/', () => {
  assert.equal(slug('East North Central'), 'east-north-central');
  assert.equal(slug('  Winston-Salem, NC  '), 'winston-salem-nc');
  assert.equal(slug('Mid  -- Atlantic!'), 'mid-atlantic');
  assert.equal(placePath('state', 'AL'), '/hacrp/state/al/');
  assert.equal(placePath('metro', '12580'), '/hacrp/metro/12580/');
  assert.equal(placePath('metro', 12580), '/hacrp/metro/12580/');
  assert.equal(placePath('region', 'midwest'), '/hacrp/region/midwest/');
  assert.equal(placePath('division', slug('Pacific')), '/hacrp/division/pacific/');
  assert.equal(placePath('state', 'a b/c'), '/hacrp/state/a%20b%2Fc/', 'a key is one path segment');
  assert.throws(() => placePath('county', '01001'), RangeError);
  assert.deepEqual([...KINDS], ['region', 'division', 'state', 'metro']);
});

test('every place has its own page path, in the form the hospitals loader accepts', () => {
  const paths = PLACES.list.map((p) => p.path);
  assert.equal(new Set(paths).size, paths.length, 'one page per place');
  const ids = PLACES.list.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...PLACES.places.keys()].sort(), [...ids].sort());
  for (const p of PLACES.list) {
    assert.ok(KINDS.includes(p.kind), p.id);
    assert.equal(p.id, `${p.kind}:${p.key}`);
    assert.equal(p.path, placePath(p.kind, p.key));
    assert.match(p.path, /^\/hacrp\/(region|division|state|metro)\/[a-z0-9-]+\/$/, p.id);
    assert.ok(p.name, `${p.id}: a name`);
  }
  assert.deepEqual(KINDS.map((k) => of(k).length > 0), [true, true, true, true]);
  assert.equal(of('region').length, 4);
  assert.equal(of('division').length, 9);
  assert.deepEqual(PLACES.regions.map((r) => r.id), of('region').map((r) => r.id).sort((a, b) => place(a).name.localeCompare(place(b).name, 'en')), 'regions in name order');
});

test('every hospital the master places is in exactly one state, one division and one region', () => {
  const eligible = hospitals.filter(placed);
  assert.ok(eligible.length > 0);
  for (const kind of ['state', 'division', 'region']) {
    const inPlaces = new Map();
    for (const p of of(kind)) for (const ccn of p.ccns) inPlaces.set(ccn, (inPlaces.get(ccn) ?? 0) + 1);
    assert.equal(inPlaces.size, eligible.length, `${kind}: every placed hospital is in one`);
    assert.ok([...inPlaces.values()].every((n) => n === 1), `${kind}: and in only one`);
  }
  // The state is the master's own, and the division and region are that state's.
  for (const h of eligible) {
    const r = master.get(h.ccn);
    const state = place(`state:${r.state.toLowerCase()}`);
    assert.ok(state.ccns.includes(h.ccn), h.ccn);
    assert.equal(state.name, STATE_NAMES[r.state]);
    assert.equal(place(state.parent).name, r.division);
    assert.equal(place(place(state.parent).parent).name, r.region);
  }
  // CMS's file has no hospital the master leaves out of a state page.
  assert.equal(eligible.length, hospitals.length, 'the pinned data has none to drop');
  assert.equal(of('state').length, new Set(hospitals.map((h) => master.get(h.ccn).state)).size);
});

test('counts add up down the chain: a region is its divisions, a division its states', () => {
  const FIELDS = ['file', 'scored', 'decided', 'yes', 'allSix', 'assigned'];
  const kids = (p) => p.children.map(place);
  for (const kind of ['region', 'division']) {
    for (const p of of(kind)) {
      assert.ok(p.children.length > 0, `${p.id}: has children`);
      for (const f of FIELDS) assert.equal(p.counts[f], sum(kids(p), (k) => k.counts[f]), `${p.id}: ${f}`);
      assert.deepEqual([...p.ccns].sort(), kids(p).flatMap((k) => k.ccns).sort(), `${p.id}: its hospitals are its children's`);
      assert.ok(kids(p).every((k) => k.parent === p.id));
    }
  }
  // The regions are the nation (every placed hospital).
  const regions = of('region');
  assert.equal(sum(regions, (r) => r.counts.file), hospitals.filter(placed).length);
  for (const f of ['scored', 'decided', 'yes']) assert.equal(sum(regions, (r) => r.counts[f]), sum(of('state'), (s) => s.counts[f]), f);
  for (const p of PLACES.list) {
    const c = p.counts;
    assert.equal(c.file, p.ccns.length, `${p.id}: file`);
    assert.ok(c.yes <= c.decided && c.decided <= c.scored && c.scored <= c.file, `${p.id}: counts nest`);
    assert.ok(c.allSix <= c.scored && c.assigned <= c.scored, `${p.id}: parts of the scored`);
    assert.equal(p.rows.length, c.scored);
    assert.equal(c.median === null, c.scored === 0, `${p.id}: a middle score exactly when something is scored`);
  }
});

test('every metro area belongs to a state it reaches, and is listed under every state it reaches', () => {
  const metros = of('metro');
  assert.ok(metros.length > 0);
  for (const m of metros) {
    assert.ok(m.stateCodes.length > 0, `${m.id}: reaches a state`);
    assert.deepEqual(m.stateCodes, [...m.stateCodes].sort(), `${m.id}: state codes in order`);
    const home = place(m.parent);
    assert.equal(home?.kind, 'state', `${m.id}: parent is a state`);
    assert.ok(m.stateCodes.includes(home.key.toUpperCase()), `${m.id}: the parent is one it reaches`);
    for (const code of m.stateCodes) assert.ok(place(`state:${code.toLowerCase()}`).children.includes(m.id), `${m.id}: listed under ${code}`);
    // Each of its hospitals is in the master's metro and in one of the states it reaches.
    for (const ccn of m.ccns) {
      const r = master.get(ccn);
      assert.equal(r.cbsa, m.key, `${m.id}: ${ccn}'s metro`);
      assert.ok(m.stateCodes.includes(r.state), `${m.id}: ${ccn}'s state`);
    }
    // The home state holds the most of its hospitals.
    const inState = (code) => m.ccns.filter((c) => master.get(c).state === code).length;
    assert.ok(m.stateCodes.every((code) => inState(code) <= inState(home.key.toUpperCase())), `${m.id}: home has the most`);
    assert.equal(m.ccns.length, sum(m.stateCodes, inState));
  }
  // A metro is no place's child by its parent alone: a state lists only metros that reach it.
  for (const s of of('state')) for (const id of s.children) assert.ok(place(id).stateCodes.includes(s.key.toUpperCase()), `${s.id}: ${id}`);
  assert.ok(metros.some((m) => m.stateCodes.length > 1), 'the pinned data has a metro across a state line');
  // A metro changes no count above it.
  assert.equal(sum(of('region'), (r) => r.counts.file), sum(of('state'), (s) => s.counts.file));
});

test('children are listed by name; a state\'s are metro areas, the rest\'s are the next kind down', () => {
  const next = { region: 'division', division: 'state', state: 'metro' };
  for (const p of PLACES.list.filter((x) => x.kind !== 'metro')) {
    const names = p.children.map((id) => place(id).name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')), `${p.id}: by name`);
    assert.ok(p.children.every((id) => place(id).kind === next[p.kind]), `${p.id}: kind`);
  }
  assert.deepEqual(of('metro').map((m) => m.children), of('metro').map(() => []));
});

test('ancestors: from the region down to the place\'s parent; a metro has its home state\'s chain', () => {
  const [region] = of('region');
  assert.deepEqual(ancestors(PLACES.places, region), []);
  const [division] = of('division');
  assert.deepEqual(ancestors(PLACES.places, division).map((p) => p.kind), ['region']);
  const state = of('state')[0];
  assert.deepEqual(ancestors(PLACES.places, state).map((p) => p.kind), ['region', 'division']);
  assert.equal(ancestors(PLACES.places, state)[1].id, state.parent);
  for (const m of of('metro')) {
    const chain = ancestors(PLACES.places, m);
    assert.deepEqual(chain.map((p) => p.kind), ['region', 'division', 'state'], m.id);
    assert.equal(chain.at(-1).id, m.parent);
    assert.deepEqual(chain.slice(0, 2), ancestors(PLACES.places, chain[2]), `${m.id}: its home state's chain`);
  }
});

// ---------- synthetic hospitals ----------

const row = (ccn, over = {}) => ({ ccn, total: 0.1, decided: true, yes: false, ids: ['PSI90'], assigned: [], ...over });
const rec = (state, over = {}) => ({ state, region: 'Northeast', division: 'Middle Atlantic', cbsa: null, cbsaName: null, ...over });

test('buildPlaces on synthetic hospitals: the ones the site cannot place are left out; a metro across a line has a home', () => {
  const metro = { cbsa: '99001', cbsaName: 'Examplecity, NY-CT' };
  const records = new Map([
    ['990001', rec('NY', metro)], ['990002', rec('NY', metro)], ['990003', rec('CT', { ...metro, division: 'New England' })],
    // Tied across the line: the first state code is home.
    ['990004', rec('NY', { cbsa: '99002', cbsaName: 'Tieburg, CT-NY' })], ['990005', rec('CT', { division: 'New England', cbsa: '99002', cbsaName: 'Tieburg, CT-NY' })],
    ['990006', rec('CT', { division: 'New England' })],
    // Left out: a territory the site has no name for, no region, no division, and no master record.
    ['990007', rec('ZZ')], ['990008', rec('NY', { region: null })], ['990009', rec('NY', { division: null })],
  ]);
  const list = [...records.keys(), '990010'].map((ccn) => ({ ccn }));
  const rows = [
    row('990001', { yes: true }), row('990002'), row('990003', { decided: false, yes: null }),
    row('990004', { ids: ['PSI90', 'CLABSI', 'CAUTI', 'SSI', 'CDI', 'MRSA'], assigned: ['CDI'], yes: true }), row('990005'), row('990006'),
  ];
  const places = buildPlaces({ hospitals: list, master: records, rows });
  const ids = places.list.map((p) => p.id).sort();
  assert.deepEqual(ids, ['division:middle-atlantic', 'division:new-england', 'metro:99001', 'metro:99002', 'region:northeast', 'state:ct', 'state:ny']);
  const get = (id) => places.places.get(id);

  assert.deepEqual(get('state:ny').ccns, ['990001', '990002', '990004']);
  assert.deepEqual(get('state:ct').ccns, ['990003', '990005', '990006']);
  assert.deepEqual(get('region:northeast').ccns.sort(), ['990001', '990002', '990003', '990004', '990005', '990006']);
  assert.equal(get('state:ny').parent, 'division:middle-atlantic');
  assert.equal(get('state:ct').parent, 'division:new-england');
  assert.equal(get('state:ct').name, STATE_NAMES.CT);

  // Two of three hospitals in NY: NY is home. A tie goes to the first code.
  assert.equal(get('metro:99001').parent, 'state:ny');
  assert.deepEqual(get('metro:99001').stateCodes, ['CT', 'NY']);
  assert.equal(get('metro:99002').parent, 'state:ct');
  // Both states list both metros; the metro's chain is its home state's.
  assert.deepEqual(get('state:ny').children, ['metro:99001', 'metro:99002']);
  assert.deepEqual(get('state:ct').children, ['metro:99001', 'metro:99002']);
  assert.deepEqual(ancestors(places.places, get('metro:99001')).map((p) => p.id), ['region:northeast', 'division:middle-atlantic', 'state:ny']);
  assert.deepEqual(ancestors(places.places, get('metro:99002')).map((p) => p.id), ['region:northeast', 'division:new-england', 'state:ct']);
  assert.deepEqual(places.regions.map((r) => r.id), ['region:northeast']);
  assert.deepEqual(get('region:northeast').children, ['division:middle-atlantic', 'division:new-england']);

  // The counts: Maryland-style rows (decided false) count as scored, not decided.
  assert.deepEqual(get('state:ct').counts, { file: 3, scored: 3, decided: 2, yes: 0, median: 0.1, allSix: 0, assigned: 0 });
  assert.deepEqual(get('state:ny').counts, { file: 3, scored: 3, decided: 3, yes: 2, median: 0.1, allSix: 1, assigned: 1 });
  assert.equal(get('region:northeast').counts.file, 6);
  assert.equal(get('metro:99001').counts.file, 3);
});

test('placeCounts: scored, decided, cut, the middle score, all six measures and CMS-assigned, over the rows given', () => {
  const six = ['PSI90', 'CLABSI', 'CAUTI', 'SSI', 'CDI', 'MRSA'];
  const rows = [
    row('990001', { total: -0.5, yes: false }), row('990002', { total: 0.5, yes: true, ids: six }),
    row('990003', { total: 0.25, decided: false, yes: null, ids: six, assigned: ['SSI'] }), row('990004', { total: 1, yes: true, assigned: ['PSI90'] }),
  ];
  assert.deepEqual(placeCounts(rows, 5), { file: 5, scored: 4, decided: 3, yes: 2, median: 0.375, allSix: 2, assigned: 2 });
  // A place with nothing scored has no middle score.
  assert.deepEqual(placeCounts([], 2), { file: 2, scored: 0, decided: 0, yes: 0, median: null, allSix: 0, assigned: 0 });
});
