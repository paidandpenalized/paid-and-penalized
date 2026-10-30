// The response headers: the _headers file the build writes for Cloudflare, the parser and matcher that read it back
// (as Cloudflare does), and the local server that sends them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYTICS_ORIGIN, cspFor, isAnalyticsBeacon, headersFile, headersFor, parseHeaders } from '../site/headers.js';
import { createSiteServer } from '../site/serve.js';
import { get, withServer, withTemp, writeTree } from './helpers.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const WEEK = 'public, max-age=604800';
// Every build but production: production's policy differs only in letting the analytics beacon load.
const CSP_DEFAULT = cspFor(undefined);
const EVERY_PATH = {
  'content-security-policy': CSP_DEFAULT,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'strict-transport-security': 'max-age=31536000',
};

test('headersFile: every path gets the CSP and the security headers; noindex on every build but production', () => {
  for (const env of [undefined, 'preview', 'production']) {
    const rules = parseHeaders(headersFile({ env }));
    const all = rules.find((r) => r.path === '/*');
    assert.ok(all, env);
    const want = { ...EVERY_PATH, 'content-security-policy': cspFor(env), ...(env === 'production' ? {} : { 'x-robots-tag': 'noindex' }) };
    assert.deepEqual(Object.fromEntries(all.set.map(([k, v]) => [k.toLowerCase(), v])), want, env);
    for (const path of ['/', '/hacrp/', '/hacrp/hospital/990001/', '/nope/', '/assets/site.ab12cd34.css']) {
      const got = headersFor(rules, path);
      for (const [name, value] of Object.entries(want)) assert.equal(got[name], value, `${env} ${path} ${name}`);
      if (env === 'production') assert.equal(got['x-robots-tag'], undefined, path);
    }
  }
  assert.ok(headersFile({ env: undefined }).includes(`Content-Security-Policy: ${CSP_DEFAULT}\n`));
  assert.ok(headersFile({ env: undefined }).includes('X-Robots-Tag: noindex\n'));
  assert.ok(!headersFile({ env: 'production' }).includes('X-Robots-Tag'));
});

test('cspFor: only a production build lets a script load from the analytics origin, and nothing else changes', () => {
  const directives = (csp) => new Map(csp.split('; ').map((d) => [d.split(' ')[0], d]));
  const prod = directives(cspFor('production'));
  for (const env of [undefined, 'preview']) {
    const other = directives(cspFor(env));
    assert.equal(other.get('script-src'), "script-src 'self'", env);
    assert.ok(!cspFor(env).includes(ANALYTICS_ORIGIN), env);
    for (const [name, value] of other) if (name !== 'script-src') assert.equal(prod.get(name), value, name);
    assert.equal(prod.size, other.size);
  }
  assert.equal(prod.get('script-src'), `script-src 'self' ${ANALYTICS_ORIGIN}`);
  // The beacon reports to the site's own /cdn-cgi/rum, so connect-src stays 'self'.
  assert.equal(prod.get('connect-src'), "connect-src 'self'");
});

test('isAnalyticsBeacon: the beacon script and its versioned copies on the analytics origin, nothing else', () => {
  for (const ok of ['/beacon.min.js', '/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516', '/beacon.min.js?token=x']) {
    assert.ok(isAnalyticsBeacon(ANALYTICS_ORIGIN + ok), ok);
    assert.ok(isAnalyticsBeacon(new URL(ANALYTICS_ORIGIN + ok)), `${ok} as a URL`);
  }
  for (const no of [ANALYTICS_ORIGIN + '/beacon.min.json', ANALYTICS_ORIGIN + '/beacon.min.js.map', ANALYTICS_ORIGIN + '/other.js', 'https://example.org/beacon.min.js', 'http://static.cloudflareinsights.com/beacon.min.js', '/beacon.min.js', 'not a url']) {
    assert.ok(!isAnalyticsBeacon(no), no);
  }
});

test('headersFile stays inside Cloudflare\'s limits: at most 100 rules, every line under 2,000 characters', () => {
  for (const env of [undefined, 'production']) {
    const text = headersFile({ env });
    assert.ok(parseHeaders(text).length <= 100, env);
    for (const line of text.split('\n')) assert.ok(line.length < 2000, line.slice(0, 60));
  }
});

test('headersFor: hashed scripts, styles, data and share cards are immutable; fonts and the favicon are cached a week, not immutable', () => {
  const rules = parseHeaders(headersFile({ env: 'production' }));
  for (const path of ['/assets/site.ab12cd34.css', '/assets/shell.0123abcd.js', '/assets/hacrp-hospitals.e1ebc9c2.json', '/assets/og-family.5f0e2a9c.png']) {
    assert.equal(headersFor(rules, path)['cache-control'], IMMUTABLE, path);
  }
  for (const path of ['/assets/fonts/x.woff2', '/assets/fonts/OFL-x.txt', '/favicon.svg']) {
    assert.equal(headersFor(rules, path)['cache-control'], WEEK, path);
  }
  for (const path of ['/', '/hacrp/', '/hacrp/data/x.csv', '/404.html']) {
    assert.equal(headersFor(rules, path)['cache-control'], undefined, path);
  }
});

test('parseHeaders reads rules, headers and comments, and refuses what it cannot match or does not support', () => {
  const text = '# a comment\n/a/*\n  X-One: 1\n\n/b\n\tX-Three: c: d\n';
  assert.deepEqual(parseHeaders(text).map(({ path, set }) => ({ path, set })), [
    { path: '/a/*', set: [['X-One', '1']] },
    { path: '/b', set: [['X-Three', 'c: d']] },
  ]);
  assert.throws(() => parseHeaders('  X-One: 1\n'), /before any rule/);
  assert.throws(() => parseHeaders('/a\n  no colon\n'), /line 2/);
  assert.throws(() => parseHeaders('/a\n  Bad Name: 1\n'), /line 2/);
  assert.throws(() => parseHeaders('https://example.org/*\n  X: 1\n'), /path/);
  assert.throws(() => parseHeaders('/*/*\n  X: 1\n'), /one splat/);
  assert.throws(() => parseHeaders('/a\n  X: 1\n/a\n  Y: 2\n'), /line 3: "\/a" is already a rule/);
  // The parts of Cloudflare's grammar this file never writes.
  assert.throws(() => parseHeaders('/docs/:page/\n  X: 1\n'), /line 1: ":placeholder" paths are not supported/);
  assert.throws(() => parseHeaders('/a\n  ! X-Two\n'), /line 2: detaching a header .* is not supported/);
  assert.throws(() => parseHeaders('/a/*\n  X-Splat: :splat\n'), /line 2: filling ":splat" into a value is not supported/);
});

// Cloudflare's rules (https://developers.cloudflare.com/workers/static-assets/headers/): a splat matches any
// characters, slashes included; a request takes every matching rule's headers; a header set twice joins with a comma.
test('headersFor applies every matching rule in order, as Cloudflare does', () => {
  const rules = parseHeaders([
    '/*', '  X-All: a',
    '/docs/*', '  x-all: b', '  X-Docs: d',
    '/*.jpg', '  X-Jpg: yes',
  ].join('\n'));
  assert.deepEqual(headersFor(rules, '/'), { 'x-all': 'a' });
  assert.deepEqual(headersFor(rules, '/docs/one/two/'), { 'x-all': 'a, b', 'x-docs': 'd' });
  assert.deepEqual(headersFor(rules, '/docs/a/b.jpg'), { 'x-all': 'a, b', 'x-docs': 'd', 'x-jpg': 'yes' });
  assert.deepEqual(headersFor(rules, '/docs'), { 'x-all': 'a' });
  // A pattern is matched whole and literally, not as a regular expression.
  assert.deepEqual(headersFor(parseHeaders('/a.b\n  X: 1\n'), '/aXb'), {});
  assert.deepEqual(headersFor(parseHeaders('/a\n  X: 1\n'), '/a/'), {});
});

test('the local server sends the headers _headers gives each path, on a 404 and a redirect too, and never serves _headers itself', () =>
  withTemp('pp-headers-', async (dir) => {
    const root = join(dir, 'dist');
    const text = headersFile({ env: undefined });
    writeTree(root, { 'index.html': 'home', '404.html': 'not here', 'hacrp/index.html': 'hacrp', 'assets/site.ab12cd34.css': 'a{}', _headers: text });
    const rules = parseHeaders(text);
    await withServer(root, async (port) => {
      for (const [path, status] of [['/', 200], ['/hacrp/', 200], ['/nope/', 404], ['/assets/site.ab12cd34.css', 200], ['/hacrp', 307], ['/404.html', 307]]) {
        const res = await get(port, path);
        assert.equal(res.status, status, path);
        const sent = Object.fromEntries(Object.keys(headersFor(rules, path)).map((name) => [name, res.headers[name]]));
        assert.deepEqual(sent, headersFor(rules, path), path);
      }
      const missing = await get(port, '/nope/');
      assert.equal(missing.body, 'not here');
      assert.equal(missing.headers['content-security-policy'], CSP_DEFAULT);
      for (const path of ['/_headers', '/_HEADERS', '/_Headers', '/%5Fheaders']) {
        const own = await get(port, path);
        assert.equal(own.status, 404, path);
        assert.equal(own.body, 'not here', path);
      }
    });
  }));

test('the local server sends a missing hashed file\'s 404 with the file\'s year-long Cache-Control, as the deployed Worker does', () =>
  withTemp('pp-headers-', async (dir) => {
    const root = join(dir, 'dist');
    writeTree(root, { '404.html': 'not here', _headers: headersFile({ env: undefined }) });
    await withServer(root, async (port) => {
      const path = '/assets/site.deadbeef.css';
      for (const [p, status] of [[path, 404], ['/assets/%E0%A4%A.css', 400]]) {
        const res = await get(port, p);
        assert.equal(res.status, status, p);
        assert.equal(res.headers['cache-control'], IMMUTABLE, p);
        assert.equal(res.headers['content-security-policy'], CSP_DEFAULT, p);
      }
      // No 404.html: the plain-text 404 carries them too.
      rmSync(join(root, '404.html'));
      const bare = await get(port, path);
      assert.equal(bare.status, 404);
      assert.equal(bare.headers['cache-control'], IMMUTABLE);
    });
  }));

test('the local server reads _headers again when a rebuild changes it, sends none once it is gone, and refuses a malformed one', () =>
  withTemp('pp-headers-', async (dir) => {
    const root = join(dir, 'dist');
    writeTree(root, { 'index.html': 'home', _headers: headersFile({ env: undefined }) });
    await withServer(root, async (port) => {
      assert.equal((await get(port, '/')).headers['x-robots-tag'], 'noindex');
      writeFileSync(join(root, '_headers'), headersFile({ env: 'production' }));
      const after = await get(port, '/');
      assert.equal(after.headers['x-robots-tag'], undefined);
      assert.equal(after.headers['content-security-policy'], cspFor('production'));
      rmSync(join(root, '_headers'));
      assert.equal((await get(port, '/')).headers['content-security-policy'], undefined);
      // A malformed file: a 500 that names it, and a server that won't start on one.
      writeFileSync(join(root, '_headers'), '  X-Orphan: 1\n');
      const bad = await get(port, '/');
      assert.equal(bad.status, 500);
      assert.match(bad.body, /_headers: .*line 1/);
      assert.throws(() => createSiteServer(root), /line 1/);
      // One that can't be read: a 500 that gives the error's code, not the folder's local path. (Root reads it anyway.)
      if (process.getuid?.() !== 0) {
        writeFileSync(join(root, '_headers'), headersFile({ env: undefined }));
        chmodSync(join(root, '_headers'), 0);
        const unreadable = await get(port, '/');
        assert.equal(unreadable.status, 500);
        assert.match(unreadable.body, /^dist\/_headers: cannot be read \(EACCES\)$/);
        assert.ok(!unreadable.body.includes(dir));
        chmodSync(join(root, '_headers'), 0o644);
      }
    });
  }));
