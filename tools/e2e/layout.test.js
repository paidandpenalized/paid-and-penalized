// Layout facts a reader sees at a glance, in a real browser (light): the HACRP hospital page's record card at 1280 and
// 390 px (as tall as the verdict beside it, the state's outline behind its fields, the dot and its halo clear of every
// line of their words, the dot of every rule); at 1280 px, the end of the placeholder and interim Readmissions pages (no
// wide empty band before the footer) and the interim page's pill beside its figure; and a hospital page with scripts
// off, which offers no what-if it cannot run. Pages are picked by type (site.js) or by state, never named. Runs against
// dist/ (make build) or any URL; see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readNewestEmitted } from '../../sites/hacrp/pipeline/build.js';
import { programById } from '../../web/site.js';
import { hospitalPath } from '../ci/page-types.js';
import { CONCURRENCY, assertNoSideways, assertQuiet, useBrowser, useContext, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();
const PAGES = samplePages();
const ofType = (type) => PAGES.find((p) => p.type === type);
const HACRP_PAGES = PAGES.filter((p) => p.type.startsWith('hospital-'));
// The footer's own room above its rule (web/styles/shell.css .foot's margin), and what a page may add to it.
const FOOT_ROOM = 88;
const SLACK = 24;

// The HACRP record card's checks, read in the page: whether the card is as tall as the verdict beside it (two columns),
// the state's outline behind the fields (the watermark spanning the card below its title, the map filling it one way), and
// the dot inside the watermark, it and its halo clear of every line of the fields' words (by 2 px) and the dot clear of
// the rules, shown once placed.
const recordCard = (page) => page.evaluate(() => {
  const card = document.querySelector('.hosp__id');
  const verdict = document.querySelector('.hosp__verdict');
  const wm = card.querySelector('.hosp__wm');
  const box = (el) => el.getBoundingClientRect();
  const c = box(card);
  const out = { stretched: Math.abs(c.bottom - box(verdict).bottom) <= 1, map: Boolean(wm) };
  if (!wm) return out;
  const w = box(wm);
  const s = box(wm.querySelector('svg'));
  const d = box(wm.querySelector('.chart-geo-dot'));
  const halo = box(wm.querySelector('.chart-geo-halo')).width / 2;
  const dot = { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2, r: d.width / 2 };
  const within = (r, room) => Math.hypot(dot.x - Math.max(r.left, Math.min(dot.x, r.right)), dot.y - Math.max(r.top, Math.min(dot.y, r.bottom))) < room;
  const range = document.createRange();
  const lines = [...card.querySelectorAll(':is(.form__title, .field__label, .field__value, .field__note)')].flatMap((el) => {
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((r) => r.width > 0).map((r) => ({ r, el: el.className }));
  });
  const rules = [...card.querySelectorAll('.field')].flatMap((f) => {
    const r = box(f);
    return [{ left: r.right - 2, right: r.right, top: r.top, bottom: r.bottom }, { left: r.left, right: r.right, top: r.bottom - 2, bottom: r.bottom }];
  });
  Object.assign(out, {
    behind: wm === card.firstElementChild && w.top - c.top < 48 && c.bottom - w.bottom < 16 && (s.height >= w.height - 1 || s.width >= w.width - 1),
    inside: dot.x - dot.r >= w.left && dot.x + dot.r <= w.right && dot.y - dot.r >= w.top && dot.y + dot.r <= w.bottom,
    onWords: [...new Set(lines.filter(({ r }) => within(r, halo + 2)).map(({ el }) => el))],
    onRules: rules.filter((r) => within(r, dot.r + 2)).length,
    shown: getComputedStyle(wm).opacity === '1',
  });
  return out;
});

// The record card's samples: the three sample hospitals (site.js), and the first hospital in the file in a small state,
// a wide one and a tall one, so the dot lands in different places on the card.
const HACRP_ALL = readNewestEmitted().hospitals;
const RECORD_PAGES = [
  ...HACRP_PAGES.map((p) => [p.name, p.path]),
  ...['RI', 'TN', 'CA'].map((st) => [`the first hospital in ${st}`, hospitalPath(HACRP_ALL.find((h) => h.state === st).ccn)]),
];

for (const [width, two] of [[1280, true], [390, false]]) {
  describe(`the HACRP record card at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: width < 600 ? 844 : 900 });
    for (const [name, path] of RECORD_PAGES) {
      it(`${name}: ${two ? 'as tall as the verdict, ' : ''}the state behind the fields, the dot and its halo clear of every line of words, the dot of every rule`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
        await page.waitForFunction(() => !document.querySelector('.hosp__wm') || document.querySelector('.hosp__wm').hasAttribute('data-placed'));
        const s = await recordCard(page);
        if (two) assert.equal(s.stretched, true, 'the card as tall as the verdict beside it: no space under it');
        if (s.map) {
          assert.equal(s.behind, true, 'the outline behind the whole card, below its title');
          assert.equal(s.inside, true, 'the dot inside the card');
          assert.deepEqual(s.onWords, [], 'the dot and its halo clear of every line of the fields\' words');
          assert.equal(s.onRules, 0, 'the dot clear of the rules');
          assert.equal(s.shown, true, 'the outline shows once placed');
        }
        await assertNoSideways(page, name);
        await assertQuiet(seen, name);
      }));
    }
  });
}

describe('at 1280 px', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared);

  // The space between a page's last words and the footer's rule: the footer's own room, give or take.
  const endBand = (page) => page.evaluate(() => {
    const leaves = [...document.querySelector('main').querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const last = Math.max(...leaves.map((el) => el.getBoundingClientRect().bottom));
    return Math.round(document.querySelector('.foot > .wrap').getBoundingClientRect().top - last);
  });
  for (const [what, path] of [['a placeholder page', programById('team').path], ['the HVBP placeholder', ofType('coming').path], ['an interim Readmissions page', ofType('hrrp-hospital-cut').path], ['a hospital page', ofType('hub-hospital-cut').path]]) {
    it(`${what} ends without a wide empty band before the footer`, () => withPage(tabs, { path }, async (page) => {
      const band = await endBand(page);
      assert.ok(band <= FOOT_ROOM + SLACK, `${band} px between its last words and the footer's rule`);
    }));
  }

  it('the interim Readmissions page\'s pill sits beside its figure', () => withPage(tabs, { path: ofType('hrrp-hospital-cut').path }, async (page) => {
    const gap = await page.evaluate(() => {
      const big = document.querySelector('.hh__netline .hh__big').getBoundingClientRect();
      const pill = document.querySelector('.hh__netline .pill').getBoundingClientRect();
      return Math.round(pill.left - big.right);
    });
    assert.ok(gap >= 0 && gap <= 24, `the pill ${gap} px from the figure`);
  }));
});

describe('a hospital page with scripts off', () => {
  const tabs = useContext(shared, { javaScript: false });
  it('offers no what-if it cannot run: no button to it, the section headed by what it shows, what needs JavaScript said', () => withPage(tabs, { path: ofType('hub-hospital-cut').path }, async (page) => {
    const s = await page.evaluate(() => ({
      button: document.querySelector('.hh__wbtn').checkVisibility(),
      heading: document.getElementById('whatif-h').innerText.trim(),
      kicker: document.querySelector('.hh__sechead .kicker').checkVisibility(),
      lines: [...document.querySelectorAll('.hh__noscript')].filter((p) => p.checkVisibility()).length,
    }));
    assert.deepEqual(s, { button: false, heading: 'Every program, among its peers', kicker: false, lines: 2 });
  }));
});
