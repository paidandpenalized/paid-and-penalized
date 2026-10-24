// Positive controls for the harness (lib.js): a watcher that silently stops catching things makes every page check
// pass for the wrong reason, so these serve a deliberately bad page from a throwaway server and require watch() to
// report each fault, and a clean page it must report nothing for. They also pin newPage's contract: it takes the
// origin, follows the scheme and returns only once the priming page's requests have settled. No dist/ needed.
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SITE } from '../../web/site.js';
import { launch, newPage, watch } from './lib.js';

const BAD = '/bad/';
const OFFSITE = 'https://example.invalid/x.png';
// The CSP forbids inline scripts (not images or off-site loads: those must reach the network for the foreign-request
// detector to see them).
const CSP = "script-src 'self'";
const LATE_AFTER_MS = 200;
const LATE_TAKES_MS = 300;

const page = (head, body = '') => `<!doctype html><meta charset="utf-8"><title>control</title>${head}<body>${body}`;
const PAGES = {
  [BAD]: page(`<script>document.title = 'an inline script ran'</script><script src="/bad.js"></script>`, `<img src="${OFFSITE}" alt=""><img src="/missing.png" alt="">`),
  // The page newPage primes a tab with (SITE.pages.about): it asks for something late, as a page's script can.
  [SITE.pages.about]: page('<script src="/late.js"></script>'),
};

let server;
let base;
let lateDone = false;
let browser;
let context;

before(async () => {
  server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const reply = (status, type, body, more = {}) => res.writeHead(status, { 'content-type': type, ...more }).end(body);
    if (pathname === '/bad.js') return reply(200, 'text/javascript', "console.error('deliberate console error'); setTimeout(() => { throw new Error('deliberate page error'); }, 0);");
    if (pathname === '/late.js') return reply(200, 'text/javascript', `addEventListener('load', () => setTimeout(() => fetch('/late'), ${LATE_AFTER_MS}));`);
    if (pathname === '/late') return void setTimeout(() => { lateDone = true; reply(200, 'text/plain', 'late'); }, LATE_TAKES_MS);
    if (pathname === '/missing.png') return reply(404, 'text/plain', 'not found');
    if (pathname === '/gone/') return reply(404, 'text/html', page('', '<p>gone</p>'));
    reply(200, 'text/html', PAGES[pathname] ?? page('', '<p>clean</p>'), pathname === BAD ? { 'content-security-policy': CSP } : {});
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch();
  context = await browser.newContext();
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
});

// Opens `path` in a fresh tab watched from the start, and returns what the watcher saw once the network went quiet.
async function visit(path) {
  const tab = await context.newPage();
  try {
    const seen = await watch(tab, base);
    await tab.goto(base + path, { waitUntil: 'load' });
    await tab.waitForLoadState('networkidle');
    return seen;
  } finally {
    await tab.close();
  }
}

describe('watch reports what is wrong with a page', () => {
  it('a Content Security Policy violation (an inline script the policy forbids)', async () => {
    const { cspViolations } = await visit(BAD);
    assert.ok(cspViolations.some((v) => /^script-src/.test(v.directive)), `no script-src violation in ${JSON.stringify(cspViolations)}`);
  });

  it('a request to another origin', async () => {
    const { foreignRequests } = await visit(BAD);
    assert.ok(foreignRequests.includes(OFFSITE), `${OFFSITE} not among ${JSON.stringify(foreignRequests)}`);
    assert.ok(foreignRequests.every((url) => !url.startsWith(base)), 'a request to the page\'s own origin is not foreign');
  });

  it('a console error, an uncaught error, a failed request and a subresource answered 404', async () => {
    const { errors } = await visit(BAD);
    assert.ok(errors.includes('console: deliberate console error'), `no console error in ${JSON.stringify(errors)}`);
    assert.ok(errors.includes('page error: deliberate page error'), `no page error in ${JSON.stringify(errors)}`);
    assert.ok(errors.some((e) => e.startsWith(`request failed: ${OFFSITE}`)), `no failed request in ${JSON.stringify(errors)}`);
    assert.ok(errors.includes(`HTTP 404: ${base}/missing.png`), `no 404 in ${JSON.stringify(errors)}`);
  });

  it('nothing on a clean page, and nothing for a document\'s own error status', async () => {
    for (const path of ['/clean/', '/gone/']) {
      const { errors, cspViolations, foreignRequests } = await visit(path);
      assert.deepEqual({ errors, cspViolations, foreignRequests }, { errors: [], cspViolations: [], foreignRequests: [] }, path);
    }
  });

  it('a page is watched once: the second watch() is refused (its exposed function is already registered)', async () => {
    const tab = await context.newPage();
    try {
      await watch(tab, base);
      await assert.rejects(watch(tab, base), /already/);
    } finally {
      await tab.close();
    }
  });
});

describe('newPage', () => {
  it('takes the origin, follows the scheme and returns a tab whose priming requests have settled', async () => {
    lateDone = false;
    const tab = await newPage(context, 'dark', base);
    try {
      // The priming page asked for /late after its load event: a tab handed over before it was answered would blame
      // the next page for it.
      assert.equal(lateDone, true, 'the priming page was still loading when newPage returned');
      assert.equal(await tab.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), true);
    } finally {
      await tab.close();
    }
  });

  it('closes the tab it opened when the priming load fails', async () => {
    const before = context.pages().length;
    await assert.rejects(newPage(context, 'light', 'http://127.0.0.1:1'));
    assert.equal(context.pages().length, before, 'a failed newPage leaked its tab');
  });

  it('throws the priming failure, not the error of closing the tab that failed', async () => {
    const tab = { goto: async () => { throw new Error('priming failed'); }, close: async () => { throw new Error('close failed'); } };
    await assert.rejects(newPage({ newPage: async () => tab }, 'light', base), /priming failed/);
  });

  it('needs the origin', async () => {
    await assert.rejects(newPage(context, 'light'), /origin/);
  });
});
