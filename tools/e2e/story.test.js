// The home page's story, live (hub/client/home.js), in a real browser: on a phone and on a desktop, with reduced motion
// each step shows its end state at once (the chart drawn, the right drawing behind it, the rail or the step's name
// marking it), nothing scrolls sideways, and nothing goes wrong on the page; without the story's data the page stays as
// the server wrote it. Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONCURRENCY, assertQuiet, settle, useBrowser, useContext, withPage } from './lib.js';

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

    it('without its data the page stays as the server wrote it: both drawings, no canvas, no live layout', () => withPage(tabs, { path: '/about/' }, async (page) => {
      await page.route('**/assets/hub-hospitals.*.json', (route) => route.fulfill({ status: 503, body: '' }));
      await page.goto(new URL('/', page.url()).href, { waitUntil: 'networkidle' });
      await settle(page);
      const s = await page.evaluate(() => {
        const story = document.querySelector('.story');
        return {
          live: story.classList.contains('story--live'), canvas: story.querySelector('.stage__cv').hidden,
          bar: getComputedStyle(story.querySelector('.stage__panel--bar')).opacity, map: getComputedStyle(story.querySelector('.stage__panel--map')).opacity,
          faded: [...story.querySelectorAll('.step__in')].filter((el) => el.style.opacity).length,
        };
      });
      assert.deepEqual(s, { live: false, canvas: true, bar: '1', map: '1', faded: 0 });
    }));
  });
}
