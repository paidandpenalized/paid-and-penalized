// The Readmissions program page's controls in a real browser: the hero search, Worksheet R's hospital swap (the sheet and the
// waterfall under it change hospital and the waterfall stays wired), Step 2's condition switch (the other five conditions
// load lazily, in one fetch), the map's measure switch, hospital dots and "Every state" pager; and at 360 px, no sideways
// scroll and no console error. Hospitals are picked by property (hrrp-pick.js), never named. Runs against dist/ or any URL; see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../web/client/search.js';
import { CONDS } from '../../engine/js/hrrp/formula.js';
import { HRRP_PROGRAM_PATH, HOSPITALS, bigState, pathOf, statesCount, swapSamples } from './hrrp-pick.js';
import { METHODS_PATH } from '../../sites/hrrp/web/links.js';
import { STATES_PAGE_SIZE } from '../../sites/hrrp/web/constants.js';
import { CONCURRENCY, assertNoSideways, assertQuiet, eventually, fetchesOf, searchIn, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();
const PATH = HRRP_PROGRAM_PATH;
const OPEN = HOSPITALS.find((h) => h.paf < 1 && h.pen != null);

// A query typed whole into the box, then Enter once the search lists something.
async function typeAndEnter(input, list, query) {
  await input.fill(query);
  await eventually(async () => (await list.count()) > 0 && (await input.getAttribute('aria-expanded')) === 'true', 'the search lists nothing for the query');
  await input.press('Enter');
}

// The hospital's CCN typed into the box lists exactly that hospital (its option's title is the hospital's name).
async function listsHospital(input, options, h) {
  await input.fill(h.id);
  await eventually(async () => (await options.count()) === 1, 'a CCN does not list exactly one option');
  assert.equal(normalize(await options.first().locator('.omni__t').textContent()), normalize(h.name), 'the option is the hospital');
}

describe('hero search', () => {
  const tabs = useContext(shared);

  it('a hospital found by its CCN is listed, and Enter opens its page', () => withPage(tabs, { path: PATH, watched: true }, async (page, { seen }) => {
    const form = page.locator('#hero');
    await form.waitFor({ state: 'visible' });
    const input = page.locator('#hero-q');
    await listsHospital(input, form.getByRole('option'), OPEN);
    await input.press('Enter');
    await page.waitForURL((url) => url.pathname === pathOf(OPEN), { timeout: 10000 });
    await assertQuiet(seen, 'hero search');
  }));

  it('a state name lists a place, and Enter opens its page', () => withPage(tabs, { path: PATH }, async (page) => {
    const input = page.locator('#hero-q');
    await input.waitFor({ state: 'visible' });
    await typeAndEnter(input, page.locator('#hero-list').getByRole('option'), OPEN.st);
    await page.waitForURL((url) => url.pathname.startsWith(PATH) && url.pathname !== PATH, { timeout: 10000 });
  }));

  it('a query nothing matches lists no option', () => withPage(tabs, { path: PATH }, async (page) => {
    const input = page.locator('#hero-q');
    await input.waitFor({ state: 'visible' });
    await input.fill('qqzzxxqq');
    await eventually(async () => (await input.getAttribute('aria-expanded')) !== null && (await page.locator('#hero .vh[role="status"]').textContent()).length > 0, 'the search says nothing for a query with no match');
    assert.equal(await page.locator('#hero-list').getByRole('option').count(), 0, 'no option listed');
  }));
});

describe('the top-bar search on the other pages', () => {
  const tabs = useContext(shared);
  const pages = [['a hospital page', pathOf(OPEN)], ['a place page', bigState().url], ['Methods', METHODS_PATH]];

  for (const [where, path] of pages) {
    it(`${where}: the hospitals index waits for the box, then a CCN lists its hospital`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
      const { box, list } = searchIn(page, '.topbar');
      await box.waitFor({ state: 'visible' });
      assert.equal(await fetchesOf(page, 'hrrp-hospitals'), 0, 'nothing is fetched before the box is used');
      await listsHospital(box, list, OPEN);
      assert.equal(await fetchesOf(page, 'hrrp-hospitals'), 1, 'the index is fetched once');
      await assertQuiet(seen, 'top-bar search');
    }));
  }
});

describe('Worksheet R hospital swap', () => {
  const tabs = useContext(shared);
  const sheetId = (page) => page.locator('.wsr-holder .wsr__id').innerText();
  const caption = (page) => page.locator('.wf-holder .fig__cap').textContent();
  // The waterfall as a reader meets it: its chart takes the keyboard, its table sorts, its CSV button is there.
  const wired = (page) => page.evaluate(() => {
    const fig = document.querySelector('.wf-holder figure');
    return {
      wired: fig.hasAttribute('data-wired'),
      focusable: [...fig.querySelectorAll('svg.chart')].some((s) => s.getAttribute('tabindex') === '0'),
      sorts: fig.querySelectorAll('.fig__sort').length,
      csv: !fig.querySelector('[data-figure-csv]').hidden,
    };
  });

  it('picking a hospital changes the sheet and the waterfall, which stay wired (twice over)', () => withPage(tabs, { path: PATH, watched: true }, async (page, { seen }) => {
    const input = page.locator('#ws-pick-q');
    await input.scrollIntoViewIfNeeded();
    const before = { id: await sheetId(page), cap: await caption(page), figure: await page.locator('.wf-holder').getAttribute('data-figure-n') };
    const w0 = await wired(page);
    assert.ok(w0.wired && w0.focusable && w0.sorts > 0 && w0.csv, 'the waterfall starts wired');
    const exampleId = (await page.locator('.wsr-holder .wsr__id a').getAttribute('href')).split('/').filter(Boolean).pop();
    let last = before;
    for (const h of swapSamples(exampleId)) {
      await listsHospital(input, page.locator('#ws-pick-list').getByRole('option'), h);
      await input.press('Enter');
      await eventually(async () => (await page.locator('.wsr-holder .wsr__id a').getAttribute('href')) === pathOf(h), 'the sheet did not change to the picked hospital');
      assert.ok((await sheetId(page)) !== last.id, 'the sheet\'s identity block changed');
      assert.notEqual(await caption(page), last.cap, 'the waterfall\'s caption changed with the hospital');
      assert.equal(await page.locator('.wf-holder').getAttribute('data-figure-n'), before.figure, 'the waterfall keeps its figure number');
      assert.match(await caption(page), new RegExp(`^\\s*Figure ${before.figure}\\.`), 'the caption keeps its figure number');
      const w = await wired(page);
      assert.ok(w.wired && w.focusable && w.sorts > 0 && w.csv, `the waterfall is wired after the swap: ${JSON.stringify(w)}`);
      assert.match(await page.locator('.wsr-pick__status[role="status"]').innerText(), /now shows that hospital/, 'the swap is announced');
      last = { id: await sheetId(page), cap: await caption(page) };
    }
    // The swapped-in table sorts, and the CSV button saves the figure's file.
    const fig = page.locator('.wf-holder figure');
    await fig.locator('details > summary').first().click();
    const heads = fig.locator('.fig__table th');
    const first = fig.locator('.fig__table tbody tr').first();
    const rows = await fig.locator('.fig__table tbody tr').count();
    assert.ok(rows > 1, 'the waterfall table has rows');
    const order = () => fig.locator('.fig__table tbody tr th, .fig__table tbody tr td:first-child').allInnerTexts();
    const was = await order();
    for (let dir = 0; dir < 2; dir++) await heads.first().locator('.fig__sort').click();
    assert.equal(await heads.first().getAttribute('aria-sort'), 'descending', 'the second click sorts the column the other way');
    assert.notDeepEqual(await order(), was, 'sorting reorders the rows');
    assert.ok(await first.isVisible(), 'the table shows');
    const [download] = await Promise.all([page.waitForEvent('download'), fig.locator('[data-figure-csv]').click()]);
    assert.equal(download.suggestedFilename(), await fig.locator('[data-figure-csv]').getAttribute('data-figure-csv'), 'the CSV is named as the button says');
    await assertQuiet(seen, 'worksheet swap');
  }));

  it('a CCN the asset does not hold leaves the example in place', () => withPage(tabs, { path: PATH }, async (page) => {
    const input = page.locator('#ws-pick-q');
    await input.scrollIntoViewIfNeeded();
    const before = await sheetId(page);
    await input.fill('qqzzxxqq');
    await input.press('Enter');
    await page.locator('#ws-pick-list .omni__empty').waitFor({ state: 'visible' }); // the search has answered "no matches"
    assert.equal(await sheetId(page), before, 'the sheet is unchanged');
  }));
});

describe('Step 2 condition switch', () => {
  const tabs = useContext(shared);
  const visiblePanels = (page) => page.evaluate(() => [...document.querySelectorAll('.swarm__m')].filter((e) => !e.hidden).map((e) => e.dataset.cond));

  it('each condition shows its own swarm and caption, and the other five load in one fetch', () => withPage(tabs, { path: PATH, watched: true }, async (page, { seen }) => {
    const buttons = page.locator('.swarm__controls button[data-cond]');
    assert.deepEqual(await buttons.evaluateAll((els) => els.map((e) => e.dataset.cond).sort()), [...CONDS].sort(), 'a button for each condition');
    assert.equal(await page.locator('.swarm__m').count(), 1, 'the page opens with one condition drawn');
    assert.equal(await fetchesOf(page, 'hrrp-swarm'), 0, 'nothing is fetched before a switch');
    const start = (await visiblePanels(page))[0];
    const order = [...CONDS.filter((k) => k !== start), start, ...CONDS];
    for (const cond of order) {
      await page.locator(`.swarm__controls button[data-cond="${cond}"]`).click();
      await eventually(async () => (await visiblePanels(page)).join() === cond, `the ${cond} swarm is not the only one shown`);
      assert.equal(await page.locator('.swarm__controls button[aria-pressed="true"]').getAttribute('data-cond'), cond, 'the pressed button is the condition');
      const panel = page.locator(`.swarm__m[data-cond="${cond}"]`);
      const takeaway = await panel.getAttribute('data-takeaway');
      assert.ok(takeaway, 'a panel states its takeaway');
      assert.ok((await page.locator('figure:has(.swarm) > figcaption').textContent()).includes(takeaway), 'the caption says the shown condition\'s takeaway');
      assert.ok(await panel.evaluate((el) => [...el.querySelectorAll('svg.chart--swarm')].some((svg) => svg.getBoundingClientRect().width > 0)), 'the shown swarm is drawn');
    }
    assert.equal(await page.locator('.swarm__m').count(), CONDS.length, 'all six are in the page');
    assert.equal(await fetchesOf(page, 'hrrp-swarm'), 1, 'the other five came in one fetch');
    await assertQuiet(seen, 'swarm switch');
  }));
});

describe('map', () => {
  const tabs = useContext(shared);
  const MEASURES = ['avg', 'share', 'dollars', 'ge1'];
  const shown = (page) => page.evaluate(() => [...document.querySelectorAll('.usmap__m')].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0).map((e) => e.dataset.measure));

  it('the measure buttons press one at a time and show one map', () => withPage(tabs, { path: PATH, watched: true }, async (page, { seen }) => {
    const box = page.locator('.usmap').first();
    assert.equal(await box.locator('.usmap__controls').isVisible(), true, 'the controls are offered');
    assert.deepEqual(await shown(page), ['avg'], 'the average cut opens');
    for (const measure of [...MEASURES.slice(1), 'avg']) {
      await box.locator(`.usmap__modes button[data-measure="${measure}"]`).click();
      assert.deepEqual(await shown(page), [measure], `the ${measure} map shows alone`);
      assert.deepEqual(await box.locator('.usmap__modes button').evaluateAll((bs) => bs.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.measure)), [measure], 'one button pressed');
      assert.equal(await box.getAttribute('data-measure'), measure, 'the box takes the pick');
    }
    await assertQuiet(seen, 'map measures');
  }));

  it('the dots checkbox turns the dot layer on and off', () => withPage(tabs, { path: PATH }, async (page) => {
    const box = page.locator('.usmap').first();
    const dots = box.locator('input[data-dots]');
    assert.equal(await dots.isChecked(), false, 'dots start off');
    assert.equal(await box.getAttribute('data-dots'), 'off');
    await dots.check();
    assert.equal(await box.getAttribute('data-dots'), 'on', 'checked: dots on');
    await dots.uncheck();
    assert.equal(await box.getAttribute('data-dots'), 'off', 'unchecked: dots off');
  }));

  it('"Every state" pages by STATES_PAGE_SIZE', () => withPage(tabs, { path: PATH }, async (page) => {
    const pages = Math.ceil(statesCount() / STATES_PAGE_SIZE);
    const pager = page.locator('.states__pager');
    assert.equal(await pager.isVisible(), true, 'the pager is offered');
    assert.equal(await pager.locator('button').count(), pages, 'a button for each page');
    const rows = () => page.locator('table.states__table tbody:not([hidden]) tr');
    const names = () => rows().locator('th a').allInnerTexts();
    assert.equal(await rows().count(), STATES_PAGE_SIZE, 'a full page shows');
    const first = await names();
    await pager.getByRole('button', { name: 'Page 2' }).click();
    assert.equal(await rows().count(), Math.min(STATES_PAGE_SIZE, statesCount() - STATES_PAGE_SIZE), 'page 2 shows its rows');
    assert.notDeepEqual(await names(), first, 'page 2 lists other states');
    assert.equal(await pager.locator('button[aria-pressed="true"]').textContent(), 'Page 2');
    await pager.getByRole('button', { name: `Page ${pages}` }).click();
    assert.equal(await rows().count(), statesCount() - (pages - 1) * STATES_PAGE_SIZE, 'the last page shows the rest');
    await pager.getByRole('button', { name: 'Page 1' }).click();
    assert.deepEqual(await names(), first, 'page 1 again');
  }));
});

describe('at 360 px', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, { width: 360 });

  it('the program page does not scroll sideways, hides the dots checkbox and shows the shading', () => withPage(tabs, { path: PATH, watched: true }, async (page, { seen }) => {
    await assertNoSideways(page, 'program page');
    const box = page.locator('.usmap').first();
    assert.equal(await box.locator('.usmap__dotsbtn').isHidden(), true, 'no dots checkbox on a phone');
    for (const measure of ['dollars', 'ge1']) {
      await box.locator(`.usmap__modes button[data-measure="${measure}"]`).click();
      await assertNoSideways(page, `map ${measure}`);
    }
    await page.locator('.swarm__controls button[data-cond]').nth(2).click();
    await assertNoSideways(page, 'swarm switched');
    await assertQuiet(seen, 'program page at 360');
  }));
});
