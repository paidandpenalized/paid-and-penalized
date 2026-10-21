// The HACRP search's entries (client/search.js) from the hospitals asset: each hospital found by its name, city,
// state, ZIP code or CCN, opening its page; and the program page's handoff to the table (client/program.js
// showInTable), which puts the table back on all states. Synthetic rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search } from '../../../web/client/search.js';
import { hospitalEntries, STATE_ENTRIES } from '../client/search.js';

const ASSET = {
  hospitalPath: '/hacrp/hospital/',
  rows: [
    ['99000A', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes', '35000'],
    ['990002', 'Example General Hospital', 'Exampleton', 'AL', 'N/A', 'No', '35001'],
    ['990003', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A', ''],
  ],
};

test('each hospital is an entry: its name, "City, ST ZIP" under it, its page; no state entries until state pages exist', () => {
  const entries = hospitalEntries(ASSET);
  assert.deepEqual(entries[0], { type: 'hospital', key: '99000A', label: 'Example General Hospital', sub: 'Exampleton, AL 35000', extra: 'Exampleton AL 35000', href: '/hacrp/hospital/99000a/' });
  assert.equal(entries[2].sub, 'Sampleville, MD', 'no ZIP, no trailing space');
  assert.deepEqual(STATE_ENTRIES, []);
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

test('showInTable: the query goes to the table filter, the state filter and the URL go back to all states, the table into view', async (t) => {
  const ORIGINAL = { document: globalThis.document, window: globalThis.window };
  const filter = { value: '', events: [], dispatchEvent: (e) => filter.events.push(e.type) };
  const states = { value: 'MD', events: [], dispatchEvent: (e) => states.events.push(e.type) };
  const section = { scrolled: false, scrollIntoView() { section.scrolled = true; } };
  const urls = [];
  globalThis.document = { querySelector: (s) => ({ '#ht-name': filter, '#ht-state': states, '#hospitals': section })[s] ?? null, addEventListener() {} };
  globalThis.window = { location: { pathname: '/hacrp/', search: '', hash: '#state=MD' }, history: { replaceState: (_s, _t, url) => urls.push(url) }, addEventListener() {} };
  t.after(() => {
    for (const [k, v] of Object.entries(ORIGINAL)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const { showInTable } = await import(`../client/program.js?run=${Math.random()}`);
  showInTable('Exampleton');
  assert.deepEqual(urls, ['/hacrp/']);
  assert.equal(states.value, '');
  assert.deepEqual(states.events, ['change']);
  assert.equal(filter.value, 'Exampleton');
  assert.deepEqual(filter.events, ['input']);
  assert.ok(section.scrolled);
});
