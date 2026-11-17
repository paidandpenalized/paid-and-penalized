// The pages of hospitals outside Medicare's penalty programs (hub/hospital/outside.js), and the family search that finds
// them, in a real browser: on a critical access hospital's page (which has the nearest section) and a VA hospital's (which
// does not), at a desktop's width and a phone's, light then dark by the theme button: the page is quiet and axe finds
// nothing, the stamp shows with its words, the US map of hospitals like it is drawn, and the nearest table sticks on a
// desktop and not on a phone (the VA page has no nearest section). The search lists the critical access hospital with its
// kind and Enter opens its page, on a desktop and by the phone's find button; the tabs on its page carry it to the
// program folders, where no chip appears. Runs against dist/ (make build) or any URL; see site.js. CI's logs are public,
// so no message here prints a hospital's name, CCN or figure.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_PATH } from '../ci/page-types.js';
import { audit } from './axe.js';
import { CONCURRENCY, assertNoSideways, assertQuiet, settle, useBrowser, useContext, withPage } from './lib.js';
import { hubModel } from '../../hub/data.js';
import { outsideHospitalSample } from './site.js';

const shared = useBrowser();
const CAH = outsideHospitalSample('hub-hospital-outside-cah');
const FEDERAL = outsideHospitalSample('hub-hospital-outside-federal');
const STAMP = 'Not in Medicare’s penalty programs';
const WIDTHS = [['a desktop', 1280], ['a phone', 390]];
const squash = (text) => text.replace(/\s+/g, ' ').trim();

for (const [where, width] of WIDTHS) {
  describe(`outside the penalty programs, on ${where}`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, options: width < 600 ? { hasTouch: true, isMobile: true } : {} });

    // One page load for each theme: axe's flattening (axe.js) fixes the paper's colour for the page it ran on, so the dark
    // page is the light one after the theme button, on a page of its own.
    for (const sample of [CAH, FEDERAL]) {
      for (const scheme of ['light', 'dark']) {
        it(`${sample.type}, ${scheme}: quiet and axe-clean, with its stamp and map; the nearest table ${sample === CAH ? (width >= 720 ? 'sticks' : 'does not stick') : 'is not there'}`, () => withPage(tabs, { path: sample.path, watched: true }, async (page, { seen }) => {
          if (scheme === 'dark') {
            await page.locator('.theme-toggle:visible').click();
            assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the theme button sets dark');
            // The colours glide to the dark ones; axe judges the finished page.
            await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished' || a.effect?.getTiming().iterations === Infinity));
            await settle(page);
          }
          const stamp = page.locator('#hh-status-h');
          assert.equal(await stamp.isVisible(), true, 'the stamp shows');
          assert.ok(squash(await stamp.textContent()) === STAMP, 'the stamp\'s words');
          assert.ok(await page.locator('.hh__likei svg').first().isVisible(), 'the US map shows');
          const near = page.locator('.hh__near');
          if (sample === CAH) {
            assert.equal(await near.count(), 1, 'the nearest section');
            assert.ok(await page.locator('.hh__near table').count() > 0, 'the nearest table');
            const position = await page.locator('.hh__neartab').evaluate((el) => getComputedStyle(el).position);
            assert.equal(position, width >= 720 ? 'sticky' : 'static', 'the nearest table\'s position');
          } else {
            assert.equal(await near.count(), 0, 'no nearest section');
          }
          await assertNoSideways(page, 'the page');
          await audit(page, `${sample.type} at ${width} px, ${scheme}`);
          await assertQuiet(seen, `${sample.type} at ${width} px, ${scheme}`);
        }));
      }
    }
  });
}

describe('the family search finds a hospital outside the penalty programs', { concurrency: CONCURRENCY }, () => {
  const desktop = useContext(shared, { width: 1280 });
  const phone = useContext(shared, { width: 390, options: { hasTouch: true, isMobile: true } });
  const name = CAH.hospital.name;
  // A distinctive part of the name: its longest word.
  const word = name.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');

  // Types the word in the form's box, moves to the option for the sample (its title is the name) by the arrow keys, checks that
  // option shows its kind (and, in a box with a state, the state), and presses Enter; resolves once the sample's page has opened.
  async function findAndOpen(page, form, what) {
    const box = form.getByRole('combobox');
    await box.focus();
    await box.pressSequentially(word);
    const options = form.getByRole('option');
    await options.first().waitFor();
    const titles = await options.evaluateAll((els) => els.map((el) => el.querySelector('.omni__t')?.textContent ?? ''));
    const at = titles.findIndex((t) => t === name);
    assert.ok(at >= 0, `${what}: the hospital is listed`);
    const picked = options.nth(at);
    assert.ok((await picked.locator('.omni__k').textContent()).trim().length > 0, `${what}: the option shows its kind`);
    assert.ok(/\b[A-Z]{2}\b/.test(await picked.locator('.omni__s').textContent()), `${what}: the option names its state`);
    for (let i = 0; i < titles.length && await picked.getAttribute('aria-selected') !== 'true'; i++) await box.press('ArrowDown');
    assert.ok(await picked.getAttribute('aria-selected') === 'true', `${what}: the option is the active one`);
    await box.press('Enter');
    await page.waitForURL((url) => url.pathname === CAH.path);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#hh-status-h').isVisible(), true, `${what}: its page opened, with the stamp`);
  }

  it('typing part of its name lists it with its kind, and Enter opens its page', () => withPage(desktop, { path: '/', watched: true }, async (page, { seen }) => {
    await findAndOpen(page, page.locator('.topbar form#omni[data-hub]'), 'the desktop search');
    await assertQuiet(seen, 'search to an outside hospital');
  }));

  it('on a phone the find button opens the search, and Enter opens its page', () => withPage(phone, { path: '/', watched: true }, async (page, { seen }) => {
    await page.locator('.fam__find').click();
    await findAndOpen(page, page.locator('.fam__end form#omni'), 'the phone search');
    await assertQuiet(seen, 'phone search to an outside hospital');
  }));

  // The chip a followed hospital shows on a program's folder (the shell, from the hub's asset), which an estimated hospital
  // has and an outside one has not: proved on the estimated one first, so the selector is known to find it when it shows.
  const ESTIMATED = hubModel().hospitals.find((h) => h.est);
  const chipOn = async (page) => {
    await page.waitForLoadState('networkidle');
    return page.locator('[data-chip]');
  };

  it('the tabs on its page carry it to each program folder, which shows no chip and nothing wrong; the wordmark likewise', () => withPage(desktop, { path: CAH.path, watched: true }, async (page, { seen }) => {
    const ccn = await page.locator('.topbar').getAttribute('data-hospital');
    assert.ok(ccn && CAH.path.includes(ccn.toLowerCase()), 'the header names the page\'s hospital');
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('.tabs__scroll a')].map((a) => a.getAttribute('href')));
    const folders = hrefs.filter((h) => h !== CAH.path);
    assert.ok(folders.length >= 3 && folders.every((h) => h.endsWith(`?h=${ccn}`)), 'every folder tab carries the hospital');
    const hacrp = folders.find((h) => h.startsWith('/hacrp/'));
    assert.ok(hacrp, 'a HACRP tab');
    assert.ok(hacrp.split('?')[0] === '/hacrp/', 'the HACRP tab opens the program folder, not a hospital page');
    const wordmark = await page.locator('a.wordmark').getAttribute('href');
    assert.ok(wordmark === `/?h=${ccn}`, 'the wordmark carries the hospital');
    await assertQuiet(seen, 'the outside hospital\'s page');

    // The selector finds the chip where a hospital in the programs is followed.
    await withPage(desktop, { path: `${PROGRAM_PATH}?h=${ESTIMATED.ccn}`, watched: true }, async (opened, { seen: now }) => {
      const chip = await chipOn(opened);
      assert.equal(await chip.count(), 1, 'the chip exists for an estimated hospital');
      await chip.waitFor({ state: 'visible' });
      await assertQuiet(now, 'a followed estimated hospital');
    });
    for (const [what, href] of [['the HACRP tab', hacrp], ['the home link', wordmark]]) {
      await withPage(desktop, { path: href, watched: true }, async (opened, { seen: now }) => {
        const chip = await chipOn(opened);
        assert.equal(await chip.count(), 1, `${what}: the chip element is in the page`);
        assert.equal(await chip.isHidden(), true, `${what}: no chip appears`);
        await assertQuiet(now, what);
      });
    }
  }));
});
