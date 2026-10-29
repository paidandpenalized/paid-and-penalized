// The family search (hub/client/search.js, entry hub-search): the hospitals and the states as search entries, found by
// word starts in the shared index (web/client/search.js), the combobox mounted on every hub search form, and the form's
// markup (hub/search/form.js) that Task 6 puts in the bar. Synthetic hospitals, plus the real list for the counts and
// for the example hospital, which is picked by EXAMPLE_CCN and not by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { buildIndex, search } from '../../web/client/search.js';
import { US_STATES } from '../../engine/js/states.js';
import { hubEntries, hubWords, mountHubSearch } from '../client/search.js';
import { loadHub } from '../data.js';
import { EXAMPLE_CCN, hubHospitals } from '../model.js';
import { hubSearchForm } from '../search/form.js';
import { comboForm } from '../../web/test/dom.js';

const h = (ccn, name, city, state) => ({ ccn, name, city, state, status: 'estimated', inTdr: false, est: null });
const SAMPLE = [
  h('990001', 'Example General Hospital', 'Exampleton', 'OH'),
  h('99000A', 'Sample Medical Center', 'Sampleville', 'NY'),
  h('990003', 'Ohio Valley Example', 'Troy', 'NY'),
  h('990004', 'Island Clinic', 'San Juan', 'PR'),
];

test('each hospital is an entry: its name, "City, ST" under it, found by its city, state and CCN, opening its page', () => {
  const entries = hubEntries(SAMPLE).filter((e) => e.type === 'hospital');
  assert.equal(entries.length, SAMPLE.length);
  assert.deepEqual(entries[0], { type: 'hospital', key: '990001', label: 'Example General Hospital', sub: 'Exampleton, OH', extra: 'Exampleton OH', href: '/hospital/990001/' });
  assert.equal(entries[1].href, '/hospital/99000a/', 'folders are lowercase');
  assert.equal(entries[3].sub, 'San Juan, PR');
});

test('the states are the fifty and DC, each by name and by code, with the hospitals in it; Puerto Rico is a place hospitals are in, not a state', () => {
  const states = hubEntries(SAMPLE).filter((e) => e.type === 'state');
  assert.deepEqual(states.map((e) => e.key), US_STATES.map(([code]) => code));
  assert.equal(states.length, 51);
  assert.ok(!states.some((e) => e.key === 'PR'));
  const ohio = states.find((e) => e.key === 'OH');
  assert.deepEqual(ohio, { type: 'state', key: 'OH', label: 'Ohio', sub: 'State · one hospital', extra: '', href: '/#state=OH' });
  assert.equal(states.find((e) => e.key === 'NY').sub, 'State · 2 hospitals');
  assert.equal(states.find((e) => e.key === 'AK').sub, 'State · 0 hospitals', 'a state with none is still a place to look at');
  assert.ok(states.every((e) => e.href === `/#state=${e.key}`));
});

test('typing a state\'s name or code lists the state first; a city and a state find a hospital', () => {
  const index = buildIndex(hubEntries(SAMPLE));
  const keys = (q) => search(q, index).results.map((r) => r.key);
  assert.equal(keys('ohio')[0], 'OH');
  assert.equal(keys('oh')[0], 'OH', 'a code is a key: it outranks a hospital whose name starts with it');
  assert.equal(keys('new york')[0], 'NY');
  assert.deepEqual(keys('exampleton oh'), ['990001']);
  assert.deepEqual(keys('sample ny'), ['99000A']);
  assert.deepEqual(keys('99000a'), ['99000A']);
  assert.equal(keys('san juan')[0], '990004');
});

const hub = loadHub();
const hospitals = hubHospitals(hub);
const EXAMPLE_STATE = hospitals.find((x) => x.ccn === EXAMPLE_CCN).state;

test('the real list: every hospital of the dollar file plus the fifty states and DC, and "troy oh" finds the example hospital', () => {
  const entries = hubEntries(hospitals);
  assert.equal(entries.length, hub.dollars.hospitals.length + 51);
  assert.equal(entries.filter((e) => e.type === 'hospital').length, hub.dollars.hospitals.length);
  assert.equal(new Set(entries.map((e) => `${e.type}:${e.key}`)).size, entries.length, 'no two entries share a key');
  const index = buildIndex(entries);
  // The example hospital's city and state find it. They need not rank it first: the search puts a name that holds a
  // query word ahead of one that only has it as a city, and another hospital in the same city may have that name.
  const { results, total } = search('troy oh', index);
  assert.ok(total >= 1 && total <= 10, 'the city and state name a few hospitals, all listed');
  const found = results.find((r) => r.key === EXAMPLE_CCN);
  assert.ok(found, 'the example hospital is in the list');
  assert.equal(found.href, `/hospital/${EXAMPLE_CCN.toLowerCase()}/`);
  assert.equal(search(EXAMPLE_CCN, index).results[0].key, EXAMPLE_CCN, 'its CCN finds it first');
});

test('the real list: a CCN finds its hospital first, and a state carries the count of the data\'s hospitals in it', () => {
  const entries = hubEntries(hospitals);
  const index = buildIndex(entries);
  for (const row of [hospitals[0], hospitals[hospitals.length - 1], hospitals.find((x) => x.status === 'maryland')]) {
    assert.equal(search(row.ccn, index).results[0].key, row.ccn);
  }
  const state = entries.find((e) => e.type === 'state' && e.key === EXAMPLE_STATE);
  assert.equal(state.sub, `State · ${hospitals.filter((x) => x.state === EXAMPLE_STATE).length.toLocaleString('en-US')} hospitals`);
});

// ---------- the combobox on the hub's forms ----------

// The family search mounted on a stand-in search form (web/test/dom.js) over the hub's asset, which holds SAMPLE unless
// load says otherwise.
function stage(t, { load } = {}) {
  const s = comboForm(t);
  s.form.dataset.src = '/assets/hub-hospitals.test.json';
  const opened = [];
  const loads = [];
  mountHubSearch([s.form], {
    loadAsset: async (src) => { loads.push(src); if (load) return load(); return { hospitals: SAMPLE }; },
    open: (href) => opened.push(href),
  });
  return { ...s, opened, loads };
}

test('mountHubSearch: the form shows; the asset loads once, from the form\'s own address, on first focus; typing lists hospitals and states in the family\'s words', async (t) => {
  const s = stage(t);
  assert.equal(s.form.hidden, false);
  assert.deepEqual(s.loads, []);
  await s.type('ohio');
  assert.deepEqual(s.loads, ['/assets/hub-hospitals.test.json']);
  assert.deepEqual(s.texts(), ['Ohio|State · one hospital|State', 'Ohio Valley Example|Troy, NY|Hospital']);
  assert.equal(s.status.textContent, '2 matches');
  await s.type('exampleton');
  assert.equal(s.status.textContent, 'One match');
  await s.type('zzzz');
  assert.equal(s.status.textContent, hubWords.empty);
  assert.deepEqual(s.loads.length, 1);
});

test('mountHubSearch: Enter opens the first match — a hospital\'s page, or a state on the front page', async (t) => {
  const s = stage(t);
  await s.type('exampleton');
  await s.input.listeners.keydown({ key: 'Enter', preventDefault() {} });
  await s.type('ohio');
  await s.input.listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(s.opened, ['/hospital/990001/', '/#state=OH']);
});

test('mountHubSearch: a form with data-only lists that kind alone; a pick a page\'s script cancels (hub:pick) opens nothing', async (t) => {
  const s = comboForm(t);
  s.form.dataset.src = '/assets/hub-hospitals.test.json';
  s.form.dataset.only = 'hospital';
  const opened = [];
  mountHubSearch([s.form], { loadAsset: async () => ({ hospitals: SAMPLE }), open: (href) => opened.push(href) });
  await s.type('ohio');
  assert.deepEqual(s.texts(), ['Ohio Valley Example|Troy, NY|Hospital'], 'no state');
  const picked = [];
  s.form.addEventListener('hub:pick', (e) => {
    picked.push(e.detail.href);
    if (e.detail.href === '/hospital/990003/') e.preventDefault();
  });
  await s.input.listeners.keydown({ key: 'Enter', preventDefault() {} });
  await s.type('exampleton');
  await s.input.listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(picked, ['/hospital/990003/', '/hospital/990001/']);
  assert.deepEqual(opened, ['/hospital/990001/'], 'the canceled pick stays on the page');
});

test('mountHubSearch: a failed load says so in the box\'s status', async (t) => {
  const s = stage(t, { load: async () => { throw new Error('down'); } });
  await s.type('ohio');
  assert.equal(s.status.textContent, hubWords.failed);
  assert.equal(s.list.hidden, true);
});

test('mountHubSearch: a page with no hub search form mounts nothing', () => {
  mountHubSearch([], { loadAsset: () => { throw new Error('loaded'); } });
});

// ---------- the form's markup ----------

test('hubSearchForm: the shell\'s search form over the hub asset, marked data-hub, in the family\'s words; hidden until its script shows it', () => {
  const bar = String(hubSearchForm('/assets/hub-hospitals.abcd1234.json'));
  assert.match(bar, /^<form class="omni" id="omni" role="search" aria-label="[^"]+" data-src="\/assets\/hub-hospitals\.abcd1234\.json" data-hub hidden>/);
  assert.ok(bar.includes('<input id="omni-q" type="search" role="combobox"'));
  assert.ok(bar.includes('aria-controls="omni-list"'));
  assert.doesNotMatch(bar, /\sstyle=/);
});

test('the script builds markup from no data: textContent and attributes only (the combobox owns the list)', () => {
  const src = readFileSync(REPO_ROOT + 'hub/client/search.js', 'utf8').replace(/\/\/.*$/gm, '');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'localStorage', 'sessionStorage']) assert.ok(!src.includes(word), word);
});
