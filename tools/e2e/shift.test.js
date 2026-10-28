// A first visit holds still: on a cold cache, with the page's scripts and data arriving late (as on a slow connection, so
// the page paints before its scripts run), each kind of page the hub serves, and HACRP's program and hospital pages to
// compare, shifts its layout less than CUMULATIVE (the cumulative layout shift a browser reports, summed from load until
// the page has settled) at a phone's width and a desktop's. What used to move: the bar's search and theme toggle
// appearing (the header grew and its end slid left), a hero's search box appearing, the hospital page's peer toggle
// appearing, and a phone's story switching to its live layout when its script started.
// Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js. CI's logs are public: a page is named by its
// type, never its address.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_CCN } from '../../hub/model.js';
import { hospitalPathOf, programById } from '../../web/site.js';
import { PROGRAM_PATH } from '../ci/page-types.js';
import { useBrowser } from './lib.js';
import { hospitalSample } from './site.js';

const shared = useBrowser();

// The most a page may shift on a first visit (good is under 0.1; the site aims well under it).
const CUMULATIVE = 0.05;
// How late each script and data file arrives (ms): long enough that the page paints first.
const LATE_MS = 300;
// How long the page is watched after its network goes quiet (ms), so a late redraw is counted.
const WATCH_MS = 1000;

const PAGES = [
  ['the front page', '/'],
  ['a hospital page across the programs', hospitalPathOf('hub', EXAMPLE_CCN)],
  ['a placeholder page', programById('hvbp').path],
  ['the interim Readmissions page', programById('hrrp').path],
  ['HACRP\'s program page', PROGRAM_PATH],
  ['a HACRP hospital page', hospitalSample('hospital-cut').path],
];

// The page's layout shifts from its start until it has settled, each { value, sources: tag and class of each node that
// moved }, in a fresh context (an empty cache) whose scripts and data files arrive LATE_MS late.
async function shiftsOn(browser, base, path, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
  try {
    const page = await context.newPage();
    await page.route(/\/assets\/[^/]+\.(?:js|json)$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, LATE_MS));
      await route.continue();
    });
    await page.addInitScript(() => {
      window.shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          const sources = (e.sources ?? []).map(({ node }) => (node?.nodeType === 1 ? `${node.localName}${[...node.classList].map((c) => `.${c}`).join('')}` : 'text'));
          window.shifts.push({ value: e.value, sources });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(new URL(path, base).href, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(WATCH_MS);
    return await page.evaluate(() => window.shifts);
  } finally {
    await context.close();
  }
}

for (const width of [390, 1440]) {
  describe(`a first visit at ${width} px`, () => {
    // A browser's very first page draws its first canvas late, which can count as a shift once per browser; a reader's
    // browser has long since drawn one. One page is opened first, so that is not blamed on a page under test.
    before(async () => {
      await shiftsOn(shared.browser, shared.site.base, '/about/', width);
    });
    for (const [name, path] of PAGES) {
      it(`${name}: its layout shifts less than ${CUMULATIVE} in all`, async () => {
        const shifts = await shiftsOn(shared.browser, shared.site.base, path, width);
        const total = shifts.reduce((sum, s) => sum + s.value, 0);
        const moved = shifts.filter((s) => s.value >= 0.001).map((s) => `${s.value.toFixed(3)} (${s.sources.join(', ')})`);
        assert.ok(total < CUMULATIVE, `${name} at ${width} px: cumulative shift ${total.toFixed(3)}; the shifts: ${moved.join('; ')}`);
      });
    }
  });
}
