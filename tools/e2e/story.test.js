// The home page's story, live (hub/client/home.js), in a real browser: on a phone and on a desktop, with reduced motion
// each step shows its end state at once (the chart drawn, the right drawing behind it, the rail or the step's name
// marking it), nothing scrolls sideways, and nothing goes wrong on the page; without the story's data the page stays as
// the server wrote it. Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from './axe.js';
import { CONCURRENCY, SCHEMES, assertQuiet, settle, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();

// The story's state after the reader has scrolled step i to where it is read: the step the page marks, the current
// rail link or step name, the two drawings' opacities, whether the canvas has paint on it, and the sideways overflow.
async function readStep(page, i) {
  await page.evaluate((k) => {
    const el = document.querySelectorAll('.story .step')[k];
    const phone = window.innerWidth <= 760;
    const head = document.querySelector('.topbar').getBoundingClientRect().height;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (phone ? head - 44 : window.innerHeight * 0.1));
  }, i);
  await settle(page);
  await settle(page);
  return page.evaluate(() => {
    const story = document.querySelector('.story');
    const canvas = story.querySelector('.stage__cv');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let p = 3; p < pixels.length; p += 4) if (pixels[p] > 0) painted += 1;
    const opacity = (sel) => Number(getComputedStyle(story.querySelector(sel)).opacity);
    const wide = window.innerWidth >= 1080;
    const marked = wide ? [...story.querySelectorAll('.rail a')].findIndex((a) => a.getAttribute('aria-current') === 'step')
      : [...story.querySelectorAll('.nowstep li')].findIndex((li) => li.classList.contains('is-now') && li.offsetParent !== null);
    return {
      step: Number(story.dataset.step), marked, painted, bar: opacity('.stage__panel--bar'), map: opacity('.stage__panel--map'),
      sideways: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

// A 1x screen zoomed out to 50% (devicePixelRatio 0.5): the story lays out as at 1x and runs every step without error.
describe('the story zoomed out to 50%', () => {
  it('every step draws, nothing throws', async () => {
    const context = await shared.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(new URL('/', shared.site.base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
      assert.equal(await page.evaluate(() => window.devicePixelRatio), 0.5);
      for (let i = 0; i < 9; i++) {
        const s = await readStep(page, i);
        assert.equal(s.step, i);
        assert.ok(s.painted > 1000, `step ${i}: the canvas holds the dots`);
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
});

for (const width of [320, 390, 1280]) {
  describe(`the story at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width });

    it('with reduced motion, every step\'s end state at once: its chart drawn on its drawing, the step marked, nothing sideways', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
      for (let i = 0; i < 9; i++) {
        const s = await readStep(page, i);
        assert.equal(s.step, i, `step ${i} is the one being read`);
        assert.equal(s.marked, i, `step ${i} is marked`);
        assert.ok(s.painted > 1000, `step ${i}: the canvas holds the dots (${s.painted} pixels)`);
        assert.equal(s.bar, i === 0 ? 1 : 0, `step ${i}: the scale bar ${i === 0 ? 'shows' : 'is gone'}`);
        assert.equal(s.map, i === 6 || i === 7 ? 1 : 0, `step ${i}: the map ${i === 6 || i === 7 ? 'shows' : 'is gone'}`);
        assert.ok(s.sideways <= 0, `step ${i}: the page scrolls ${s.sideways} px sideways`);
      }
      await assertQuiet(seen, `the story at ${width} px`);
    }));

    // Mid-scroll, between two steps (the words of both on screen, one being read and one not): every word still meets
    // contrast. Reduced motion, so the colors have finished turning when axe looks.
    for (const scheme of SCHEMES) {
      it(`mid-scroll between two steps, ${scheme}: axe finds nothing`, () => withPage(tabs, { path: '/', scheme }, async (page) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
        await page.evaluate(() => {
          const [a, b] = [...document.querySelectorAll('.story .step')].slice(2, 4);
          const top = (el) => el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, (top(a) + top(b)) / 2);
        });
        await settle(page);
        await settle(page);
        const shown = await page.evaluate(() => [...document.querySelectorAll('.story .step__in')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        }).length);
        assert.ok(shown >= 2, `two steps' words on screen (${shown})`);
        await audit(page, `the story mid-scroll at ${width} px, ${scheme}`);
      }));
    }

    it('without its data the page stays as the server wrote it: both drawings, no canvas, no live layout', () => withPage(tabs, { path: '/about/' }, async (page) => {
      await page.route('**/assets/hub-hospitals.*.json', (route) => route.fulfill({ status: 503, body: '' }));
      await page.goto(new URL('/', page.url()).href, { waitUntil: 'networkidle' });
      await settle(page);
      const s = await page.evaluate(() => {
        const story = document.querySelector('.story');
        return {
          live: story.classList.contains('story--live'), canvas: story.querySelector('.stage__cv').hidden,
          bar: getComputedStyle(story.querySelector('.stage__panel--bar')).opacity, map: getComputedStyle(story.querySelector('.stage__panel--map')).opacity,
          faded: story.querySelectorAll('.step.is-current').length,
        };
      });
      assert.deepEqual(s, { live: false, canvas: true, bar: '1', map: '1', faded: 0 });
    }));
  });
}

// The last two steps answer to the reader: an address's #state= (either case) scrolls to the states and pins that one in
// the readout, a junk one does nothing; the last step's search follows a hospital in place (the page stays, the card and
// the 'hub:select' event name it), and a hospital without a teaching status has that peer toggle disabled with the
// hospital page's note.
describe('states you can read, and Find yours', () => {
  const tabs = useContext(shared);

  it('#state= pins a state on the map; a junk one is ignored', () => withPage(tabs, { path: '/#state=oh', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.readout')?.classList.contains('is-line'));
    await settle(page);
    const s = await page.evaluate(() => ({
      step: document.querySelector('.story').dataset.step, line: document.querySelector('.readout').textContent,
      pinned: [...document.querySelectorAll('.smap .is-pin')].map((el) => el.dataset.st),
      focusable: [...document.querySelectorAll('.smap .st')].every((el) => el.getAttribute('role') === 'button' && el.tabIndex === 0),
    }));
    assert.equal(s.step, '7');
    assert.match(s.line, /^Ohio: [\d,]+ hospitals, net [−+]?\d\.\d\d% of pay, \d+% take a net cut$/);
    assert.deepEqual(s.pinned, ['OH']);
    assert.ok(s.focusable, 'the states are buttons in the tab order on step 7');
    await page.goto(new URL('/about/', page.url()).href, { waitUntil: 'networkidle' });
    await page.goto(new URL('/#state=%3Cimg%20src=x%3E', page.url()).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
    assert.equal(await page.evaluate(() => document.querySelectorAll('.smap .is-pin, img[src="x"]').length), 0, 'nothing pinned, no markup');
    await assertQuiet(seen, 'state fragment');
  }));

  it('the last step\'s search follows a hospital in place, with its card, its event and its peer toggles', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
    // A hospital with an estimate and no teaching status, from the page's own asset.
    const ccn = await page.evaluate(async () => {
      const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
      const at = (c) => cols.indexOf(c);
      return rows.find((r) => r[at('status')] === 'e' && r[at('teach')] === null)[at('ccn')];
    });
    await page.evaluate(() => document.addEventListener('hub:select', (e) => { window.selected = e.detail.ccn; }));
    const box = page.locator('main form#find').getByRole('combobox');
    await box.pressSequentially(ccn.toLowerCase());
    await page.locator('main form#find [role="option"]').first().waitFor();
    await box.press('Enter');
    await page.waitForFunction((c) => document.querySelector('[data-card]').dataset.ccn === c, ccn);
    const s = await page.evaluate(() => ({
      path: window.location.pathname, selected: window.selected, step: document.querySelector('.story').dataset.step,
      teach: document.querySelector('.peers [data-peer="teach"]').getAttribute('aria-disabled'),
      why: document.querySelector('#peers-no-teach').checkVisibility(), example: document.querySelector('.card__ex').hidden,
    }));
    assert.deepEqual(s, { path: '/', selected: ccn, step: '8', teach: 'true', why: true, example: true });
    await assertQuiet(seen, 'find yours');
  }));
});
