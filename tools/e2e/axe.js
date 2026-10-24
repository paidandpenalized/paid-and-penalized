// The axe-core run the browser checks share: every page type in pages.test.js, and axe.test.js's controls and open
// search lists. axe runs at WCAG 2.2 AA, read from node_modules into the page with a protocol evaluation, which the
// page's Content Security Policy does not govern, so the page keeps its real policy. An audit requires zero violations
// and names each rule once, with the selector of every element it flags. No rule is ever switched off for a page or
// the site; a confirmed false positive would be set aside by rule and exact selector, with the reason beside it, and
// there has been none.
//
// axe judges each page with three changes, made for the run only:
//   - every <details> is opened (openFolds): what a fold keeps closed is not laid out, so axe skips it;
//   - the body's grain image is replaced by one flat colour, the grain's worst pixel for text (flatten, grainWorst). The
//     grain is a faint noise image; over it axe reports "background could not be determined" and leaves nearly all text
//     unjudged. The grain darkens the light paper and lightens the dark one, a little more at some pixels than others, so
//     the run lays down the paper as the grain leaves it at its darkest pixel (light) or its lightest (dark), measured in
//     the browser, and axe holds every text colour on the paper to 4.5:1 there. axe.test.js's control prints both colours;
//   - the two decorations drawn over text are hidden: the scroll frames' fade (a 28px gradient over a table's right edge)
//     and the tape's torn edge. axe gives up on every cell of a table one of them overlaps (about 19,000 cells in a run of
//     every page), and the fade only dims a strip of it.
// Two checks keep this honest: some text must have been judged on every page, and none may be left unjudged because of
// an image, a gradient or a pseudo-element drawn over it (what flatten removes). axe still leaves some text unjudged,
// which is not covered here: text inside an SVG (the charts' labels), and in HTML text overlapped or partly obscured by
// another element, text beside an image node, lone characters and glyphs such as the minus sign or the stars.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { settle } from './lib.js';

const AXE = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// The widths axe judges at: a desktop width, a common phone's and the narrowest phone width pages are designed for
// (where links sit closest).
export const AXE_WIDTHS = [1280, 390, 320];
// The reasons axe gives (the contrast check's messageKey) for leaving text unjudged because of what is drawn behind or over it.
const DRAWN_OVER = ['bgImage', 'bgGradient', 'pseudoContent'];

// Opens every closed <details>, resolving once each has toggled (the scripts that watch a fold have run) and the page
// has painted twice.
export async function openFolds(page) {
  await page.evaluate(async () => {
    const closed = [...document.querySelectorAll('details:not([open])')];
    await Promise.all(closed.map((d) => new Promise((resolve) => { d.addEventListener('toggle', resolve, { once: true }); d.open = true; })));
  });
  await settle(page);
}

// The body's paper as the grain leaves it, measured in the page: the grain's tile drawn on a canvas over the body's own
// colour, and of its pixels the one that leaves text the least contrast: the darkest on a light paper, the lightest on a
// dark one. Returns { paper, worst }, each as the browser prints a colour ('rgb(r, g, b)'); worst is paper when the body
// has no image.
export const grainWorst = (page) => page.evaluate(async () => {
  const body = getComputedStyle(document.body);
  const paper = body.backgroundColor;
  // The grain is the body's one image layer (its others are none), a data: URL of an SVG holding its own url(#filter).
  const src = /url\("(.*?)"\)/.exec(body.backgroundImage)?.[1];
  if (!src) return { paper, worst: paper };
  const tile = new Image();
  tile.src = src;
  await tile.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: tile.naturalWidth, height: tile.naturalHeight });
  const draw = canvas.getContext('2d', { willReadFrequently: true });
  draw.fillStyle = paper;
  draw.fillRect(0, 0, canvas.width, canvas.height);
  const flat = draw.getImageData(0, 0, 1, 1).data;
  draw.drawImage(tile, 0, 0);
  const { data } = draw.getImageData(0, 0, canvas.width, canvas.height);
  // WCAG's relative luminance of the pixel at byte offset i of px.
  const channel = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (px, i) => 0.2126 * channel(px[i]) + 0.7152 * channel(px[i + 1]) + 0.0722 * channel(px[i + 2]);
  const light = luminance(flat, 0) > 0.5;
  let at = 0;
  for (let i = 4; i < data.length; i += 4) {
    if (light ? luminance(data, i) < luminance(data, at) : luminance(data, i) > luminance(data, at)) at = i;
  }
  return { paper, worst: `rgb(${data[at]}, ${data[at + 1]}, ${data[at + 2]})` };
});

// Makes the page what axe can judge (see the header): the body's grain replaced by the colour `paper`, and the
// decorations drawn over text hidden. A constructed stylesheet, which the page's policy allows (a <style> it refuses).
const flatten = (page, paper) => page.evaluate((css) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}, `body { background: ${paper} !important; } .printout::after, .receipt::after { display: none !important; }`);

// Runs axe on the page as it is, flattened: its violations ({ id, impact, help, nodes: [{ target, summary }] }), how
// many rules passed (a run that checked nothing passes nothing), whether the contrast rule passed on any element (some
// text axe could judge: passes are not a result type asked for, so axe lists each passing rule with its first element
// only) and the targets of the elements whose contrast axe left unjudged because of an image, a gradient or a
// pseudo-element drawn behind or over the text.
export async function runAxe(page) {
  await flatten(page, (await grainWorst(page)).worst);
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE);
  return page.evaluate(async ([tags, drawnOver]) => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] });
    const target = (n) => n.target.map((t) => (Array.isArray(t) ? t.join(' >> ') : t)).join(' >> ');
    const checks = (n) => [...n.any, ...n.all, ...n.none];
    return {
      passes: results.passes.length,
      contrastPassed: results.passes.find((r) => r.id === 'color-contrast')?.nodes.length ?? 0,
      unjudgedDrawnOver: results.incomplete.filter((r) => r.id === 'color-contrast')
        .flatMap((r) => r.nodes.filter((n) => checks(n).some((c) => drawnOver.includes(c.data?.messageKey))).map(target)),
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: target(n), summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').trim() })),
      })),
    };
  }, [TAGS, DRAWN_OVER]);
}

const describeViolations = (violations) => violations
  .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.help}\n${v.nodes.map((n) => `    ${n.target}\n      ${n.summary}`).join('\n')}`)
  .join('\n');

// Runs axe and requires that it ran, judged some text, left none unjudged for something drawn behind or over it, and found
// nothing.
export async function audit(page, what) {
  const { violations, passes, contrastPassed, unjudgedDrawnOver } = await runAxe(page);
  assert.ok(passes > 20, `${what}: axe passed only ${passes} rules: did it run?`);
  assert.ok(contrastPassed > 0, `${what}: axe judged the contrast of no text`);
  assert.equal(unjudgedDrawnOver.length, 0, `${what}: axe could not judge the contrast of ${unjudgedDrawnOver.length} elements behind or over an image, gradient or pseudo-element (flatten should have removed it), among them ${unjudgedDrawnOver.slice(0, 6).join(', ')}`);
  assert.equal(violations.length, 0, `${what}: axe violations\n${describeViolations(violations)}`);
}
