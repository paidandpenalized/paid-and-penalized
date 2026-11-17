// The family search (hub/client/search.js, entry hub-search): the hospitals and the states as search entries, found by
// word starts in the shared index (web/client/search.js), the combobox mounted on every hub search form, and the form's
// markup (hub/search/form.js) that Task 6 puts in the bar. Synthetic hospitals, plus the real list (the search's own
// index over every hospital on Medicare's list) for the counts, for the example hospital, which is picked by EXAMPLE_CCN
// and not by name, and for a critical access hospital, picked by its kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { buildIndex, search } from '../../web/client/search.js';
import { US_STATES } from '../../engine/js/states.js';
import { cmsNamed } from '../../pipeline/master.js';
import { SEARCH_KINDS, decodeSearchAsset, hubEntries, hubWords, mountHubSearch } from '../client/search.js';
import { hubModel } from '../data.js';
import { EXAMPLE_CCN, stateTotals } from '../model.js';
import { searchAsset } from '../search/asset.js';
import { hubSearchForm } from '../search/form.js';
import { comboForm } from '../../web/test/dom.js';

// A row of the search asset as loadSearchAsset decodes it (hub/search/asset.js writes it): the hospital's CCN, the name
// its page shows, its place and the master's kind. The state counts are the asset's (the map's, worked out at build).
const h = (ccn, name, city, state, kind = 'acute') => ({ ccn, name, city, state, kind });
const SAMPLE = [
  h('990001', 'Example General Hospital', 'Exampleton', 'OH'),
  h('99000A', 'Sample Medical Center', 'Sampleville', 'NY'),
  h('990003', 'Ohio Valley Example', 'Troy', 'NY'),
  h('990004', 'Island Clinic', 'San Juan', 'PR'),
];
const STATES = { OH: 1, NY: 2 };
const SEARCH = { rows: SAMPLE, states: STATES };

test('each hospital is an entry: its name, "City, ST · kind" under it, found by its city, state and CCN, opening its page', () => {
  const entries = hubEntries(SEARCH).filter((e) => e.type === 'hospital');
  assert.equal(entries.length, SAMPLE.length);
  assert.deepEqual(entries[0], { type: 'hospital', key: '990001', label: 'Example General Hospital', sub: 'Exampleton, OH · Acute care hospital', extra: 'Exampleton OH', href: '/hospital/990001/' });
  assert.equal(entries[1].href, '/hospital/99000a/', 'folders are lowercase');
  assert.equal(entries[3].sub, 'San Juan, PR · Acute care hospital');
});

test('every kind of hospital has its word in the sub line, but one of unknown kind, which has its place alone', () => {
  for (const kind of SEARCH_KINDS) {
    const [entry] = hubEntries({ rows: [h('990001', 'Invented Hospital', 'Exampleton', 'OH', kind)], states: {} }).filter((e) => e.type === 'hospital');
    if (kind === 'unknown') assert.equal(entry.sub, 'Exampleton, OH', kind);
    else assert.match(entry.sub, /^Exampleton, OH · \S/, kind);
  }
  const subs = SEARCH_KINDS.map((kind) => hubEntries({ rows: [h('990001', 'Invented Hospital', 'Exampleton', 'OH', kind)], states: {} }).at(-1).sub);
  assert.equal(new Set(subs).size, subs.length, 'no two kinds share a word');
});

test('the states are the fifty and DC, each by name and by code, with the hospitals the asset counts in it; Puerto Rico is a place hospitals are in, not a state', () => {
  const states = hubEntries(SEARCH).filter((e) => e.type === 'state');
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
  const index = buildIndex(hubEntries(SEARCH));
  const keys = (q) => search(q, index).results.map((r) => r.key);
  assert.equal(keys('ohio')[0], 'OH');
  assert.equal(keys('oh')[0], 'OH', 'a code is a key: it outranks a hospital whose name starts with it');
  assert.equal(keys('new york')[0], 'NY');
  assert.deepEqual(keys('exampleton oh'), ['990001']);
  assert.deepEqual(keys('sample ny'), ['99000A']);
  assert.deepEqual(keys('99000a'), ['99000A']);
  assert.equal(keys('san juan')[0], '990004');
});

const model = hubModel();
const { hub, hospitals, outside } = model;
const asset = searchAsset({ hospitals, outside, master: hub.master });
const realRows = decodeSearchAsset(asset);
const EXAMPLE_STATE = hospitals.find((x) => x.ccn === EXAMPLE_CCN).state;

test('the real list: every hospital on Medicare\'s list plus the fifty states and DC, and "troy oh" finds the example hospital', () => {
  const entries = hubEntries(realRows);
  assert.equal(entries.length, hub.master.size + 51);
  assert.equal(entries.filter((e) => e.type === 'hospital').length, hub.master.size);
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

test('hubEntries: a critical access hospital is found by name, city and CCN, and its sub line names its kind', () => {
  const cah = outside.find((x) => x.kind === 'critical_access' && x.city && cmsNamed(x.name, x.ccn));
  assert.ok(cah, 'an outside critical access hospital with a name and a city');
  const index = buildIndex(hubEntries(realRows));
  const hits = (q) => search(q, index, { limit: Infinity }).results.some((r) => r.key === cah.ccn);
  assert.ok(hits(cah.name), 'found by its name');
  assert.ok(hits(`${cah.city} ${cah.state}`), 'found by its city and state');
  assert.ok(search(cah.ccn, index).results[0].key === cah.ccn, 'its CCN finds it first');
  const entry = index.find((e) => e.key === cah.ccn);
  assert.ok(entry.sub === `${cah.city}, ${cah.state} · Critical access hospital`, 'the sub line names its place and its kind');
  assert.ok(entry.href === `/hospital/${cah.ccn.toLowerCase()}/`, 'it opens its page');
});

test('the real list: a CCN finds its hospital first, inside the programs and out, and a state carries the count of the data\'s hospitals in it', () => {
  const entries = hubEntries(realRows);
  const index = buildIndex(entries);
  const rows = { 'the dollar file\'s first': hospitals[0], 'its last': hospitals[hospitals.length - 1], 'a Maryland hospital': hospitals.find((x) => x.status === 'maryland'), 'the first outside': outside[0], 'the last outside': outside[outside.length - 1] };
  for (const [what, row] of Object.entries(rows)) assert.ok(search(row.ccn, index).results[0].key === row.ccn, `${what}: its CCN finds it first`);
  const state = entries.find((e) => e.type === 'state' && e.key === EXAMPLE_STATE);
  assert.equal(state.sub, `State · ${stateTotals(hospitals).get(EXAMPLE_STATE).n.toLocaleString('en-US')} hospitals`);
});

test('the real list: every state carries the count its line on the map says (stateTotals), though some have hospitals with no estimate', () => {
  const totals = stateTotals(hospitals);
  const states = hubEntries(realRows).filter((e) => e.type === 'state');
  const n = (code) => totals.get(code)?.n ?? 0;
  const words = (k) => (k === 1 ? 'State · one hospital' : `State · ${k.toLocaleString('en-US')} hospitals`);
  for (const e of states) assert.equal(e.sub, words(n(e.key)), 'the map\'s count');
  assert.ok(states.some((e) => hospitals.filter((x) => x.state === e.key).length !== n(e.key)), 'some state has a hospital the map does not count (if not, this test no longer covers one)');
});

// ---------- the combobox on the hub's forms ----------

// The family search mounted on a stand-in search form (web/test/dom.js) over the hub's asset, which holds SAMPLE unless
// load says otherwise.
function stage(t, { load } = {}) {
  const s = comboForm(t);
  s.form.dataset.src = '/assets/hub-search.test.json';
  const opened = [];
  const loads = [];
  mountHubSearch([s.form], {
    loadAsset: async (src) => { loads.push(src); if (load) return load(); return SEARCH; },
    open: (href) => opened.push(href),
  });
  return { ...s, opened, loads };
}

test('mountHubSearch: the form shows; the asset loads once, from the form\'s own address, on first focus; typing lists hospitals and states in the family\'s words', async (t) => {
  const s = stage(t);
  assert.equal(s.form.hidden, false);
  assert.deepEqual(s.loads, []);
  await s.type('ohio');
  assert.deepEqual(s.loads, ['/assets/hub-search.test.json']);
  assert.deepEqual(s.texts(), ['Ohio|State · one hospital|State', 'Ohio Valley Example|Troy, NY · Acute care hospital|Hospital']);
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
  s.form.dataset.src = '/assets/hub-search.test.json';
  s.form.dataset.only = 'hospital';
  const opened = [];
  mountHubSearch([s.form], { loadAsset: async () => SEARCH, open: (href) => opened.push(href) });
  await s.type('ohio');
  assert.deepEqual(s.texts(), ['Ohio Valley Example|Troy, NY · Acute care hospital|Hospital'], 'no state');
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

test('mountHubSearch: no fetch before focus', async (t) => {
  const s = comboForm(t);
  s.form.dataset.src = '/assets/hub-search.test.json';
  const loads = [];
  mountHubSearch([s.form], { loadAsset: async (src) => { loads.push(src); return SEARCH; }, open: () => {} });
  assert.deepEqual(loads, [], 'mounting fetches nothing');
  await s.input.listeners.focus();
  await Promise.resolve();
  assert.deepEqual(loads, ['/assets/hub-search.test.json'], 'the first focus fetches the form\'s own asset');
  await s.input.listeners.focus();
  await s.type('ohio');
  assert.equal(loads.length, 1, 'once');
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
  const bar = String(hubSearchForm('/assets/hub-search.abcd1234.json'));
  assert.match(bar, /^<form class="omni" id="omni" role="search" aria-label="[^"]+" data-src="\/assets\/hub-search\.abcd1234\.json" data-hub hidden>/);
  assert.ok(bar.includes('<input id="omni-q" type="search" role="combobox"'));
  assert.ok(bar.includes('aria-controls="omni-list"'));
  assert.doesNotMatch(bar, /\sstyle=/);
});

test('the script builds markup from no data: textContent and attributes only (the combobox owns the list)', () => {
  const src = readFileSync(REPO_ROOT + 'hub/client/search.js', 'utf8').replace(/\/\/.*$/gm, '');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'localStorage', 'sessionStorage']) assert.ok(!src.includes(word), word);
});

test('hubEntries: a hospital with no city is found by its state alone, never by the word "null"', () => {
  const entry = hubEntries({ rows: [h('990001', 'Invented Hospital', null, 'SC', 'unknown')], states: {} }).find((e) => e.type === 'hospital');
  assert.equal(entry.extra, 'SC');
  assert.equal(entry.sub, 'SC');
});

test('hubEntries: a state count is the asset\'s own key only, never one the object inherits', () => {
  const states = hubEntries({ rows: [], states: Object.create({ OH: 7 }) }).filter((e) => e.type === 'state');
  assert.equal(states.find((e) => e.key === 'OH').sub, 'State · 0 hospitals');
});
