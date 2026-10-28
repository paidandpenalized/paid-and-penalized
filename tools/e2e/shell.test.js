// The shell's script (web/client/shell.js) in a real browser, on a phone and on a desktop: the sticky header stays
// modest on a phone (at most 132 px, on hub pages, a program page and a hospital's page), every bar holds a search, the
// find button is there exactly when it does and that search opens and closes by touch and by Escape, the followed
// hospital in ?h= fills the chip and points the tabs at it (and a malformed, markup or unknown value changes nothing), a
// hospital's own page shows its chip from the server and its tabs carry it, the chip leaves the bar whole between a
// phone's width and a desktop's, the family search on a hub page opens a state, the theme button flips the theme and
// says so, and the tab row scrolls its current tab into view and fades while more lie to the right.
// Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js. CI's logs are public, so no message or assertion
// here prints a hospital's name, CCN or figure: they say what was checked.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_CODES } from '../../web/client/hub-asset.js';
import { money } from '../../web/client/format.js';
import { tabHref, withFollow } from '../../web/client/follow.js';
import { SITE } from '../../web/site.js';
import { PROGRAM_PATH } from '../ci/page-types.js';
import { CONCURRENCY, assertQuiet, settle, useBrowser, useContext, visit, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();

// The tallest the sticky header (the bar, the program tabs and a program's section menu) may be on a phone: the spec's
// modest total (about 128 px, with room for a pixel's rounding and a taller section menu).
const MAX_STICKY = 132;
// The one-row bar a phone's header has: 50 px, with a pixel for rounding.
const BAR = 51;
const PHONE = { width: 390, height: 844 };

// A hospital's page on a program site (one CMS cut): its header follows the hospital.
const HOSPITAL = samplePages().find((p) => p.type === 'hospital-cut').path;
// A hub page that is plain text (the front page now), another hub page, a placeholder for a program without a site here,
// the program page and a hospital's page there: each wears the same header, [the name a test's title gives it, path].
const PATHS = [['hub page', '/'], ['hub page', SITE.pages.about], ['placeholder', SITE.programs.find((p) => p.id === 'hvbp').path], ['program page', PROGRAM_PATH], ['hospital page', HOSPITAL]];

// Two estimated hospitals from the hub's asset, one Thirty Day Readmissions has and one it does not, as { ccn, name }:
// read in the page, so the test needs no hospital of its own and prints none.
const pickHospitals = (page) => page.evaluate(async ({ estimated }) => {
  const asset = await (await fetch(document.querySelector('.topbar').dataset.hubSrc)).json();
  const at = (c) => asset.cols.indexOf(c);
  const pick = (tdr) => {
    const row = asset.rows.find((r) => r[at('status')] === estimated && r[at('tdr')] === tdr);
    return { ccn: row[at('ccn')], name: row[at('name')] };
  };
  return { tdr: pick(1), plain: pick(0) };
}, { estimated: STATUS_CODES.estimated });

// What the header shows: its height, the bar's, whether the find button shows, whether the bar holds a search form, the
// tab row's fade and scroll, and the current tab's place against the row's.
const headerFacts = (page) => page.evaluate(() => {
  const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
  const row = box('.tabs__scroll');
  const current = box('.tabs__scroll [aria-current="page"]');
  return {
    header: box('.topbar').height,
    bar: box('.fam__bar').height,
    find: document.querySelector('.fam__find').checkVisibility(),
    barSearch: document.querySelector('.fam__end form#omni') !== null,
    more: document.querySelector('.tabs').classList.contains('tabs--more'),
    scrollLeft: document.querySelector('.tabs__scroll').scrollLeft,
    row: { left: row.left, right: row.right },
    current: current && { left: current.left, right: current.right },
  };
});

describe('the header on a phone', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, PHONE);

  for (const [name, path] of PATHS) {
    it(`${name}: the sticky header is at most ${MAX_STICKY} px tall, the bar one row, and the find button shows exactly when the bar holds a search, which every page's bar does`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
      const facts = await headerFacts(page);
      assert.ok(facts.header <= MAX_STICKY, `the header is ${facts.header} px tall`);
      assert.ok(facts.bar <= BAR, `the bar is ${facts.bar} px tall, not one row`);
      assert.equal(facts.barSearch, true, 'the bar holds a search');
      assert.equal(facts.find, facts.barSearch, 'the find button shows iff the bar holds a search form');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
      await assertQuiet(seen, 'header');
    }));
  }

  for (const [name, path] of [['program page', PROGRAM_PATH], ['hub page', SITE.pages.about]]) it(`${name}: the bar's search is behind the find button, which opens it as a row under the bar and closes it again, by touch and by Escape`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
    const find = page.locator('.fam__find');
    const bar = page.locator('.fam__end form#omni');
    const input = bar.getByRole('combobox');
    assert.equal(await find.isVisible(), true);
    assert.equal(await bar.isVisible(), false, 'the search waits behind the button');
    assert.equal(await find.getAttribute('aria-expanded'), 'false');
    const before = await find.boundingBox();
    assert.ok(before.width >= 44 && before.height >= 44, 'a 44 px target');

    await find.click();
    assert.equal(await find.getAttribute('aria-expanded'), 'true');
    assert.equal(await bar.isVisible(), true);
    assert.equal(await input.evaluate((el) => document.activeElement === el), true, 'the box has focus');
    const open = await find.boundingBox();
    assert.deepEqual([open.x, open.y], [before.x, before.y], 'the button stays where it was');
    assert.ok((await bar.boundingBox()).y > open.y + open.height - 1, 'the search is a row of its own under the button');

    // The first Escape closes the box's list, as it does anywhere; the next closes the row and returns to the button.
    await input.pressSequentially('a');
    await page.waitForFunction(() => document.querySelector('.fam__end form#omni [role="combobox"]').getAttribute('aria-expanded') === 'true');
    await page.keyboard.press('Escape');
    assert.equal(await input.getAttribute('aria-expanded'), 'false');
    assert.equal(await find.getAttribute('aria-expanded'), 'true', 'the list closed, not the row');
    await page.keyboard.press('Escape');
    assert.equal(await find.getAttribute('aria-expanded'), 'false');
    assert.equal(await bar.isVisible(), false);
    assert.equal(await find.evaluate((el) => document.activeElement === el), true, 'focus returns to the button');
    await find.click();
    await find.click();
    assert.equal(await bar.isVisible(), false, 'the button closes it too');
    await assertQuiet(seen, 'phone search');
  }));

  it('the tab row: it scrolls the current tab into view clear of the fade, and the fade shows while more tabs lie to the right and goes at the end', async () => {
    const last = SITE.programs.at(-1).path;
    await withPage(tabs, { path: last }, async (page) => {
      const f = await headerFacts(page);
      assert.ok(f.scrollLeft > 0, 'the row scrolled to the last tab');
      assert.ok(f.current.left >= f.row.left && f.current.right <= f.row.right + 0.5, 'the current tab is whole');
      assert.equal(f.more, false, 'nothing more lies to the right');
    });
    await withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
      const f = await headerFacts(page);
      assert.ok(f.current.left >= f.row.left && f.current.right <= f.row.right - 40, 'the current tab is whole and clear of the fade');
      assert.equal(f.more, true, 'more tabs lie to the right');
      await page.evaluate(() => { const row = document.querySelector('.tabs__scroll'); row.scrollLeft = row.scrollWidth; });
      await settle(page);
      assert.equal((await headerFacts(page)).more, false, 'at the end the fade goes');
      await page.evaluate(() => { document.querySelector('.tabs__scroll').scrollLeft = 0; });
      await settle(page);
      assert.equal((await headerFacts(page)).more, true, 'and comes back');
    });
  });
});

describe('the followed hospital', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, PHONE);
  // The tab links, as the page holds them.
  const hrefsOf = (page) => page.evaluate(() => [...document.querySelectorAll('.tabs__scroll a')].map((a) => a.getAttribute('href')));

  it('a ?h= naming a hospital fills the chip, points the tabs and the wordmark at it, and the × stops following', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const { tdr, plain } = await pickHospitals(page);
    for (const [row, inTdr] of [[tdr, true], [plain, false]]) {
      // Lowercase on purpose: a CCN is accepted in either case.
      await visit(page, tabs.base, `${PROGRAM_PATH}?x=1&h=${row.ccn.toLowerCase()}`);
      const chip = page.locator('[data-chip]');
      await chip.waitFor({ state: 'visible' });
      assert.equal(await chip.locator('.chip__t').textContent(), row.name, 'the chip names the hospital');
      assert.match(await chip.locator('.chip__v').textContent(), /^Estimated FY\d{4} net:\s*[+−]?\$[\d.,]+[KMB]?$/);
      assert.equal(await chip.locator('.chip__n').getAttribute('href'), tabHref(null, row.ccn));
      assert.deepEqual(await hrefsOf(page), [tabHref(null, row.ccn), ...SITE.programs.map((p) => tabHref(p.id, row.ccn, { inTdr }))]);
      assert.equal(await page.locator('a.wordmark').getAttribute('href'), `/?h=${row.ccn}`);
      assert.ok((await headerFacts(page)).header <= MAX_STICKY, 'the header stays modest with the chip');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
    }
    // The × goes to the same page without ?h= and keeps the rest of the address.
    assert.equal(await page.locator('.chip__x').getAttribute('href'), `${PROGRAM_PATH}?x=1`);
    await page.locator('.chip__x').click();
    await page.waitForURL((url) => url.pathname === PROGRAM_PATH && url.search === '?x=1');
    assert.equal(await page.locator('[data-chip]').isHidden(), true, 'no hospital is followed');
    assert.deepEqual(await hrefsOf(page), ['/', ...SITE.programs.map((p) => p.path)]);
    await assertQuiet(seen, 'followed hospital');
  }));

  it('a malformed, markup, repeated or unknown ?h= changes nothing: no chip, no rewritten link, no markup, no error', async () => {
    const junk = [
      ['markup', '?h=%3Cimg%20src%3Dx%20onerror%3Dwindow.pwned%3D1%3E', false],
      ['too short', '?h=99', false],
      ['too long', '?h=9900011', false],
      ['letters and a space', '?h=abc%20123', false],
      ['empty', '?h=', false],
      ['first is junk', '?h=abc&h=', false],
      ['well formed, unknown', '?h=zzzzzz&h=zzzzzz', true],
    ];
    for (const [what, search, mayFetch] of junk) {
      await withPage(tabs, { path: PROGRAM_PATH + search, watched: true }, async (page, { seen }) => {
        assert.equal(await page.locator('[data-chip]').isHidden(), true, `${what}: no chip`);
        assert.deepEqual(await hrefsOf(page), ['/', ...SITE.programs.map((p) => p.path)], `${what}: the tabs are as written`);
        assert.equal(await page.locator('a.wordmark').getAttribute('href'), '/', `${what}: the wordmark`);
        const state = await page.evaluate(() => ({
          imgs: document.querySelectorAll('main img, header img').length,
          pwned: window.pwned ?? null,
          assetRequests: performance.getEntriesByType('resource').filter((e) => e.name.includes('hub-hospitals')).length,
        }));
        assert.deepEqual([state.imgs, state.pwned], [0, null], `${what}: no markup from the value`);
        if (!mayFetch) assert.equal(state.assetRequests, 0, `${what}: the hub's asset is not fetched for a value that is no CCN`);
        await assertQuiet(seen, what);
      });
    }
  });

  it('a page with no ?h= fetches no hub asset, though its bar holds the family search (its list loads on first focus)', () => withPage(tabs, { path: SITE.pages.about, watched: true }, async (page, { seen }) => {
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('hub-hospitals')).length), 0);
    await assertQuiet(seen, 'no ?h=');
  }));
});

// The followed hospital's figures as the hub's asset holds them, read in the page (so the test prints none): its name and
// its estimated net (null without an estimate). Fetches the asset: call it after any check that it was not fetched.
const assetRow = (page, ccn) => page.evaluate(async (want) => {
  const asset = await (await fetch(document.querySelector('.topbar').dataset.hubSrc)).json();
  const at = (c) => asset.cols.indexOf(c);
  const row = asset.rows.find((r) => r[at('ccn')] === want);
  return row && { name: row[at('name')], net: row[at('net')], fy: asset.fy };
}, ccn);

describe('a hospital\'s own page', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared, PHONE);
  const hrefsOf = (page) => page.evaluate(() => [...document.querySelectorAll('.tabs__scroll a')].map((a) => a.getAttribute('href')));

  it('the server\'s chip names it with its estimated net; the script points the folder tabs and the wordmark at it and fetches nothing', () => withPage(tabs, { path: HOSPITAL, watched: true }, async (page, { seen }) => {
    const ccn = await page.locator('.topbar').getAttribute('data-hospital');
    assert.ok(ccn && HOSPITAL.includes(ccn.toLowerCase()), 'the header names the page\'s hospital');
    const chip = page.locator('[data-chip]');
    assert.equal(await chip.isVisible(), true, 'the chip shows without waiting for a script');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('hub-hospitals')).length), 0, 'no hub asset fetched');
    // The tabs and the wordmark carry the hospital to every program's folder and the front page; its HACRP tab is this
    // page. Compared as one answer, so a failure prints no CCN.
    const want = ['/', ...SITE.programs.map((p) => p.path)].map((path) => (path === '/hacrp/' ? HOSPITAL : withFollow(path, ccn)));
    assert.ok(JSON.stringify(await hrefsOf(page)) === JSON.stringify(want), 'the tabs follow the hospital');
    assert.ok(await page.locator('a.wordmark').getAttribute('href') === withFollow('/', ccn), 'the wordmark follows the hospital');
    // Until the family's hospital page is built, the chip's name is plain text, not a link.
    assert.equal(await chip.locator('a.chip__n').count(), 0, 'the name links nowhere yet');
    assert.equal(await page.locator('.chip__x').getAttribute('href'), '/hacrp/', 'the × opens the program page');
    const row = await assetRow(page, ccn);
    assert.ok(row, 'the hospital is in the hub\'s asset');
    assert.ok(await chip.locator('.chip__t').textContent() === row.name, 'the chip\'s name is the hub\'s');
    const value = chip.locator('.chip__v');
    if (row.net === null) assert.equal(await value.count(), 0, 'no figure without an estimate');
    else assert.ok(await value.textContent() === `Estimated FY${row.fy} net: ${money(row.net, { sign: true })}`, 'the chip\'s net is the hub\'s estimate');
    await assertQuiet(seen, 'hospital page');
  }));
});

// Between a phone's layout and the widest bar: the followed hospital's chip beside the program's search. The bar stays one
// row with nothing past its edge; the chip's name gives way (cut short with an ellipsis), never its net or its ×.
describe('the chip beside a program\'s search', { concurrency: CONCURRENCY }, () => {
  for (const width of [641, 720, 800, 1024, 1280]) {
    describe(`${width} px wide`, () => {
      const tabs = useContext(shared, { width, height: 400 });
      it('the bar is one row, whole, and only the name gives way', () => withPage(tabs, { path: HOSPITAL }, async (page) => {
        const f = await page.evaluate(() => {
          // A name three times as long as this one stands for the longest: the chip is at its widest.
          const name = document.querySelector('.chip__t');
          name.textContent = name.textContent.repeat(3);
          const bar = document.querySelector('.fam__bar');
          const box = bar.getBoundingClientRect();
          const whole = (el) => el.scrollWidth <= el.clientWidth;
          const t = document.querySelector('.chip__t');
          const v = document.querySelector('.chip__v');
          const x = document.querySelector('.chip__x');
          const toggle = bar.querySelector('.theme-toggle');
          const form = bar.querySelector('form#omni');
          return {
            bar: box.height,
            past: [...bar.querySelectorAll('*')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().right > box.right + 0.5).length,
            toggle: toggle.checkVisibility() && toggle.getBoundingClientRect().right <= box.right + 0.5,
            ellipsis: getComputedStyle(t).textOverflow === 'ellipsis' && getComputedStyle(t).whiteSpace === 'nowrap',
            value: !v || whole(v),
            x: x.getBoundingClientRect().width,
            search: form.getBoundingClientRect().width,
            sideways: document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        assert.ok(f.bar <= 63, `the bar is ${f.bar} px tall, not one row`);
        assert.equal(f.past, 0, 'nothing in the bar reaches past its edge');
        assert.equal(f.toggle, true, 'the theme toggle shows whole');
        assert.equal(f.ellipsis, true, 'the name is cut short with an ellipsis');
        assert.equal(f.value, true, 'the net shows whole');
        assert.ok(f.x >= 30, `the × is ${f.x} px wide`);
        assert.ok(f.search >= 180, `the search is ${f.search} px wide`);
        // On a wide screen the search keeps its full width beside the chip (the tagline steps aside).
        if (width >= 1200) assert.ok(f.search >= 360, `the search is ${f.search} px wide`);
        assert.equal(f.sideways, false, 'no sideways scroll');
      }));
    });
  }
});

describe('the family search on a hub page', () => {
  const tabs = useContext(shared);

  it('a state\'s name lists the state, and choosing it opens the front page at that state', () => withPage(tabs, { path: SITE.pages.about, watched: true }, async (page, { seen }) => {
    const box = page.locator('.topbar form#omni[data-hub]').getByRole('combobox');
    assert.equal(await box.isVisible(), true, 'the bar\'s search shows');
    await box.pressSequentially('Ohio');
    const option = page.locator('.topbar form#omni [role="option"]').filter({ hasText: 'Ohio' }).first();
    await option.waitFor();
    assert.match(await option.textContent(), /State/, 'the state is listed as a state');
    await option.click();
    await page.waitForURL((url) => url.pathname === '/' && url.hash === '#state=OH');
    await assertQuiet(seen, 'family search');
  }));
});

describe('the theme button', () => {
  const tabs = useContext(shared);

  it('flips the theme for the visit, keeps aria-pressed in step, says so on the document, and stores nothing', () => withPage(tabs, { path: SITE.pages.about, watched: true }, async (page, { seen }) => {
    await page.evaluate(() => {
      window.themeEvents = [];
      document.addEventListener('pp-theme', (e) => window.themeEvents.push(e.detail.dark));
    });
    const toggle = page.locator('.theme-toggle:visible');
    const dark = await toggle.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
    assert.equal(await toggle.getAttribute('aria-pressed'), String(dark));
    await toggle.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), dark ? 'light' : 'dark');
    assert.equal(await toggle.getAttribute('aria-pressed'), String(!dark));
    await toggle.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), dark ? 'dark' : 'light');
    assert.deepEqual(await page.evaluate(() => window.themeEvents), [!dark, dark]);
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]), [0, 0, '']);
    await assertQuiet(seen, 'theme');
  }));
});
