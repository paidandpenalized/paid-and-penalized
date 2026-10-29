// Layout facts a reader sees at a glance, in a real browser at 1280 px (light): the HACRP hospital page's record card
// (each row as tall as its fields' words, the state's outline and its dot in the Location field, clear of every field's
// words); the end of the placeholder and interim Readmissions pages (no wide empty band before the footer) and the interim
// page's pill beside its figure; and a hospital page with scripts off, which offers no what-if it cannot run. Pages are
// picked by type (site.js), never named. Runs against dist/ (make build) or any URL; see site.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { programById } from '../../web/site.js';
import { CONCURRENCY, assertQuiet, useBrowser, useContext, withPage } from './lib.js';
import { samplePages } from './site.js';

const shared = useBrowser();
const PAGES = samplePages();
const ofType = (type) => PAGES.find((p) => p.type === type);
const HACRP_PAGES = PAGES.filter((p) => p.type.startsWith('hospital-'));
// The footer's own room above its rule (web/styles/shell.css .foot's margin), and what a page may add to it.
const FOOT_ROOM = 88;
const SLACK = 24;

describe('at 1280 px', { concurrency: CONCURRENCY }, () => {
  const tabs = useContext(shared);

  for (const sample of HACRP_PAGES) {
    it(`the HACRP record card (${sample.name}): rows as tall as their words, the map in the Location field and clear of every field's words`, () => withPage(tabs, { path: sample.path, watched: true }, async (page, { seen }) => {
      const s = await page.evaluate(() => {
        const fields = [...document.querySelectorAll('.hosp__fields > .field')];
        // Each row's fields (by their top), and the least room any of them leaves under its own content.
        const rows = new Map();
        for (const f of fields) {
          const box = f.getBoundingClientRect();
          const last = [...f.children].filter((c) => c.getClientRects().length).at(-1).getBoundingClientRect();
          const room = box.bottom - parseFloat(getComputedStyle(f).paddingBottom) - last.bottom;
          const key = Math.round(box.top);
          rows.set(key, Math.min(rows.get(key) ?? Infinity, room));
        }
        const dot = document.querySelector('.hosp__id .chart-geo-dot');
        const d = dot?.getBoundingClientRect();
        const words = [...document.querySelectorAll('.hosp__id :is(.field__label, .field__value, .field__note, .form__title)')].map((el) => el.getBoundingClientRect());
        const under = d ? words.filter((w) => w.right > d.left && w.left < d.right && w.bottom > d.top && w.top < d.bottom).length : null;
        return { rooms: [...rows.values()].map(Math.round), inLocation: dot ? dot.closest('.f-loc') !== null : null, under };
      });
      assert.ok(s.rooms.every((room) => room <= 2), `each row as tall as its tallest field's words (room left under it: ${s.rooms.join(', ')} px)`);
      if (s.inLocation !== null) {
        assert.equal(s.inLocation, true, 'the map in the Location field');
        assert.equal(s.under, 0, 'the dot clear of every field\'s words');
      }
      await assertQuiet(seen, sample.name);
    }));
  }

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
