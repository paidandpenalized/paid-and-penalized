// The HACRP hospital page's charts in a real browser, at the two phone widths and a desktop's: the peer chart's words
// ("among hospitals like it": each group's name and size, its share cut, the hospital's mark and the axis) never
// overlap each other and stay inside the drawing, and on the wide drawing each row's words stay clear of its plot; the
// what-if's payment-cut chart keeps its cut label clear of CMS's line once the what-if is used. Pages: the HACRP
// hospital samples with a score (site.js samplePages) and the three hardest peer charts (site.js peerChartSamples).
// Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js. Messages name a page by its type, never a
// hospital.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONCURRENCY, assertQuiet, lowerAMeasure, settle, useBrowser, useContext, withPage } from './lib.js';
import { peerChartSamples, samplePages } from './site.js';

const SAMPLES = samplePages().filter((p) => p.type === 'hospital-cut' || p.type === 'hospital-not-cut');
const PEERS = [...SAMPLES, ...peerChartSamples()];
// The phone's drawing at two phone widths, and the wide drawing at a desktop width.
const WIDTHS = [320, 390, 1440];
// Units (of the drawing) two words' boxes may share across, or a box may reach past the drawing, before it counts; and
// up and down: a glyph's box is taller than its ink, so two lines set the kit's 13 units apart share about 1.5 units
// of box with no ink touching, while words on one line share nearly all of theirs.
const SLACK = { x: 0.5, y: 3 };

const shared = useBrowser();

// In the page: the shown drawing of the peer chart (the phone's or the wide one), its words' boxes in the drawing's
// own units (through the axis group's transform), and what is wrong with them: words that overlap, words past the
// drawing, and (wide) a row's words running onto its plot. Words are named by class and their first few characters.
function peerFacts(slack) {
  const svg = [...document.querySelectorAll('svg.chart--ridges')].find((el) => el.checkVisibility());
  if (!svg) return null;
  const toSvg = svg.getScreenCTM().inverse();
  // Each line of words' box in the drawing's units, from its box on screen by its characters (window.svgBox: lib.js).
  const boxOf = (el) => {
    const b = window.svgBox(el);
    const [p, q] = [new DOMPoint(b.left, b.top).matrixTransform(toSvg), new DOMPoint(b.right, b.bottom).matrixTransform(toSvg)];
    return { x0: Math.min(p.x, q.x), y0: Math.min(p.y, q.y), x1: Math.max(p.x, q.x), y1: Math.max(p.y, q.y) };
  };
  const vb = svg.viewBox.baseVal;
  const named = (el) => `${el.getAttribute('class') ?? el.parentElement.getAttribute('class')} "${el.textContent.trim().slice(0, 12)}…"`;
  // Each line of words: a text, or each of its lines (a tspan with its own x) when it has several.
  const words = [...svg.querySelectorAll('text')].flatMap((el) => {
    const parts = [...el.querySelectorAll(':scope > tspan[x]')];
    return (parts.length ? parts : [el]).map((part) => ({ el: part, b: boxOf(part) }));
  }).filter(({ b }) => b.x1 > b.x0);
  const overlaps = [];
  for (const [i, a] of words.entries()) {
    for (const c of words.slice(i + 1)) {
      if (Math.min(a.b.x1, c.b.x1) - Math.max(a.b.x0, c.b.x0) > slack.x && Math.min(a.b.y1, c.b.y1) - Math.max(a.b.y0, c.b.y0) > slack.y) overlaps.push(`${named(a.el)} and ${named(c.el)}`);
    }
  }
  const outside = words.filter(({ b }) => b.x0 < vb.x - slack.x || b.y0 < vb.y - slack.x || b.x1 > vb.x + vb.width + slack.x || b.y1 > vb.y + vb.height + slack.x)
    .map(({ el, b }) => `${named(el)} (${Math.round(b.x0)} to ${Math.round(b.x1)} of ${vb.width})`);
  // A row: a group holding a baseline; its plot starts at the baseline's left end, which is past the words' column
  // only on the wide drawing.
  const onPlot = [];
  for (const g of svg.querySelectorAll('g')) {
    const base = g.querySelector(':scope > line.chart-baseline');
    const plotLeft = Number(base?.getAttribute('x1'));
    if (!base || plotLeft < vb.width / 5) continue;
    for (const el of g.querySelectorAll(':scope > text')) {
      const b = boxOf(el);
      if (b.x0 < plotLeft && b.x1 > plotLeft - slack.x) onPlot.push(named(el));
    }
  }
  return { fit: svg.dataset.fit, overlaps, outside, onPlot };
}

// In the page: the payment-cut chart's cut label, its words' left edge against CMS's line (the drop's right edge).
function cliffFacts() {
  const label = document.querySelector('#whatif .wi-cliff__level--cut');
  const drop = document.querySelector('#whatif .wi-cliff__drop');
  if (!label || !drop) return null;
  const range = document.createRange();
  range.selectNodeContents(label);
  return { words: range.getBoundingClientRect().left, line: drop.getBoundingClientRect().right };
}

for (const width of WIDTHS) {
  describe(`HACRP hospital charts, ${width} px wide`, { concurrency: CONCURRENCY }, () => {
    const tabs = useContext(shared, { width });
    for (const { name, path } of PEERS) {
      it(`${name}: the peer chart's words fit`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
        const got = await page.evaluate(peerFacts, SLACK);
        assert.ok(got, `${name}: a peer chart is shown`);
        assert.deepEqual(got.overlaps, [], `${name} (${got.fit} drawing): words that overlap`);
        assert.deepEqual(got.outside, [], `${name} (${got.fit} drawing): words past the drawing`);
        assert.deepEqual(got.onPlot, [], `${name} (${got.fit} drawing): a row's words on its plot`);
        await assertQuiet(seen, name);
      }));
    }
    // The payment-cut chart at the phone widths, where its pit is narrowest.
    for (const { name, path } of width < 641 ? SAMPLES : []) {
      it(`${name}: the what-if used, the cut label is clear of CMS's line`, () => withPage(tabs, { path, watched: true }, async (page, { seen }) => {
        await lowerAMeasure(page.locator('#whatif'));
        await settle(page);
        const got = await page.evaluate(cliffFacts);
        assert.ok(got, `${name}: the payment-cut chart is shown`);
        assert.ok(got.words >= got.line, `${name}: the cut label's words start ${Math.round(got.line - got.words)} px left of CMS's line`);
        await assertQuiet(seen, name);
      }));
    }
  });
}
