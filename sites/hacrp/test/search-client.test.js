// The program page's search script (client/program.js) against a stand-in DOM: it fetches the hospitals asset on
// first focus, builds the datalist in one step, skips bad rows, and opens a hospital's page on a pick or on submit;
// a submit with several matches hands the query to the table's filter, and one with none says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };

// The stand-ins stay in place until the test ends (t.after), since the script fetches on a later focus.
async function run(t, asset, { ok = true } = {}) {
  const handlers = {};
  const input = { value: '', addEventListener: (type, fn) => { handlers[type] = fn; } };
  const list = { options: null, replaceChildren: (...options) => { list.options = options.map((o) => o.value); } };
  const status = { textContent: '' };
  const parts = { input, datalist: list, '[role="status"]': status };
  const box = {
    hidden: true, dataset: { src: '/assets/hacrp-hospitals.test.json' }, querySelector: (s) => parts[s],
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  const filter = { value: '', events: [], dispatchEvent: (e) => filter.events.push(e.type) };
  const section = { scrolled: false, scrollIntoView() { section.scrolled = true; } };
  const fetched = [];
  const opened = [];
  const others = { '#ht-name': filter, '#hospitals': section };
  globalThis.document = { querySelector: (s) => (s === '.search[data-src]' ? box : others[s] ?? null), createElement: () => ({}) };
  globalThis.window = { location: { assign: (p) => opened.push(p) } };
  globalThis.fetch = async (url) => { fetched.push(url); return { ok, status: ok ? 200 : 500, json: async () => asset }; };
  t.after(() => {
    for (const [k, v] of Object.entries(ORIGINAL)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  await import(`../client/program.js?run=${Math.random()}`);
  const submit = async (value) => {
    input.value = value;
    let prevented = false;
    await handlers.submit({ preventDefault: () => { prevented = true; } });
    assert.ok(prevented, 'the form never submits to the server');
  };
  return {
    handlers, input, list, box, status, filter, section, fetched, opened, submit,
    focus: async () => { handlers.focus(); await new Promise((r) => setTimeout(r, 0)); },
  };
}

const ASSET = {
  hospitalPath: '/hacrp/hospital/',
  rows: [
    ['99000A', 'Example General Hospital', 'Exampleton', 'AL', '0.3000', 'Yes'],
    ['990002', 'Example General Hospital', 'Exampleton', 'AL', 'N/A', 'No'],
    ['990003', 'Sample Medical Center', 'Sampleville', 'MD', '0.4000', 'N/A'],
    ['bad', 'Not a hospital', 'Nowhere', 'ZZ', '', ''],
  ],
};

test('fetches on first focus only, labels shared names with the CCN, skips a bad CCN', async (t) => {
  const s = await run(t, ASSET);
  assert.equal(s.box.hidden, false);
  assert.deepEqual(s.fetched, []);
  await s.focus();
  await s.focus();
  assert.deepEqual(s.fetched, ['/assets/hacrp-hospitals.test.json']);
  assert.deepEqual(s.list.options, [
    'Example General Hospital, Exampleton, AL (CCN 99000A)',
    'Example General Hospital, Exampleton, AL (CCN 990002)',
    'Sample Medical Center, Sampleville, MD',
  ]);
  s.input.value = 'Example General Hospital, Exampleton, AL (CCN 99000A)';
  s.handlers.input();
  await s.submit('sample');
  assert.deepEqual(s.opened, ['/hacrp/hospital/99000a/', '/hacrp/hospital/990003/']);
});

test('a submit matches the name, city or CCN: one opens its page, several go to the table, none says so', async (t) => {
  const s = await run(t, ASSET);
  await s.submit('990002');
  await s.submit('sampleville');
  assert.deepEqual(s.opened, ['/hacrp/hospital/990002/', '/hacrp/hospital/990003/'], 'a CCN or a city with one hospital opens it');
  await s.submit('  Exampleton ');
  assert.equal(s.opened.length, 2, 'several matches open nothing');
  assert.equal(s.filter.value, 'Exampleton');
  assert.deepEqual(s.filter.events, ['input']);
  assert.ok(s.section.scrolled, 'the table comes into view');
  assert.equal(s.status.textContent, '');
  await s.submit('no such place');
  assert.equal(s.status.textContent, 'No hospital matches.');
  s.input.value = 'n';
  s.handlers.input();
  assert.equal(s.status.textContent, '', 'typing clears the message');
  await s.submit('   ');
  assert.equal(s.opened.length, 2);
});

test('a failed fetch or a bad hospitalPath leaves the list empty, and a later focus tries again', async (t) => {
  const failed = await run(t, ASSET, { ok: false });
  await failed.focus();
  await failed.focus();
  assert.equal(failed.fetched.length, 2);
  assert.equal(failed.list.options, null);

  const bad = await run(t, { ...ASSET, hospitalPath: 'javascript:alert(1)//' });
  await bad.focus();
  assert.equal(bad.list.options, null);
});

test('the asset is in the table\'s order (state, then name); the search lists its labels by name', async (t) => {
  const s = await run(t, {
    hospitalPath: '/hacrp/hospital/',
    rows: [
      ['990041', 'Zeta Hospital', 'Exampleton', 'AL', '0.1000', 'No'],
      ['990042', 'Beta Hospital', 'Exampleton', 'CA', '0.2000', 'No'],
      ['990043', 'Alpha Hospital', 'Sampleville', 'MD', '0.3000', 'N/A'],
    ],
  });
  await s.focus();
  assert.deepEqual(s.list.options, ['Alpha Hospital, Sampleville, MD', 'Beta Hospital, Exampleton, CA', 'Zeta Hospital, Exampleton, AL']);
});
