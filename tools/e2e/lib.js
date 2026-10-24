// What the browser checks (npm run e2e) share: the site under test, a browser to drive it, the pages to visit and a
// watcher for what a page does wrong. Playwright is a dev dependency used only here; npm test needs no browser.
//
//   startSite()    dist/ served with its real _headers (make serve's server) on a free loopback port, or any URL
//                  named in E2E_BASE_URL (a preview, a deployed site), which nothing is started for.
//   launch()       a browser: Chromium by default, Firefox or WebKit through E2E_ENGINE or the argument. Chromium
//                  runs the Chrome installed on this machine; with CI set it runs the Chromium Playwright installs.
//   newPage()      a tab in a context in a colour scheme, whichever the engine, with nothing of its own left loading.
//   samplePages()  one page of each type, chosen by property from the emitted data and dist/ (no page is named here).
//   hospitalAt()   the emitted record of the hospital whose page is at a path, for checks that need its name.
//   watch(page)    what the page logs, loads and violates from now on; once per page (its exposed function's name is
//                  unique), so open a new tab for another watch.
import { existsSync, readdirSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { DIST_DIR as DIST, REPO_ROOT, newestYear, readJson } from '../../pipeline/files.js';
import { createSiteServer } from '../../pipeline/site/serve.js';
import { emittedPath } from '../../sites/hacrp/pipeline/build.js';
import { isDecided } from '../../engine/js/hacrp/hospital.js';
import { DICTIONARY_PAGE, KINDS, METHODS_PATH, PROGRAM_PATH, hospitalPath, placePath } from '../ci/page-types.js';
import { SITE } from '../../web/site.js';


// The origin of the site under test, set by startSite, which watch falls back on to tell this site's requests from others.
let siteOrigin = null;

// Serves dist/ (build it first: make build) unless E2E_BASE_URL names the site to test. Returns the site's origin
// (base: http://127.0.0.1:<port>, no trailing slash) and close(), which stops the server.
export async function startSite() {
  if (process.env.E2E_BASE_URL) {
    const url = new URL(process.env.E2E_BASE_URL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RangeError('E2E_BASE_URL must be an http or https address');
    siteOrigin = url.origin;
    return { base: siteOrigin, close: async () => {} };
  }
  if (!existsSync(DIST)) throw new Error('dist/ not found: run `make build` first (or set E2E_BASE_URL)');
  const server = createSiteServer(DIST);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  siteOrigin = `http://127.0.0.1:${server.address().port}`;
  // A browser's kept-alive connections would hold close() open, so they end with the server.
  return { base: siteOrigin, close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }) };
}

// A new tab in the context in the colour scheme, set on the tab itself: Firefox ignores the context's colorScheme option
// and takes emulateMedia only once the tab has loaded a page from the network, so the tab first loads a small page of
// the site at `base` (its origin; not the page's icon: a browser asks for /favicon.ico after a bare image, and that 404
// would land in watch). It returns once that page's own requests have settled, so none is blamed on the page the caller
// opens next. Call it before watch. A tab whose priming fails is closed, not leaked (the failure thrown is the priming's).
export async function newPage(context, colorScheme, base) {
  if (!base) throw new TypeError('newPage: the site\'s origin is required');
  const page = await context.newPage();
  try {
    await page.goto(`${base}${SITE.pages.about}`);
    await page.emulateMedia({ colorScheme });
    await page.waitForLoadState('networkidle');
  } catch (error) {
    // A close that fails must not replace the error that brought us here.
    await page.close().catch(() => {});
    throw error;
  }
  return page;
}

const ENGINES = { chromium, firefox, webkit };

// A browser for the engine: 'chromium', 'firefox' or 'webkit'. Defaults to E2E_ENGINE, then Chromium. Chromium is
// the installed Google Chrome (channel 'chrome', so no browser is downloaded) unless CI is set, where Playwright's
// own Chromium is installed by the workflow. The other engines are Playwright's builds.
export function launch(engine = process.env.E2E_ENGINE || 'chromium') {
  if (!Object.hasOwn(ENGINES, engine)) throw new RangeError(`unknown browser engine "${engine}": use chromium, firefox or webkit`);
  return ENGINES[engine].launch(engine === 'chromium' && !process.env.CI ? { channel: 'chrome' } : {});
}

// The newest HACRP file's hospitals, in the file's order.
const hospitals = () => readJson(REPO_ROOT + emittedPath(newestYear('data/emitted/hacrp'))).hospitals;

// The first place page of a kind that dist/ holds, by folder name: '/hacrp/<kind>/<key>/'.
function placeOf(kind) {
  const dir = `${DIST}${PROGRAM_PATH.slice(1)}${kind}/`;
  const key = existsSync(dir) ? readdirSync(dir).sort().find((name) => existsSync(`${dir}${name}/index.html`)) : undefined;
  if (key === undefined) throw new Error(`samplePages: no ${kind} page in dist/ (run make build)`);
  return placePath(kind, key);
}

// The emitted record of the hospital whose page is at `path` ('/hacrp/hospital/<ccn>/'), as samplePages gives them.
export function hospitalAt(path) {
  const record = hospitals().find((h) => hospitalPath(h.ccn) === path);
  if (!record) throw new Error(`hospitalAt: no hospital in the data has a page at ${path}`);
  return record;
}

// One page of every type, [{ type, path }]: the hub's home and each of its policy pages, the program page, its Methods
// and dictionary, three hospitals (the first in the data that CMS cut, that has no score, and that has a score and was
// not cut), the first region, division, state and metro page in dist/, and a path no page has (the not-found page,
// served with status 404). Needs dist/ and the emitted data, whichever site the browser visits.
export function samplePages() {
  const all = hospitals();
  const hospital = (what, test) => {
    const found = all.find(test);
    if (!found) throw new Error(`samplePages: no hospital ${what} in the data`);
    return hospitalPath(found.ccn);
  };
  return [
    { type: 'hub', path: '/' },
    ...Object.values(SITE.pages).map((path) => ({ type: 'policy', path })),
    { type: 'program', path: PROGRAM_PATH },
    { type: 'hospital-cut', path: hospital('with a payment cut', (h) => isDecided(h) && h.paymentReduction === 'Yes') },
    { type: 'hospital-unscored', path: hospital('with no score', (h) => h.total === null) },
    { type: 'hospital-not-cut', path: hospital('with a score and no cut', (h) => isDecided(h) && h.paymentReduction === 'No') },
    ...KINDS.map((kind) => ({ type: kind, path: placeOf(kind) })),
    { type: 'methods', path: METHODS_PATH },
    { type: 'dictionary', path: DICTIONARY_PAGE },
    { type: 'not-found', path: '/no-page-has-this-address/' },
  ];
}

// Records what goes wrong on the page from the next navigation on. Await it before page.goto: it installs a script in
// every document the page loads. Returns three arrays that fill as the page runs:
//   errors           console errors, uncaught page errors, requests that failed and subresources answered 400 or above
//                    (the status of the page itself, which Chromium also logs as a console error, is for the caller to check)
//   cspViolations    each Content Security Policy violation, { directive, blocked, source, line, sample }, from a
//                    securitypolicyviolation listener (Playwright's own scripts are not subject to the page's policy)
//   foreignRequests  the address of every network request to an origin other than the site under test's (data: and
//                    blob: addresses are not requests to a host)
// base: the site's origin, by default the one startSite started or was given.
export async function watch(page, base = siteOrigin) {
  if (!base) throw new Error('watch: no site origin; call startSite() first or pass the origin');
  const errors = [];
  const cspViolations = [];
  const foreignRequests = [];
  const documents = new Set();
  // Chromium logs a document's own error status (the 404 page's) as a console error against the document's address.
  const ownStatus = (message) => documents.has(message.location().url) && /^Failed to load resource: the server responded with a status of \d+/.test(message.text());
  page.on('console', (message) => message.type() === 'error' && !ownStatus(message) && errors.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));
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
