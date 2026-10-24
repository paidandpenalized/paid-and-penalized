// What the browser checks (npm run e2e) share: a browser held for a test file, tabs in a colour scheme, a page opened
// the way a reader meets it, and a watcher for what a page does wrong. Playwright is a dev dependency used only by the
// browser checks; npm test needs no browser. The site and its pages are site.js's.
import { after, before } from 'node:test';
import assert from 'node:assert/strict';
import * as playwright from 'playwright';
import { SITE } from '../../web/site.js';
import { ENGINES, startSite } from './site.js';

export { samplePages } from './site.js';

export const SCHEMES = ['light', 'dark'];
// Every context's window height.
export const HEIGHT = 800;

// A browser for E2E_ENGINE: chromium (when it is unset), firefox or webkit. Chromium is the Google Chrome installed on
// this machine (channel 'chrome', so no browser is downloaded) unless CI is set, where the workflow installs
// Playwright's own Chromium. The other engines are Playwright's builds.
export function launch() {
  const engine = process.env.E2E_ENGINE || 'chromium';
  if (!ENGINES.includes(engine)) throw new RangeError(`unknown browser engine "${engine}": use ${ENGINES.join(', ')}`);
  return playwright[engine].launch(engine === 'chromium' && !process.env.CI ? { channel: 'chrome' } : {});
}

// The site under test (site.js startSite) and a browser, for the tests of the file that calls it (once, at its top):
// { site, browser }, filled in before the first test, and both closed after the last.
export function useBrowser() {
  const shared = {};
  before(async () => {
    shared.site = await startSite();
    shared.browser = await launch();
  });
  after(async () => {
    await shared.browser?.close();
    await shared.site?.close();
  });
  return shared;
}

// A browser context (options as browser.newContext takes them) for the tests of the describe that calls it: { context,
// base } (base: the site's origin), filled in before its first test, and closed after its last.
export function useContext(shared, options) {
  const held = {};
  before(async () => {
    held.context = await shared.browser.newContext(options);
    held.base = shared.site.base;
  });
  after(() => held.context?.close());
  return held;
}

// Loads a page of the site at base in the tab, takes the scheme there, and returns once that page's own requests have
// settled, so none is blamed on the page the caller opens next. The page is the About page (not the site's icon: a
// browser asks for /favicon.ico after a bare image, and that 404 would land in watch).
export async function prime(page, colorScheme, base) {
  await page.goto(`${base}${SITE.pages.about}`);
  await page.emulateMedia({ colorScheme });
  await page.waitForLoadState('networkidle');
}

// A new tab in the context, in the colour scheme, checked. Chromium and WebKit take the scheme as the tab opens. Firefox
// takes it only once the tab has loaded a page from the network, and each tab for itself (it ignores the context's
// colorScheme option, and emulateMedia on a fresh tab), so there the tab is primed first (prime). Call it before watch.
export async function newPage(context, colorScheme, base) {
  const page = await context.newPage();
  if (context.browser()?.browserType().name() === 'firefox') await prime(page, colorScheme, base);
  else await page.emulateMedia({ colorScheme });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), colorScheme === 'dark', `the tab follows the ${colorScheme} scheme`);
  return page;
}

// Opens path (from base, the site's origin) in the tab the way a reader meets it: loaded, and quiet (its scripts have
// fetched what they fetch). With scripts off nothing fetches after the load, so idle: false spares that wait. Returns
// the response.
export async function visit(page, base, path, { idle = true } = {}) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: 'load' });
  if (idle) await page.waitForLoadState('networkidle');
  return response;
}

// Runs fn(page, { response, seen }) on path, visited in a fresh tab (newPage) of a useContext context in the scheme, and
// closes the tab; returns what fn returns. watched: the tab is watched from before the visit, and seen is what watch
// reports (null otherwise).
export async function withPage({ context, base }, { path, scheme = 'light', watched = false, idle = true }, fn) {
  const page = await newPage(context, scheme, base);
  try {
    const seen = watched ? await watch(page, base) : null;
    const response = await visit(page, base, path, { idle });
    return await fn(page, { response, seen });
  } finally {
    await page.close();
  }
}

// How each engine words a request the page gave up on itself (a fetch it aborted, an image whose src it changed, a load
// cut short by leaving the page): Chromium, Firefox, WebKit on macOS, and WebKit's other ports. Not a failure.
const ABORTED = /^(?:net::ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled)$/;

// Records what goes wrong on the page from the next navigation on, for the site at base (its origin). Await it before
// page.goto: it installs a script in every document the page loads. Returns three arrays that fill as the page runs:
//   errors           console errors, uncaught page errors, requests that failed (not those the page aborted, ABORTED)
//                    and subresources answered 400 or above (the status of the page itself, which Chromium also logs
//                    as a console error, is for the caller to check)
//   cspViolations    each Content Security Policy violation, { directive, blocked, source, line, sample }, from a
//                    securitypolicyviolation listener (Playwright's own scripts are not subject to the page's policy)
//   foreignRequests  the address of every network request to an origin other than the site's (data: and blob:
//                    addresses are not requests to a host)
export async function watch(page, base) {
  const errors = [];
  const cspViolations = [];
  const foreignRequests = [];
  const documents = new Set();
  // Chromium logs a document's own error status (the 404 page's) as a console error against the document's address.
  const ownStatus = (message) => documents.has(message.location().url) && /^Failed to load resource: the server responded with a status of \d+/.test(message.text());
  page.on('console', (message) => message.type() === 'error' && !ownStatus(message) && errors.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('requestfailed', (request) => {
    const why = request.failure()?.errorText;
    if (!ABORTED.test(why ?? '')) errors.push(`request failed: ${request.url()} (${why})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.request().isNavigationRequest()) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('request', (request) => {
    if (request.isNavigationRequest()) documents.add(request.url());
    const url = new URL(request.url());
    if (/^(?:https?|wss?):$/.test(url.protocol) && url.origin !== new URL(base).origin) foreignRequests.push(request.url());
  });
  await page.exposeFunction('reportCspViolation', (violation) => cspViolations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.reportCspViolation({ directive: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber, sample: e.sample });
    });
  });
  return { errors, cspViolations, foreignRequests };
}

// Asserts that what watch saw is clean: no console or page error, no CSP violation, no request to another origin.
export function assertQuiet(seen, what) {
  assert.deepEqual(seen.errors, [], `${what}: console and page errors`);
  assert.deepEqual(seen.cspViolations, [], `${what}: CSP violations`);
  assert.deepEqual(seen.foreignRequests, [], `${what}: requests to another origin`);
}

// The program page's two search boxes over one index, by where each sits: the top bar's, and the larger one in the hero.
export const SEARCH_BOXES = [['the top bar', '.topbar'], ['the hero', 'main']];
// The search in a container (a SEARCH_BOXES selector): its box and the options it lists.
export function searchIn(page, container) {
  const search = page.locator(container).getByRole('search');
  return { box: search.getByRole('combobox'), list: search.getByRole('option') };
}
