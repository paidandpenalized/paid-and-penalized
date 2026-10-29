// The axe run's controls and the page states the per-page run (pages.test.js) does not reach: axe flags what it should
// and reports text it cannot judge, the paper it judges text on is the grain's measured worst, the program page passes
// with its search list open, and the tables that stack on a phone keep their column heads. axe.js has how a page is
// judged. Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_PATH, METHODS_PATH } from '../ci/page-types.js';
import { AXE_WIDTHS, audit, grainWorst, runAxe } from './axe.js';
import { CONCURRENCY, SCHEMES, SEARCH_BOXES, searchIn, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();

describe('axe finds what it should (a positive control)', () => {
  // A page of our own in a context like the real ones, audited the way the real pages are.
  async function control(body) {
    const context = await shared.browser.newContext();
    try {
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html lang="en"><title>control</title><main><h1>control</h1>${body}</main>`);
      return await runAxe(page);
    } finally {
      await context.close();
    }
  }
  const GIF = 'url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)';

  it('flags a missing alternative, a nameless button and low contrast', async () => {
    const { violations, passes } = await control(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><button></button><p style="color:#ccc;background:#fff">faint words</p>`);
    assert.ok(passes > 0, 'axe checked rules');
    const ids = violations.map((v) => v.id);
    for (const id of ['image-alt', 'button-name', 'color-contrast']) assert.ok(ids.includes(id), `${id} not among ${ids}`);
  });

  it('reports text over an image, a gradient or under a pseudo-element as unjudged (what flatten exists to avoid)', async () => {
    const { unjudgedDrawnOver } = await control(`<style>#over { position: relative } #over::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 100%; background: linear-gradient(to right, transparent, #fff) }</style>
<p id="img" style="background-image:${GIF}">over an image</p><p id="grad" style="background-image:linear-gradient(#fff,#ddd)">over a gradient</p><p id="over">under a pseudo-element</p>`);
    assert.deepEqual(unjudgedDrawnOver.sort(), ['#grad', '#img', '#over']);
  });
});

// The colour the run lays under the text is measured, not the flat paper: the grain darkens the light paper and lightens
// the dark one. Both colours are printed with the run.
describe('the paper axe judges text on is the grain\'s worst pixel', () => {
  const total = (rgb) => rgb.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b);
  const tabs = useContext(shared);
  for (const scheme of SCHEMES) {
    it(scheme, (t) => withPage(tabs, { path: '/', scheme }, async (page) => {
      const { paper, worst } = await grainWorst(page);
      t.diagnostic(`${scheme}: the paper is ${paper}; the grain's worst pixel for text is ${worst}`);
      assert.notEqual(worst, paper, 'the grain changes the paper');
      if (scheme === 'light') assert.ok(total(worst) < total(paper), `the light paper's worst pixel ${worst} is darker than ${paper}`);
      else assert.ok(total(worst) > total(paper), `the dark paper's worst pixel ${worst} is lighter than ${paper}`);
    }));
  }
});

// The list the search shows under its box, open with the first match active: in the top bar, and in the program page's
// hero (the larger box, on top of the page's own content).
for (const scheme of SCHEMES) {
  for (const width of AXE_WIDTHS) {
    describe(`the program page with a search list open, ${scheme}, ${width} px wide`, { concurrency: CONCURRENCY }, () => {
      const tabs = useContext(shared, { width });
      for (const [where, container] of SEARCH_BOXES) {
        it(`in ${where}`, () => withPage(tabs, { path: PROGRAM_PATH, scheme }, async (page) => {
          const { box, list } = searchIn(page, container);
          // On a phone the bar's search is behind the find button, which opens it as a row under the bar.
          const find = page.locator(`${container} .fam__find`);
          if (await find.isVisible()) await find.click();
          await box.pressSequentially('hosp');
          await list.first().waitFor();
          await box.press('ArrowDown');
          await audit(page, `${PROGRAM_PATH} with the list open in ${where}`);
        }));
      }
    });
  }
}

// Below 600 px three Methods tables stack their rows and clip their column heads (sites/hacrp/web/styles.css). A head
// removed with display: none would leave the stacked cells without the names axe never asks for. Playwright's snapshot of
// the accessibility tree leaves out what is display: none and keeps what is only clipped, in every engine; it models the
// tree from the page rather than reading the browser's own (Chrome's real tree, read through the protocol, has the heads
// too, and loses them with display: none). Each table must show every head it has, and a control shows the check bite.
describe('the tables that stack on a phone keep their column heads', () => {
  const STACKED = ['.receipt--dollars table', 'table.takes', 'table.receipts'];
  const heads = async (table) => ((await table.ariaSnapshot()).match(/^\s*- columnheader\b/gm) ?? []).length;
  const tabs = useContext(shared, { width: 390 });

  it('on the Methods page, each one, and the control', () => withPage(tabs, { path: METHODS_PATH }, async (page) => {
    for (const selector of STACKED) {
      const table = page.locator(selector);
      const expected = await table.locator('thead th').count();
      assert.ok(expected >= 3, `${selector} has its column heads in the markup`);
      assert.equal(await heads(table), expected, `${selector}: column heads in the accessibility tree`);
    }
    // The control: one table's head removed the way the page once did.
    const [first] = STACKED;
    await page.locator(`${first} thead`).evaluate((thead) => thead.style.setProperty('display', 'none', 'important'));
    assert.equal(await heads(page.locator(first)), 0, `${first}: the check does not see a head removed with display: none`);
  }));
});
