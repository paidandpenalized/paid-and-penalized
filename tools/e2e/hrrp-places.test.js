// The Readmissions hospitals tables in a real browser: a place page's table and the program page's "Every hospital" explorer, which
// run the same code. The rows come in once, when the table is near the screen (and not at all on a place that fits one page);
// the filters, sort and pager act on them; "Copy as CSV" copies the filtered rows in the table's order; and at 360 px, no
// sideways scroll and no console error. Expected rows are worked out here from the build's data (the engine's applyFilters),
// and places are picked by property (hrrp-pick.js), never named. Runs against dist/ or any URL; see site.js.
import { readFile } from 'node:fs/promises';
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS } from '../../engine/js/hrrp/formula.js';
import { applyFilters } from '../../engine/js/hrrp/filters.js';
import { PAGE_SIZE } from '../../sites/hrrp/web/constants.js';
import { HRRP_PROGRAM_PATH, HOSPITALS, bigState, intOf, multiStateMetro, smallMetro, stubClipboard } from './hrrp-pick.js';
import { CONCURRENCY, assertNoSideways, assertQuiet, eventually, fetchesOf, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();
const BIG = bigState();
const METRO = multiStateMetro();
const SMALL = smallMetro();
const idsOf = (list) => list.map((h) => h.id.toUpperCase());
const sameSet = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

// A table's controls and readings, for the box at root with ids prefixed prefix ('ph' on a place page, 'ex' on the explorer).
function table(page, root, prefix) {
  const box = page.locator(root);
  const t = {
    box,
    rows: box.locator('table.ph__table tbody tr'),
    status: () => box.locator('.ph__status').innerText(),
    total: async () => intOf((await t.status()).match(/of ([\d,]+)/)[1]),
    // The CCNs of the rows shown, from their links.
    shownIds: () => box.locator('table.ph__table tbody tr th a').evaluateAll((as) => as.map((a) => a.getAttribute('href').split('/').filter(Boolean).pop().toUpperCase())),
    column: (n) => box.locator(`table.ph__table tbody tr td:nth-child(${n})`).allInnerTexts(),
    control: (id) => box.locator(`#${prefix}-${id}`),
    open: async () => {
      await box.scrollIntoViewIfNeeded();
      await box.locator('.ph__controls').waitFor({ state: 'visible' });
    },
  };
  return t;
}

// A city that some, not all, of the hospitals are in.
const partialCity = (scope) => scope.find((h) => scope.some((o) => o.city !== h.city)).city;

// The checks a full table (rows asset loaded) has to pass, for the hospitals in scope (the build's records). Leaves it unfiltered.
async function exerciseTable(page, t, scope, { state }) {
  const n = scope.length;
  const pages = Math.ceil(n / PAGE_SIZE);
  assert.equal(await t.rows.count(), PAGE_SIZE, 'a page of rows shows');
  assert.equal(await t.total(), n, 'the status counts every hospital in scope');
  assert.match(await t.status(), new RegExp(`^1–${PAGE_SIZE} of`));
  // Pager: next, then previous (disabled on page 1); the last page holds the rest.
  const first = await t.shownIds();
  await t.box.locator('[data-next]').click();
  assert.match(await t.status(), new RegExp(`^${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, n)} of`));
  assert.notDeepEqual(await t.shownIds(), first, 'the next page lists other hospitals');
  await t.box.locator('[data-prev]').click();
  assert.equal(await t.box.locator('[data-prev]').isDisabled(), true, 'previous is off on page 1');
  assert.deepEqual(await t.shownIds(), first, 'page 1 again');
  for (let i = 1; i < pages; i++) await t.box.locator('[data-next]').click();
  assert.equal(await t.box.locator('[data-next]').isDisabled(), true, 'next is off on the last page');
  assert.equal(await t.rows.count(), n - (pages - 1) * PAGE_SIZE, 'the last page holds the rest');
  await t.control('sort').selectOption('cut');

  // Text filter.
  const city = partialCity(scope);
  const inCity = applyFilters(scope, { text: city });
  await t.control('text').fill(city);
  await eventually(async () => (await t.total()) === inCity.length, 'the text filter does not leave the hospitals in that city');
  if (inCity.length <= PAGE_SIZE) sameSet(await t.shownIds(), idsOf(inCity));
  await t.control('text').fill('');

  // Penalized only; a peer group; a condition; a state (where the table has the control).
  const checks = [
    ['penalized', () => t.control('pen').check(), () => t.control('pen').uncheck(), { penalized: true }],
    ['peer', () => t.control('peer').selectOption(String(scope[0].peer)), () => t.control('peer').selectOption(''), { peer: scope[0].peer }],
    ['condition', () => t.control('cond').selectOption(String(CONDS.indexOf('HF'))), () => t.control('cond').selectOption(''), { cond: 'HF' }],
  ];
  if (state) checks.push(['state', () => t.control('state').selectOption(state), () => t.control('state').selectOption(''), { st: state }]);
  for (const [what, apply, undo, filter] of checks) {
    const want = applyFilters(scope, filter);
    await apply();
    await eventually(async () => (await t.status()) === '' || (await t.total()) === want.length, `the ${what} filter does not leave the ${want.length} expected`);
    if (want.length) assert.equal(await t.total(), want.length, `${what}: the count`);
    if (what === 'peer') assert.ok((await t.column(4)).every((x) => x.trim() === String(scope[0].peer)), 'only that peer group shows');
    await undo();
    await eventually(async () => (await t.total()) === n, `undoing the ${what} filter restores the count`);
  }

  // Sorts: by name (A to Z) and by beds (high to low) across the first page.
  await t.control('sort').selectOption('name');
  const names = await t.box.locator('table.ph__table tbody tr th a').allInnerTexts();
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')), 'name A to Z');
  await t.control('sort').selectOption('beds');
  const beds = (await t.column(6)).map(intOf);
  assert.ok(beds.every((v, i) => !i || v <= beds[i - 1]), 'beds high to low');
  await t.control('sort').selectOption('cut');

  // No match: the empty line says so and the status is empty.
  await t.control('text').fill('qqzzxxqq');
  await eventually(async () => await t.box.locator('.ht-empty').isVisible(), 'no empty line for a filter nothing passes');
  assert.equal(await t.status(), '');
  await t.control('text').fill('');
  await eventually(async () => (await t.total()) === n, 'clearing the text restores the rows');
}

// Copy as CSV: the filtered rows, in the table's sort order, the header first.
async function copyFiltered(page, t, scope) {
  const city = partialCity(scope);
  const want = applyFilters(scope, { text: city });
  await t.control('text').fill(city);
  await t.control('sort').selectOption('name');
  await eventually(async () => (await t.total()) === want.length, 'the filter has been applied');
  const ids = await t.shownIds();
  await t.box.locator('button[data-copy]').click();
  await eventually(() => page.evaluate(() => window.__clip !== undefined), 'nothing was copied');
  const lines = (await page.evaluate(() => window.__clip)).split('\r\n').filter(Boolean);
  assert.ok(lines[0].startsWith('CCN,'), 'the file has its header');
  assert.equal(lines.length - 1, want.length, 'one line for each filtered hospital');
  assert.ok(want.length < scope.length, 'the filter cut some hospitals out');
  ids.forEach((id, i) => assert.ok(lines[i + 1].startsWith(`${id},`), 'the copied lines follow the table\'s order'));
  assert.match(await t.box.locator('[data-copy-status]').innerText(), /\S/, 'the copy says how it went');
}

describe('place page hospitals table', () => {
  const tabs = useContext(shared);
  before(() => stubClipboard(tabs.context));

  it('the rows come in once, near the table; the filters, sort and pager work; Copy follows the filtered order', () => withPage(tabs, { path: BIG.url, watched: true }, async (page, { seen }) => {
    const t = table(page, '.ph', 'ph');
    assert.equal(await fetchesOf(page, 'place-rows'), 0, 'no rows asset at the top of the page');
    assert.equal(await t.rows.count(), PAGE_SIZE, 'the first page is in the page');
    assert.equal(await t.box.locator('.ph__controls').isHidden(), true, 'the controls wait for the rows');
    assert.equal(await t.box.locator('.ph__more').isVisible(), true, 'the CSV line stands in meanwhile');
    await t.open();
    await eventually(async () => (await fetchesOf(page, 'place-rows')) === 1, 'the rows asset is not fetched once near the table');
    assert.equal(await t.box.locator('.ph__more').isHidden(), true, 'the CSV line goes once the rows are in');
    assert.equal(await t.control('state').count(), 0, 'a state has no state filter');
    await exerciseTable(page, t, BIG.hospitals, { state: null });
    await copyFiltered(page, t, BIG.hospitals);
    assert.equal(await fetchesOf(page, 'place-rows'), 1, 'still one fetch of the rows');
    await assertQuiet(seen, 'place table');
  }));

  it('a metro across states filters by state', () => withPage(tabs, { path: METRO.url, watched: true }, async (page, { seen }) => {
    const t = table(page, '.ph', 'ph');
    await t.open();
    const code = METRO.states[METRO.states.length - 1];
    await exerciseTable(page, t, METRO.hospitals, { state: code });
    await t.control('state').selectOption(code);
    await eventually(async () => (await t.total()) === METRO.hospitals.filter((h) => h.st === code).length, 'the state filter');
    const places = await t.box.locator('table.ph__table tbody tr th .nb__place').allInnerTexts();
    assert.ok(places.every((x) => new RegExp(`${code} · CCN`).test(x)), 'only that state\'s hospitals show');
    await assertQuiet(seen, 'metro place table');
  }));

  it('a place that fits one page fetches no rows and has no pager', () => withPage(tabs, { path: SMALL.url, watched: true }, async (page, { seen }) => {
    const t = table(page, '.ph', 'ph');
    await t.box.scrollIntoViewIfNeeded();
    await t.box.locator('button[data-copy]').waitFor({ state: 'visible' }); // the script has run: it would have asked for the rows by now
    assert.equal(await fetchesOf(page, 'place-rows'), 0, 'no rows asset');
    assert.equal(await t.rows.count(), SMALL.hospitals.length, 'every hospital is in the page');
    assert.equal(await t.box.locator('[data-next]').isHidden(), true, 'no pager');
    await assertQuiet(seen, 'small place table');
  }));
});

describe('the Every hospital explorer', () => {
  const tabs = useContext(shared);
  before(() => stubClipboard(tabs.context));

  it('is hidden until near, then fetches the rows once and works like a place table', () => withPage(tabs, { path: HRRP_PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const t = table(page, '#explore-table', 'ex');
    assert.equal(await fetchesOf(page, 'place-rows'), 0, 'no rows asset at the top');
    assert.equal(await t.box.isHidden(), true, 'the table waits');
    assert.equal(await page.locator('.ht-nojs').isHidden(), true, 'the needs-JavaScript sentence goes as soon as the script runs');
    assert.match(await page.locator('#ex-note').innerText(), /Loading/, 'a loading line stands in meanwhile');
    await page.locator('#explore').scrollIntoViewIfNeeded();
    await t.box.waitFor({ state: 'visible' });
    await eventually(async () => (await fetchesOf(page, 'place-rows')) === 1, 'the rows asset is not fetched once near the explorer');
    assert.equal(await page.locator('#ex-note').innerText(), '', 'the loading line goes');
    await exerciseTable(page, t, HOSPITALS, { state: BIG.hospitals[0].st });
    // Teaching, beds and location together.
    const picks = { teach: 'major', beds: '500+', loc: 'urban' };
    for (const [id, v] of Object.entries(picks)) await t.control(id).selectOption(v);
    const want = applyFilters(HOSPITALS, { teach: picks.teach, beds: picks.beds, urban: picks.loc === 'urban' });
    await eventually(async () => (await t.total()) === want.length, 'teaching, beds and location together');
    for (const id of Object.keys(picks)) await t.control(id).selectOption('');
    await eventually(async () => (await t.total()) === HOSPITALS.length, 'the filters clear');
    await copyFiltered(page, t, HOSPITALS);
    // The download is the copy, saved as a file named for the filtered rows.
    const copied = await page.evaluate(() => window.__clip);
    const [download] = await Promise.all([page.waitForEvent('download'), t.box.locator('button[data-download]').click()]);
    assert.ok(download.suggestedFilename().endsWith('-hospitals-filtered.csv'), 'the file is named as filtered');
    assert.equal(await readFile(await download.path(), 'utf8'), copied, 'the file holds the copied rows');
    assert.equal(await fetchesOf(page, 'place-rows'), 1, 'still one fetch');
    await assertQuiet(seen, 'explorer');
  }));
});

describe('the explorer when the rows do not come', () => {
  const tabs = useContext(shared);
  const ROWS = /\/assets\/hrrp-place-rows\.[^/]+\.json$/;
  const CSV = /\/data\/hrrp\/fy\d+\/hrrp-fy\d+-hospitals\.csv$/;

  it('says it did not load, tries again on a touch of that line, and then loads', () => withPage(tabs, { path: HRRP_PROGRAM_PATH }, async (page) => {
    let fail = true;
    await page.route(ROWS, (route) => (fail ? route.fulfill({ status: 503, body: '' }) : route.continue()));
    const note = page.locator('#ex-note');
    await page.locator('#explore').scrollIntoViewIfNeeded();
    await eventually(async () => /try again/.test(await note.innerText()), 'the failure is said');
    assert.doesNotMatch(await note.innerText(), /reload/i, 'the words match the behavior: a touch, not a reload');
    assert.equal(await page.locator('#explore-table').isHidden(), true, 'the table stays hidden');
    assert.equal(await page.locator('.ht-nojs').isHidden(), true, 'the needs-JavaScript sentence is not shown to a reader with the script');
    fail = false;
    await note.click();
    await page.locator('#explore-table').waitFor({ state: 'visible' });
    assert.equal(await note.innerText(), '', 'the line clears once the rows are in');
  }));

  it('a failed filtered download says so, and the whole list stays a visible link', () => withPage(tabs, { path: HRRP_PROGRAM_PATH }, async (page) => {
    const t = table(page, '#explore-table', 'ex');
    await page.locator('#explore').scrollIntoViewIfNeeded();
    await t.box.waitFor({ state: 'visible' });
    await page.route(CSV, (route) => route.fulfill({ status: 503, body: '' }));
    const whole = t.box.locator('a.fig__btn[download]');
    assert.equal(await whole.isVisible(), true, 'the whole list is a visible link beside the download button');
    await t.box.locator('button[data-download]').click();
    await eventually(async () => /could not be downloaded/.test(await t.box.locator('[data-copy-status]').innerText()), 'the failure is said');
    assert.equal(await whole.isVisible(), true, 'the link is still there');
  }));
});

describe('at 360 px', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, { width: 360 });

  it('a place page with its table loaded does not scroll sideways', () => withPage(tabs, { path: BIG.url, watched: true }, async (page, { seen }) => {
    await assertNoSideways(page, 'place page');
    await table(page, '.ph', 'ph').open();
    await assertNoSideways(page, 'place page with its table loaded');
    await assertQuiet(seen, 'place page at 360');
  }));

  it('the explorer loaded does not scroll sideways', () => withPage(tabs, { path: HRRP_PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await page.locator('#explore').scrollIntoViewIfNeeded();
    await table(page, '#explore-table', 'ex').box.waitFor({ state: 'visible' });
    await assertNoSideways(page, 'explorer');
    await assertQuiet(seen, 'explorer at 360');
  }));

  it('a one-hospital-page place does not scroll sideways', () => withPage(tabs, { path: SMALL.url }, async (page) => {
    await assertNoSideways(page, 'small place');
  }));
});
