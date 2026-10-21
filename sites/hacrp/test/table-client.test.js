// The program page's table script (client/program.js) against a stand-in DOM: a failed fetch of the hospitals asset
// says so and offers Try again, which fetches again; a fetch that then works mounts the table and clears the message.
// Both the observer's path and a linked #state= path go through the same load.
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

async function run(t, { hash = '', results }) {
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
  const fetched = [];
  const errors = [];
  globalThis.document = { activeElement: null, querySelector: (s) => (s === '.ht[data-src]' ? table : null), createElement: el };
  globalThis.window = { location: { hash, pathname: '/hacrp/', search: '' }, history: { replaceState() {} }, addEventListener() {} };
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
  return { table, retry, nojs, parts, fetched, errors, settle };
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
    assert.equal(message, "The table didn't load.");
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
