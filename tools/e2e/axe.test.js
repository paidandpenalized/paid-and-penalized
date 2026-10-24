// axe-core at WCAG 2.2 AA on every page type, light and dark, at a desktop and two phone widths: zero violations. axe is
// injected from node_modules into contexts created with bypassCSP (the page's policy would refuse an injected script);
// no other browser test does that, so those keep the real policy. A failure names each rule once, with the selector of
// every element it flags. Runs against dist/ (make build) or any URL (E2E_BASE_URL); see lib.js.
//
// axe judges each page with three changes, made for the run only:
//   - every <details> is opened (openFolds): what a fold keeps closed is not laid out, so axe skips it;
//   - the body's grain image is replaced by one flat colour, the grain's worst pixel for text (flatten, grainWorst). The
//     grain is a faint noise image; over it axe reports "background could not be determined" and leaves nearly all text
//     unjudged. The grain darkens the light paper and lightens the dark one, a little more at some pixels than others, so
//     the run lays down the paper as the grain leaves it at its darkest pixel (light) or its lightest (dark), measured in
//     the browser, and axe holds every text colour on the paper to 4.5:1 there. The control below prints both colours;
//   - the two decorations drawn over text are hidden: the scroll frames' fade (a 28px gradient over a table's right edge)
//     and the tape's torn edge. axe gives up on every cell of a table one of them overlaps (about 19,000 cells in a run of
//     every page), and the fade only dims a strip of it.
// Two controls keep this honest: some text must have been judged on every page, and none may be left unjudged because of an
// image, a gradient or a pseudo-element drawn over it (what flatten removes). axe still leaves some text unjudged, which is
// not covered here: text inside an SVG (the charts' labels), and in HTML text overlapped or partly obscured by another
// element, text beside an image node, lone characters and glyphs such as the minus sign or the stars.
// The search list is audited open, on the program page, in its own tests.
//
// A confirmed axe false positive may be excluded in FALSE_POSITIVES: one rule, one selector (exactly as axe prints it),
// the reason beside it. There are none. No rule is ever switched off for a page or the site.
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SITE } from '../../web/site.js';
import { launch, newPage, samplePages, startSite } from './lib.js';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SCHEMES = ['light', 'dark'];
// A desktop width, a common phone's and the narrowest phone width pages are designed for (where links sit closest).
const WIDTHS = [1280, 390, 320];
const HEIGHT = 800;
const PAGES = samplePages();
const HACRP = SITE.sites.hacrp.path;
const AXE = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

// The page as axe can judge it (see the header): the body's grain replaced by the colour `paper` (grainWorst's worst), and
// the decorations drawn over text hidden.
const flatten = (paper) => `body { background: ${paper} !important; } .printout::after, .receipt::after { display: none !important; }`;
// The reasons axe gives (the contrast check's messageKey) for leaving text unjudged because of what is drawn behind or over it.
const DRAWN_OVER = ['bgImage', 'bgGradient', 'pseudoContent'];

// { rule: 'axe-rule-id', selector: '.exact > .selector', reason: 'why axe is wrong here' }
const FALSE_POSITIVES = [];

let site;
let browser;
before(async () => {
  site = await startSite();
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await site?.close();
});

// Opens every closed <details>, resolving once each has toggled (the scripts that watch a fold have run) and the page
// has painted twice.
const openFolds = (page) => page.evaluate(async () => {
  const closed = [...document.querySelectorAll('details:not([open])')];
  await Promise.all(closed.map((d) => new Promise((resolve) => { d.addEventListener('toggle', resolve, { once: true }); d.open = true; })));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

// The body's paper as the grain leaves it, measured in the page: the grain's tile drawn on a canvas over the body's own
// colour, and of its pixels the one that leaves text the least contrast: the darkest on a light paper, the lightest on a
// dark one. Returns { paper, worst }, each as the browser prints a colour ('rgb(r, g, b)'); worst is paper when the body
// has no image.
const grainWorst = (page) => page.evaluate(async () => {
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

// Runs axe on the page as it is, flattened (see the header): its violations ({ id, impact, help, nodes: [{ target,
// summary }] }), how many rules passed (a run that checked nothing passes nothing), how many elements passed the contrast
// rule (the text axe could judge) and the targets of the elements whose contrast axe left unjudged because of an image,
// a gradient or a pseudo-element drawn behind or over the text.
async function runAxe(page) {
  await page.addStyleTag({ content: flatten((await grainWorst(page)).worst) });
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async ([tags, drawnOver]) => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'passes', 'incomplete'] });
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

// Violations left once the confirmed false positives are removed, grouped by rule.
function remaining(violations, falsePositives = FALSE_POSITIVES) {
  return violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !falsePositives.some((f) => f.rule === v.id && f.selector === n.target)) }))
    .filter((v) => v.nodes.length > 0);
}

const describeViolations = (violations) => violations
  .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.help}\n${v.nodes.map((n) => `    ${n.target}\n      ${n.summary}`).join('\n')}`)
  .join('\n');

// Runs axe and requires that it ran, judged some text, left none unjudged for something drawn behind or over it, and found
// nothing.
async function audit(page, what) {
  const { violations, passes, contrastPassed, unjudgedDrawnOver } = await runAxe(page);
  assert.ok(passes > 20, `${what}: axe passed only ${passes} rules: did it run?`);
  assert.ok(contrastPassed > 0, `${what}: axe judged the contrast of no text`);
  assert.equal(unjudgedDrawnOver.length, 0, `${what}: axe could not judge the contrast of ${unjudgedDrawnOver.length} elements behind or over an image, gradient or pseudo-element (flatten should have removed it), among them ${unjudgedDrawnOver.slice(0, 6).join(', ')}`);
  const left = remaining(violations);
  assert.equal(left.length, 0, `${what}: axe violations\n${describeViolations(left)}`);
}

// A fresh tab on the path in the context, loaded and quiet (the scripts have drawn what they draw: the search, the theme
// toggle, the what-if). Returns the tab; the caller closes it.
async function openTab(context, scheme, path) {
  const page = await newPage(context, scheme, site.base);
  try {
    await page.goto(new URL(path, site.base).href, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), scheme === 'dark', `the browser follows the ${scheme} scheme`);
    return page;
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}

describe('axe finds what it should (a positive control)', () => {
  // A page of our own in a context like the real ones, audited the way the real pages are.
  async function control(body) {
    const context = await browser.newContext({ bypassCSP: true });
    try {
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html lang="en"><title>control</title><main><h1>control</h1>${body}</main>`);
      return await runAxe(page);
    } finally {
      await context.close();
    }
  }
  // A transparent 1px image, whole enough to decode (the grain is measured from the body's image).
  const GIF = 'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)';

  it('flags a missing alternative, a nameless button and low contrast', async () => {
    const { violations, passes } = await control(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><button></button><p style="color:#ccc;background:#fff">faint words</p>`);
    assert.ok(passes > 0, 'axe checked rules');
    const ids = violations.map((v) => v.id);
    for (const id of ['image-alt', 'button-name', 'color-contrast']) assert.ok(ids.includes(id), `${id} not among ${ids}`);
  });

  it('reports text over an image, a gradient or under a pseudo-element as unjudged (what flatten exists to avoid)', async () => {
    const { unjudgedDrawnOver } = await control(`<style>#over { position: relative } #over::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 100%; background: linear-gradient(to right, transparent, #fff) }</style>
<p id="img" style="background-image:${GIF}">over an image</p><p id="grad" style="background-image:linear-gradient(#fff,#ddd)">over a gradient</p><p id="over">under a pseudo-element</p>`);
    assert.deepEqual(unjudgedDrawnOver.sort(), ['#grad', '#img', '#over']);
  });

  it('judges text over the body\'s own image once the flat paper is laid over it', async () => {
    const context = await browser.newContext({ bypassCSP: true });
    try {
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html lang="en"><title>control</title><body style="background:${GIF} repeat, #fbfbf8"><main><h1>control</h1><p>words</p></main>`);
      const { unjudgedDrawnOver, contrastPassed } = await runAxe(page);
      assert.deepEqual(unjudgedDrawnOver, []);
      assert.ok(contrastPassed > 0);
    } finally {
      await context.close();
    }
  });

  it('the exclusion list names one rule, one selector and a reason, and removes exactly those nodes', () => {
    for (const f of FALSE_POSITIVES) for (const key of ['rule', 'selector', 'reason']) assert.ok(typeof f[key] === 'string' && f[key].trim(), `a false positive needs a ${key}`);
    const found = [{ id: 'color-contrast', nodes: [{ target: '.a' }, { target: '.b' }] }, { id: 'label', nodes: [{ target: '.a' }] }];
    const targets = (list) => list.map((v) => [v.id, v.nodes.map((n) => n.target)]);
    assert.deepEqual(targets(remaining(found, [])), [['color-contrast', ['.a', '.b']], ['label', ['.a']]], 'no entries: nothing removed');
    assert.deepEqual(targets(remaining(found, [{ rule: 'color-contrast', selector: '.a', reason: 'x' }])), [['color-contrast', ['.b']], ['label', ['.a']]], 'the rule and the selector must both match');
    assert.deepEqual(targets(remaining(found, [{ rule: 'label', selector: '.a', reason: 'x' }])), [['color-contrast', ['.a', '.b']]], 'a rule left with no node is dropped');
    assert.deepEqual(targets(remaining(found, [{ rule: 'color-contrast', selector: '.', reason: 'x' }])), [['color-contrast', ['.a', '.b']], ['label', ['.a']]], 'a selector must match exactly');
  });
});

// The colour the run lays under the text is measured, not the flat paper: the grain darkens the light paper and lightens
// the dark one. Both colours are printed with the run.
describe('the paper axe judges text on is the grain\'s worst pixel', () => {
  const total = (rgb) => rgb.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b);
  for (const scheme of SCHEMES) {
    it(scheme, async (t) => {
      const context = await browser.newContext({ colorScheme: scheme });
      try {
        const { paper, worst } = await grainWorst(await openTab(context, scheme, '/'));
        t.diagnostic(`${scheme}: the paper is ${paper}; the grain's worst pixel for text is ${worst}`);
        assert.notEqual(worst, paper, 'the grain changes the paper');
        if (scheme === 'light') assert.ok(total(worst) < total(paper), `the light paper's worst pixel ${worst} is darker than ${paper}`);
        else assert.ok(total(worst) > total(paper), `the dark paper's worst pixel ${worst} is lighter than ${paper}`);
      } finally {
        await context.close();
      }
    });
  }
});

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    describe(`${scheme}, ${width} px wide`, { concurrency: 4 }, () => {
      let context;
      before(async () => {
        context = await browser.newContext({ colorScheme: scheme, viewport: { width, height: HEIGHT }, bypassCSP: true });
      });
      after(() => context?.close());

      for (const { type, path } of PAGES) {
        // A hospital's test is named by its type, not its address, so the output names no hospital.
        it(type === 'policy' ? `policy ${path}` : type, async () => {
          const page = await openTab(context, scheme, path);
          try {
            await openFolds(page);
            await audit(page, path);
          } finally {
            await page.close();
          }
        });
      }

      // The list the search shows under its box, open with the first match active: in the top bar, and in the program
      // page's hero (the larger box, on top of the page's own content).
      for (const [where, container] of [['the top bar', '.topbar'], ['the hero', 'main']]) {
        it(`the program page, with the search list open in ${where}`, async () => {
          const page = await openTab(context, scheme, HACRP);
          try {
            const box = page.locator(container).getByRole('search').getByRole('combobox');
            await box.pressSequentially('hosp');
            await page.locator(container).getByRole('search').getByRole('option').first().waitFor();
            await box.press('ArrowDown');
            await audit(page, `${HACRP} with the list open in ${where}`);
          } finally {
            await page.close();
          }
        });
      }
    });
  }
}

// Below 600 px three Methods tables stack their rows and clip their column heads (sites/hacrp/web/styles.css). A head
// removed with display: none would leave the stacked cells without the names axe never asks for. Playwright's snapshot of
// the accessibility tree leaves out what is display: none and keeps what is only clipped, in every engine; it models the
// tree from the page rather than reading the browser's own (Chrome's real tree, read through the protocol, has the heads
// too, and loses them with display: none). Each table must show every head it has, and the control shows the check bite.
describe('the tables that stack on a phone keep their column heads', () => {
  const STACKED = ['.receipt--dollars table', 'table.takes', 'table.receipts'];
  const heads = async (table) => ((await table.ariaSnapshot()).match(/^\s*- columnheader\b/gm) ?? []).length;
  let context;
  before(async () => {
    context = await browser.newContext({ viewport: { width: 390, height: HEIGHT }, bypassCSP: true });
  });
  after(() => context?.close());

  for (const selector of STACKED) {
    it(selector, async () => {
      const page = await openTab(context, 'light', `${HACRP}methods/`);
      try {
        const table = page.locator(selector);
        const expected = await table.locator('thead th').count();
        assert.ok(expected >= 3, `${selector} has its column heads in the markup`);
        assert.equal(await heads(table), expected, `${selector}: column heads in the accessibility tree`);
        // The control: the same page with its head removed the way the page once did.
        await page.addStyleTag({ content: `@media (max-width: 600px) { ${selector} thead { display: none !important; } }` });
        assert.equal(await heads(table), 0, `${selector}: the check does not see a head removed with display: none`);
      } finally {
        await page.close();
      }
    });
  }
});
