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
function setup(t, { load = async () => INDEX, onMore = null, more = null } = {}) {
  const s = comboForm(t);
  const opened = [];
  const loads = { n: 0 };
  mountOmnibox(s.form, {
    load: () => { loads.n++; return load(); },
    words: { empty: 'No matches.', kind: { hospital: 'Hospital', state: 'State' }, count: (n) => `${n} matches`, failed: 'Did not load.', more },
    open: (href) => opened.push(href),
    onMore,
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
  s.list.listeners.mousedown({ target: s.list.children[0].children[0] && { closest: () => s.list.children[0] }, preventDefault: () => { prevented = true; } });
  assert.ok(prevented, 'the input keeps focus until the pick');
  assert.equal(s.opened.length, 1);
  await s.type('nothing like it');
  assert.deepEqual(s.texts(), ['No matches.']);
  assert.equal(s.input.getAttribute('aria-activedescendant'), null);
  await s.type('');
  assert.equal(s.list.hidden, true);
  assert.equal(s.status.textContent, '');
});

// Leaving the box closes the list a moment later (so a press on an option lands first). A reader who comes straight back
// and types keeps the list: coming back calls off the late close.
test('the combobox: leaving closes the list a moment later, unless the reader is back in the box by then', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup(t);
  await s.type('exam');
  s.input.listeners.blur();
  t.mock.timers.tick(500);
  assert.equal(s.list.hidden, true, 'closed once the box has lost the focus');
  s.input.listeners.blur();
  s.input.listeners.focus();
  await s.type('sample');
  t.mock.timers.tick(500);
  assert.equal(s.list.hidden, false, 'back in the box and typing: the list stays');
  s.key('Enter');
  assert.deepEqual(s.opened, ['/h/99000a/']);
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

test('the combobox: a failed load says so, and the next try loads again', async (t) => {
  let ok = false;
  const s = setup(t, { load: async () => { if (!ok) throw new Error('down'); return INDEX; } });
  await s.type('exam');
  assert.equal(s.status.textContent, 'Did not load.');
  assert.equal(s.list.hidden, true);
  ok = true;
  await s.type('exam');
  assert.equal(s.loads.n, 2);
  assert.equal(s.list.children.length, 2);
});
