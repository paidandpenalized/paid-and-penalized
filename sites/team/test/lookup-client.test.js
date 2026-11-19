// Part 1's lookup in the browser (sites/team/client/lookup.js) against a stand-in DOM: nothing is fetched until the reader
// focuses the box, and then only the two files the box names; a query lists at most five hospitals, each one line with
// its answer and reason, under a sentence that counts the matches; a "yes" opens the hospital in the calculator (the
// address carries ?h=, the page hears team:pick, the calculator's heading takes the focus); a "no" links the hospital's
// page across the programs; names go in as text. The codes and words are the build's (lookupFile over the emitted file);
// the hospitals' names and places are made up, each CCN picked from the codes by its status. Failures print no CCN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { count } from '../../../web/render/format.js';
import { el as baseEl, standIn } from '../../../web/test/dom.js';
import { COPY as SEARCH } from '../../../hub/search/copy.js';
import { loadTeam } from '../web/data.js';
import { lookupFile } from '../web/lookup-copy.js';
import { SHOWN, mountLookup } from '../client/lookup.js';

const FILE = lookupFile(loadTeam());
const SRC = '/assets/hub-search.test.json';
const CODES = '/assets/team-lookup.test.json';
const FAILED = 'The list did not load.';

// The first CCN in the codes whose status passes ok(code, arg).
const ccnWhere = (ok) => {
  const row = FILE.rows.find(([, code, arg]) => ok(code, arg));
  assert.ok(row, 'a row with that status');
  return row[0];
};
const IN = ccnWhere((code) => code === 'in');
const CAH = ccnWhere((code, arg) => code === 'in_area_kind' && arg === 'critical_access');
const CJRX = ccnWhere((code) => code === 'cjrx');
const OUTSIDE = ccnWhere((code) => code === 'outside');

// The family search's file, made up: [ccn, name, city, state, kind].
const searchFile = (rows) => ({ cols: ['ccn', 'name', 'city', 'state', 'kind'], rows, states: {} });
const ROWS = [
  [IN, 'Example Valley Medical Center', 'Exampleton', 'AL', 'acute'],
  [CAH, 'Example Prairie Hospital', 'Plainsville', 'KS', 'critical_access'],
  [CJRX, 'Example Coast Hospital', 'Shoreton', 'GA', 'acute'],
  [OUTSIDE, 'Example Hills Hospital', null, 'TN', 'acute'],
];

// An element of the stand-in DOM that also answers closest() for a link with a CCN, remove() and focus().
function el(tag) {
  const node = baseEl(tag);
  node.closest = (sel) => (sel === 'a[data-ccn]' && node.tag === 'a' && node.dataset.ccn ? node : null);
  node.remove = () => { node.removed = true; };
  node.focus = (options) => { node.focused = options ?? {}; };
  return node;
}
// The words a node shows, its children's in order (a string child is a text node).
const textOf = (node) => (typeof node === 'string' ? node : node.textContent || node.children.map(textOf).join(''));

// The box as the build writes it, with a document, a window and fetch standing in. files: what each source answers
// (an object, or a status number for a failed answer); reduce: the reader asks for reduced motion.
function setUp(t, { files = { [SRC]: searchFile(ROWS), [CODES]: FILE }, reduce = false } = {}) {
  const input = el('input');
  input.hidden = true;
  const out = el('div');
  const nojs = el('p');
  const mount = el('search');
  Object.assign(mount.dataset, { src: SRC, codes: CODES, failed: FAILED });
  mount.querySelector = (s) => ({ input, '[aria-live]': out, '.tm-look__nojs': nojs })[s] ?? null;
  const heading = el('h2');
  const calc = el('section');
  calc.scrolled = [];
  calc.scrollIntoView = (options) => calc.scrolled.push(options);
  calc.closest = (sel) => (sel === '[aria-labelledby]' ? { getAttribute: (k) => (k === 'aria-labelledby' ? 'yours-h' : null) } : null);
  const picks = [];
  const urls = [];
  const fetched = [];
  standIn(t, {
    document: {
      createElement: el,
      getElementById: (id) => ({ calc, 'yours-h': heading })[id] ?? null,
      dispatchEvent: (e) => { picks.push(e); return true; },
    },
    window: {
      history: { state: null, replaceState: (state, title, url) => urls.push(url) },
      matchMedia: (q) => ({ matches: reduce && q === '(prefers-reduced-motion: reduce)' }),
    },
    location: { origin: 'https://pp.test' },
    fetch: async (url) => {
      const path = new URL(url).pathname;
      fetched.push(path);
      const answer = files[path];
      return typeof answer === 'number' ? { ok: false, status: answer } : { ok: true, status: 200, json: async () => structuredClone(answer) };
    },
  });
  mountLookup(mount, { wait: 0 });
  const settle = () => new Promise((r) => setTimeout(r, 5));
  const type = async (value) => {
    input.listeners.focus?.();
    input.value = value;
    input.listeners.input();
    await settle();
    await settle();
  };
  // The answer: the sentence, then each row as { tag, name, line, href, ccn }.
  const answer = () => {
    const [sentence, list] = out.children;
    return {
      sentence: sentence ? textOf(sentence) : null,
      rows: (list?.children ?? []).map((li) => {
        const [tag, , line] = li.children;
        const [name, , link] = line.children;
        return { li, tag: textOf(tag), name, line: textOf(line), link, href: link.href, ccn: link.dataset.ccn };
      }),
    };
  };
  return { mount, input, out, nojs, heading, calc, picks, urls, fetched, type, settle, answer };
}

test('no fetch before focus; on focus, the two files the box names and nothing else, once', async (t) => {
  const s = setUp(t);
  assert.equal(s.input.hidden, false, 'the script shows the box');
  assert.equal(s.nojs.removed, true, 'the no-JS sentence goes');
  await s.settle();
  assert.deepEqual(s.fetched, [], 'nothing fetched before focus');
  s.input.listeners.focus();
  await s.settle();
  assert.deepEqual(s.fetched.sort(), [CODES, SRC].sort());
  await s.type('example');
  s.input.listeners.focus();
  await s.settle();
  assert.equal(s.fetched.length, 2, 'fetched once');
});

test('a first keystroke before any focus event loads the files too', async (t) => {
  const s = setUp(t);
  s.input.value = 'prairie';
  s.input.listeners.input();
  await s.settle();
  await s.settle();
  assert.equal(s.fetched.length, 2);
  assert.equal(s.answer().rows.length, 1);
});

test('a "no" for a critical access hospital names its kind, and CJR-X when listed', async (t) => {
  const s = setUp(t);
  await s.type('prairie');
  const [cah] = s.answer().rows;
  assert.equal(cah.tag, FILE.words.no);
  assert.ok(cah.line.includes(SEARCH['hospitalKind.critical_access']), 'the kind is named');
  assert.ok(cah.line.startsWith('Example Prairie Hospital, Plainsville, KS. '), 'name, then place');
  await s.type('coast');
  const [listed] = s.answer().rows;
  assert.equal(listed.tag, FILE.words.no);
  assert.match(listed.line, /CJR-X/);
});

for (const reduce of [false, true]) {
  test(`yes${reduce ? ', reduced motion' : ''}: the link opens the calculator; with the script, team:pick, ?h=, a scroll and the calculator's heading`, async (t) => {
    const s = setUp(t, { reduce });
    await s.type('valley');
    const [row] = s.answer().rows;
    assert.equal(row.tag, FILE.words.yes);
    assert.equal(row.href, `?h=${IN}#calc`, 'works without the script');
    assert.equal(textOf(row.link), FILE.words.toCalc);
    let prevented = false;
    s.out.listeners.click({ target: row.link, button: 0, preventDefault: () => { prevented = true; } });
    assert.ok(prevented, 'the script takes the click');
    assert.deepEqual(s.urls, [`?h=${IN}#calc`], 'the address carries ?h= and #calc');
    assert.equal(s.picks.length, 1);
    assert.equal(s.picks[0].type, 'team:pick');
    assert.deepEqual(s.picks[0].detail, { ccn: IN }, 'team:pick carries the CCN');
    assert.deepEqual(s.calc.scrolled, [{ behavior: reduce ? 'auto' : 'smooth', block: 'start' }], 'reduced motion honored');
    assert.equal(s.heading.tabIndex, -1);
    assert.deepEqual(s.heading.focused, { preventScroll: true }, 'the calculator\'s heading takes the focus');
  });
}

test('a click with a modifier key, or not the main button, is the browser\'s', async (t) => {
  const s = setUp(t);
  await s.type('valley');
  const [row] = s.answer().rows;
  for (const extra of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
    let prevented = false;
    s.out.listeners.click({ target: row.link, button: 0, ...extra, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false, JSON.stringify(extra));
  }
  assert.equal(s.picks.length, 0);
});

test('no: the link is the hospital\'s page across the programs; a hospital with no city shows its state', async (t) => {
  const s = setUp(t);
  await s.type('hills');
  const [row] = s.answer().rows;
  assert.equal(row.tag, FILE.words.no);
  assert.equal(row.href, `${FILE.hub}${OUTSIDE.toLowerCase()}/`);
  assert.equal(row.ccn, undefined, 'not a calculator link');
  assert.equal(textOf(row.link), FILE.words.toHub);
  assert.ok(row.line.startsWith('Example Hills Hospital, TN. '));
});

test('a hospital the codes lack is not listed', async (t) => {
  const rows = [...ROWS, ['ZZ9999', 'Example Lost Hospital', 'Nowhere', 'AL', 'acute']];
  const s = setUp(t, { files: { [SRC]: searchFile(rows), [CODES]: FILE } });
  await s.type('lost');
  assert.equal(s.answer().rows.length, 0);
  assert.equal(s.answer().sentence, FILE.words.empty);
});

test('at most five rows, under a sentence that counts every match; one match and none have their own words', async (t) => {
  const many = FILE.rows.slice(0, SHOWN + 3).map(([ccn], i) => [ccn, `Example Twin Hospital ${String.fromCharCode(97 + i)}`, 'Twinsburg', 'OH', 'acute']);
  const s = setUp(t, { files: { [SRC]: searchFile(many), [CODES]: FILE } });
  assert.equal(SHOWN, 5);
  await s.type('twin');
  const a = s.answer();
  assert.equal(a.rows.length, SHOWN);
  assert.equal(a.sentence, FILE.words.countMore.replace('{n}', count(many.length)).replace('{shown}', count(SHOWN)));
  await s.type('twin hospital a');
  assert.equal(s.answer().sentence, FILE.words.countOne);
  await s.type('nothing like it');
  assert.deepEqual(s.answer(), { sentence: FILE.words.empty, rows: [] });
});

test('a few matches: the plain count', async (t) => {
  const two = setUp(t, { files: { [SRC]: searchFile(ROWS.slice(0, 2)), [CODES]: FILE } });
  await two.type('example');
  assert.equal(two.answer().sentence, FILE.words.count.replace('{n}', count(2)));
});

test('Escape clears the box and the answer; an emptied box says nothing', async (t) => {
  const s = setUp(t);
  await s.type('example');
  assert.ok(s.answer().rows.length > 0);
  let prevented = false;
  s.input.listeners.keydown({ key: 'Escape', preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.equal(s.input.value, '');
  assert.deepEqual(s.out.children, []);
  await s.type('example');
  await s.type('   ');
  assert.deepEqual(s.out.children, []);
});

test('names inserted as text, not HTML', async (t) => {
  const rows = [[IN, '<b>Bold</b> Example <img src=x onerror=alert(1)>', '<i>City</i>', 'AL', 'acute']];
  const s = setUp(t, { files: { [SRC]: searchFile(rows), [CODES]: FILE } });
  await s.type('bold');
  const [row] = s.answer().rows;
  assert.equal(row.name.tag, 'strong');
  assert.equal(row.name.textContent, '<b>Bold</b> Example <img src=x onerror=alert(1)>', 'the name renders literally');
  assert.ok(row.line.includes(', <i>City</i>, AL. '), 'the place renders literally');
  const walk = (node) => (typeof node === 'string' ? [] : [node, ...node.children.flatMap(walk)]);
  for (const node of walk(s.out)) assert.ok(!Object.hasOwn(node, 'innerHTML') && !Object.hasOwn(node, 'outerHTML'), `${node.tag}: markup set`);
  const source = readFileSync(REPO_ROOT + 'sites/team/client/lookup.js', 'utf8');
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|setHTML|document\.write/, 'the script writes no markup');
});

test('a failed load says so; the next focus tries again', async (t) => {
  const files = { [SRC]: searchFile(ROWS), [CODES]: 503 };
  const s = setUp(t, { files });
  await s.type('valley');
  assert.equal(s.answer().sentence, FAILED);
  assert.equal(s.answer().rows.length, 0);
  files[CODES] = FILE;
  await s.type('valley');
  assert.equal(s.answer().rows.length, 1);
});

test('a file that is not the site\'s own asset is refused', async (t) => {
  const s = setUp(t);
  s.mount.dataset.codes = 'https://elsewhere.test/assets/x.json';
  await s.type('valley');
  assert.equal(s.answer().sentence, FAILED);
  assert.ok(!s.fetched.some((p) => p === '/assets/x.json'));
});

test('a codes file of another shape, or a status with no words, says the list didn\'t load', async (t) => {
  const reasons = { ...FILE.reasons };
  delete reasons[Object.keys(reasons)[0]];
  for (const codes of [{ ...FILE, cols: ['ccn', 'code'] }, { ...FILE, reasons }, { ...FILE, hub: null }]) {
    await t.test(JSON.stringify(Object.keys(codes)), async (st) => {
      const s = setUp(st, { files: { [SRC]: searchFile(ROWS), [CODES]: codes } });
      await s.type('valley');
      assert.deepEqual(s.answer(), { sentence: FAILED, rows: [] });
    });
  }
});
