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
    // The reader groups the example by teaching status first.
    await page.locator('#step-find').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.story').dataset.step === '8');
    await page.locator('.peers [data-peer="teach"]').click();
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
    // Shown by state (it has no teaching group), "Same state" is still the reader's choice for the next hospital.
    const pressed = () => page.evaluate(() => [...document.querySelectorAll('.peers [data-peer]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.peer));
    await page.locator('.peers [data-peer="state"]').click();
    const other = await page.evaluate(async () => {
      const { cols, rows } = await (await fetch(document.querySelector('form#find').dataset.src)).json();
      const at = (c) => cols.indexOf(c);
      return rows.find((r) => r[at('status')] === 'e' && r[at('teach')] === 'major')[at('ccn')];
    });
    await box.fill('');
    await box.pressSequentially(other.toLowerCase());
    await page.locator('main form#find [role="option"]').first().waitFor();
    await box.press('Enter');
    await page.waitForFunction((c) => document.querySelector('[data-card]').dataset.ccn === c, other);
    assert.deepEqual(await pressed(), ['state']);
    await page.locator('.peers [data-peer="teach"]').click();
    assert.deepEqual(await pressed(), ['teach']);
    await assertQuiet(seen, 'find yours');
  }));

  it('a state picked twice in the bar\'s search on the front page goes to it both times', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
    const box = page.locator('.topbar form#omni').getByRole('combobox');
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      await box.fill('');
      await box.pressSequentially('Ohio');
      await page.locator('.topbar form#omni [role="option"]').filter({ hasText: 'Ohio' }).first().click();
      await page.waitForFunction(() => document.querySelector('.story').dataset.step === '7' && document.querySelector('.readout').textContent.startsWith('Ohio:'));
      assert.equal(new URL(page.url()).hash, '#state=OH', `pick ${i + 1}`);
    }
    await assertQuiet(seen, 'a state picked twice');
  }));
});

// On a phone the chart is pinned over the lower part of the window: a keyboard reader who tabs to the last step's search
// and its card's link finds each in view, clear of the chart, and then reaches the peer toggle on the chart.
for (const [width, height] of [[390, 844], [320, 640]]) {
  describe(`Find yours by keyboard at ${width} px`, () => {
    const tabs = useContext(shared, { width, height });

    it('Tab reaches the search and the card\'s link clear of the pinned chart, then the peer toggle', () => withPage(tabs, { path: '/', watched: true }, async (page, { seen }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('.story')?.classList.contains('story--drawn'));
      const reached = [];
      for (let i = 0; i < 80 && !reached.some((f) => f.peer === 'teach'); i++) {
        await page.keyboard.press('Tab');
        await settle(page);
        const f = await page.evaluate(() => {
          const el = document.activeElement;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: el.id || el.className, peer: el.dataset?.peer ?? null, clear: Boolean(hit) && (el.contains(hit) || hit.contains(el)) && !(hit.closest('[data-stage]') && !el.closest('[data-stage]')) };
        });
        if (f.id === 'find-q' || f.id === 'card__go' || f.peer) reached.push(f);
      }
      assert.deepEqual(reached.map((f) => f.id === 'find-q' || f.id === 'card__go' ? f.id : f.peer), ['find-q', 'card__go', 'state', 'size', 'teach']);
      for (const f of reached) assert.ok(f.clear, `${f.id}${f.peer ? ` ${f.peer}` : ''} is in view, not under the chart`);
      await assertQuiet(seen, `Find yours by keyboard at ${width} px`);
    }));
  });
}
