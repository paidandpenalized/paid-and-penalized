// The TEAM program page in a real browser (light and dark): at 1280 and 390 px, no block of words is crushed beside a
// figure, a stamp or a table (each paragraph, heading, list item and caption is at least MIN_TEXT px wide, or short
// enough to sit on one line), no stamp runs past its column, no citation breaks inside a word, and the
// page never scrolls sideways; and Part 4's picker redraws its map (below). Runs against dist/ (make build) or any URL;
// see site.js. (Task 8 adds the lookup's checks.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_PATH } from '../../sites/team/web/links.js';
import { CONCURRENCY, SCHEMES, assertNoSideways, assertQuiet, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();
// The narrowest a block of words may be when it wraps: about 18 characters of the body face at its smallest size.
const MIN_TEXT = 150;

// Read in the page: every wrapped block narrower than MIN_TEXT, every stamp past its parent's edge, every citation that
// breaks inside a word, each named by its tag, class and first words (never a hospital: the page
// names none in these blocks).
const crushed = (page, minText) => page.evaluate((minText) => {
  const range = document.createRange();
  // The lines a block's words take: the distinct line boxes of its text (a swatch or an inline box beside the words is
  // not a line), told apart by their tops to the nearest 4 px.
  const lines = (el) => {
    const tops = new Set();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      if (!node.textContent.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top / 4));
    }
    return tops.size;
  };
  const name = (el) => `${el.localName}${[...el.classList].map((c) => `.${c}`).join('')} "${el.textContent.trim().slice(0, 40)}"`;
  const blocks = [...document.querySelectorAll('main .tm-part :is(p, h1, h2, h3, h4, li, figcaption), main .tm-next')]
    .filter((el) => el.checkVisibility() && el.textContent.trim());
  const narrow = blocks.filter((el) => el.getBoundingClientRect().width < minText && lines(el) > 1).map(name);
  const stamps = [...document.querySelectorAll('main .stamp')].filter((s) => s.getBoundingClientRect().right > s.parentElement.getBoundingClientRect().right + 1).map(name);
  // A citation may wrap between its words, or where the browser's line breaking allows it after a closing bracket or a
  // dash ("512.562(b)" / "(2)", "(b)–" / "(d)"), never inside a run of letters and digits: two characters of one run on
  // two lines is a citation in pieces (what overflow-wrap: anywhere does in a crushed box).
  const brokenWord = (el) => {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      const text = node.textContent;
      let last = null;
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i]) || (i > 0 && /[)\u2013]/.test(text[i - 1]))) last = null;
        if (/\s/.test(text[i])) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const top = Math.round(range.getBoundingClientRect().top / 4);
        if (last !== null && top !== last) return true;
        last = top;
      }
    }
    return false;
  };
  const cites = [...document.querySelectorAll('main .tm-cite')].filter(brokenWord).map(name);
  return { narrow, stamps, cites, checked: blocks.length };
}, minText);

for (const width of [1280, 390]) {
  describe(`the TEAM program page at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: width < 600 ? 844 : 900 });
    for (const scheme of SCHEMES) {
      it(`${scheme}: no block of words crushed, no stamp past its column, no citation in pieces, no sideways scroll`, () => withPage(tabs, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
        const s = await crushed(page, MIN_TEXT);
        assert.ok(s.checked > 50, `${s.checked} blocks checked`);
        assert.deepEqual(s.narrow, [], `blocks narrower than ${MIN_TEXT} px that wrap`);
        assert.deepEqual(s.stamps, [], 'stamps past their column');
        assert.deepEqual(s.cites, [], 'citations broken inside a word');
        await assertNoSideways(page, 'the TEAM program page');
        await assertQuiet(seen, 'the TEAM program page');
      }));
    }
  });
}

// Part 4 (sites/team/web/program/bar.js, client/bar.js): the picker shows and is labeled, and a new pick redraws the map
// (every region's mark and label, in the drawing on screen), the price beside the words and the figure's table, all from
// the big table's own cells; opening the table never scrolls the page sideways; without JavaScript the picker stays
// hidden and the map and table are the build's.
const PICK = '523';
const part4 = (page) => page.evaluate((pick) => {
  const bar = document.getElementById('bar');
  const select = bar.querySelector('select[data-bar-pick]');
  const label = select ? bar.querySelector(`label[for="${select.id}"]`)?.textContent.trim() : null;
  const svg = [...bar.querySelectorAll('svg.chart--division-map')].find((s) => s.checkVisibility());
  const row = [...bar.querySelectorAll('table[data-bar-table] tr')].find((tr) => tr.dataset.drg === pick);
  const fromTable = row ? [...row.cells].slice(1).map((td) => Number(td.dataset.value)) : [];
  const marks = svg ? [...svg.querySelectorAll('.chart-mark[data-div]')].map((m) => Number(m.dataset.value)) : [];
  const labels = svg ? [...svg.querySelectorAll('.chart-div__price')].map((t) => t.textContent) : [];
  const cells = [...bar.querySelectorAll('figure td[data-div]')].map((td) => Number(td.dataset.value));
  const reader = Number(bar.querySelector('[data-bar-reader]')?.dataset.barReader);
  return {
    shown: Boolean(select?.checkVisibility()), label, value: select?.value ?? null, marks, labels, cells, fromTable, reader,
    price: bar.querySelector('[data-bar="price"]')?.textContent, drg: bar.querySelector('figcaption [data-bar="drg"]')?.textContent,
  };
}, PICK);
const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;

for (const width of [1280, 390]) {
  describe(`TEAM Part 4 at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: width < 600 ? 844 : 900 });
    for (const scheme of SCHEMES) {
      it(`${scheme}: the labeled picker redraws the map, the price and the figure's table from the table's cells; the open table scrolls in its box`, () => withPage(tabs, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
        const before = await part4(page);
        assert.ok(before.shown, 'the picker shows once the script runs');
        assert.equal(before.label, 'Episode type');
        assert.equal(before.value, '470');
        assert.equal(before.marks.length, 9);
        await page.selectOption('#bar-drg', PICK);
        const after = await part4(page);
        assert.equal(after.value, PICK);
        assert.equal(after.drg, PICK);
        assert.equal(after.fromTable.length, 9);
        assert.deepEqual(after.marks, after.fromTable, 'each region\'s mark holds its price from the table');
        assert.deepEqual(after.cells, after.fromTable, 'the figure\'s table follows');
        assert.deepEqual(after.labels, after.fromTable.map(usd), 'each region\'s label');
        assert.equal(after.price, usd(after.fromTable[after.reader - 1]), 'the price beside the words is the reader\'s region\'s');
        await page.locator('#all-prices > summary').click();
        await assertNoSideways(page, 'Part 4 with its table open');
        // web/client/figure.js re-reads the box on the disclosure's toggle (an event after the click): wait for it.
        await page.waitForFunction(() => {
          const scroll = document.querySelector('#all-prices .printout__scroll');
          return scroll.scrollWidth <= scroll.clientWidth + 1 || scroll.getAttribute('role') === 'region';
        }, null, { timeout: 2000 }).catch(() => {});
        const box = await page.evaluate(() => {
          const scroll = document.querySelector('#all-prices .printout__scroll');
          return { overflows: scroll.scrollWidth > scroll.clientWidth + 1, region: scroll.getAttribute('role'), tabindex: scroll.getAttribute('tabindex') };
        });
        if (box.overflows) assert.deepEqual([box.region, box.tabindex], ['region', '0'], 'a table wider than its box scrolls from the keyboard');
        await assertQuiet(seen, 'TEAM Part 4');
      }));
    }
  });
}

describe('TEAM Part 4 without JavaScript', () => {
  const tabs = useContext(shared, { javaScript: false });
  it('the picker stays hidden; the map, its price and the whole table are the build\'s', () => withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
    const s = await part4(page);
    assert.equal(s.shown, false);
    assert.equal(s.value, '470');
    assert.equal(s.marks.length, 9);
    const rows = await page.locator('#all-prices tr[data-drg]').count();
    assert.ok(rows > 30, `${rows} episode types in the table`);
  }));
});
