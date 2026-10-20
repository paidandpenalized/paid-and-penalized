// The program page's search script (client/program.js) against a stand-in DOM: it fetches the hospitals asset on
// first focus, builds the datalist in one step, skips bad rows, and opens a hospital's page on a pick or on Enter.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };

// The stand-ins stay in place until the test ends (t.after), since the script fetches on a later focus.
async function run(t, asset, { ok = true } = {}) {
  const handlers = {};
  const input = { value: '', addEventListener: (type, fn) => { handlers[type] = fn; } };
  const list = { options: null, replaceChildren: (...options) => { list.options = options.map((o) => o.value); } };
  const box = { hidden: true, dataset: { src: '/assets/hacrp-hospitals.test.json' }, querySelector: (s) => (s === 'input' ? input : list) };
  const fetched = [];
  const opened = [];
  globalThis.document = { querySelector: (s) => (s === '.search[data-src]' ? box : null), createElement: () => ({}) };
  globalThis.window = { location: { assign: (p) => opened.push(p) } };
  globalThis.fetch = async (url) => { fetched.push(url); return { ok, status: ok ? 200 : 500, json: async () => asset }; };
  t.after(() => {
    for (const [k, v] of Object.entries(ORIGINAL)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  await import(`../client/program.js?run=${Math.random()}`);
  return { handlers, input, list, box, fetched, opened, focus: async () => { handlers.focus(); await new Promise((r) => setTimeout(r, 0)); } };
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
  s.input.value = 'sample';
  s.handlers.keydown({ key: 'Enter' });
  s.input.value = 'example';
  s.handlers.keydown({ key: 'Enter' });
  assert.deepEqual(s.opened, ['/hacrp/hospital/99000a/', '/hacrp/hospital/990003/']);
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
