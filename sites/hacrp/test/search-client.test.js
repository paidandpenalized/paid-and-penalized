// The HACRP search's entries (client/search.js) from the hospitals asset: each hospital found by its name, city,
// state, ZIP code or CCN, opening its page, and each place (a region, division, state or metro area) by its name,
// opening its page; the asset loader (client/hospitals.js), which drops what is not a hospital or one of the site's
// own place pages; and the hand-off to the table (client/table.js showInTable), which puts the table back on all
// states. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search } from '../../../web/client/search.js';
import { hospitalEntries, placeEntries } from '../client/search.js';

const ASSET = {
  hospitalPath: '/hacrp/hospital/',
  rows: [
    ['99000A', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes', '35000'],
    ['990002', 'Example General Hospital', 'Exampleton', 'AL', 'N/A', 'No', '35001'],
    ['990003', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A', ''],
  ],
  // [kind, key, name, page, hospitals in CMS's file]
  places: [
    ['region', 'midwest', 'Midwest', '/hacrp/region/midwest/', 700],
    ['division', 'east-north-central', 'East North Central', '/hacrp/division/east-north-central/', 300],
    ['state', 'al', 'Alabama', '/hacrp/state/al/', 120],
    ['state', 'md', 'Maryland', '/hacrp/state/md/', 43],
    ['metro', '99001', 'Exampleton, AL', '/hacrp/metro/99001/', 12],
    ['metro', '99002', 'Sampleville-Examplecity, MD-AL', '/hacrp/metro/99002/', 1234],
  ],
};

test('each hospital is an entry: its name, "City, ST ZIP" under it, its page', () => {
  const entries = hospitalEntries(ASSET);
  assert.equal(entries.length, ASSET.rows.length);
  assert.deepEqual(entries[0], { type: 'hospital', key: '99000A', label: 'Example General Hospital', sub: 'Exampleton, AL 35000', extra: 'Exampleton AL 35000', href: '/hacrp/hospital/99000a/' });
  assert.equal(entries[2].sub, 'Sampleville, MD', 'no ZIP, no trailing space');
});

test('each place is an entry: its name, its kind and hospital count under it, its page; a state is also found by its code', () => {
  const entries = placeEntries(ASSET);
  assert.equal(entries.length, ASSET.places.length);
  assert.deepEqual(entries.map((e) => e.type), ASSET.places.map(([kind]) => kind));
  assert.deepEqual(entries.map((e) => e.href), ASSET.places.map(([, , , path]) => path));
  assert.deepEqual(entries.map((e) => e.label), ASSET.places.map(([, , name]) => name));
  // A state's key is its code; the others' are unique across kinds ("metro-99001"), so a key never collides with a CCN's or a code.
  assert.deepEqual(entries.map((e) => e.key), ['region-midwest', 'division-east-north-central', 'AL', 'MD', 'metro-99001', 'metro-99002']);
  assert.deepEqual(entries.map((e) => e.sub), [
    'Region · 700 hospitals', 'Division · 300 hospitals', 'State · 120 hospitals', 'State · 43 hospitals', 'Metro area · 12 hospitals', 'Metro area · 1,234 hospitals',
  ]);
  assert.ok(entries.every((e) => e.extra === ''));
  // An asset with no places (an old one, or a page whose loader dropped them all) gives none.
  assert.deepEqual(placeEntries({ rows: [] }), []);
  assert.deepEqual(placeEntries({ places: [] }), []);
});

test('a name, a city, a state, a ZIP or a CCN finds the hospital; two of one name are told apart by ZIP', () => {
  const index = buildIndex(hospitalEntries(ASSET));
  const find = (q) => search(q, index).results.map((r) => r.href);
  assert.deepEqual(find('sample med'), ['/hacrp/hospital/990003/']);
  assert.deepEqual(find('sampleville'), ['/hacrp/hospital/990003/']);
  assert.deepEqual(find('35001'), ['/hacrp/hospital/990002/']);
  assert.deepEqual(find('99000a'), ['/hacrp/hospital/99000a/']);
  assert.equal(find('example al').length, 2);
  assert.deepEqual(search('example', index).results.map((r) => r.sub), ['Exampleton, AL 35000', 'Exampleton, AL 35001']);
});

test('a place is found by name beside the hospitals; a state by its code first, then the places in a state-first order', () => {
  const index = buildIndex([...placeEntries(ASSET), ...hospitalEntries(ASSET)]);
  const find = (q, options) => search(q, index, options).results.map((r) => [r.type, r.href]);
  assert.deepEqual(find('alabama'), [['state', '/hacrp/state/al/']]);
  assert.deepEqual(find('midwest'), [['region', '/hacrp/region/midwest/']]);
  assert.deepEqual(find('east north'), [['division', '/hacrp/division/east-north-central/']]);
  assert.deepEqual(find('sampleville exam'), [['metro', '/hacrp/metro/99002/']], 'a metro area\'s name has its states in it');
  // "al": the state by its code ranks first, then the metro areas that name it; a hospital in AL is found by its city.
  const al = find('al');
  assert.deepEqual(al[0], ['state', '/hacrp/state/al/']);
  assert.deepEqual(find('md')[0], ['state', '/hacrp/state/md/']);
  // The same text finds a hospital (by city) and a metro area of that name; the metro area comes first, and a type filter separates them.
  assert.deepEqual(find('exampleton').map(([type]) => type), ['metro', 'hospital', 'hospital']);
  assert.deepEqual(find('exampleton', { types: ['hospital'] }).map(([type]) => type), ['hospital', 'hospital']);
  assert.deepEqual(find('exampleton', { types: ['metro'] }), [['metro', '/hacrp/metro/99001/']]);
});

// A fetch that serves an asset, and the loader reading it (client/hospitals.js), with the stand-ins put back after.
async function load(t, asset, { ok = true } = {}) {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const fetched = [];
  globalThis.fetch = async (url) => { fetched.push(url); return { ok, status: ok ? 200 : 503, json: async () => asset }; };
  const { hospitalLoader } = await import(`../client/hospitals.js?run=${Math.random()}`);
  return { hospitals: hospitalLoader(), fetched };
}

test('the loader keeps a hospital with a CCN and a place with one of the site\'s own place pages, and drops the rest', async (t) => {
  const good = ['state', 'al', 'Alabama', '/hacrp/state/al/', 120];
  const asset = {
    hospitalPath: '/hacrp/hospital/',
    rows: [['990001', 'A', 'B', 'AL', '0.1', 'No', ''], ['99000A', 'A', 'B', 'AL', '0.1', 'No', ''], ['9900', 'Short', 'B', 'AL', '0.1', 'No', ''], ['<script>', 'Bad', 'B', 'AL', '0.1', 'No', '']],
    places: [
      good,
      ['metro', '12580', 'Exampleton, AL', '/hacrp/metro/12580/', 3],
      ['region', 'midwest', 'Midwest', '/hacrp/region/midwest/', 3],
      // Dropped: a page off the site, without its closing slash, on no place kind's path, with a second path segment, in capitals,
      // a script, a path out of the site, or a kind the site has no pages for.
      ['state', 'x', 'Offsite', 'https://example.org/hacrp/state/x/', 1],
      ['state', 'x', 'Protocol-relative', '//example.org/hacrp/state/x/', 1],
      ['state', 'x', 'No slash', '/hacrp/state/x', 1],
      ['state', 'x', 'Not a place page', '/hacrp/hospital/990001/', 1],
      ['state', 'x', 'Too deep', '/hacrp/state/x/y/', 1],
      ['state', 'x', 'Capitals', '/hacrp/state/AL/', 1],
      ['state', 'x', 'Script', 'javascript:alert(1)', 1],
      ['state', 'x', 'Up', '/hacrp/state/../../x/', 1],
      ['county', '01001', 'Unknown kind', '/hacrp/county/01001/', 1],
    ],
  };
  const { hospitals, fetched } = await load(t, asset);
  const data = await hospitals('/assets/hacrp-hospitals.0000abcd.json');
  assert.deepEqual(data.rows.map((r) => r[0]), ['990001', '99000A']);
  assert.deepEqual(data.places.map((p) => p[3]), ['/hacrp/state/al/', '/hacrp/metro/12580/', '/hacrp/region/midwest/']);
  assert.deepEqual(data.places[0], good);
  assert.equal(data.hospitalPath, '/hacrp/hospital/');
  // Fetched once, however many ask.
  assert.equal(await hospitals('/assets/hacrp-hospitals.0000abcd.json'), data);
  assert.equal(fetched.length, 1);
});

test('the loader gives an asset with no places an empty list, and refuses a hospital path that is not a plain site path', async (t) => {
  const old = await load(t, { hospitalPath: '/hacrp/hospital/', rows: [] });
  assert.deepEqual((await old.hospitals('/a.json')).places, []);
  for (const hospitalPath of ['https://example.org/', '/hacrp/hospital', '/Hacrp/hospital/', 'javascript:alert(1)//']) {
    const bad = await load(t, { hospitalPath, rows: [], places: [] });
    await assert.rejects(bad.hospitals('/a.json'), /bad hospitalPath/, hospitalPath);
  }
});

test('a failed fetch is let go, so the next ask fetches again', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const results = [false, true];
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; const ok = results.shift(); return { ok, status: ok ? 200 : 503, json: async () => ({ hospitalPath: '/hacrp/hospital/', rows: [], places: [] }) }; };
  const { hospitalLoader } = await import(`../client/hospitals.js?run=${Math.random()}`);
  const hospitals = hospitalLoader();
  await assert.rejects(hospitals('/a.json'), /HTTP 503/);
  assert.deepEqual((await hospitals('/a.json')).rows, []);
  assert.equal(calls, 2);
});

// The page the table script finds: the filter box, the state menu (the program page's only), the section.
async function showIn(t, { menu, hash }) {
  const ORIGINAL = { document: globalThis.document, window: globalThis.window };
  const filter = { value: '', events: [], dispatchEvent: (e) => filter.events.push(e.type) };
  const states = menu ? { value: menu, events: [], dispatchEvent: (e) => states.events.push(e.type) } : null;
  const section = { scrolled: false, scrollIntoView() { section.scrolled = true; } };
  const urls = [];
  globalThis.document = { querySelector: (s) => ({ '#ht-name': filter, '#ht-state': states, '#hospitals': section })[s] ?? null, addEventListener() {} };
  globalThis.window = { location: { pathname: '/hacrp/', search: '', hash }, history: { replaceState: (_s, _t, url) => urls.push(url) }, addEventListener() {} };
  t.after(() => {
    for (const [k, v] of Object.entries(ORIGINAL)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const { showInTable } = await import(`../client/table.js?run=${Math.random()}`);
  showInTable('Exampleton');
  return { filter, states, section, urls };
}

test('showInTable: the query goes to the table filter, the state filter and the URL go back to all states, the table into view', async (t) => {
  const { filter, states, section, urls } = await showIn(t, { menu: 'MD', hash: '#state=MD' });
  assert.deepEqual(urls, ['/hacrp/']);
  assert.equal(states.value, '');
  assert.deepEqual(states.events, ['change']);
  assert.equal(filter.value, 'Exampleton');
  assert.deepEqual(filter.events, ['input']);
  assert.ok(section.scrolled);
});

test('showInTable on a place page (no state menu): the query goes to the filter and the table into view; the URL is left alone', async (t) => {
  const { filter, states, section, urls } = await showIn(t, { menu: null, hash: '' });
  assert.equal(states, null);
  assert.deepEqual(urls, []);
  assert.equal(filter.value, 'Exampleton');
  assert.deepEqual(filter.events, ['input']);
  assert.ok(section.scrolled);
});
