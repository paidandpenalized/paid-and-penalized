// The shell's script (web/client/shell.js, loaded first on every page): the theme toggles, the followed hospital that
// travels in a link's ?h= (its pure parts in follow.js), the phone's search button and the program tabs' scroll and
// fade. The pure parts run on strings; the wiring runs on a stand-in DOM that refuses innerHTML, so a test fails if
// data ever reaches the page as markup. Synthetic hospitals only (invented CCNs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../pipeline/files.js';
import { CHIP } from '../chip-copy.js';
import { followedCcn, siteAddress, tabHref, tabProgram, withoutFollow } from '../client/follow.js';
import * as shell from '../client/shell.js';
import { follow, moreTabs, rewriteLinks, tabScroll, wireFind, wireTabs, wireTheme } from '../client/shell.js';
import { SITE, hospitalPathOf } from '../site.js';

// ---------- the pure parts ----------

test('followedCcn: the first h, six digits or letters, any case, uppercased; anything else is nothing', () => {
  assert.equal(followedCcn('?h=990001'), '990001');
  assert.equal(followedCcn('h=990001'), '990001', 'the leading ? is optional');
  assert.equal(followedCcn('?x=1&h=99000A&y=2'), '99000A');
  assert.equal(followedCcn('?h=99000a'), '99000A', 'a lowercase CCN is accepted and uppercased');
  assert.equal(followedCcn('?h=990001&h=99000A'), '990001', 'the first h wins');
  assert.equal(followedCcn('?h=abc&h=990001'), null, 'the first h is the one that counts, even when a later one is fine');
  assert.equal(followedCcn('?h=99%30001'), '990001', 'percent-encoding is decoded as for any parameter');
});

test('followedCcn: malformed, markup and look-alike values are null', () => {
  for (const search of [
    '', '?', '?h', '?h=', '?h=abc', '?h=99000', '?h=9900011', '?h=99 001', '?h=99-001', '?h=99_001', '?h=%2099001',
    '?h=<img src=x>', '?h=%3Cimg%20src%3Dx%3E', '?h="><script>alert(1)</script>', '?h=990001%0A', '?h=%0A990001', '?h=990001;x',
    '?H=990001', '?hh=990001', '?x=h%3D990001',
    // Characters that uppercase into ASCII letters (dotless i, long s) are not a lowercase CCN.
    `?h=${'ı'.repeat(6)}`, `?h=${'ſ'.repeat(5)}1`, '?h=ß99999', '?h=K99999',
  ]) assert.equal(followedCcn(search), null, search);
  assert.equal(followedCcn(undefined), null);
});

test('followedCcn: a CCN the page does not know is null, and known is asked only about a well-formed one', () => {
  const asked = [];
  const known = (ccn) => { asked.push(ccn); return ccn === '990001'; };
  assert.equal(followedCcn('?h=990001', known), '990001');
  assert.equal(followedCcn('?h=99000a', known), null);
  assert.equal(followedCcn('?h=<img>', known), null);
  assert.equal(followedCcn('?h=99000', known), null);
  assert.deepEqual(asked, ['990001', '99000A'], 'asked with the uppercase CCN, and never about junk');
});

test('tabHref: All is the hospital page; Hacrp has one for every hospital; Readmissions only for a hospital Thirty Day Readmissions has', () => {
  assert.equal(tabHref(null, '990001', { inTdr: false }), '/hospital/990001/');
  assert.equal(tabHref('hub', '99000A', null), '/hospital/99000a/', 'folders are lowercase');
  assert.equal(tabHref('hacrp', '99000A', { inTdr: false }), '/hacrp/hospital/99000a/');
  assert.equal(tabHref('hrrp', '990001', { inTdr: true }), '/hrrp/hospital/990001/');
  assert.equal(tabHref('hrrp', '990001', { inTdr: false }), '/hrrp/?h=990001');
  assert.equal(tabHref('hrrp', '990001', null), '/hrrp/?h=990001');
  assert.equal(tabHref('hvbp', '99000A', { inTdr: true }), '/hvbp/?h=99000A', 'any other program: its folder, with the hospital in the link');
  for (const p of SITE.programs.filter((q) => !['hrrp', 'hacrp'].includes(q.id))) assert.equal(tabHref(p.id, '990001', null), `${p.path}?h=990001`, p.id);
  assert.throws(() => tabHref('nope', '990001', null), RangeError);
});

test('tabProgram: the front page is All, a program\'s folder is that program, any other address is undefined', () => {
  assert.equal(tabProgram('/'), null);
  for (const p of SITE.programs) assert.equal(tabProgram(p.path), p.id, p.id);
  assert.equal(tabProgram('/hospital/990001/'), undefined);
  assert.equal(tabProgram('/hacrp/hospital/990001/'), undefined);
  assert.equal(tabProgram('/hrrp/?h=990001'), undefined, 'already carrying a hospital');
  assert.equal(tabProgram('https://example.org/'), undefined);
  assert.equal(tabProgram(null), undefined);
});

test('withoutFollow: every h is dropped, everything else stays exactly as it was', () => {
  assert.equal(withoutFollow('/hacrp/?h=990001&x=1#a'), '/hacrp/?x=1#a');
  assert.equal(withoutFollow('/hacrp/?h=990001'), '/hacrp/');
  assert.equal(withoutFollow('/hacrp/?h=990001#top'), '/hacrp/#top');
  assert.equal(withoutFollow('/?x=1&h=99000A&y=a%20b+c&h=990001'), '/?x=1&y=a%20b+c');
  assert.equal(withoutFollow('/?%68=990001&H=2'), '/?H=2', 'a percent-encoded h is an h; a capital H is another name');
  assert.equal(withoutFollow('/?h'), '/');
  assert.equal(withoutFollow('/?hh=1&xh=2'), '/?hh=1&xh=2');
  for (const same of ['/', '/hacrp/#h=990001', '/a/?x=1', '/a/?x=1&&y=2#z', '']) assert.equal(withoutFollow(same), same, `${same} is returned untouched`);
});

test('shell.js offers the follow\'s pure parts, the very functions follow.js holds', () => {
  assert.equal(shell.followedCcn, followedCcn);
  assert.equal(shell.tabHref, tabHref);
  assert.equal(shell.withoutFollow, withoutFollow);
});

test('siteAddress: the page\'s path, query and fragment as a link on this site, never another site\'s', () => {
  assert.equal(siteAddress({ pathname: '/hacrp/', search: '?h=990001&x=1', hash: '#a' }), '/hacrp/?h=990001&x=1#a');
  assert.equal(siteAddress({ pathname: '/', search: '', hash: '' }), '/');
  for (const pathname of ['//example.invalid/p', '///example.invalid/p', '/////example.invalid/p']) {
    assert.equal(siteAddress({ pathname, search: '?h=990001', hash: '' }), '/example.invalid/p?h=990001', pathname);
  }
  assert.equal(withoutFollow(siteAddress({ pathname: '//example.invalid/', search: '?h=990001', hash: '' })), '/example.invalid/');
});

// ---------- a stand-in DOM ----------

// Elements that keep attributes, children, classes and listeners, and refuse innerHTML and outerHTML.
function el(tag = 'div', init = {}) {
  const classes = new Set();
  const node = {
    tag, attrs: {}, children: [], listeners: {}, hidden: false, className: '', textContent: '', dataset: {}, focused: false,
    setAttribute(k, v) { node.attrs[k] = String(v); },
    getAttribute: (k) => node.attrs[k] ?? null,
    append(...xs) { node.children.push(...xs); },
    replaceChildren(...xs) { node.children = xs; },
    addEventListener(type, fn) { (node.listeners[type] ??= []).push(fn); },
    emit(type, event = {}) { for (const fn of node.listeners[type] ?? []) fn({ defaultPrevented: false, ...event }); },
    focus() { node.focused = true; },
    classList: {
      toggle(c, force) { if (force ?? !classes.has(c)) classes.add(c); else classes.delete(c); return classes.has(c); },
      contains: (c) => classes.has(c),
    },
    ...init,
  };
  for (const name of ['innerHTML', 'outerHTML']) Object.defineProperty(node, name, { set() { throw new Error(`${name} set`); }, get: () => '' });
  return node;
}
const doc = () => {
  const events = [];
  return { createElement: (tag) => el(tag), dispatchEvent: (e) => events.push(e), events };
};

// ---------- the theme toggles ----------

test('wireTheme: every toggle shows, flips data-theme for this visit, keeps aria-pressed in step and says so on the document', () => {
  const buttons = [el('button', { hidden: true }), el('button', { hidden: true })];
  const root = { dataset: {} };
  const query = { matches: true, listeners: [], addEventListener(_, fn) { query.listeners.push(fn); } };
  const d = doc();
  wireTheme({ buttons, root, query, doc: d });
  const pressed = () => buttons.map((b) => b.getAttribute('aria-pressed'));
  assert.deepEqual(buttons.map((b) => b.hidden), [false, false]);
  assert.deepEqual(pressed(), ['true', 'true'], 'follows the device');
  buttons[0].emit('click');
  assert.equal(root.dataset.theme, 'light');
  assert.deepEqual(pressed(), ['false', 'false']);
  buttons[1].emit('click');
  assert.equal(root.dataset.theme, 'dark');
  assert.deepEqual(pressed(), ['true', 'true']);
  assert.deepEqual(d.events.map((e) => [e.type, e.detail.dark]), [['pp-theme', false], ['pp-theme', true]]);
  // The device changing while no visit choice is made repaints too; once the visitor chose, the device is not asked.
  root.dataset.theme = '';
  query.matches = false;
  query.listeners[0]();
  assert.deepEqual(pressed(), ['false', 'false']);
  assert.equal(d.events.length, 3);
  assert.deepEqual([d.events[2].type, d.events[2].detail.dark], ['pp-theme', false]);
  root.dataset.theme = 'dark';
  query.listeners[0]();
  assert.equal(d.events.length, 3, 'a chosen theme ignores the device');
  assert.deepEqual(pressed(), ['true', 'true']);
});

test('wireTheme does nothing on a page with no toggle', () => {
  const query = { matches: false, addEventListener() { throw new Error('listened'); } };
  wireTheme({ buttons: [], root: { dataset: {} }, query, doc: doc() });
});

// ---------- the followed hospital ----------

// The pieces of a header as the server writes them: the empty hidden chip, the front page's wordmark and the tabs (the
// registry's: All programs, then each program's folder; on a hospital page, All is the hospital's page and a program
// with a page for it links there).
function page({ hospital = null } = {}) {
  const chip = el('p', { hidden: true });
  const wordmark = el('a');
  wordmark.setAttribute('href', '/');
  const tabs = [null, ...SITE.programs].map((p) => {
    const a = el('a');
    const own = hospital && hospitalPathOf(p === null ? 'hub' : p.id, hospital.toLowerCase(), { inTdr: false });
    a.setAttribute('href', own || (p === null ? '/' : p.path));
    return a;
  });
  return { chip, wordmark, tabs };
}
const hrefs = (tabs) => tabs.map((a) => a.getAttribute('href'));
const ROWS = new Map([
  ['990001', { ccn: '990001', name: 'Example General', inTdr: true, est: { net: -1234567 } }],
  ['99000A', { ccn: '99000A', name: 'Sample Medical', inTdr: false, est: { net: 250000 } }],
  ['990003', { ccn: '990003', name: 'No Estimate Hospital', inTdr: false, est: null }],
  ['990004', { ccn: '990004', name: '<img src=x onerror=alert(1)>', inTdr: false, est: { net: 0 } }],
]);
function run({ search, here = '/hacrp/', hospital = null, rows = ROWS, fail = false } = {}) {
  const p = page({ hospital });
  const loads = { n: 0 };
  const load = async () => {
    loads.n++;
    if (fail) throw new Error('down');
    return { fy: 2026, byCcn: rows };
  };
  const d = doc();
  const done = follow({ hospital, chip: p.chip, wordmark: p.wordmark, tabs: p.tabs, search, here: `${here}${search}`, load, doc: d });
  return { ...p, loads, done, d };
}

test('follow: a ?h= naming a known hospital fills the chip, points the tabs and the wordmark at it, and stops following on the ×', async () => {
  const r = run({ search: '?h=99000a&x=1' });
  await r.done;
  assert.equal(r.loads.n, 1);
  assert.equal(r.chip.hidden, false);
  const [key, name, stop] = r.chip.children;
  assert.deepEqual([key.tag, key.className, key.textContent], ['span', 'chip__k', CHIP.chipKey]);
  assert.deepEqual([name.tag, name.className, name.getAttribute('href')], ['a', 'chip__n', '/hospital/99000a/']);
  const [title, gap, value] = name.children;
  assert.deepEqual([title.className, title.textContent], ['chip__t', 'Sample Medical']);
  assert.equal(gap, ' ');
  assert.equal(value.className, 'chip__v');
  const [said, figure] = value.children;
  assert.deepEqual([said.className, said.textContent], ['vh', 'Estimated FY2026 net: ']);
  assert.equal(figure, '+$250K', 'the signed estimated net, as the build prints it');
  assert.deepEqual([stop.tag, stop.className, stop.textContent, stop.getAttribute('href'), stop.getAttribute('aria-label')], ['a', 'chip__x', '×', '/hacrp/?x=1', 'Stop following Sample Medical']);
  assert.equal(r.wordmark.getAttribute('href'), '/?h=99000A');
  const own = { hrrp: '/hrrp/?h=99000A', hacrp: '/hacrp/hospital/99000a/' };
  assert.deepEqual(hrefs(r.tabs), ['/hospital/99000a/', ...SITE.programs.map((p) => own[p.id] ?? `${p.path}?h=99000A`)]);
});

test('follow: a hospital Thirty Day Readmissions has gets its own Readmissions page', async () => {
  const r = run({ search: '?h=990001' });
  await r.done;
  const at = SITE.programs.findIndex((p) => p.id === 'hrrp') + 1;
  assert.equal(r.tabs[at].getAttribute('href'), '/hrrp/hospital/990001/');
});

test('follow: a hospital with no estimate has a chip without a figure', async () => {
  const r = run({ search: '?h=990003' });
  await r.done;
  const name = r.chip.children[1];
  assert.deepEqual(name.children.map((c) => c.className), ['chip__t']);
  assert.equal(r.chip.hidden, false);
});

test('follow: a name that is markup stays text: it is set as textContent and an attribute, never as HTML', async () => {
  const r = run({ search: '?h=990004' });
  await r.done;
  assert.equal(r.chip.children[1].children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(r.chip.children[2].getAttribute('aria-label'), 'Stop following <img src=x onerror=alert(1)>');
  assert.equal(r.chip.children[1].children[2].children[1], '$0', 'a zero net prints with no sign');
});

test('follow: a malformed, markup or unknown ?h= changes nothing, fetches nothing where it can tell, and says nothing', async () => {
  for (const search of ['', '?h=', '?h=abc', '?h=<img src=x>', '?h=99000', '?h=abc&h=990001', '?h=990002', '?h=zzzzzz']) {
    const r = run({ search });
    await r.done;
    const malformed = followedCcn(search) === null;
    assert.equal(r.loads.n, malformed ? 0 : 1, `${search}: the asset is fetched only for a well-formed CCN`);
    assert.equal(r.chip.hidden, true, search);
    assert.deepEqual(r.chip.children, [], search);
    assert.deepEqual(hrefs(r.tabs), ['/', ...SITE.programs.map((p) => p.path)], search);
    assert.equal(r.wordmark.getAttribute('href'), '/', search);
  }
});

test('follow: an asset that fails to load leaves the page as it was, with no error', async () => {
  const r = run({ search: '?h=990001', fail: true });
  await r.done;
  assert.equal(r.loads.n, 1);
  assert.equal(r.chip.hidden, true);
  assert.deepEqual(hrefs(r.tabs), ['/', ...SITE.programs.map((p) => p.path)]);
});

test('follow: a repeated ?h= follows the first; the chip stops following every h', async () => {
  const r = run({ search: '?h=990001&h=99000A' });
  await r.done;
  assert.equal(r.chip.children[1].children[0].textContent, 'Example General');
  assert.equal(r.chip.children[2].getAttribute('href'), '/hacrp/');
});

test('follow: on a hospital page the header names the hospital, nothing is fetched, a ?h= is ignored and each plain program tab gains ?h=', async () => {
  const r = run({ search: '?h=99000A', hospital: '990001' });
  await r.done;
  assert.equal(r.loads.n, 0, 'no fetch on a hospital page');
  assert.equal(r.chip.hidden, true, 'the server wrote the chip; the script leaves it be');
  assert.deepEqual(hrefs(r.tabs), ['/hospital/990001/', ...SITE.programs.map((p) => (p.id === 'hacrp' ? '/hacrp/hospital/990001/' : `${p.path}?h=990001`))]);
  assert.equal(r.wordmark.getAttribute('href'), '/?h=990001');
});

test('follow: a header naming something that is not a CCN is left alone', async () => {
  const p = page();
  await follow({ hospital: '<b>', chip: p.chip, wordmark: p.wordmark, tabs: p.tabs, search: '?h=990001', here: '/?h=990001', load: async () => { throw new Error('loaded'); }, doc: doc() });
  assert.deepEqual(hrefs(p.tabs), ['/', ...SITE.programs.map((q) => q.path)]);
  assert.equal(p.wordmark.getAttribute('href'), '/');
});

test('follow: a hospital whose name holds "$&" or "$1" is printed as it is', async () => {
  const rows = new Map([['990005', { ccn: '990005', name: 'A $& B $1 $$ C', inTdr: false, est: { net: -5 } }]]);
  const r = run({ search: '?h=990005', rows });
  await r.done;
  assert.equal(r.chip.children[1].children[0].textContent, 'A $& B $1 $$ C');
  assert.equal(r.chip.children[2].getAttribute('aria-label'), 'Stop following A $& B $1 $$ C');
});

test('rewriteLinks: only the front page and a program\'s folder are rewritten; another link, an external one and a missing tab are left', () => {
  const tabs = ['/', '/hvbp/', '/hvbp/?h=990001', '/somewhere/else/', 'https://example.org/hvbp/', null].map((href) => {
    const a = el('a');
    if (href !== null) a.setAttribute('href', href);
    return a;
  });
  rewriteLinks({ tabs, wordmark: null }, '99000A', { inTdr: false });
  assert.deepEqual(hrefs(tabs), ['/hospital/99000a/', '/hvbp/?h=99000A', '/hvbp/?h=990001', '/somewhere/else/', 'https://example.org/hvbp/', null]);
});

// ---------- the phone's search ----------

function bar() {
  const header = el('header');
  const button = el('button', { hidden: true });
  button.setAttribute('aria-expanded', 'false');
  const input = el('input');
  return { header, button, input };
}

test('wireFind: the button shows; it opens the search row and focuses the box, and closes it again', () => {
  const { header, button, input } = bar();
  wireFind({ header, button, input });
  assert.equal(button.hidden, false);
  button.emit('click');
  assert.equal(header.classList.contains('fam--searching'), true);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(input.focused, true);
  input.focused = false;
  button.emit('click');
  assert.equal(header.classList.contains('fam--searching'), false);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(input.focused, false, 'closing does not focus the box');
});

test('wireFind: Escape closes the row and returns focus to the button, unless the box used the key to close its list', () => {
  const { header, button, input } = bar();
  wireFind({ header, button, input });
  header.emit('keydown', { key: 'Escape' });
  assert.equal(header.classList.contains('fam--searching'), false, 'nothing to close');
  assert.equal(button.focused, false);
  button.emit('click');
  header.emit('keydown', { key: 'Enter' });
  assert.equal(header.classList.contains('fam--searching'), true);
  header.emit('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(header.classList.contains('fam--searching'), true, 'the combobox closed its list with that Escape');
  header.emit('keydown', { key: 'Escape' });
  assert.equal(header.classList.contains('fam--searching'), false);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.focused, true);
});

// ---------- the program tabs ----------

test('tabScroll: nothing when the current tab is whole and clear; just enough to bring it clear of the left edge or the right fade', () => {
  const row = { left: 0, right: 390 };
  assert.equal(tabScroll(row, { left: 100, right: 220 }), 0);
  assert.equal(tabScroll(row, { left: 16, right: 100 }), 0);
  assert.equal(tabScroll(row, { left: 8, right: 100 }), 0);
  assert.equal(tabScroll(row, { left: 4, right: 100 }), -4, 'a tab cut by the left edge');
  assert.equal(tabScroll(row, { left: -60, right: 20 }), -68);
  assert.equal(tabScroll(row, { left: 300, right: 420 }), 78, 'a tab cut by the right edge, and clear of the fade');
  assert.equal(tabScroll(row, { left: 250, right: 350 }), 8, 'a tab under the fade');
  assert.equal(tabScroll(row, { left: 250, right: 342 }), 0);
});

test('moreTabs: more lie to the right while the row can still scroll', () => {
  assert.equal(moreTabs({ scrollLeft: 0, clientWidth: 390, scrollWidth: 900 }), true);
  assert.equal(moreTabs({ scrollLeft: 510, clientWidth: 390, scrollWidth: 900 }), false);
  assert.equal(moreTabs({ scrollLeft: 509.5, clientWidth: 390, scrollWidth: 900 }), false, 'a fraction of a pixel is not more');
  assert.equal(moreTabs({ scrollLeft: 0, clientWidth: 1180, scrollWidth: 1180 }), false);
});

function tabRow({ scrollWidth = 900, clientWidth = 390, current = { left: 500, right: 600 } } = {}) {
  const nav = el('nav');
  const currentTab = el('a');
  currentTab.getBoundingClientRect = () => ({ left: row.current.left - row.scrollLeft, right: row.current.right - row.scrollLeft });
  const row = el('div', { scrollLeft: 0, scrollWidth, clientWidth, current: { ...current }, getBoundingClientRect: () => ({ left: 0, right: row.clientWidth }) });
  row.querySelector = (selector) => (selector === '[aria-current="page"]' ? currentTab : null);
  const win = el('window');
  return { nav, row, win };
}

test('wireTabs: the row scrolls the current tab into view and marks more to the right while there are, as it scrolls and as the window resizes', () => {
  const { nav, row, win } = tabRow();
  wireTabs({ nav, row, win });
  assert.equal(row.scrollLeft, 600 + 48 - 390, 'the current tab clear of the fade');
  assert.equal(nav.classList.contains('tabs--more'), true);
  row.scrollLeft = 510;
  row.emit('scroll');
  assert.equal(nav.classList.contains('tabs--more'), false);
  row.clientWidth = 200;
  win.emit('resize');
  assert.equal(nav.classList.contains('tabs--more'), true);
});

test('wireTabs: when the web fonts arrive and change the tabs\' widths, the fit is made again and the fade follows', async () => {
  const { nav, row, win } = tabRow({ scrollWidth: 450, current: { left: 100, right: 180 } });
  let arrive;
  wireTabs({ nav, row, win, fonts: new Promise((resolve) => { arrive = resolve; }) });
  assert.equal(row.scrollLeft, 0, 'the current tab is clear at first');
  assert.equal(nav.classList.contains('tabs--more'), true);
  // The fonts widen the row and move the tab under the fade; the row is at its end, so nothing more lies to the right.
  row.scrollWidth = 900;
  row.current.left = 500;
  row.current.right = 600;
  arrive();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(row.scrollLeft, 258);
  row.scrollLeft = 510;
  row.emit('scroll');
  assert.equal(nav.classList.contains('tabs--more'), false);
});

test('wireTabs: fonts that never settle, or a page without them, change nothing', async () => {
  const failing = tabRow();
  wireTabs({ ...failing, fonts: Promise.reject(new Error('no fonts')) });
  await Promise.resolve();
  await Promise.resolve();
  const none = tabRow();
  wireTabs({ ...none, fonts: null });
  assert.equal(none.row.scrollLeft, 258);
});

test('wireTabs: a row that fits is left alone, and a page with no current tab still marks more', () => {
  const fits = tabRow({ scrollWidth: 390 });
  wireTabs(fits);
  assert.equal(fits.row.scrollLeft, 0);
  assert.equal(fits.nav.classList.contains('tabs--more'), false);
  const none = tabRow({ current: { left: 20, right: 90 } });
  wireTabs(none);
  assert.equal(none.row.scrollLeft, 0, 'a current tab already clear is not moved');
  assert.equal(none.nav.classList.contains('tabs--more'), true);
  const noCurrent = tabRow();
  noCurrent.row.querySelector = () => null;
  wireTabs(noCurrent);
  assert.equal(noCurrent.row.scrollLeft, 0);
  assert.equal(noCurrent.nav.classList.contains('tabs--more'), true);
});

// ---------- the source ----------

test('shell.js and follow.js store nothing and build no markup from data', () => {
  for (const file of ['web/client/shell.js', 'web/client/follow.js']) {
    const src = readFileSync(REPO_ROOT + file, 'utf8').replace(/\/\/.*$/gm, '');
    for (const word of ['localStorage', 'sessionStorage', 'cookie', 'indexedDB', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(']) assert.ok(!src.includes(word), `${file}: ${word}`);
  }
  assert.match(readFileSync(REPO_ROOT + 'web/client/shell.js', 'utf8'), /dataset\.theme/);
});

test('the chip\'s words are the render\'s own: COPY holds the very strings the script prints', async () => {
  const { COPY } = await import('../copy.js');
  for (const key of Object.keys(CHIP)) assert.equal(COPY[key], CHIP[key], key);
});
