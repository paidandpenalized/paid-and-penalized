// The search (web/client/search.js) and the combobox (web/client/omnibox.js) on synthetic entries and a stand-in DOM:
// matching by word starts, synonyms and the key; ranking; the listbox's ARIA as the keys move through it; Enter,
// a press and Escape; a failed load said once and tried again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMIT, buildIndex, normalize, search } from '../client/search.js';
import { mountOmnibox } from '../client/omnibox.js';
import { comboForm } from './dom.js';

const INDEX = buildIndex([
  { type: 'hospital', key: '990001', label: 'Saint Example Hospital', sub: 'Exampleton, AL 35000', extra: 'Exampleton AL 35000', href: '/h/990001/' },
  { type: 'hospital', key: '990002', label: 'Example General', sub: 'Sampleville, MD 21000', extra: 'Sampleville MD 21000', href: '/h/990002/' },
  { type: 'hospital', key: '99000A', label: 'Mount Sample Medical Center', sub: 'Fort Sample, TX', extra: 'Fort Sample TX', href: '/h/99000a/' },
  { type: 'state', key: 'MD', label: 'Maryland', sub: 'State', href: '/s/md/' },
]);
const keys = (q, opts) => search(q, INDEX, opts).results.map((r) => r.key);

test('normalize: lowercase, no accents or apostrophes, single spaces', () => {
  assert.equal(normalize("  St. Mary's  Médical–Center "), 'st marys medical center');
  assert.equal(normalize(null), '');
});

test('every query word must start some word of the label, the extra text or the key', () => {
  assert.deepEqual(keys('exam'), ['990002', '990001']);
  assert.deepEqual(keys('sampleville'), ['990002']);
  assert.deepEqual(keys('21000'), ['990002']);
  assert.deepEqual(keys('99000a'), ['99000A']);
  assert.deepEqual(keys('xample'), [], 'a word must start, not merely contain, the query');
  assert.deepEqual(keys('example tx'), []);
  assert.deepEqual(keys('   '), []);
});

test('saint/st, mount/mt and fort/ft match each other; an exact key or label ranks first; a state outranks at equal match', () => {
  assert.deepEqual(keys('st example'), ['990001']);
  assert.deepEqual(keys('mt sample'), ['99000A']);
  assert.deepEqual(keys('ft sample'), ['99000A']);
  assert.deepEqual(keys('990001')[0], '990001');
  assert.deepEqual(keys('example general')[0], '990002');
  assert.deepEqual(keys('md'), ['MD', '990002']);
  assert.deepEqual(keys('md', { types: ['hospital'] }), ['990002']);
});

test('at equal match a state ranks over a region, a region over a division, a division over a metro area, and any place over a hospital', () => {
  const index = buildIndex([
    { type: 'hospital', key: '990009', label: 'Pacific Example Hospital', href: '/h/990009/' },
    { type: 'metro', key: 'metro-99001', label: 'Pacific Example, XX', href: '/m/99001/' },
    { type: 'division', key: 'division-pacific', label: 'Pacific Example', href: '/d/pacific/' },
    { type: 'region', key: 'region-pacific', label: 'Pacific Example', href: '/r/pacific/' },
    { type: 'state', key: 'PE', label: 'Pacific Example', href: '/s/pe/' },
  ]);
  const { results } = search('pacific example', index);
  // The three with the label as the query rank first by kind; the metro area and the hospital follow (longer labels).
  assert.deepEqual(results.map((r) => r.type), ['state', 'region', 'division', 'metro', 'hospital']);
});

test('results stop at the limit; total counts every match', () => {
  const many = buildIndex(Array.from({ length: 25 }, (_, i) => ({ type: 'hospital', key: `9900${String(i).padStart(2, '0')}`, label: `Example ${i}`, href: '/' })));
  const { results, total } = search('example', many);
  assert.equal(results.length, LIMIT);
  assert.equal(total, 25);
});

// The combobox mounted on a stand-in search form (dom.js), over INDEX by default.
function setup(t, { load = async () => INDEX, onMore = null, more = null, moreTypes = null } = {}) {
  const s = comboForm(t);
  const opened = [];
  const loads = { n: 0 };
  mountOmnibox(s.form, {
    load: () => { loads.n++; return load(); },
    words: { empty: 'No matches.', kind: { hospital: 'Hospital', state: 'State' }, count: (n) => `${n} matches`, failed: 'Did not load.', more },
    open: (href) => opened.push(href),
    onMore,
    moreTypes,
  });
  const key = (k) => { let prevented = false; s.input.listeners.keydown({ key: k, preventDefault: () => { prevented = true; } }); return prevented; };
  return { ...s, opened, loads, key };
}

test('the combobox: shown by script; typing lists the matches as options, the first active, the count said politely', async (t) => {
  const s = setup(t);
  assert.equal(s.form.hidden, false);
  await s.type('exam');
  assert.equal(s.list.hidden, false);
  assert.equal(s.input.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(s.texts(), ['Example General|Sampleville, MD 21000|Hospital', 'Saint Example Hospital|Exampleton, AL 35000|Hospital']);
  assert.deepEqual(s.list.children.map((li) => [li.id, li.getAttribute('role'), li.getAttribute('aria-selected')]), [['omni-list-0', 'option', 'true'], ['omni-list-1', 'option', 'false']]);
  assert.equal(s.input.getAttribute('aria-activedescendant'), 'omni-list-0');
  assert.equal(s.status.textContent, '2 matches');
});

test('the combobox: arrows move the active option round the list, Enter opens it, Escape closes the list', async (t) => {
  const s = setup(t);
  await s.type('exam');
  assert.ok(s.key('ArrowDown'));
  assert.equal(s.input.getAttribute('aria-activedescendant'), 'omni-list-1');
  s.key('ArrowDown');
  assert.equal(s.input.getAttribute('aria-activedescendant'), 'omni-list-0', 'wraps to the top');
  s.key('ArrowUp');
  assert.equal(s.input.getAttribute('aria-activedescendant'), 'omni-list-1');
  assert.ok(s.key('Escape'));
  assert.equal(s.list.hidden, true);
  assert.equal(s.input.getAttribute('aria-expanded'), 'false');
  assert.equal(s.input.getAttribute('aria-activedescendant'), null);
  s.key('Enter');
  assert.deepEqual(s.opened, [], 'Enter with the list closed opens nothing');
  s.key('ArrowDown');
  s.key('Enter');
  assert.deepEqual(s.opened, ['/h/990002/']);
});

test('the combobox: a press on an option opens it; no match says so in the list; clearing the box closes it', async (t) => {
  const s = setup(t);
  await s.type('sample');
  let prevented = false;
  s.list.listeners.mousedown({ button: 0, target: s.list.children[0].children[0] && { closest: () => s.list.children[0] }, preventDefault: () => { prevented = true; } });
  assert.ok(prevented, 'the input keeps focus until the pick');
  assert.equal(s.opened.length, 1);
  await s.type('nothing like it');
  assert.deepEqual(s.texts(), ['No matches.']);
  assert.equal(s.input.getAttribute('aria-activedescendant'), null);
  await s.type('');
  assert.equal(s.list.hidden, true);
  assert.equal(s.status.textContent, '');
});

// Leaving the box closes the list at once: a press on the list never leaves the box (the next test), so nothing waits on
// a delay, and a reader who comes straight back and types gets the list for what they typed (no late close to hide it).
test('the combobox: leaving closes the list at once; back in the box, typing lists again', async (t) => {
  const s = setup(t);
  await s.type('exam');
  s.input.listeners.blur();
  assert.equal(s.list.hidden, true, 'closed the moment the box loses the focus');
  assert.equal(s.input.getAttribute('aria-expanded'), 'false');
  await s.type('sample');
  assert.equal(s.list.hidden, false, 'back in the box and typing: the list shows');
  s.key('Enter');
  assert.deepEqual(s.opened, ['/h/99000a/']);
});

// A press anywhere on the list keeps the focus in the box: on its scrollbar (the list itself is the target) or on its
// "No matches" row as on an option. The list stays open; only an option picks.
test('the combobox: a press on the list\'s scrollbar or its "No matches" row keeps the box\'s focus and the list', async (t) => {
  const s = setup(t);
  const press = (target, button = 0) => {
    let prevented = false;
    s.list.listeners.mousedown({ target, button, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  await s.type('exam');
  assert.ok(press(s.list), 'a press on the scrollbar (the list itself) keeps the focus');
  assert.equal(s.list.hidden, false);
  assert.deepEqual(s.opened, []);
  await s.type('nothing like it');
  assert.ok(press(s.list.children[0]), 'a press on "No matches" keeps the focus');
  assert.equal(s.list.hidden, false);
  assert.deepEqual(s.opened, []);
  // A right or middle press on an option is the browser's: no pick.
  await s.type('exam');
  const option = { closest: () => s.list.children[0] };
  assert.equal(press(option, 2), false);
  assert.equal(press(option, 1), false);
  assert.deepEqual(s.opened, [], 'nothing opened');
});

// The index loads on the first focus; a reader who types and leaves before it arrives is not followed by a list.
test('the combobox: a slow first load does not open the list after the reader has left the box', async (t) => {
  let release;
  const s = setup(t, { load: () => new Promise((resolve) => { release = () => resolve(INDEX); }) });
  const typed = s.type('exam');
  s.input.listeners.blur();
  release();
  await typed;
  assert.equal(s.list.hidden, true, 'no list opens behind the reader');
  assert.equal(s.input.getAttribute('aria-expanded'), 'false');
  // Back in the box, the words still there are listed (nothing to retype).
  await s.input.listeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.list.hidden, false, 'listed on return');
  // A list the reader closed (Escape) stays closed when they come back: only words a load left unlisted reopen.
  s.key('Escape');
  s.input.listeners.blur();
  await s.input.listeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.list.hidden, true, 'closed by the reader, closed on return');
  // And the loaded index answers typing at once.
  await s.type('exam');
  assert.equal(s.list.hidden, false);
  assert.equal(s.list.children.length, 2);
});

test('the combobox: a list cut short offers every match as a last option, where the site hands them on', async (t) => {
  const many = buildIndex(Array.from({ length: 12 }, (_, i) => ({ type: 'hospital', key: `9900${10 + i}`, label: `Example ${i}`, href: `/h/${i}/` })));
  const handed = [];
  const s = setup(t, { load: async () => many, more: (n) => `All ${n} matches`, onMore: (q) => handed.push(q) });
  await s.type(' example ');
  assert.equal(s.list.children.length, LIMIT + 1);
  assert.equal(s.texts().at(-1), 'All 12 matches');
  s.key('ArrowUp');
  s.key('Enter');
  assert.deepEqual(handed, ['example']);
  assert.deepEqual(s.opened, []);
});

test('the combobox: with moreTypes the last option counts and hands on only those kinds, by the list\'s own matcher', async (t) => {
  const entries = [
    ...Array.from({ length: 12 }, (_, i) => ({ type: 'hospital', key: `9900${10 + i}`, label: `Example ${i}`, href: `/h/${i}/` })),
    { type: 'state', key: 'EX', label: 'Example State', href: '/s/ex/' },
  ];
  const handed = [];
  const s = setup(t, { load: async () => buildIndex(entries), more: (n) => `All ${n} matches`, moreTypes: ['hospital'], onMore: (q, matches) => handed.push([q, matches.map((m) => m.key)]) });
  await s.type('example');
  assert.equal(s.texts().at(-1), 'All 12 matches', 'the state is not counted');
  s.key('ArrowUp');
  s.key('Enter');
  assert.equal(handed.length, 1);
  assert.equal(handed[0][1].length, 12);
  assert.ok(!handed[0][1].includes('EX'));
});

test('the combobox: a failed load says so, and the next try loads again', async (t) => {
  let ok = false;
  const s = setup(t, { load: async () => { if (!ok) throw new Error('down'); return INDEX; } });
  await s.type('exam');
  assert.equal(s.status.textContent, 'Did not load.');
  assert.equal(s.list.hidden, true);
  ok = true;
  // Back in the box, the load is tried again and the words already there are listed, with nothing retyped.
  s.input.listeners.blur();
  s.input.listeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.list.hidden, false, 'listed on the retry');
  await s.type('exam');
  assert.equal(s.loads.n, 2);
  assert.equal(s.list.children.length, 2);
});
