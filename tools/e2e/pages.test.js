// Every page type in a real browser, in light and dark, at two desktop and three phone widths, each page opened once:
//   - it loads clean: the status, no console or page errors, no CSP violations, no request to another origin, no
//     sideways scroll, the footer's feedback link naming the page's canonical address, and the maintenance banner
//     exactly when the page's site has its maintenance flag set (web/site.js);
//   - axe finds nothing at WCAG 2.2 AA (axe.js), at its three widths, in the same tab once the load checks have read it.
// Runs against dist/ (make build) or any URL (E2E_BASE_URL); see site.js. Not part of npm test, which needs no browser:
// run it with npm run e2e.
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY } from '../../web/copy.js';
import { SITE, siteOf } from '../../web/site.js';
import { AXE_WIDTHS, audit, openFolds } from './axe.js';
import { CONCURRENCY, HEIGHT, SCHEMES, assertQuiet, samplePages, useBrowser, useContext, withPage } from './lib.js';

// A desktop width, a narrow laptop's (where the program page's columns are tightest), two common phones' (390 px is
// axe's), and the narrowest phone width pages are designed for.
const WIDTHS = [1280, 1024, 390, 375, 320];
const PAGES = samplePages();
// The maintenance banner's words up to the release name, which the config supplies.
const BANNER = COPY.maintenance.slice(0, COPY.maintenance.indexOf('{release}'));

const shared = useBrowser();

test('the maintenance banner has words of its own to look for', () => {
  assert.ok(BANNER.length > 10, `the banner's copy leads up to the release name: ${JSON.stringify(COPY.maintenance)}`);
});

// What the load checks read from the page.
const factsOf = (page) => page.evaluate(([formUrl, banner]) => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  // When the page scrolls sideways, the first few elements that reach past the window's right edge, to name in the failure.
  pastEdge: document.documentElement.scrollWidth > window.innerWidth
    ? [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).slice(0, 3)
      .map((el) => `${el.localName}${[...el.classList].map((c) => `.${c}`).join('')} (to ${Math.round(el.getBoundingClientRect().right)} px)`)
    : [],
  canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
  feedback: [...document.querySelectorAll('a')].filter((a) => a.href.startsWith(formUrl)).map((a) => ({ href: a.href, footer: a.closest('footer') !== null })),
  notices: document.querySelectorAll('.notice').length,
  bannerWords: document.body.innerText.includes(banner),
}), [SITE.feedback.url, BANNER]);

for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    describe(`${scheme}, ${width} px wide`, { concurrency: CONCURRENCY }, () => {
      const tabs = useContext(shared, { colorScheme: scheme, viewport: { width, height: HEIGHT } });

      // A hospital's test is named by its type, not its address, and so are its messages, so the output names no
      // hospital: CI's logs are public. An assertion on an address says only whether it is right.
      for (const { type, name, path } of PAGES) {
        it(name, (t) => withPage(tabs, { path, scheme, watched: true }, async (page, { response, seen }) => {
          await t.test('loads clean', async () => {
            const got = await factsOf(page);
            const notFound = type === 'not-found';
            assert.equal(response.status(), notFound ? 404 : 200, `${name}: status`);
            assertQuiet(seen, name);
            assert.ok(got.scrollWidth <= got.innerWidth, `${name}: scrolls sideways (${got.scrollWidth} px of content in ${got.innerWidth}), past the edge: ${got.pastEdge.join(', ')}`);
            const banner = (siteOf(path)?.maintenance ?? null) !== null;
            assert.equal(got.notices, banner ? 1 : 0, `${name}: ${banner ? 'one' : 'no'} maintenance banner`);
            assert.equal(got.bannerWords, banner, `${name}: the maintenance banner's words ${banner ? '' : 'not '}shown`);

            // Every link to the feedback form (the footer's, and a policy page's own) prefills the page's canonical address.
            // The not-found page is served at every missing address, so it has no canonical link and its link has no page.
            assert.equal(got.feedback.filter((link) => link.footer).length, 1, `${name}: one feedback link in the footer`);
            if (notFound) assert.equal(got.canonical, null, `${name}: no canonical link`);
            else assert.ok(got.canonical === SITE.origin + path, `${name}: the canonical link is the page's own address`);
            for (const { href } of got.feedback) {
              const form = new URL(href);
              assert.ok(form.searchParams.get(SITE.feedback.siteEntry), `${name}: a feedback link names the site`);
              assert.ok(form.searchParams.get(SITE.feedback.pageEntry) === got.canonical, `${name}: a feedback link names the page's canonical address`);
            }
          });
          if (AXE_WIDTHS.includes(width)) {
            await t.test('axe', async () => {
              await openFolds(page);
              await audit(page, name);
            });
          }
        }));
      }
    });
  }
}
