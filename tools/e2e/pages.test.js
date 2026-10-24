// Page-load checks in a real browser, for every page type, in light and dark, at a desktop and a phone width: the
// status, no console or page errors, no CSP violations, no request to another origin, no sideways scroll, and the
// footer's feedback link naming the page's canonical address. Runs against dist/ (make build) or any URL
// (E2E_BASE_URL); see lib.js. Not part of npm test, which needs no browser: run it with npm run e2e.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SITE } from '../../web/site.js';
import { launch, newPage, samplePages, startSite, watch } from './lib.js';

const SCHEMES = ['light', 'dark'];
// A desktop width, a common phone's, and the narrowest phone width pages are designed for.
const WIDTHS = [1280, 375, 320];
const HEIGHT = 800;
const PAGES = samplePages();

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

// Loads one page in a fresh tab of the context and returns what the checks read.
async function load(context, scheme, path) {
  let page;
  try {
    page = await newPage(context, scheme, site.base);
    const seen = await watch(page, site.base);
    const response = await page.goto(new URL(path, site.base).href, { waitUntil: 'load' });
    // Scripts fetch their data after load; a violation or error from them lands before the network goes quiet.
    await page.waitForLoadState('networkidle');
    const facts = await page.evaluate((formUrl) => ({
      dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      feedback: [...document.querySelectorAll('a')].filter((a) => a.href.startsWith(formUrl)).map((a) => ({ href: a.href, footer: a.closest('footer') !== null })),
    }), SITE.feedback.url);
    return { status: response.status(), seen, ...facts };
  } finally {
    await page?.close();
  }
}

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    describe(`${scheme}, ${width} px wide`, { concurrency: 4 }, () => {
      let context;
      before(async () => {
        context = await browser.newContext({ colorScheme: scheme, viewport: { width, height: HEIGHT } });
      });
      after(() => context?.close());

      for (const { type, path } of PAGES) {
        // A hospital's test is named by its type, not its address, so the output names no hospital.
        it(type === 'policy' ? `policy ${path}` : type, async () => {
          const got = await load(context, scheme, path);
          const notFound = type === 'not-found';
          assert.equal(got.status, notFound ? 404 : 200, `${path}: status`);
          assert.equal(got.dark, scheme === 'dark', `${path}: the browser follows the ${scheme} scheme`);
          assert.deepEqual(got.seen.errors, [], `${path}: console and page errors`);
          assert.deepEqual(got.seen.cspViolations, [], `${path}: CSP violations`);
          assert.deepEqual(got.seen.foreignRequests, [], `${path}: requests to another origin`);
          assert.ok(got.scrollWidth <= got.innerWidth, `${path}: scrolls sideways (${got.scrollWidth} px of content in ${got.innerWidth})`);

          // Every link to the feedback form (the footer's, and a policy page's own) prefills the page's canonical address.
          // The not-found page is served at every missing address, so it has no canonical link and its link has no page.
          assert.equal(got.feedback.filter((link) => link.footer).length, 1, `${path}: one feedback link in the footer`);
          if (notFound) assert.equal(got.canonical, null, `${path}: no canonical link`);
          else assert.equal(got.canonical, SITE.origin + path, `${path}: canonical address`);
          for (const { href } of got.feedback) {
            const form = new URL(href);
            assert.ok(form.searchParams.get(SITE.feedback.siteEntry), `${path}: a feedback link names the site`);
            assert.equal(form.searchParams.get(SITE.feedback.pageEntry), got.canonical, `${path}: a feedback link's page`);
          }
        });
      }
    });
  }
}
