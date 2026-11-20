// The TEAM pages against the field's bar, in a real browser: the calculator's "Copy for a slide"; a Windows contrast
// theme (forced colors) on the program page and a participant's hub page; a larger default font (20px and 24px, set as
// the browser's own setting, so the pages' em breakpoints follow it) on a 320px phone and a 1280px laptop, and 20px and
// 22px on a 390px phone; the quality table opened on a 390px phone; and the calculator's slider under a 4x CPU
// throttle. Runs against dist/ (make build) or any URL; see site.js. The participant
// is picked by property; failures name elements by tag and class, never a hospital or a dollar figure.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fill, t } from '../../sites/team/web/calc-copy.js';
import { loadTeam } from '../../sites/team/web/data.js';
import { METHODS_PATH, PROGRAM_PATH } from '../../sites/team/web/links.js';
import { SETTLE_MS } from '../../web/client/live-status.js';
import { hospitalPathOf } from '../../web/site.js';
import { CONCURRENCY, ENGINE, assertNoSideways, assertQuiet, eventually, settle, useBrowser, useContext, withPage } from './lib.js';

const shared = useBrowser();

// A participant with public episodes (so its section draws the ruler) and a public Track 2 flag (the longest status).
const PARTICIPANT = loadTeam().participants.find((p) => p.active && p.target > 0 && p.track2Flags.length > 0);
assert.ok(PARTICIPANT, 'a TEAM participant with public episodes and a Track 2 flag');
const HUB_PATH = hospitalPathOf('hub', PARTICIPANT.ccn);
const CHROMIUM_ONLY = 'a Chromium setting (CDP); the other engines have no way to set it from a test';

// ---------- "Copy for a slide" ----------

// The clipboard as the page sees it: every write recorded, every read counted (the page must never read it).
function fakeClipboard() {
  window.copied = [];
  window.clipboardReads = 0;
  const read = async () => {
    window.clipboardReads += 1;
    return '';
  };
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => { window.copied.push(text); }, readText: read, read },
  });
}

describe('TEAM Part 5: "Copy for a slide"', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('copies the scenario as plain text, "includes your numbers" only once the reader typed; the clipboard is written, never read', async () => {
    await tabs.context.addInitScript(fakeClipboard);
    await withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
      const button = page.locator('[data-calc-slide]');
      const status = page.locator('#calc .tc-copied');
      const copied = () => page.evaluate(() => window.copied);

      await button.click();
      await eventually(async () => (await copied()).length === 1, 'the text copied');
      const [first] = await copied();
      const range = await page.locator('[data-v="out.range"]').textContent();
      const lines = first.split('\n');
      assert.ok(lines.length >= 6 && lines.every((l) => l.trim()), 'one fact a line');
      assert.ok(lines[0].includes(await page.locator('#calc [data-v="name"]').textContent()), 'the hospital first');
      assert.ok(first.includes(range), 'the band\'s range as the page shows it');
      const track = await page.locator('input[name="tc-track"]:checked').getAttribute('value');
      assert.ok(first.includes(fill('trackName', { n: track })), 'the track');
      assert.ok(first.includes(t('slideHyp')), '"Hypothetical · standardized dollars"');
      assert.ok(/^Sources: CMS/m.test(first), 'the source line');
      assert.ok(!first.includes(t('tagMine')), 'nothing typed: no "your numbers"');
      assert.equal(await status.textContent(), t('slideCopied'));

      // A typed count: the result the text carries includes it, and says so.
      await page.locator('#tc-n-LEJR').fill('120');
      await page.locator('#tc-n-LEJR').press('Tab');
      await button.click();
      await eventually(async () => (await copied()).length === 2, 'the text copied again');
      const second = (await copied())[1];
      assert.ok(second.includes(t('tagMine')), 'typed: "includes your numbers"');
      assert.ok(second.includes(await page.locator('[data-v="l.result"]').textContent()), 'the result with the reader\'s number in it');

      // Where the browser refuses, the text shows, selected, under the buttons; the link's line stays hidden.
      await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
      await button.click();
      const shown = page.locator('[data-calc-slide-text]');
      await eventually(async () => shown.isVisible(), 'the text shown to copy by hand');
      assert.ok((await shown.textContent()).includes(t('tagMine')), 'the same text');
      assert.equal(await page.evaluate(() => window.getSelection().toString().length > 0), true, 'and selected');
      assert.equal(await page.locator('[data-calc-link]').isVisible(), false, 'the link\'s line stays hidden');
      assert.equal(await page.evaluate(() => window.clipboardReads), 0, 'the clipboard is never read');
      await assertQuiet(seen, 'TEAM Part 5 copy for a slide');
    });
  });
});

// ---------- forced colors ----------

// Read in the page under forced colors: each named mark's color (its stroke, fill, border or background, as asked)
// against the page's canvas. A mark passes when its color is opaque enough to see and is not the canvas's own.
const marksIn = (page, asks) => page.evaluate((asks) => {
  const rgba = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c ?? '');
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const canvas = rgba(getComputedStyle(document.body).backgroundColor);
  const seen = (c) => {
    const x = rgba(c);
    return Boolean(x && x.a > 0.3 && !(canvas && x.r === canvas.r && x.g === canvas.g && x.b === canvas.b));
  };
  return Object.fromEntries(asks.map(([key, selector, prop]) => {
    // A pattern's shapes are never drawn where they stand, only where the pattern fills: they count as found.
    const el = [...document.querySelectorAll(selector)].find((e) => e.closest('pattern') || e.checkVisibility());
    return [key, el ? seen(getComputedStyle(el)[prop]) : 'missing'];
  }));
}, asks);

describe('the TEAM pages in a contrast theme (forced colors)', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  const forced = async (page) => {
    await page.emulateMedia({ forcedColors: 'active' });
    return page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  };

  it('the program page: the payoff line and its band, the map\'s outline and labels, the result box, the chosen track, "your number"', (t) => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    if (!(await forced(page))) return t.skip(`${ENGINE} does not emulate forced colors`);
    await page.locator('#tc-n-LEJR').fill('120');
    await page.locator('#tc-n-LEJR').press('Tab');
    await settle(page);
    const s = await marksIn(page, [
      ['payoff line', '#calc .chart-payoff__gain, #calc .chart-payoff__loss', 'stroke'],
      ['payoff band', '#calc .chart-payoff__band', 'stroke'],
      ['map outline', '.chart-div__reader', 'stroke'],
      ['map labels', '.chart-div__price', 'fill'],
      ['result box border', '#calc .tc-out', 'borderTopColor'],
      ['chosen track', '.tc-track__opt:has(input:checked)', 'backgroundColor'],
      ['"your number"', '#calc [data-v="tag"]', 'color'],
    ]);
    for (const [mark, ok] of Object.entries(s)) assert.equal(ok, true, `${mark} visible under forced colors`);
    const cues = await page.evaluate(() => ({
      tag: getComputedStyle(document.querySelector('#calc [data-v="tag"]')).fontStyle,
      tagLine: getComputedStyle(document.querySelector('#calc [data-v="tag"]')).textDecorationLine,
      boxLine: getComputedStyle(document.querySelector('#calc .tc-src--mine')).textDecorationLine,
      on: getComputedStyle(document.querySelector('.tc-track__opt:has(input:checked)')).backgroundColor,
      off: getComputedStyle(document.querySelector('.tc-track__opt:not(:has(input:checked))')).backgroundColor,
    }));
    assert.equal(cues.tag, 'italic', '"your number" keeps a cue that is not color');
    assert.ok(cues.tagLine.includes('underline') && cues.boxLine.includes('underline'), '"your number" underlined, a cue beyond italic');
    assert.notEqual(cues.on, cues.off, 'the chosen track stands apart from the others');
    await assertQuiet(seen, 'the TEAM program page in forced colors');
  }));

  it('a participant\'s hub page: the ruler\'s range, its limits and its hatched walls', (t) => withPage(tabs, { path: HUB_PATH, watched: true }, async (page, { seen }) => {
    if (!(await forced(page))) return t.skip(`${ENGINE} does not emulate forced colors`);
    await page.locator('[data-team]').scrollIntoViewIfNeeded();
    await settle(page);
    const s = await marksIn(page, [
      ['range', '[data-team] .chart-ruler__loss, [data-team] .chart-ruler__gain', 'fill'],
      ['limits', '[data-team] .chart-ruler__limit', 'stroke'],
      ['hatch', '[data-team] svg[data-fit="wide"] .chart-hatch rect', 'fill'],
    ]);
    for (const [mark, ok] of Object.entries(s)) assert.equal(ok, true, `${mark} visible under forced colors`);
    await assertQuiet(seen, 'a TEAM participant\'s hub page in forced colors');
  }));
});

// ---------- a larger default font ----------

// The browser's own default font size (Chrome's Settings > Appearance > Font size), set before the page loads.
const fontSize = (px) => async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: px } });
};

// Read in the page: every element that cuts its own content off (overflow hidden or clip, a box's value included) and
// every block whose words run past its own box, each by tag and class. Not counted: a 1px box (words kept for screen
// readers only), text the page truncates on purpose with an ellipsis (the followed hospital's chip: its whole name is
// in the page), boxes that scroll (a table's frame, the tabs; checked below), and SVG (drawn in px, not text size).
const clipping = (page) => page.evaluate(() => {
  const name = (el) => `${el.localName}${[...el.classList].map((c) => `.${c}`).join('')}${el.id ? `#${el.id}` : ''}`;
  const clips = (o) => o === 'hidden' || o === 'clip';
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  const clipped = [];
  const spilled = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || !el.checkVisibility() || el.clientWidth <= 1 || el.clientHeight <= 1) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis') continue;
    const [dx, dy] = [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight];
    if ((clips(cs.overflowX) && dx > 1) || (clips(cs.overflowY) && dy > 1)) clipped.push(name(el));
    else if (cs.overflowX === 'visible' && cs.display !== 'inline' && ownText(el) && dx > 1) spilled.push(name(el));
  }
  return { clipped, spilled };
});

// The calculator, still usable: the episode table inside its column, every box inside the window; the quality table's
// boxes, where larger text makes its frame scroll, each brought into view by the focus; a typed number taken.
async function assertCalcUsable(page, what) {
  await page.locator('#tc-q > summary').click();
  const s = await page.evaluate(() => {
    const frame = document.querySelector('.tc-ep').parentElement;
    const outside = [];
    for (const input of document.querySelectorAll('#calc input:not([type="radio"]):not([type="checkbox"])')) {
      if (!input.checkVisibility()) continue;
      input.focus();
      const r = input.getBoundingClientRect();
      const box = input.closest('.tc-scroll')?.getBoundingClientRect() ?? { left: 0, right: innerWidth };
      if (r.width < 24 || r.left < Math.max(0, box.left) - 1 || r.right > Math.min(innerWidth, box.right) + 1) outside.push(input.id || input.dataset.in || input.type);
    }
    document.activeElement.blur();
    return { tableFits: frame.scrollWidth <= frame.clientWidth + 1, outside };
  });
  assert.ok(s.tableFits, `${what}: the episode table fits its column`);
  assert.deepEqual(s.outside, [], `${what}: boxes out of reach or too narrow`);
  await page.locator('#tc-n-LEJR').fill('120');
  await page.locator('#tc-n-LEJR').press('Tab');
  assert.equal(await page.locator('#calc [data-v="tag"]').textContent(), t('tagMine'), `${what}: a typed number taken`);
}

const SCALED = [['the TEAM program page', PROGRAM_PATH], ['the TEAM Methods page', METHODS_PATH], ['a TEAM participant\'s hub page', HUB_PATH]];
// Each default font size with each width: the small phone and the laptop at 20px and 24px, and a common phone (390px)
// at 20px and 22px, where the 18em large-text rules do not apply.
const SCALES = [[20, 320], [20, 1280], [24, 320], [24, 1280], [20, 390], [22, 390]];
for (const [px, width] of SCALES) {
  describe(`the TEAM pages with a ${px}px default font at ${width} px`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width, height: 900 });
    for (const [what, path] of SCALED) {
      it(`${what}: nothing clipped or run past its box, no sideways scroll${path === PROGRAM_PATH ? '; the calculator usable' : ''}`, (t) => {
        if (ENGINE !== 'chromium') return t.skip(CHROMIUM_ONLY);
        return withPage(tabs, { path, watched: true, prepare: fontSize(px) }, async (page, { seen }) => {
          assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), `${px}px`, 'the default font took');
          const s = await clipping(page);
          assert.deepEqual(s.clipped, [], `${what}: clipped`);
          assert.deepEqual(s.spilled, [], `${what}: words past their box`);
          await assertNoSideways(page, `${what} at ${px}px`);
          if (path === PROGRAM_PATH) await assertCalcUsable(page, `the calculator at ${px}px`);
          await assertQuiet(seen, `${what} at ${px}px`);
        });
      });
    }
  });
}

// At a phone's width and the default font, "Quality score…" opened: its table stays in its own .tc-scroll frame, which
// keeps to the calculator's column, and the page never scrolls sideways.
describe('TEAM Part 5 at 390 px: the quality table opened', () => {
  const tabs = useContext(shared, { width: 390, height: 844 });
  it('the quality table held in its frame, the frame inside its column, no sideways scroll', () => withPage(tabs, { path: PROGRAM_PATH, watched: true }, async (page, { seen }) => {
    await page.locator('#tc-q > summary').click();
    const s = await page.evaluate(() => {
      const table = document.querySelector('#tc-q .tc-qt');
      const frame = table?.parentElement;
      const column = frame?.closest('.tc-left, .tc-right, .tc-grid');
      const [f, c] = [frame?.getBoundingClientRect(), column?.getBoundingClientRect()];
      return {
        shown: Boolean(table?.checkVisibility()),
        framed: Boolean(frame?.classList.contains('tc-scroll')),
        inColumn: Boolean(f && c && f.left >= c.left - 1 && f.right <= c.right + 1),
      };
    });
    assert.equal(s.shown, true, 'the quality table shows');
    assert.equal(s.framed, true, 'the table sits in its .tc-scroll frame');
    assert.equal(s.inColumn, true, 'the frame keeps to the calculator\'s column');
    // Every column, Weight too, fits the frame: nothing of the table waits off-screen to be scrolled to.
    const fit = await page.evaluate(() => {
      const frame = document.querySelector('#tc-q .tc-scroll');
      const cite = document.querySelector('#tc-q .tc-foot > .tm-cite');
      return { over: frame.scrollWidth - frame.clientWidth, cite: cite && getComputedStyle(cite).display };
    });
    assert.ok(fit.over <= 1, `the quality table is ${fit.over} px wider than its frame`);
    // The note's citation on its own line, so the note's last number ("at 50.") never reads into it.
    assert.equal(fit.cite, 'block');
    // Tap targets (WCAG 2.5.8): each low-volume box's label at least 24 by 24, and "by measure" at least 24 high.
    const targets = await page.evaluate(() => ({
      lv: [...document.querySelectorAll('#calc .tc-lvhit')].map((l) => l.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)),
      open: document.querySelector('#calc [data-calc-open]').getBoundingClientRect().height,
    }));
    assert.ok(targets.lv.length === 5 && targets.lv.every((x) => x >= 24), `low-volume targets: ${targets.lv.join(', ')} px`);
    assert.ok(targets.open >= 24, `"by measure" is ${targets.open} px high`);
    // A signed amount never splits from its sign at a line's end: each .nw figure in the calculator sits on one line.
    const split = await page.evaluate(() => [...document.querySelectorAll('#calc .nw')].filter((el) => el.checkVisibility() && new Set([...el.getClientRects()].map((r) => Math.round(r.top))).size > 1).map((el) => el.parentElement.dataset.v ?? el.parentElement.className));
    assert.deepEqual(split, [], 'signed amounts broken across lines');
    await assertNoSideways(page, 'the TEAM program page with the quality table open at 390 px');
    await assertQuiet(seen, 'the TEAM program page with the quality table open');
  }));
});

// The Methods page's sources on a phone: each source a card (nothing of either table cut off by its frame), and on a
// laptop the two tables ruled alike (hairlines, no banding on the longer one); the head clear of the sub-nav.
describe('the TEAM Methods page\'s sources', () => {
  for (const width of [390, 1280]) {
    const tabs = useContext(shared, { width, height: 900 });
    it(`at ${width} px: every source table fits its frame; both tables ruled alike; the head clear of the sub-nav`, () => withPage(tabs, { path: METHODS_PATH, watched: true }, async (page, { seen }) => {
      const s = await page.evaluate(() => {
        const tables = [...document.querySelectorAll('.tm-meth__pins')];
        const frames = tables.map((tb) => tb.closest('.printout__scroll'));
        const fills = tables.flatMap((tb) => [...tb.tBodies[0].rows].map((tr) => getComputedStyle(tr).backgroundColor));
        const nav = document.querySelector('nav.nav')?.getBoundingClientRect();
        const head = document.querySelector('.page__head').getBoundingClientRect();
        return {
          tables: tables.length,
          cut: frames.filter((f) => f.scrollWidth > f.clientWidth + 1).length,
          fills: [...new Set(fills)],
          gap: nav ? head.top - nav.bottom : null,
        };
      });
      assert.equal(s.tables, 2, 'two source tables');
      assert.equal(s.cut, 0, 'source tables cut off by their frame');
      assert.equal(s.fills.length, 1, 'one row treatment for both tables');
      assert.ok(s.gap !== null && s.gap >= 20, `the head ${s.gap} px under the sub-nav`);
      await assertNoSideways(page, `the TEAM Methods page at ${width} px`);
      await assertQuiet(seen, 'the TEAM Methods page');
    }));
  }
});

// ---------- the slider under a CPU throttle ----------

// Records, from before the drag: at each animation frame, the calculator's patches and figure draws so far; the time of
// each slider input; the time and words of each change to the polite line.
function recordFrames() {
  const calc = document.getElementById('calc');
  const say = calc.querySelector('[data-calc-say]');
  Object.assign(window, { frames: [], inputs: [], says: [], recording: true });
  const tick = () => {
    window.frames.push([Number(calc.dataset.patches), Number(calc.dataset.draws ?? 0)]);
    if (window.recording) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.getElementById('tc-s').addEventListener('input', () => window.inputs.push(performance.now()));
  new MutationObserver(() => window.says.push([performance.now(), say.textContent])).observe(say, { childList: true, characterData: true, subtree: true });
}

describe('TEAM Part 5 under a 4x CPU throttle', () => {
  const tabs = useContext(shared, { width: 1280, height: 900 });
  it('dragging the "all five" slider: at most one patch and one figure a frame; the polite line only once the reader pauses', (t) => {
    if (ENGINE !== 'chromium') return t.skip(CHROMIUM_ONLY);
    const throttle = async (page) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    };
    return withPage(tabs, { path: PROGRAM_PATH, watched: true, prepare: throttle }, async (page, { seen }) => {
      const slider = page.locator('#tc-s');
      await slider.scrollIntoViewIfNeeded();
      const was = await page.locator('[data-v="l.s"]').textContent();
      await page.evaluate(recordFrames);
      const box = await slider.boundingBox();
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 2, y, { steps: 40 });
      await page.mouse.up();
      // Past the pause the polite line waits for, and a frame more.
      await page.waitForTimeout(SETTLE_MS * 3);
      await settle(page);
      const r = await page.evaluate(() => {
        window.recording = false;
        return { frames: window.frames, inputs: window.inputs, says: window.says };
      });

      assert.ok(r.inputs.length >= 10, `the drag sent input events (${r.inputs.length})`);
      assert.notEqual(await page.locator('[data-v="l.s"]').textContent(), was, 'the slider moved the scenario');
      const steps = r.frames.slice(1).map(([p, d], i) => [p - r.frames[i][0], d - r.frames[i][1]]);
      const [patches, draws] = [Math.max(...steps.map((s) => s[0])), Math.max(...steps.map((s) => s[1]))];
      assert.ok(patches <= 1, `at most one patch a frame (most in one frame: ${patches})`);
      assert.ok(draws <= 1, `at most one figure a frame (most in one frame: ${draws})`);
      assert.ok(r.frames.at(-1)[0] - r.frames[0][0] >= 2, 'the drag redrew the calculator');

      assert.ok(r.says.length >= 1, 'the polite line spoke once the drag ended');
      for (const [at] of r.says) {
        const lastInput = Math.max(...r.inputs.filter((i) => i <= at));
        assert.ok(at - lastInput >= SETTLE_MS - 5, `the polite line waited ${Math.round(at - lastInput)} ms after the last input, not ${SETTLE_MS}`);
      }

      // A burst faster than the frames (an input every few milliseconds, as a quick drag or a held key sends them): the
      // patches still come at most one a frame, so there are fewer of them than inputs.
      const burst = await page.evaluate(async () => {
        const slider = document.getElementById('tc-s');
        const calc = document.getElementById('calc');
        const count = () => Number(calc.dataset.patches);
        Object.assign(window, { frames: [], recording: true });
        const tick = () => {
          window.frames.push([count(), Number(calc.dataset.draws)]);
          if (window.recording) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const before = count();
        const n = 60;
        for (let i = 0; i < n; i++) {
          slider.value = String(-(i % 20));
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.recording = false;
        return { n, patches: count() - before, frames: window.frames };
      });
      const burstSteps = burst.frames.slice(1).map(([p, d], i) => Math.max(p - burst.frames[i][0], d - burst.frames[i][1]));
      assert.ok(Math.max(...burstSteps) <= 1, 'the burst: at most one patch and one figure a frame');
      assert.ok(burst.patches >= 1 && burst.patches < burst.n, `the burst coalesced (${burst.n} inputs, ${burst.patches} patches)`);
      await assertQuiet(seen, 'TEAM Part 5 under a CPU throttle');
    });
  });
});
