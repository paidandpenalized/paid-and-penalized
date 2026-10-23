// The hospital table's script (client/table.js, started by the program page's script, client/program.js, and by the place
// pages', client/place.js) against a stand-in DOM: a failed fetch of the hospitals asset says so and offers Try again,
// which fetches again; a fetch that then works mounts the table and clears the message. Both the observer's path and
// a linked #state= path go through the same load. On a phone the sort buttons leave the tab order. On a place page the
// table lists the place's hospitals only (data-area). A state picked on the program page's US map opens its page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count } from '../../../web/render/format.js';
import { TABLE_FIRST_ROWS } from '../web/constants.js';
import { fill } from '../web/copy.js';

const ORIGINAL = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, error: console.error };

// An element that takes any call the script makes and keeps what it is given.
function el(name) {
  const node = {
    name, hidden: false, dataset: {}, children: [], handlers: {}, textContent: '', value: '',
    append: (...xs) => { node.children.push(...xs); },
    replaceChildren: (...xs) => { node.children = xs; },
    addEventListener: (type, fn) => { node.handlers[type] = fn; },
    setAttribute() {}, removeAttribute() {}, scrollIntoView() {}, focus() { globalThis.document.activeElement = node; },
    querySelectorAll: () => [],
  };
  return node;
}

// entry: the page script that starts the table. area: a place page's data-area (its CCNs); a place page has no state menu.
async function run(t, { hash = '', results, heads = [], media, maps = [], figs = [], entry = 'program', area = null, asset = ASSET }) {
  const parts = { '#ht-name': el('input'), '#ht-count': el('count'), tbody: el('tbody'), '#ht-all': el('all') };
  if (!area) parts['#ht-state'] = el('select');
  const retry = el('retry');
  const nojs = el('nojs');
  const section = el('section');
  section.querySelector = (s) => (s === '.ht-retry' ? retry : s === '.ht-nojs' ? nojs : null);
  const table = el('table');
  table.hidden = true;
  table.dataset.src = '/assets/hacrp-hospitals.test.json';
  if (area) table.dataset.area = area;
  table.closest = () => section;
  table.querySelector = (s) => parts[s] ?? null;
  table.querySelectorAll = () => heads;
  const fetched = [];
  const errors = [];
  globalThis.document = {
    activeElement: null, querySelector: (s) => (s === '.ht[data-src]' ? table : null), createElement: el,
    // The map's figure is found from its .usmap part (client/program.js figuresWith).
    querySelectorAll: (s) => (s === 'svg.chart--us-map' ? maps : s === '.usmap' ? figs.map((fig) => ({ closest: (c) => (c === '.fig' ? fig : null) })) : []),
  };
  const opened = [];
  globalThis.window = { location: { hash, pathname: '/hacrp/', search: '', assign: (url) => opened.push(url) }, history: { replaceState() {} }, addEventListener() {}, ...(media && { matchMedia: media }) };
  globalThis.fetch = async (url) => {
    fetched.push(url);
    const ok = results.shift();
    return { ok, status: ok ? 200 : 503, json: async () => asset };
  };
  console.error = (e) => errors.push(e);
  t.after(() => {
    console.error = ORIGINAL.error;
    for (const k of ['document', 'window', 'fetch']) {
      if (ORIGINAL[k] === undefined) delete globalThis[k];
      else globalThis[k] = ORIGINAL[k];
    }
  });
  await import(`../client/${entry}.js?run=${Math.random()}`);
  const settle = () => new Promise((r) => setTimeout(r, 0));
  await settle();
  return { table, retry, nojs, parts, fetched, errors, settle, section, opened };
}

const ASSET = {
  hospitalPath: '/hacrp/hospital/',
  rows: [
    ['990051', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes'],
    ['990052', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A'],
  ],
};

for (const hash of ['', '#state=AL']) {
  test(`a failed table fetch offers Try again, which fetches again and mounts the table (hash "${hash}")`, async (t) => {
    // No IntersectionObserver in the stand-in window, so the script loads at once on either path.
    const s = await run(t, { hash, results: [false, false, true] });
    assert.equal(s.fetched.length, 1);
    assert.equal(s.errors.length, 1);
    assert.equal(s.table.hidden, true);
    const [message, , button] = s.retry.children;
    assert.equal(message, 'The table didn\u2019t load.');
    assert.equal(button.textContent, 'Try again');
    assert.equal(button.type, 'button');

    button.focus();
    button.handlers.click();
    await s.settle();
    assert.equal(s.fetched.length, 2);
    assert.equal(s.errors.length, 2);
    assert.equal(s.retry.children[2], button, 'still offered after a second failure');

    button.handlers.click();
    await s.settle();
    assert.equal(s.fetched.length, 3);
    assert.deepEqual(s.retry.children, []);
    assert.equal(s.table.hidden, false);
    assert.equal(s.nojs.hidden, true);
    assert.equal(s.parts.tbody.children.length, hash ? 1 : 2);
    assert.equal(globalThis.document.activeElement, s.parts['#ht-state'], 'focus moves from the gone button to the first control');
  });
}

test('a table that loads first time shows no retry message', async (t) => {
  const s = await run(t, { results: [true] });
  assert.equal(s.fetched.length, 1);
  assert.deepEqual(s.retry.children, []);
  assert.equal(s.table.hidden, false);
  assert.notEqual(globalThis.document.activeElement, s.parts['#ht-state']);
});

test('on a phone the sort buttons leave the tab order (the Sort by menu stands in); on a wide screen they are back', async (t) => {
  const heads = ['name', 'city', 'state', 'score', 'decision'].map((key) => {
    const button = { attrs: new Map(), addEventListener() {} };
    button.setAttribute = (k, v) => button.attrs.set(k, v);
    button.removeAttribute = (k) => button.attrs.delete(k);
    return { dataset: { key }, textContent: key, setAttribute() {}, removeAttribute() {}, querySelector: () => button };
  });
  const tabs = () => heads.map((th) => th.querySelector('button').attrs.get('tabindex') ?? null);
  const queries = [];
  const phone = { matches: true, listeners: [], addEventListener: (type, fn) => phone.listeners.push([type, fn]) };
  const s = await run(t, { results: [true], heads, media: (query) => { queries.push(query); return phone; } });
  assert.equal(s.table.hidden, false);
  assert.deepEqual(queries, ['(max-width: 640px)']);
  assert.deepEqual(tabs(), ['-1', '-1', '-1', '-1', '-1']);
  const [[type, change]] = phone.listeners;
  assert.equal(type, 'change');
  phone.matches = false;
  change();
  assert.deepEqual(tabs(), [null, null, null, null, null]);
  phone.matches = true;
  change();
  assert.deepEqual(tabs(), ['-1', '-1', '-1', '-1', '-1']);
});

test('a state picked on the US map, by a click or by Enter on the active mark, opens that state\'s page', async (t) => {
  const mark = (code) => ({ dataset: { state: code } });
  const active = mark('MD');
  const svg = el('svg');
  svg.querySelector = (s) => (s === '.chart-mark.is-active[data-state]' ? active : null);
  const fig = el('fig');
  fig.querySelector = () => null;
  fig.querySelectorAll = (s) => (s === 'svg.chart--us-map' ? [svg] : []);
  const s = await run(t, { results: [true], figs: [fig] });
  svg.handlers.click({ target: { closest: () => mark('AL') } });
  assert.deepEqual(s.opened, ['/hacrp/state/al/']);
  svg.handlers.keydown({ key: 'Enter' });
  assert.deepEqual(s.opened, ['/hacrp/state/al/', '/hacrp/state/md/']);
  svg.handlers.keydown({ key: 'ArrowRight' });
  svg.handlers.click({ target: { closest: () => null } });
  assert.equal(s.opened.length, 2, 'a key other than Enter, or a click off the states, opens nothing');
  assert.equal(globalThis.window.location.hash, '', 'the table\'s state filter is the menu\'s and the URL\'s #state=, not the map\'s');
});

test("arriving with #state=XX (a hospital page's Location link) filters the table, marks the state on each US map and brings the table into view", async (t) => {
  const marks = ['AL', 'MD'].map((code) => {
    const classes = new Set();
    return { dataset: { state: code }, classes, classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  });
  const svg = el('svg');
  svg.querySelector = () => null;
  svg.querySelectorAll = (s) => (s === '.chart-mark[data-state]' ? marks : []);
  const s = await run(t, { hash: '#state=al', results: [true], maps: [svg] });
  assert.equal(s.parts.tbody.children.length, 1);
  assert.equal(s.parts['#ht-state'].value, 'AL');
  assert.deepEqual(marks.map((m) => m.classes.has('is-picked')), [true, false]);
  // The menu moves the mark too.
  s.parts['#ht-state'].value = 'MD';
  s.parts['#ht-state'].handlers.change();
  assert.deepEqual(marks.map((m) => m.classes.has('is-picked')), [false, true]);
  s.parts['#ht-state'].value = '';
  s.parts['#ht-state'].handlers.change();
  assert.deepEqual(marks.map((m) => m.classes.has('is-picked')), [false, false]);
});

// ---------- a place page's table ----------

const rowCcns = (tbody) => tbody.children.map((tr) => /\/([0-9a-z]{6})\/$/.exec(tr.children[0].children[0].href)[1]);

test("a place page's table lists the place's hospitals only (data-area), whatever else the asset holds; no state menu, so #state= does nothing", async (t) => {
  // 990051 is in the area; 990052 is not; 999999 is in the area but not in the asset.
  for (const hash of ['', '#state=MD']) {
    const s = await run(t, { entry: 'place', hash, area: '990051 999999', results: [true] });
    assert.equal(s.fetched.length, 1);
    assert.equal(s.table.hidden, false);
    assert.deepEqual(rowCcns(s.parts.tbody), ['990051'], `hash "${hash}"`);
    assert.equal(s.parts['#ht-count'].textContent, 'One hospital shown.');
    assert.equal(s.nojs.hidden, true);
  }
  // An area naming every hospital in the asset lists them all, in the asset's order.
  const all = await run(t, { entry: 'place', area: '990052 990051', results: [true] });
  assert.deepEqual(rowCcns(all.parts.tbody), ['990051', '990052']);
  // An area holding none of them lists none, and says so.
  const none = await run(t, { entry: 'place', area: '990099', results: [true] });
  assert.deepEqual(rowCcns(none.parts.tbody), []);
  assert.equal(none.parts['#ht-count'].textContent, 'No hospital matches.');
  // The program page's table, with no area, lists every hospital.
  const program = await run(t, { results: [true] });
  assert.deepEqual(rowCcns(program.parts.tbody), ['990051', '990052']);
});

test('a place page with more hospitals than the first screenful shows the first rows and a button for the rest', async (t) => {
  const rows = Array.from({ length: TABLE_FIRST_ROWS + 10 }, (_, i) => [`9902${String(i).padStart(2, '0')}`, `Example ${String(i).padStart(2, '0')}`, 'Exampleton', 'AL', '0.1000', 'No']);
  const area = rows.map((r) => r[0]).join(' ');
  const s = await run(t, { entry: 'place', area, asset: { hospitalPath: '/hacrp/hospital/', rows: [...rows, ...ASSET.rows] }, results: [true] });
  assert.equal(s.parts.tbody.children.length, TABLE_FIRST_ROWS);
  assert.equal(s.parts['#ht-all'].hidden, false);
  assert.equal(s.parts['#ht-all'].textContent, fill('tableShowAll', { n: count(TABLE_FIRST_ROWS + 10) }));
  assert.equal(s.parts['#ht-count'].textContent, fill('tableCountFirst', { shown: count(TABLE_FIRST_ROWS), n: count(TABLE_FIRST_ROWS + 10) }));
  s.parts['#ht-all'].handlers.click();
  assert.deepEqual(rowCcns(s.parts.tbody), rows.map((r) => r[0]), 'all of them, none of the asset\'s others');
  assert.equal(s.parts['#ht-all'].hidden, true);
});

test('the estimated cut: this site\'s dollars, in the penalty ink for a cut, words where there is no estimate', async (t) => {
  const asset = {
    hospitalPath: '/hacrp/hospital/',
    rows: [
      ['990071', 'Example General Hospital', 'Exampleton', 'AL', '0.5000', 'Yes', '', 614_565],
      ['990072', 'Sample Medical Center', 'Sampleville', 'AL', '0.1000', 'No', '', 0],
      ['990073', 'Test Community Hospital', 'Testburg', 'AL', '0.6000', 'Yes', '', null],
    ],
  };
  const s = await run(t, { results: [true], asset });
  const money = s.parts.tbody.children.map((tr) => tr.children.at(-1));
  assert.deepEqual(money.map((td) => td.children[0] ?? td.textContent), ['$615K', '$0', 'no estimate']);
  assert.deepEqual(money.map((td) => td.className), ['ht-money num ht-money--cut', 'ht-money num', 'ht-money num']);
});
