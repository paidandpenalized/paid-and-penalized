// The TEAM program page in a real browser (light and dark): at 1280 and 390 px, no block of words is crushed beside a
// figure, a stamp or a table (each paragraph, heading, list item and caption is at least MIN_TEXT px wide, or short
// enough to sit on one line), no stamp runs past its column, no citation breaks inside a word, and the
// page never scrolls sideways; and Part 4's picker redraws its map (below). Runs against dist/ (make build) or any URL;
// see site.js. Part 1's lookup has its own checks (below).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOWN } from '../../sites/team/client/lookup.js';
import { loadTeam } from '../../sites/team/web/data.js';
import { PROGRAM_PATH } from '../../sites/team/web/links.js';
import { audit } from './axe.js';
import { CONCURRENCY, SCHEMES, TAB_KEYS, assertNoSideways, assertQuiet, eventually, settle, useBrowser, useContext, withPage } from './lib.js';

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

// The layout the first critic round asked for, read in the page at each width: on a laptop the Track 3 stamp sits
// beside its caption at about 15rem, and Figures 1, 3 and 5 stay in view beside their words as the words scroll; on a
// phone nothing of that sticks, each calculator box carries its column's name and every row's two results their own,
// the stamp-framed headline's numerals stand straight and unmasked clear of the scenario tag, numerals and frame in the
// ink (the range spans a payment and a repayment; red means owes), and Part 7's caption runs the table's width.
const layout = (page) => page.evaluate(async () => {
  const box = (el) => el.getBoundingClientRect();
  const shown = (el) => el.checkVisibility();
  const stamp = document.querySelector('.tm-hook .stamp');
  const caption = document.querySelector('.tm-hook p:not(.stamp)');
  // Each sticky figure, scrolled to the middle of its Part: its top under the header, not where the Part starts.
  const held = [];
  for (const id of ['who', 'money', 'do']) {
    const part = document.getElementById(id);
    scrollTo(0, part.offsetTop + part.offsetHeight / 2 - innerHeight / 2);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fig = part.querySelector('.tm-sticky');
    held.push(fig && getComputedStyle(fig).position === 'sticky' && box(fig).top >= 0 && box(fig).top < 200 ? id : null);
  }
  scrollTo(0, 0);
  const labels = [...document.querySelectorAll('.tc-ep .tc-cl')];
  const out = document.querySelector('.tc-out__v');
  const tag = document.querySelector('.tc-out__lab .tc-tag');
  const cap = document.querySelector('.tm-find caption');
  return {
    stampWidth: Math.round(box(stamp).width),
    beside: box(caption).left > box(stamp).right,
    held: held.filter(Boolean),
    labels: labels.length,
    labelsShown: labels.filter(shown).length,
    outTransform: getComputedStyle(out).transform,
    // The stamp's numerals and frame against the page's ink and pen (read off probes set in each token).
    ...(() => {
      const probe = (token) => {
        const el = document.createElement('span');
        el.style.color = `var(${token})`;
        document.body.append(el);
        const c = getComputedStyle(el).color;
        el.remove();
        return c;
      };
      return { outColor: getComputedStyle(out).color, outFrame: getComputedStyle(out, '::before').borderTopColor, ink: probe('--ink'), pen: probe('--pen') };
    })(),
    outMask: getComputedStyle(out).maskImage || getComputedStyle(out).webkitMaskImage,
    clearOfTag: box(out).top - box(tag).bottom,
    captionWidth: Math.round(box(cap).width),
    tableWidth: Math.round(box(document.querySelector('.tm-find')).width),
  };
});

describe('the TEAM program page\'s layout at 1280 px', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('the stamp beside its caption; Figures 1, 3 and 5 held beside their words; no phone labels', () => withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
    const s = await layout(page);
    assert.ok(s.stampWidth <= 260, `the stamp ${s.stampWidth} px wide`);
    assert.equal(s.beside, true, 'the caption beside the stamp');
    assert.deepEqual(s.held, ['who', 'money', 'do']);
    assert.ok(s.labels > 0 && s.labelsShown === 0, 'the table\'s head names the columns; the boxes carry no labels of their own');
  }));
});

describe('the TEAM program page\'s layout at 390 px', () => {
  const tabs = useContext(shared, { width: 390, height: 844 });
  for (const scheme of SCHEMES) {
    it(`${scheme}: every box and result labeled, the headline straight and clear of its tag, Part 7's caption full width, nothing held`, () => withPage(tabs, { path: PROGRAM_PATH, scheme }, async (page) => {
      const s = await layout(page);
      assert.ok(s.labels >= 30 && s.labelsShown === s.labels, `${s.labelsShown} of ${s.labels} labels shown`);
      assert.equal(s.outTransform, 'none', 'the numerals not rotated');
      assert.ok(s.outColor === s.ink && s.outFrame === s.ink && s.outFrame !== s.pen, 'the stamp\'s numerals and frame in the ink, not the pen');
      assert.ok(!s.outMask || s.outMask === 'none', 'the numerals not masked');
      assert.ok(s.clearOfTag >= 8, `${s.clearOfTag} px between the tag and the stamp`);
      assert.ok(s.captionWidth >= s.tableWidth - 1, `the caption ${s.captionWidth} px of the table's ${s.tableWidth}`);
      assert.deepEqual(s.held, [], 'nothing sticky on a phone');
    }));
  }
});

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

// Part 1's lookup (sites/team/web/program/who.js, client/lookup.js): the page fetches no data file until the reader
// focuses the box, then exactly the box's two (the family search's and the lookup's codes); a query lists at most SHOWN
// hospitals under a sentence, which alone is the live region; from the keyboard alone a "yes" opens the calculator (?h= and #calc in the address,
// team:pick heard, the calculator's heading focused) and Escape clears the box; axe finds nothing on the page with an
// answer showing; the page never scrolls sideways. A hospital in TEAM is picked from the codes file by its status, and its
// CCN is typed, never printed.
const dataFiles = (page) => page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname).filter((p) => p.endsWith('.json')));
const answer = (page) => page.evaluate(() => {
  const out = document.querySelector('.tm-look__out');
  return { sentence: out.querySelector('.tm-look__count').textContent, rows: out.querySelectorAll('li').length, text: out.textContent };
});
// The live regions in the lookup, each by what it holds: only the sentence, never the rows.
const liveRegions = (page) => page.evaluate(() => [...document.querySelectorAll('.tm-look [aria-live]')].map((el) => ({ live: el.getAttribute('aria-live'), rows: el.querySelectorAll('li').length, isCount: el.matches('.tm-look__count') })));

for (const width of [1280, 390]) {
  describe(`TEAM Part 1's lookup at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: width < 600 ? 844 : 900 });
    for (const scheme of SCHEMES) {
      it(`${scheme}: no fetch before focus, then the two files; at most ${SHOWN} rows; keyboard only; axe clean; no sideways scroll`, () => withPage(tabs, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
        const box = page.locator('#look');
        assert.ok(await box.isVisible(), 'the box shows once the script runs');
        assert.equal(await page.locator('.tm-look__nojs').count(), 0, 'the no-JS sentence goes');
        assert.equal(await page.locator('label[for="look"]').textContent(), 'Is a hospital in TEAM?');
        assert.deepEqual(await dataFiles(page), [], 'no data file before focus');
        await box.focus();
        const codes = await page.locator('[data-team-lookup]').getAttribute('data-codes');
        const src = await page.locator('[data-team-lookup]').getAttribute('data-src');
        await eventually(async () => (await dataFiles(page)).length === 2, 'both files fetched on focus');
        assert.deepEqual((await dataFiles(page)).sort(), [codes, src].sort(), 'exactly the box\'s two files');

        await page.keyboard.type('medical center');
        const many = await eventually(async () => { const a = await answer(page); return a.rows ? a : null; }, 'rows listed');
        assert.equal(many.rows, SHOWN, `at most ${SHOWN} rows`);
        assert.match(many.sentence, /hospitals match/);
        assert.deepEqual(await liveRegions(page), [{ live: 'polite', rows: 0, isCount: true }], 'the sentence alone is live');
        await assertNoSideways(page, 'the lookup with rows listed');
        await audit(page, `${PROGRAM_PATH} with the lookup's rows listed`);

        await page.keyboard.press('Escape');
        assert.equal(await box.inputValue(), '');
        assert.deepEqual(await answer(page), { sentence: '', rows: 0, text: '' }, 'Escape clears the answer');

        // A hospital in TEAM, by its status in the codes file; its CCN typed, then the keyboard to its link.
        const ccn = await page.evaluate(async (url) => (await (await fetch(url)).json()).rows.find((r) => r[1] === 'in')[0], codes);
        await page.evaluate(() => { window.picks = []; document.addEventListener('team:pick', (e) => window.picks.push(e.detail)); });
        await page.keyboard.type(ccn);
        await eventually(async () => (await answer(page)).rows === 1, 'one row for a CCN');
        await page.keyboard.press(TAB_KEYS.next);
        assert.equal(await page.evaluate(() => document.activeElement.closest('.tm-res') !== null && document.activeElement.localName), 'a', 'the row\'s link is next in the tab order');
        await page.keyboard.press('Enter');
        const after = await page.evaluate(() => ({ search: location.search, hash: location.hash, focused: document.activeElement.id, picks: window.picks }));
        // Compared in place, so a failure prints no CCN.
        assert.ok(after.search === `?h=${ccn}`, 'the address carries ?h= with the hospital');
        // The calculator takes the hospital, then writes its own state over the bare #calc (client/calc.js).
        await eventually(async () => page.evaluate((c) => location.hash === `#team&h=${c}`, ccn), 'the calculator writes #team&h= for the hospital');
        assert.ok(after.picks.length === 1 && after.picks[0].ccn === ccn, `team:pick heard once with the CCN (${after.picks.length} heard)`);
        assert.equal(after.focused, 'yours-h', 'the calculator\'s heading takes the focus');
        await assertQuiet(seen, 'TEAM Part 1\'s lookup');
      }));
    }
  });
}

describe('TEAM Part 1\'s lookup without JavaScript', () => {
  const tabs = useContext(shared, { javaScript: false });
  it('the box stays hidden and says the search needs JavaScript', () => withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
    assert.equal(await page.locator('#look').isVisible(), false);
    assert.ok(await page.locator('.tm-look__nojs').isVisible());
  }));
});

// Part 5, the calculator (sites/team/web/program/calc.js, calc-view.js, client/calc.js): no data file before the reader
// moves toward another hospital, then exactly the calculator's two (its participants and the family search's names); its
// height at 1280 within a tenth of the approved mockup's (about 860 px) and no clipped table column; the result box first
// on a phone and nothing sticky there; a typed number becomes "your number" and the tag says so; a box that can't take
// what was typed goes back and says so; the address carries public inputs only; axe finds nothing; the page never
// scrolls sideways. Hospitals are picked from the calculator's file by property; no CCN is printed.
const MOCKUP_HEIGHT = 860;
// A hospital on Medicare's list that isn't in TEAM (outside every selected area), picked by its status: a followed ?h= the
// calculator doesn't have.
const NOT_IN_TEAM = Object.entries(loadTeam().status).find(([, [code]]) => code === 'outside')[0];
const calcFiles = (page) => page.evaluate(() => [document.getElementById('calc').dataset.src, document.getElementById('calc').dataset.search]);
const calcSays = (page) => page.evaluate(() => {
  const calc = document.getElementById('calc');
  const text = (sel) => calc.querySelector(sel)?.textContent.trim() ?? null;
  const out = calc.querySelector('.tc-out').getBoundingClientRect();
  const track = calc.querySelector('.tc-track').getBoundingClientRect();
  const scroll = calc.querySelector('.tc-scroll');
  return {
    height: calc.getBoundingClientRect().height, tag: text('[data-v="tag"]'), srcN: text('[data-v="src.n.LEJR"]'), track: calc.querySelector('input[name="tc-track"]:checked')?.value,
    l6: text('[data-v="l.limitsLabel"]'), where: text('[data-v="where"]'), outFirst: out.top < track.top, sticky: getComputedStyle(calc.querySelector('.tc-right')).position,
    clipped: scroll.scrollWidth > scroll.clientWidth + 1, banner: !calc.querySelector('[data-calc-banner]').hidden, msg: text('.tc-msg'),
  };
});

for (const width of [1280, 390]) {
  describe(`TEAM Part 5's calculator at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: width < 600 ? 844 : 900 });
    for (const scheme of SCHEMES) {
      it(`${scheme}: no fetch until the picker, then its two files; the layout; typed numbers; the address; axe clean; no sideways scroll`, () => withPage(tabs, { path: PROGRAM_PATH, scheme, watched: true }, async (page, { seen }) => {
        const first = await calcSays(page);
        if (width === 1280) {
          assert.ok(Math.abs(first.height - MOCKUP_HEIGHT) <= MOCKUP_HEIGHT / 10, `the calculator is ${Math.round(first.height)} px tall, within a tenth of ${MOCKUP_HEIGHT}`);
          assert.equal(first.sticky, 'sticky', 'the result column stays in view');
          assert.ok(!first.clipped, 'every table column fits');
        } else {
          assert.ok(first.outFirst, 'the result box comes first on a phone');
          assert.equal(first.sticky, 'static', 'nothing sticky on a phone');
        }
        assert.equal(first.tag, 'Scenario · public data');
        assert.ok(!first.banner, 'no banner without a link');
        assert.deepEqual(await dataFiles(page), [], 'no data file before the reader moves');

        // A typed number is the reader's own; the tag says the result includes it.
        await page.locator('#tc-n-LEJR').fill('120');
        await page.locator('#tc-n-LEJR').press('Tab');
        const typed = await calcSays(page);
        assert.equal(typed.srcN, 'your number');
        assert.equal(typed.tag, 'includes your numbers');
        assert.equal(await page.locator('[data-v="tag"]').evaluate((el) => getComputedStyle(el).fontStyle), 'italic');
        // The ledger's foot and "What would it take?" say it too, in the same style.
        for (const key of ['tag.l', 'tag.ww']) {
          const tag = page.locator(`[data-v="${key}"]`);
          assert.ok(await tag.isVisible(), `${key} shows once a number is typed`);
          assert.equal(await tag.textContent(), 'includes your numbers');
          assert.equal(await tag.evaluate((el) => getComputedStyle(el).fontStyle), 'italic');
        }
        // What a box can't take goes back, said beside it.
        await page.locator('#tc-p-CABG').fill('abc');
        await page.locator('#tc-p-CABG').press('Tab');
        assert.ok(/^\$[\d,]+$/.test(await page.locator('#tc-p-CABG').inputValue()), 'back to its last good value');
        assert.ok(/isn.t a number from/.test((await calcSays(page)).msg ?? ''), 'the line under the box says so');
        // The address, once the reader pauses: the hospital and public inputs, never the typed count.
        await eventually(async () => page.evaluate(() => location.hash.startsWith('#team&h=')), 'the state in the fragment');
        assert.ok(!(await page.evaluate(() => location.hash)).includes('n.LEJR'), 'own numbers stay out of the address');
        await assertNoSideways(page, 'the calculator');
        await audit(page, `${PROGRAM_PATH} with the calculator in use`);

        // The picker's focus fetches exactly the calculator's two files.
        assert.deepEqual(await dataFiles(page), [], 'still no data file');
        await page.locator('#tc-pick-q').focus();
        const files = await calcFiles(page);
        await eventually(async () => (await dataFiles(page)).length === 2, 'both files fetched on the picker\'s focus');
        assert.deepEqual((await dataFiles(page)).sort(), files.sort(), 'exactly the calculator\'s two files');
        await assertQuiet(seen, 'TEAM Part 5');
      }));
    }
  });
}

describe('TEAM Part 5 from the keyboard, by link, and following a pick', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('keyboard only: Tab to the track, the arrow keys move it; on to the slider, the arrow keys move it', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await page.locator('[data-calc-random]').focus();
    await page.keyboard.press(TAB_KEYS.next);
    assert.equal(await page.evaluate(() => document.activeElement.name), 'tc-track', 'the track is next in the tab order');
    await page.keyboard.press('ArrowLeft');
    assert.equal((await calcSays(page)).track, '2');
    assert.equal((await calcSays(page)).l6, 'Track 2 limits');
    // Each row's three boxes and its low-volume box, then the slider.
    for (let i = 0; i < 21; i++) await page.keyboard.press(TAB_KEYS.next);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tc-s', 'the slider after the rows');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-v="l.s"]').textContent(), '+0.5%');
    assert.equal(await page.locator('#tc-s').getAttribute('aria-valuetext'), '0.5% over target');
    await assertQuiet(seen, 'TEAM Part 5 by keyboard');
  }));

  it('a link: valid keys apply under the banner, the keys it couldn\'t use named', () => withPage(tabs, { path: `${PROGRAM_PATH}#team&t=2&n.LEJR=120&zz=1`, watched: true }, async (page, { seen }) => {
    await eventually(async () => (await calcSays(page)).banner, 'the banner');
    const s = await calcSays(page);
    assert.equal(s.track, '2');
    assert.equal(s.srcN, 'your number');
    assert.ok(/zz/.test(await page.locator('[data-calc-rejected]').textContent()), 'the key it couldn\'t use is named');
    await assertQuiet(seen, 'TEAM Part 5 by link');
  }));

  const junk = `#team&${'%3Cb%3E=1&s=abc&'.repeat(200)}`.slice(0, 2000);
  it('a page opened with a 2,000-character junk fragment applies nothing and throws nothing', () => withPage(tabs, { path: `${PROGRAM_PATH}${junk}`, watched: true }, async (page, { seen }) => {
    await page.waitForTimeout(100);
    const after = await calcSays(page);
    assert.ok(!after.banner, 'nothing valid applied: no banner');
    assert.equal(after.track, '3');
    assert.equal(after.tag, 'Scenario · public data');
    await assertQuiet(seen, 'TEAM Part 5 with a junk link');
  }));

  it('"Start from the public numbers" puts a linked scenario back to the hospital\'s public numbers, in place', () => withPage(tabs, { path: `${PROGRAM_PATH}#team&t=2&s=5&n.LEJR=120&b=8`, watched: true }, async (page, { seen }) => {
    await eventually(async () => (await calcSays(page)).banner, 'the banner');
    await page.locator('[data-calc-reset]').click();
    const s = await calcSays(page);
    assert.ok(!s.banner, 'the banner goes');
    assert.equal(s.track, '3');
    assert.equal(s.tag, 'Scenario · public data');
    assert.ok(s.srcN !== 'your number', 'the typed count is gone');
    const after = await page.evaluate(() => ({ s: document.getElementById('tc-s').value, band: document.getElementById('tc-band').value, rejected: document.querySelector('[data-calc-rejected]').textContent, hash: location.hash, path: location.pathname }));
    assert.deepEqual([after.s, after.band, after.rejected, after.path], ['0', '5', '', PROGRAM_PATH]);
    assert.ok(/^#team&h=[0-9A-Z]{6}$/.test(after.hash), 'the address names the hospital alone');
    await assertQuiet(seen, 'TEAM Part 5 reset');
  }));

  it('team:pick and "Show one at random" load another hospital; Part 4\'s region follows it', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const src = (await calcFiles(page))[0];
    // A participant in another region than the default's, from the calculator's own file.
    const pick = await page.evaluate(async (url) => {
      const file = await (await fetch(url)).json();
      const div = Number(document.querySelector('[data-bar-reader]').dataset.barReader);
      const row = file.rows.find((r) => r[1] !== div && r.slice(4, 24).some((x, i) => i % 4 === 0 && x > 0));
      return { ccn: row[0], div: row[1] };
    }, src);
    await page.evaluate((ccn) => document.dispatchEvent(new CustomEvent('team:pick', { detail: { ccn } })), pick.ccn);
    await eventually(async () => page.evaluate((c) => document.querySelector('#calc [data-v="where"]').textContent.includes(c), pick.ccn), 'the calculator shows the hospital');
    const bar = await page.evaluate(() => {
      const head = [...document.querySelectorAll('#all-prices thead th')];
      return {
        reader: Number(document.querySelector('[data-bar-reader]').dataset.barReader),
        shaded: head.filter((th) => th.classList.contains('tm-all__mine')).map((th) => Number(th.dataset.div)),
        moved: document.querySelectorAll('#bar [data-moved-outline]').length,
        name: document.querySelector('#bar [data-bar="division"]').textContent,
      };
    });
    assert.equal(bar.reader, pick.div, 'Part 4\'s region is the new hospital\'s');
    assert.deepEqual(bar.shaded, [pick.div], 'the table shades its column');
    assert.ok(bar.moved >= 1, 'the outline moved');
    await eventually(async () => page.evaluate((c) => location.hash === `#team&h=${c}`, pick.ccn), 'the address names it');
    const before = (await calcSays(page)).where;
    await page.locator('[data-calc-random]').click();
    await eventually(async () => (await calcSays(page)).where !== before, 'another hospital at random');
    assert.ok(!/, VA$/.test((await calcSays(page)).where), 'never the skipped state');
    await assertQuiet(seen, 'TEAM Part 5 following a pick');
  }));
});

// The review of Checkpoint M3: an edit a box can't take goes back to its value before the edit; the family's ?h= is
// never written; a ?h= outside TEAM fetches nothing; another hospital clears a link's banner; a link with no hospital
// applies to the one showing; a burst of slider input in one frame makes one patch.
describe('TEAM Part 5: reverts, the address, fetches, the banner, links, frames', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  const patches = (page) => page.evaluate(() => Number(document.getElementById('calc').dataset.patches));
  const otherParticipant = async (page) => {
    const src = (await calcFiles(page))[0];
    return page.evaluate(async (url) => {
      const shown = JSON.parse(document.getElementById('tc-data').textContent).row[0];
      return (await (await fetch(url)).json()).rows.find((r) => r[0] !== shown && r[4] > 0)[0];
    }, src);
  };

  it('typing past a box\'s range goes back to the value before the edit, never a prefix', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await page.locator('#tc-q > summary').click();
    for (const [id, typed] of [['#tc-n-LEJR', '250000'], ['#tc-q-falls', '1000']]) {
      const box = page.locator(id);
      const before = await box.inputValue();
      await box.click();
      await box.press('ControlOrMeta+a');
      await box.pressSequentially(typed);
      await box.press('Tab');
      assert.equal(await box.inputValue(), before, `${id}: back to its value before the edit`);
    }
    assert.equal((await calcSays(page)).tag, 'Scenario · public data', 'nothing of the reader\'s left behind');
    await assertQuiet(seen, 'TEAM Part 5 reverts');
  }));

  it('a ?h= outside TEAM fetches nothing; a slider move leaves the ?h= as it was', () => withPage(tabs, { path: `${PROGRAM_PATH}?h=999999`, watched: true }, async (page, { seen }) => {
    await page.waitForTimeout(300);
    const files = await calcFiles(page);
    assert.deepEqual((await dataFiles(page)).filter((f) => files.includes(f)), [], 'neither of the calculator\'s files');
    await page.locator('#tc-s').focus();
    await page.keyboard.press('ArrowRight');
    await eventually(async () => page.evaluate(() => location.hash.startsWith('#team&h=')), 'the state written');
    assert.equal(await page.evaluate(() => location.search), '?h=999999', 'the family\'s ?h= untouched');
    await assertQuiet(seen, 'TEAM Part 5 with a ?h= outside TEAM');
  }));

  it('another hospital clears a link\'s banner; a link with no hospital then applies to it', () => withPage(tabs, { path: `${PROGRAM_PATH}#team&t=2&zz=1`, watched: true }, async (page, { seen }) => {
    await eventually(async () => (await calcSays(page)).banner, 'the banner');
    const ccn = await otherParticipant(page);
    await page.evaluate((c) => document.dispatchEvent(new CustomEvent('team:pick', { detail: { ccn: c } })), ccn);
    await eventually(async () => page.evaluate((c) => document.querySelector('#calc [data-v="where"]').textContent.includes(c), ccn), 'the new hospital');
    const after = await page.evaluate(() => ({ banner: !document.querySelector('[data-calc-banner]').hidden, rejected: document.querySelector('[data-calc-rejected]').textContent }));
    assert.deepEqual(after, { banner: false, rejected: '' }, 'the banner and the rejected keys go');
    await page.evaluate(() => { location.hash = '#team&s=5'; });
    await eventually(async () => (await page.locator('[data-v="l.s"]').textContent()) === '+5%', 'the link\'s spending applied');
    assert.ok(await page.evaluate((c) => document.querySelector('#calc [data-v="where"]').textContent.includes(c), ccn), 'still the hospital showing');
    await assertQuiet(seen, 'TEAM Part 5 banner and links');
  }));

  it('Back to an older address on the same hospital keeps the reader\'s own numbers', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    // A public scenario in the address, then the reader's own count, then an in-page link (a history entry of its own),
    // then a change (the address rewritten in place), then Back to the older public-only address.
    await page.locator('#tc-s').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('#tc-n-LEJR').fill('120');
    await page.locator('#tc-n-LEJR').press('Tab');
    await eventually(async () => page.evaluate(() => /&s=0\.5/.test(location.hash)), 'the slider in the address');
    await page.evaluate(() => { location.hash = '#calc'; });
    await page.locator('#tc-s').focus();
    await page.keyboard.press('ArrowRight');
    await eventually(async () => page.evaluate(() => /&s=1(&|$)/.test(location.hash)), 'the change written in place');
    await page.goBack();
    await eventually(async () => (await page.locator('[data-v="l.s"]').textContent()) === '+0.5%', 'the older address applied');
    const s = await calcSays(page);
    assert.equal(s.srcN, 'your number', 'the typed count is still the reader\'s');
    assert.equal(await page.locator('#tc-n-LEJR').inputValue(), '120');
    assert.equal(s.tag, 'includes your numbers');
    await assertQuiet(seen, 'TEAM Part 5 Back');
  }));

  it('a followed hospital (?h=) outside TEAM: the banner says so, on its own line, and nothing else', () => withPage(tabs, { path: `${PROGRAM_PATH}?h=${NOT_IN_TEAM}#calc`, watched: true }, async (page, { seen }) => {
    await eventually(async () => (await calcSays(page)).banner, 'the banner');
    const b = await page.evaluate(() => ({ away: !document.querySelector('[data-calc-away]').hidden, scen: !document.querySelector('[data-calc-scen]').hidden, text: document.querySelector('[data-calc-away]').textContent }));
    assert.deepEqual(b, { away: true, scen: false, text: 'The hospital you’re following isn’t in TEAM, so the calculator shows one that is. The lookup above says why.' });
    // A move to another hospital clears it.
    await page.locator('[data-calc-random]').click();
    await eventually(async () => !(await calcSays(page)).banner, 'the banner goes with the move');
    await assertQuiet(seen, 'TEAM Part 5 with a ?h= outside TEAM');
  }));

  it('a link\'s rejected keys: decoded, as text, on a line of their own under the reset link', () => withPage(tabs, { path: `${PROGRAM_PATH}#team&%3Cimg%20src=x%20onerror=alert(1)%3E=1&s=2`, watched: true }, async (page, { seen }) => {
    await eventually(async () => (await calcSays(page)).banner, 'the banner');
    const b = await page.evaluate(() => {
      const scen = document.querySelector('[data-calc-scen]');
      const rejected = document.querySelector('[data-calc-rejected]');
      return { rejected: rejected.textContent, below: rejected.getBoundingClientRect().top >= scen.getBoundingClientRect().bottom - 1, imgs: document.querySelectorAll('[data-calc-banner] img').length, scenEnds: scen.textContent.trim().endsWith('Start from the public numbers.') };
    });
    assert.equal(b.rejected, 'Parts of the link this page doesn’t use were left out: <img src.');
    assert.ok(b.below, 'the rejected keys under the reset link');
    assert.equal(b.imgs, 0, 'a key is text, never markup');
    assert.ok(b.scenEnds, 'the reset link ends its sentence');
    await assertQuiet(seen, 'TEAM Part 5 rejected keys');
  }));

  it('a burst of slider input in one frame makes one patch', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    const before = await patches(page);
    await page.evaluate(() => {
      const slider = document.getElementById('tc-s');
      for (let i = 1; i <= 10; i++) {
        slider.value = String(i);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await settle(page);
    assert.equal(await patches(page), before + 1, 'ten input events, one patch');
    assert.equal(await page.locator('[data-v="l.s"]').textContent(), '+10%', 'the last value drawn');
    await assertQuiet(seen, 'TEAM Part 5 one patch a frame');
  }));
});

// The browser's first drawing takes the build's markup through the same patch every change makes: it must change
// nothing but show the controls only the script works (their hidden attributes). Every mutation inside the drawn
// calculator is recorded from before the page's script runs (the parser's own additions aside).
describe('TEAM Part 5: the browser\'s first drawing is the build\'s', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('mounting changes nothing in the server-rendered calculator but the script\'s own controls', async () => {
    await tabs.context.addInitScript(() => {
      window.calcMutations = [];
      new MutationObserver((list) => {
        for (const m of list) {
          const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          // The parser only adds nodes as it reads the page; a script's change removes or rewrites one.
          if (!el?.closest?.('[data-calc-body]') || (m.type === 'childList' && !m.removedNodes.length)) continue;
          window.calcMutations.push({ type: m.type, attr: m.attributeName, what: `${el.localName}.${[...el.classList].join('.')}${Object.keys(el.dataset).map((k) => `[${k}]`).join('')}` });
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    await withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
      await page.waitForTimeout(100);
      const changes = await page.evaluate(() => window.calcMutations);
      const unexpected = changes.filter((m) => !(m.type === 'attributes' && m.attr === 'hidden' && /\[calcCopy\]|\[calcSlide\]|\.tc-incl|\[calcOpen\]/.test(m.what)));
      assert.deepEqual(unexpected, [], 'the first patch changes nothing');
      assert.ok(changes.length >= 3, 'the script showed its controls');
      await assertQuiet(seen, 'TEAM Part 5 on mount');
    });
  });
});

// A link naming another hospital while the participants' file won't load: the page stays on the default hospital's
// public numbers and its polite line says the one thing that matters, the failure (not also that the link was dropped).
describe('TEAM Part 5 when its file won\'t load', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('one sentence, the failure; the default hospital, its public numbers', async () => {
    await tabs.context.route(/\/assets\/team-calc\.[0-9a-f]{8}\.json$/, (route) => route.abort());
    await withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
      // A participant other than the default, from the CCNs the page carries (the file itself won't load).
      const ccn = await page.evaluate(() => {
        const { row, ccns } = JSON.parse(document.getElementById('tc-data').textContent);
        return ccns.match(/.{6}/g).find((c) => c !== row[0]);
      });
      await page.evaluate((c) => { location.hash = `#team&h=${c}&t=2&n.LEJR=40`; }, ccn);
      await eventually(async () => (await page.locator('[data-calc-say]').textContent()) !== '', 'the polite line speaks');
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-calc-say]').textContent(), 'The list of TEAM hospitals didn\u2019t load. Try again.');
      const s = await calcSays(page);
      assert.ok(s.track === '3' && s.srcN !== 'your number' && !s.banner, 'nothing from the link applied');
    });
  });
});

describe('TEAM Part 5 without JavaScript', () => {
  const tabs = useContext(shared, { javaScript: false });
  it('the default hospital\'s numbers show; the controls that need the script stay hidden', () => withPage(tabs, { path: PROGRAM_PATH }, async (page) => {
    assert.ok(await page.locator('.tc__nojs').isVisible());
    assert.ok(/\$/.test(await page.locator('[data-v="out.range"]').textContent()), 'the band in dollars');
    assert.equal(await page.locator('[data-calc-random]').isVisible(), false);
    assert.equal(await page.locator('#tc-pick').isVisible(), false);
  }));
});
