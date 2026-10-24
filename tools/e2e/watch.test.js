// Positive controls for the harness (lib.js): a watcher that silently stops catching things makes every page check
// pass for the wrong reason, so these serve a deliberately bad page from a throwaway server and require watch() to
// report each fault, and a clean page (and one that aborts its own request) it must report nothing for. They also pin
// prime's and newPage's contracts: a primed tab is handed over only once its page's requests have settled, and a new
// tab follows the scheme. No dist/ needed.
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listen, stop } from '../../pipeline/site/serve.js';
import { SITE } from '../../web/site.js';
import { assertQuiet, newPage, prime, useBrowser, useContext, visit, withPage } from './lib.js';

const BAD = '/bad/';
// A page that gives up on a request of its own: a fetch it aborts.
const ABORTS = '/aborts/';
const OFFSITE = 'https://example.invalid/x.png';
// The CSP forbids inline scripts (not images or off-site loads: those must reach the network for the foreign-request
// detector to see them).
const CSP = "script-src 'self'";
const LATE_AFTER_MS = 200;
const LATE_TAKES_MS = 300;

const page = (head, body = '') => `<!doctype html><meta charset="utf-8"><title>control</title>${head}<body>${body}`;
const PAGES = {
  [BAD]: page(`<script>document.title = 'an inline script ran'</script><script src="/bad.js"></script>`, `<img src="${OFFSITE}" alt=""><img src="/missing.png" alt="">`),
  // The page prime loads (SITE.pages.about): it asks for something late, as a page's script can.
  [SITE.pages.about]: page('<script src="/late.js"></script>'),
  [ABORTS]: page('<script src="/aborts.js"></script>'),
};

let lateDone = false;

// The throwaway site, as startSite gives one: { base, close }.
async function startControls() {
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const reply = (status, type, body, more = {}) => res.writeHead(status, { 'content-type': type, ...more }).end(body);
    if (pathname === '/bad.js') return reply(200, 'text/javascript', "console.error('deliberate console error'); setTimeout(() => { throw new Error('deliberate page error'); }, 0);");
    if (pathname === '/late.js') return reply(200, 'text/javascript', `addEventListener('load', () => setTimeout(() => fetch('/late'), ${LATE_AFTER_MS}));`);
    if (pathname === '/late') return void setTimeout(() => { lateDone = true; reply(200, 'text/plain', 'late'); }, LATE_TAKES_MS);
    if (pathname === '/missing.png') return reply(404, 'text/plain', 'not found');
    // Never answered: the page aborts it (stop ends the open connection).
    if (pathname === '/hang') return;
    if (pathname === '/aborts.js') {
      return reply(200, 'text/javascript', "const c = new AbortController(); fetch('/hang', { signal: c.signal }).catch(() => {}); setTimeout(() => c.abort(), 50);");
    }
    if (pathname === '/gone/') return reply(404, 'text/html', page('', '<p>gone</p>'));
    reply(200, 'text/html', PAGES[pathname] ?? page('', '<p>clean</p>'), pathname === BAD ? { 'content-security-policy': CSP } : {});
  });
  return { base: `http://127.0.0.1:${await listen(server)}`, close: () => stop(server) };
}

const shared = useBrowser(startControls);

describe('watch reports what is wrong with a page', () => {
  const tabs = useContext(shared);
  // What the watcher saw on `path`, opened in a fresh tab watched from the start, once the network went quiet.
  const seenOn = (path) => withPage(tabs, { path, watched: true }, (_, { seen }) => seen);

  it('a Content Security Policy violation (an inline script the policy forbids)', async () => {
    const { cspViolations } = await seenOn(BAD);
    assert.ok(cspViolations.some((v) => /^script-src/.test(v.directive)), `no script-src violation in ${JSON.stringify(cspViolations)}`);
  });

  it('a request to another origin', async () => {
    const { foreignRequests } = await seenOn(BAD);
    assert.ok(foreignRequests.includes(OFFSITE), `${OFFSITE} not among ${JSON.stringify(foreignRequests)}`);
    assert.ok(foreignRequests.every((url) => !url.startsWith(tabs.base)), 'a request to the page\'s own origin is not foreign');
  });

  it('a console error, an uncaught error, a failed request and a subresource answered 404', async () => {
    const { errors } = await seenOn(BAD);
    assert.ok(errors.includes('console: deliberate console error'), `no console error in ${JSON.stringify(errors)}`);
    assert.ok(errors.includes('page error: deliberate page error'), `no page error in ${JSON.stringify(errors)}`);
    assert.ok(errors.some((e) => e.startsWith(`request failed: ${OFFSITE}`)), `no failed request in ${JSON.stringify(errors)}`);
    assert.ok(errors.includes(`HTTP 404: ${tabs.base}/missing.png`), `no 404 in ${JSON.stringify(errors)}`);
  });

  it('nothing on a clean page, and nothing for a document\'s own error status', async () => {
    for (const path of ['/clean/', '/gone/']) assertQuiet(await seenOn(path), path);
  });

  it('nothing for a request the page aborted itself', async () => {
    assertQuiet(await seenOn(ABORTS), ABORTS);
  });
});

describe('a new tab', () => {
  const tabs = useContext(shared);

  it('primed, is handed over only once the priming page\'s requests have settled, in the scheme', async () => {
    lateDone = false;
    const tab = await tabs.context.newPage();
    try {
      await prime(tab, 'dark', tabs.base);
      // The priming page asked for /late after its load event: a tab handed over before it was answered would blame
      // the next page for it.
      assert.equal(lateDone, true, 'the priming page was still loading when prime returned');
      assert.equal(await tab.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), true);
    } finally {
      await tab.close();
    }
  });

  it('from newPage, follows the scheme, whichever the engine', async () => {
    for (const scheme of ['dark', 'light']) {
      const tab = await newPage(tabs.context, scheme, tabs.base);
      try {
        await visit(tab, tabs.base, '/clean/');
        assert.equal(await tab.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), scheme === 'dark', scheme);
      } finally {
        await tab.close();
      }
    }
  });
});
