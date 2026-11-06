// A Readmissions hospital page's controls in a real browser: the what-if (a slider moves the hypothetical cut as the engine
// works it out from the page's own embedded data, Reset puts it back, "Bring all to median" reaches no cut even from a
// ratio a hair over its median) and the area table's pager; and at 360 px, no sideways scroll and no console error. Hospitals are picked by
// property (hrrp-pick.js), never named. Runs against dist/ or any URL; see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS, cutPct, isMeasured, peerMedian } from '../../engine/js/hrrp/formula.js';
import { whatIfPaf } from '../../engine/js/hrrp/whatif.js';
import { PAGE_SIZE } from '../../sites/hrrp/web/constants.js';
import { clientHospital } from '../../sites/hrrp/web/figures/whatif-data.js';
import { cutSample, closeSample, embeddedWhatIf, intOf, neighborsSample, noEstimateSample, pathOf } from './hrrp-pick.js';
import { CONCURRENCY, assertNoSideways, assertQuiet, eventually, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();
const CUT = cutSample();
const CLOSE = closeSample();
const f4 = (v) => v.toFixed(4);

// Sets a slider to a value the way a drag does (an input event; a change when the drag ends).
const setRatio = (row, value) => row.locator('input[data-wi="range"]').evaluate((el, v) => {
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, value);
const text = (page, name) => page.locator(`[data-wi="${name}"]`).first().textContent();
const ratioOf = async (row) => Number(await row.locator('input[data-wi="range"]').inputValue());
const result = async (page) => ({ factor: await text(page, 'factor'), cut: await text(page, 'cut'), dollars: await text(page, 'dollars') });

describe('what-if', () => {
  const tabs = useContext(shared);

  it('a slider moves the cut as the engine works it out from the page\'s data; Reset and "Bring all to median" follow', () => withPage(tabs, { path: pathOf(CUT.h), watched: true }, async (page, { seen }) => {
    // The page's own embedded data, not the build's files: what the script computes from.
    const { h, meta } = clientHospital(await embeddedWhatIf(page));
    assert.equal(h.id, CUT.h.id, 'the page embeds this hospital');
    assert.equal(await page.locator('[data-wi="fields"]').evaluate((el) => el.disabled), false, 'the script enabled the sliders');
    assert.equal(await page.locator('[data-wi="nojs"]').isHidden(), true, 'the no-script note is hidden');
    const start = await result(page);
    assert.equal(start.factor, f4(h.paf), 'it starts at CMS\'s factor');
    assert.equal(start.cut, `${cutPct(h.paf).toFixed(2)}%`, 'and CMS\'s cut');
    const parts = page.locator('[data-wi="parts"]');
    const drawn = await parts.innerHTML();

    const row = page.locator(`li[data-cond="${CUT.cond}"]`);
    const was = await ratioOf(row);
    await setRatio(row, peerMedian(meta, h.peer, CUT.cond));
    const moved = await ratioOf(row);
    assert.ok(moved < was, 'the slider moved down');
    const expected = whatIfPaf(h, meta, { [CUT.cond]: moved });
    assert.ok(expected > h.paf, 'the engine says the cut shrinks');
    await eventually(async () => (await text(page, 'factor')) === f4(expected), 'the factor is not the engine\'s for the new ratio');
    assert.equal(await text(page, 'cut'), `${cutPct(expected).toFixed(2)}%`, 'the cut follows');
    assert.notEqual(await parts.innerHTML(), drawn, 'the waterfall is drawn again');
    assert.ok(await page.locator('figure:has([data-hosp-whatif]) > .fig__tip').count() <= 2, 'tooltip layers do not pile up');
    assert.match(await text(page, 'live'), /\S/, 'the live line says the result');

    await page.getByRole('button', { name: 'Reset' }).click();
    await eventually(async () => (await text(page, 'factor')) === start.factor, 'Reset does not restore the factor');
    assert.deepEqual(await result(page), start, 'Reset restores cut and dollars');
    assert.equal(await ratioOf(row), was, 'and the slider');
    assert.equal(await row.locator('[data-wi="val"]').textContent(), h.c[CUT.cond].err.toFixed(3), 'and the ratio\'s words');
    assert.equal(await parts.innerHTML(), drawn, 'and the waterfall');

    // Every measured condition over its median comes to it: no cut, no dollars.
    await page.getByRole('button', { name: 'Bring all to median' }).click();
    const over = Object.fromEntries(CONDS.filter((k) => isMeasured(h.c[k]) && h.c[k].err > peerMedian(meta, h.peer, k)).map((k) => [k, peerMedian(meta, h.peer, k)]));
    assert.ok(Object.keys(over).length > 0, 'the hospital has a condition to bring down');
    const none = whatIfPaf(h, meta, over);
    await eventually(async () => (await text(page, 'factor')) === f4(none), 'the factor is not the engine\'s with every condition at its median');
    assert.equal(none, 1, 'the engine reads no cut');
    assert.equal(await text(page, 'cut'), '0.00%');
    assert.equal(await text(page, 'dollars'), '$0');
    await assertQuiet(seen, 'what-if');
  }));

  it('"Bring all to median" leaves a ratio the reader put under its median, and brings one from under up to it', () => withPage(tabs, { path: pathOf(CUT.h) }, async (page) => {
    const { h, meta } = clientHospital(await embeddedWhatIf(page));
    const med = (k) => peerMedian(meta, h.peer, k);
    const row = page.locator(`li[data-cond="${CUT.cond}"]`);
    await setRatio(row, med(CUT.cond) - 0.1);
    const under = await ratioOf(row);
    await page.getByRole('button', { name: 'Bring all to median' }).click();
    await eventually(async () => Math.abs((await ratioOf(row)) - under) < 0.0015, 'a ratio under the median is kept');
    // A measured condition under its median, dragged over it, comes back to the median.
    const low = CONDS.find((k) => isMeasured(h.c[k]) && med(k) != null && h.c[k].err < med(k) - 0.05);
    if (low) {
      const other = page.locator(`li[data-cond="${low}"]`);
      await setRatio(other, med(low) + 0.1);
      await page.getByRole('button', { name: 'Bring all to median' }).click();
      await eventually(async () => Math.abs((await ratioOf(other)) - med(low)) < 0.0015, 'a ratio dragged over its median comes to it');
    }
  }));

  it('a ratio a hair over its median still reaches no cut with "Bring all to median"', () => withPage(tabs, { path: pathOf(CLOSE.h) }, async (page) => {
    await page.getByRole('button', { name: 'Bring all to median' }).click();
    await eventually(async () => (await text(page, 'factor')) === '1.0000', 'the factor does not reach 1');
    assert.equal(await text(page, 'cut'), '0.00%');
  }));

  it('a hospital with no estimate shows a dash for dollars, before and after a slider moves', () => withPage(tabs, { path: pathOf(noEstimateSample()) }, async (page) => {
    assert.equal(await text(page, 'dollars'), '—');
    const slider = page.locator('input[data-wi="range"]').first();
    await slider.evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await eventually(async () => (await page.locator('[data-wi="parts"]').innerHTML()).length > 0, 'the waterfall is drawn');
    assert.equal(await text(page, 'dollars'), '—');
  }));
});

describe('area table', () => {
  const tabs = useContext(shared);
  const SAMPLE = neighborsSample();
  const pages = Math.ceil(SAMPLE.n / PAGE_SIZE);
  const status = (page) => page.locator('.nb__status').textContent();
  const words = (from, to) => `${from}–${to} of ${SAMPLE.n}`;

  it('opens on the hospital\'s page, and the pager moves through the rest', () => withPage(tabs, { path: pathOf(SAMPLE.h), watched: true }, async (page, { seen }) => {
    const here = Math.ceil(SAMPLE.rank / PAGE_SIZE);
    assert.ok(here > 1, 'the sample ranks past the first page');
    assert.equal(await page.locator('table.nb__table tr.is-current').count(), 1, 'one row is the hospital\'s');
    assert.equal(await page.locator('table.nb__table tr.is-current').isVisible(), true, 'and it shows');
    assert.equal(intOf(await page.locator('table.nb__table tr.is-current td').first().textContent()), SAMPLE.rank, 'at its rank');
    assert.equal(await page.locator('table.nb__table tbody[data-page]:not([hidden]) tr').count(), Math.min(PAGE_SIZE, SAMPLE.n - (here - 1) * PAGE_SIZE));
    assert.equal(await status(page), words((here - 1) * PAGE_SIZE + 1, Math.min(here * PAGE_SIZE, SAMPLE.n)));
    await page.getByRole('button', { name: 'Page 1' }).click();
    assert.equal(intOf(await page.locator('table.nb__table tbody:not([hidden]) tr').first().locator('td').first().textContent()), 1, 'page 1 starts at rank 1');
    assert.equal(await status(page), words(1, PAGE_SIZE));
    await page.getByRole('button', { name: `Page ${pages}` }).click();
    assert.equal(await status(page), words((pages - 1) * PAGE_SIZE + 1, SAMPLE.n));
    assert.equal(intOf(await page.locator('table.nb__table tbody:not([hidden]) tr').first().locator('td').first().textContent()), (pages - 1) * PAGE_SIZE + 1);
    assert.equal(await page.locator('.nb__pager button[aria-pressed="true"]').count(), 1, 'one page button is pressed');
    await assertQuiet(seen, 'area table');
  }));
});

describe('at 360 px', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, { width: 360 });

  for (const [what, path] of [['a hospital with a cut', pathOf(CUT.h)], ['a hospital in a large area', pathOf(neighborsSample().h)]]) {
    it(`${what}: no sideways scroll, with the what-if moved`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
      await assertNoSideways(page, what);
      if (await page.locator('[data-hosp-whatif]').count()) {
        await page.getByRole('button', { name: 'Bring all to median' }).click();
        await assertNoSideways(page, `${what} with the what-if moved`);
      }
      await assertQuiet(seen, `${what} at 360`);
    }));
  }
});
