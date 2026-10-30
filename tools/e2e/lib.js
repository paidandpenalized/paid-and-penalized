// What the browser checks (npm run e2e) share: a browser held for a test file, tabs in a colour scheme, a page opened
// the way a reader meets it, a watcher for what a page does wrong, and what the checks look for on every page (the
// footer's feedback link, a settled paint). Playwright is a dev dependency used only by the browser checks; npm test
// needs no browser. The site and its pages are site.js's.
import { EventEmitter, once } from 'node:events';
import { availableParallelism } from 'node:os';
import { after, before } from 'node:test';
import assert from 'node:assert/strict';
import * as playwright from 'playwright';
import { ANALYTICS_ORIGIN } from '../../pipeline/site/headers.js';
import { SITE } from '../../web/site.js';
import { ENGINES, startSite } from './site.js';

export const SCHEMES = ['light', 'dark'];
// How many tests a describe runs at once: one core fewer than the machine has, up to four (CI's 2-core runner gets 1,
// so four tabs never load the heaviest page together there; a laptop gets up to 4). npm run e2e (run.js) runs as many
// test files at once, for the same reason: one per core, with each file's tabs, left Firefox's checks timing out.
export const CONCURRENCY = Math.max(1, Math.min(4, availableParallelism() - 1));
// Every context's window height.
const HEIGHT = 800;
// How long a watched page's requests in flight may take to end once its checks begin (watch's settled).
const SETTLE_TIMEOUT_MS = 5_000;

// The browser engine the checks run in: E2E_ENGINE, chromium when it is unset.
export const ENGINE = process.env.E2E_ENGINE || 'chromium';

// A browser for ENGINE: chromium, firefox or webkit. Chromium is the Google Chrome installed on this machine (channel
// 'chrome', so no browser is downloaded) unless CI is set, where the workflow installs Playwright's own Chromium. The
// other engines are Playwright's builds.
function launch() {
  if (!ENGINES.includes(ENGINE)) throw new RangeError(`unknown browser engine "${ENGINE}": use ${ENGINES.join(', ')}`);
  return playwright[ENGINE].launch(ENGINE === 'chromium' && !process.env.CI ? { channel: 'chrome' } : {});
}

// The site under test and a browser, for the tests of the file that calls it (once, at its top): { site, browser },
// filled in before the first test, and both closed after the last (the browser first). start: what starts the site,
// resolving its { base, close } (site.js startSite, by default; the harness's own controls pass a throwaway server).
export function useBrowser(start = startSite) {
  const shared = {};
  before(async () => {
    shared.site = await start();
    shared.browser = await launch();
  });
  after(async () => {
    await shared.browser?.close();
    await shared.site?.close();
  });
  return shared;
}

// A browser context for the tests of the describe that calls it: a window width px wide and height px tall (HEIGHT by
// default), with scripts on or off (javaScript). { context, base, javaScript } (base: the site's origin), filled in before
// its first test, and closed after its last. A tab takes its colour scheme from withPage, not from the context (newPage).
export function useContext(shared, { width = 1280, height = HEIGHT, javaScript = true } = {}) {
  const held = { javaScript };
  before(async () => {
    held.context = await shared.browser.newContext({ viewport: { width, height }, javaScriptEnabled: javaScript });
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

// Every tab's pages get window.svgBox(el) (newPage), the way the checks measure an SVG part: its box on screen
// ({ left, right, top, bottom }) by its geometry, not its paint, which the engines agree on: a text's (or tspan's)
// characters, a shape's getBBox, through its screen CTM. getBoundingClientRect differs: Firefox's takes in a stroke (a
// text's halo among them) and adds about 2 px each side of a text; WebKit's gives a tspan its whole text's box.
function defineSvgBox() {
  window.svgBox = (el) => {
    let b = el.getBBox();
    if (el instanceof SVGTextContentElement) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      // A text that isn't drawn has no characters' extents (an engine may throw for them): an empty box.
      try {
        for (let i = 0; i < el.getNumberOfChars(); i++) {
          const c = el.getExtentOfChar(i);
          [x0, y0, x1, y1] = [Math.min(x0, c.x), Math.min(y0, c.y), Math.max(x1, c.x + c.width), Math.max(y1, c.y + c.height)];
        }
      } catch {
        x1 = x0;
      }
      b = x1 > x0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : { x: 0, y: 0, width: 0, height: 0 };
    }
    const m = el.getScreenCTM();
    const [p, q] = [new DOMPoint(b.x, b.y).matrixTransform(m), new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m)];
    return { left: Math.min(p.x, q.x), right: Math.max(p.x, q.x), top: Math.min(p.y, q.y), bottom: Math.max(p.y, q.y) };
  };
}

// A new tab in the context, in the colour scheme, checked. Chromium and WebKit take the scheme as the tab opens. Firefox
// takes it only once the tab has loaded a page from the network, and each tab for itself (it ignores the context's
// colorScheme option, and emulateMedia on a fresh tab), so there the tab is primed first (prime). Call it before watch.
export async function newPage(context, colorScheme, base) {
  const page = await context.newPage();
  await page.addInitScript(defineSvgBox);
  if (ENGINE === 'firefox') await prime(page, colorScheme, base);
  else await page.emulateMedia({ colorScheme });
  assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), colorScheme === 'dark', `the tab follows the ${colorScheme} scheme`);
  return page;
}

// Opens path (from base, the site's origin) in the tab the way a reader meets it: loaded, and quiet (its scripts have
// fetched what they fetch, and its fonts are in). A page that runs a script may fetch after its load, so it is waited on
// until the network is quiet: every page of the site (each runs the shell's and the sticky header's). A page with none
// (the harness's own controls, watch.test.js, one of which never goes quiet) is quiet once loaded and its fonts are in.
// javaScript: whether the tab runs scripts; without them nothing fetches after the load, so there is no wait. Returns
// the response.
export async function visit(page, base, path, { javaScript = true } = {}) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: 'load' });
  if (!javaScript) return response;
  if (await page.evaluate(() => document.querySelector('script[src]') !== null)) await page.waitForLoadState('networkidle');
  else await page.evaluate(() => document.fonts.ready.then(() => {}));
  return response;
}

// Runs fn(page, { response, seen }) on path, visited in a fresh tab (newPage) of a useContext context in the scheme, and
// closes the tab; returns what fn returns. watched: the tab is watched from before the visit, and seen is what watch
// reports (null otherwise).
export async function withPage({ context, base, javaScript }, { path, scheme = 'light', watched = false }, fn) {
  const page = await newPage(context, scheme, base);
  try {
    const seen = watched ? await watch(page, base) : null;
    const response = await visit(page, base, path, { javaScript });
    return await fn(page, { response, seen });
  } finally {
    await page.close();
  }
}

// How each engine words a request the page gave up on itself (a fetch it aborted, an image whose src it changed, a load
// cut short by leaving the page): Chromium, Firefox, WebKit on macOS, and WebKit's other ports. Not a failure.
const ABORTED = /^(?:net::ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled)$/;

// A request as a failure names it: a page as the page (a hospital page's address has its CCN), anything else by its
// path.
const requestName = (request) => (request.isNavigationRequest() ? 'the page itself' : new URL(request.url()).pathname);

// The statuses a browser follows to their Location (300 and 304 it does not).
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// Records what goes wrong on the page from the next navigation on, for the site at base (its origin). Await it before
// page.goto: it installs a script in every document the page loads. Returns three arrays that fill as the page runs,
// and a wait:
//   errors           console errors, uncaught page errors, requests that failed (not those the page aborted, ABORTED)
//                    and subresources answered 400 or above (the status of the page itself, which Chromium also logs
//                    as a console error, is for the caller to check)
//   cspViolations    each Content Security Policy violation, { directive, blocked, source, line, sample }, from a
//                    securitypolicyviolation listener (Playwright's own scripts are not subject to the page's policy)
//   foreignRequests  the address of every network request to an origin other than the site's (data: and blob:
//                    addresses are not requests to a host; nor is the live site's analytics beacon, a script from
//                    ANALYTICS_ORIGIN's /beacon.min.js that Cloudflare adds to each page and the production CSP
//                    allows)
//   settled          ({ timeoutMs }) resolves once the page has rendered twice (a load the page starts only then, as
//                    WebKit does a lazy image in view, is under way) and every request it has made has finished or
//                    failed, each hop of a redirect included; it rejects after timeoutMs (SETTLE_TIMEOUT_MS), naming
//                    the requests still in flight
// A visit to a page that fetches nothing after its load does not wait for the network (visit), so a request can still
// be in flight when the checks begin (the browser's request for the site's icon, a lazy image); closing the tab would
// abort it, and an aborted request is not reported, so it would never be judged. Await settled before reading the
// arrays (assertQuiet does).
async function watch(page, base) {
  const errors = [];
  const cspViolations = [];
  const foreignRequests = [];
  const documents = new Set();
  const inFlight = new Set();
  // Requests answered with a redirect: each stays in flight until the browser reports its next hop (a request
  // redirectedFrom it), since it finishes before that hop starts and the page would go idle between the two.
  const redirected = new Set();
  const idle = new EventEmitter();
  const ended = (request) => {
    if (redirected.has(request)) return;
    inFlight.delete(request);
    if (inFlight.size === 0) idle.emit('idle');
  };
  // Chromium logs a document's own error status (the 404 page's) as a console error against the document's address.
  const ownStatus = (message) => documents.has(message.location().url) && /^Failed to load resource: the server responded with a status of \d+/.test(message.text());
  page.on('console', (message) => message.type() === 'error' && !ownStatus(message) && errors.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('requestfailed', (request) => {
    const why = request.failure()?.errorText;
    if (!ABORTED.test(why ?? '')) errors.push(`request failed: ${request.url()} (${why})`);
    redirected.delete(request);
    ended(request);
  });
  // WebKit reports a page sent with Cross-Origin-Opener-Policy (as the site's are) and opened at an address with a
  // #fragment as two navigation requests, and finishes only one: a finished navigation ends any other in flight to the
  // same address.
  page.on('requestfinished', (request) => {
    ended(request);
    if (!request.isNavigationRequest()) return;
    const address = request.url().split('#')[0];
    for (const other of inFlight) if (other.isNavigationRequest() && other.url().split('#')[0] === address) ended(other);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.request().isNavigationRequest()) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    if (REDIRECTS.has(response.status()) && response.headers().location) redirected.add(response.request());
  });
  page.on('request', (request) => {
    const from = request.redirectedFrom();
    if (from) {
      redirected.delete(from);
      inFlight.delete(from);
    }
    inFlight.add(request);
    if (request.isNavigationRequest()) documents.add(request.url());
    const url = new URL(request.url());
    const foreign = /^(?:https?|wss?):$/.test(url.protocol) && url.origin !== new URL(base).origin;
    const beacon = url.origin === ANALYTICS_ORIGIN && url.pathname.startsWith('/beacon.min.js') && request.resourceType() === 'script';
    if (foreign && !beacon) foreignRequests.push(request.url());
  });
  await page.exposeFunction('reportCspViolation', (violation) => cspViolations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.reportCspViolation({ directive: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber, sample: e.sample });
    });
  });
  const settled = async ({ timeoutMs = SETTLE_TIMEOUT_MS } = {}) => {
    await settle(page);
    if (inFlight.size === 0) return;
    await once(idle, 'idle', { signal: AbortSignal.timeout(timeoutMs) }).catch(() => {
      throw new Error(`requests still in flight ${timeoutMs} ms after the checks began: ${[...inFlight].map(requestName).join(', ')}`);
    });
  };
  return { errors, cspViolations, foreignRequests, settled };
}

// Asserts that what watch saw is clean, once the page's requests have ended (settled): no console or page error, no
// CSP violation, no request to another origin.
export async function assertQuiet(seen, what) {
  await seen.settled();
  assert.deepEqual(seen.errors, [], `${what}: console and page errors`);
  assert.deepEqual(seen.cspViolations, [], `${what}: CSP violations`);
  assert.deepEqual(seen.foreignRequests, [], `${what}: requests to another origin`);
}

// Asserts the page does not scroll sideways (its content is no wider than the window). The failure names the first few
// elements that reach past the window's right edge, by tag and class and how far they reach, never their text (a
// hospital's name stays out of CI's public logs); an element inside a box that scrolls or clips within the window is
// not one (a wide table in its sideways-scrolling frame).
export async function assertNoSideways(page, what) {
  const got = await page.evaluate(() => {
    const edge = window.innerWidth + 0.5;
    const held = (el) => {
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        if (getComputedStyle(up).overflowX !== 'visible' && up.getBoundingClientRect().right <= edge) return true;
      }
      return false;
    };
    const scrollWidth = document.documentElement.scrollWidth;
    const pastEdge = scrollWidth > window.innerWidth
      ? [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > edge && !held(el)).slice(0, 3)
        .map((el) => `${el.localName}${[...el.classList].map((c) => `.${c}`).join('')} (to ${Math.round(el.getBoundingClientRect().right)} px)`)
      : [];
    return { scrollWidth, innerWidth: window.innerWidth, pastEdge };
  });
  assert.ok(got.scrollWidth <= got.innerWidth, `${what}: scrolls sideways (${got.scrollWidth} px of content in ${got.innerWidth}), past the edge: ${got.pastEdge.join(', ')}`);
}

// Calls fn until it returns something truthy, for up to five seconds; its last answer goes in the failure.
export async function eventually(fn, what) {
  const end = Date.now() + 5000;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${what} (last seen: ${JSON.stringify(last)})`);
}

// Lowers the first of the what-if's measures that reads above its floor to that floor, its input's minimum (lower is
// better; a measure already at its floor would change nothing), and waits for the hypothetical score to change.
export async function lowerAMeasure(whatIf) {
  const hypothetical = whatIf.locator('[data-wi="score"]');
  const was = await hypothetical.textContent();
  const inputs = whatIf.getByRole('spinbutton');
  const readings = await inputs.evaluateAll((els) => els.map((el) => ({ value: el.value, min: el.min })));
  const at = readings.findIndex(({ value, min }) => value !== '' && min !== '' && Number(value) > Number(min));
  assert.ok(at !== -1, `the hospital has a measure above its floor to lower (none of its ${readings.length} inputs is)`);
  await inputs.nth(at).fill(readings[at].min);
  await eventually(async () => (await hypothetical.textContent()) !== was, 'the hypothetical score did not change');
}

// The footer's link to the feedback form, which every page has, as a selector for the page and for a locator.
export const FEEDBACK_LINK = `footer a[href^="${SITE.feedback.url}"]`;

// Resolves once the page has painted twice: what it changed has been laid out and drawn.
export const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// The program page's two search boxes over one index, by where each sits: the top bar's, and the larger one in the hero.
export const SEARCH_BOXES = [['the top bar', '.topbar'], ['the hero', 'main']];
// The search in a container (a SEARCH_BOXES selector): its box and the options it lists.
export function searchIn(page, container) {
  const search = page.locator(container).getByRole('search');
  return { box: search.getByRole('combobox'), list: search.getByRole('option') };
}

// The keys that move focus forward and back in ENGINE. Safari's, on macOS, tabs only through form controls unless
// Option is held (its "Press Tab to highlight each item" setting is off), so a walk there holds it.
export const TAB_KEYS = ENGINE === 'webkit' && process.platform === 'darwin'
  ? { next: 'Alt+Tab', back: 'Alt+Shift+Tab' }
  : { next: 'Tab', back: 'Shift+Tab' };

// Clicks the middle of what locator finds, where it is, with a pointer's real events: Playwright's own click first
// scrolls its target "into view", which moves the page under a sticky one.
export async function clickInPlace(locator) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  assert.ok(box, 'clickInPlace: the element has a box to click');
  await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// A route's response, fetched for a rewrite in an encoding Playwright's fetch can read: Firefox asks for zstd, which
// Cloudflare sends and Playwright can't decode.
export const fetchDecoded = (route) => route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'gzip, br' } });

// Asserts a page's response (to a navigation) is 200, or 304: a page the browser already holds may come back unchanged
// from a host that sends ETags, as Cloudflare does; Firefox revalidates that way on navigation. The local server sends
// none.
export function assertAnswered(response, what) {
  assert.ok([200, 304].includes(response.status()), `${what}: status ${response.status()}, not 200 or 304`);
}
