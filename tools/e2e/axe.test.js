// axe-core at WCAG 2.2 AA on every page type, light and dark, at a desktop and two phone widths: zero violations. axe is
// injected from node_modules into contexts created with bypassCSP (the page's policy would refuse an injected script);
// no other browser test does that, so those keep the real policy. A failure names each rule once, with the selector of
// every element it flags. Runs against dist/ (make build) or any URL (E2E_BASE_URL); see lib.js.
//
// The page is audited as a reader can meet it, which takes two steps before axe runs:
//   - the paper's grain (a faint noise image on the body) stops axe judging the contrast of any text over it: it reports
//     the background "could not be determined" and leaves the text for review, which is nearly all of it. So the run lays
//     the flat paper colour over the grain (FLAT_PAPER) and axe measures the text against that, as WCAG does a plain
//     background. Text drawn inside an SVG (the charts' labels) stays unjudged by axe whatever the background;
//   - every <details> is opened (openFolds): what a fold keeps closed is not laid out, so axe skips it.
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

const FLAT_PAPER = 'body { background-image: none !important; }';

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

// Runs axe on the page as it is: its violations ({ id, impact, help, nodes: [{ target, summary }] }), how many rules
// passed (a run that checked nothing passes nothing) and how many elements passed the contrast rule (the text axe could
// judge: none if something behind the text stops it).
async function runAxe(page) {
  await page.addStyleTag({ content: FLAT_PAPER });
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (tags) => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'passes'] });
    return {
      passes: results.passes.length,
      contrastPassed: results.passes.find((r) => r.id === 'color-contrast')?.nodes.length ?? 0,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target.map((t) => (Array.isArray(t) ? t.join(' >> ') : t)).join(' >> '), summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').trim() })),
      })),
    };
  }, TAGS);
}

// Violations left once the confirmed false positives are removed, grouped by rule.
function remaining(violations) {
  return violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !FALSE_POSITIVES.some((f) => f.rule === v.id && f.selector === n.target)) }))
    .filter((v) => v.nodes.length > 0);
}

const describeViolations = (violations) => violations
  .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.help}\n${v.nodes.map((n) => `    ${n.target}\n      ${n.summary}`).join('\n')}`)
  .join('\n');

// Runs axe and requires that it ran, judged some text and found nothing.
async function audit(page, what) {
  const { violations, passes, contrastPassed } = await runAxe(page);
  assert.ok(passes > 20, `${what}: axe passed only ${passes} rules: did it run?`);
  assert.ok(contrastPassed > 0, `${what}: axe judged the contrast of no text: something behind the text stops it`);
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
  it('flags a page with a missing alternative, a nameless button and low contrast', async () => {
    const context = await browser.newContext({ bypassCSP: true });
    try {
      const page = await context.newPage();
      await page.setContent('<!doctype html><html lang="en"><title>control</title><main><h1>control</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><button></button><p style="color:#ccc;background:#fff">faint words</p></main>');
      const { violations, passes } = await runAxe(page);
      assert.ok(passes > 0, 'axe checked rules');
      const ids = violations.map((v) => v.id);
      for (const id of ['image-alt', 'button-name', 'color-contrast']) assert.ok(ids.includes(id), `${id} not among ${ids}`);
    } finally {
      await context.close();
    }
  });

  it('the exclusion list matches by rule and exact selector, and holds nothing now', () => {
    assert.deepEqual(FALSE_POSITIVES, []);
    const found = [{ id: 'color-contrast', nodes: [{ target: '.a' }, { target: '.b' }] }];
    assert.deepEqual(remaining(found).map((v) => v.nodes.map((n) => n.target)), [['.a', '.b']]);
  });
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
