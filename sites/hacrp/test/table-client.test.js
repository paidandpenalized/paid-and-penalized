// The program page's table script (client/program.js) against a stand-in DOM: a failed fetch of the hospitals asset
// says so and offers Try again, which fetches again; a fetch that then works mounts the table and clears the message.
// Both the observer's path and a linked #state= path go through the same load. On a phone the sort buttons leave the
// tab order.
import { test } from 'node:test';
import assert from 'node:assert/strict';

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

async function run(t, { hash = '', results, heads = [], media, maps = [] }) {
  const parts = { '#ht-state': el('select'), '#ht-name': el('input'), '#ht-count': el('count'), tbody: el('tbody'), '#ht-all': el('all') };
  const retry = el('retry');
  const nojs = el('nojs');
  const section = el('section');
  section.querySelector = (s) => (s === '.ht-retry' ? retry : s === '.ht-nojs' ? nojs : null);
  const table = el('table');
  table.hidden = true;
  table.dataset.src = '/assets/hacrp-hospitals.test.json';
  table.closest = () => section;
  table.querySelector = (s) => parts[s] ?? null;
  table.querySelectorAll = () => heads;
  const fetched = [];
  const errors = [];
  globalThis.document = { activeElement: null, querySelector: (s) => (s === '.ht[data-src]' ? table : null), querySelectorAll: (s) => (s === 'svg.chart--us-map' ? maps : []), createElement: el };
  globalThis.window = { location: { hash, pathname: '/hacrp/', search: '' }, history: { replaceState() {} }, addEventListener() {}, ...(media && { matchMedia: media }) };
  globalThis.fetch = async (url) => {
    fetched.push(url);
    const ok = results.shift();
    return { ok, status: ok ? 200 : 503, json: async () => ASSET };
  };
  console.error = (e) => errors.push(e);
  t.after(() => {
    console.error = ORIGINAL.error;
    for (const k of ['document', 'window', 'fetch']) {
      if (ORIGINAL[k] === undefined) delete globalThis[k];
      else globalThis[k] = ORIGINAL[k];
    }
  });
  await import(`../client/program.js?run=${Math.random()}`);
  const settle = () => new Promise((r) => setTimeout(r, 0));
  await settle();
  return { table, retry, nojs, parts, fetched, errors, settle, section };
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

test('a state picked on the US map, by a click or by Enter on the active mark, goes in the URL and brings the table into view', async (t) => {
  const mark = (code) => ({ dataset: { state: code } });
  const active = mark('MD');
  const svg = el('svg');
  svg.querySelector = (s) => (s === '.chart-mark.is-active[data-state]' ? active : null);
  const s = await run(t, { results: [true, true], maps: [svg] });
  let scrolled = 0;
  s.section.scrollIntoView = () => { scrolled++; };
  svg.handlers.click({ target: { closest: () => mark('AL') } });
  assert.equal(globalThis.window.location.hash, '#state=AL');
  svg.handlers.keydown({ key: 'Enter' });
  assert.equal(globalThis.window.location.hash, '#state=MD');
  svg.handlers.keydown({ key: 'ArrowRight' });
  svg.handlers.click({ target: { closest: () => null } });
  assert.equal(globalThis.window.location.hash, '#state=MD', 'a key other than Enter, or a click off the states, picks nothing');
  assert.equal(scrolled, 2);
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
