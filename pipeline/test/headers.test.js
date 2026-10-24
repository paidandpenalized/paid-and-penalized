// The response headers: the _headers file the build writes for Cloudflare, the parser and matcher that read it back
// (as Cloudflare does), and the local server that sends them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { headersFile, headersFor, parseHeaders } from '../site/headers.js';
import { createSiteServer } from '../site/serve.js';
import { get, withTemp } from './helpers.js';

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; "
  + "font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const IMMUTABLE = 'public, max-age=31536000, immutable';
const WEEK = 'public, max-age=604800';
const EVERY_PATH = {
  'content-security-policy': CSP,
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
    const want = { ...EVERY_PATH, ...(env === 'production' ? {} : { 'x-robots-tag': 'noindex' }) };
    assert.deepEqual(Object.fromEntries(all.set.map(([k, v]) => [k.toLowerCase(), v])), want, env);
    for (const path of ['/', '/hacrp/', '/hacrp/hospital/990001/', '/nope/', '/assets/site.ab12cd34.css']) {
      const got = headersFor(rules, path);
      for (const [name, value] of Object.entries(want)) assert.equal(got[name], value, `${env} ${path} ${name}`);
      if (env === 'production') assert.equal(got['x-robots-tag'], undefined, path);
    }
  }
  assert.ok(headersFile({ env: undefined }).includes(`Content-Security-Policy: ${CSP}\n`));
  assert.ok(headersFile({ env: undefined }).includes('X-Robots-Tag: noindex\n'));
  assert.ok(!headersFile({ env: 'production' }).includes('X-Robots-Tag'));
});

test('headersFile stays inside Cloudflare\'s limits: at most 100 rules, every line under 2,000 characters', () => {
  for (const env of [undefined, 'production']) {
    const text = headersFile({ env });
    assert.ok(parseHeaders(text).length <= 100, env);
    for (const line of text.split('\n')) assert.ok(line.length < 2000, line.slice(0, 60));
  }
});

test('headersFor: hashed scripts, styles and data are immutable; fonts and the favicon are cached a week, not immutable', () => {
  const rules = parseHeaders(headersFile({ env: 'production' }));
  for (const path of ['/assets/site.ab12cd34.css', '/assets/theme.0123abcd.js', '/assets/hacrp-hospitals.e1ebc9c2.json']) {
    assert.equal(headersFor(rules, path)['cache-control'], IMMUTABLE, path);
  }
  for (const path of ['/assets/fonts/x.woff2', '/assets/fonts/OFL-x.txt', '/favicon.svg']) {
    assert.equal(headersFor(rules, path)['cache-control'], WEEK, path);
  }
  for (const path of ['/', '/hacrp/', '/hacrp/data/x.csv', '/404.html']) {
    assert.equal(headersFor(rules, path)['cache-control'], undefined, path);
  }
});

test('parseHeaders reads rules, headers, detaches and comments, and refuses what it cannot match', () => {
  const text = '# a comment\n/a/*\n  X-One: 1\n  ! X-Two\n\n/b\n\tX-Three: c: d\n';
  assert.deepEqual(parseHeaders(text), [
    { path: '/a/*', set: [['X-One', '1']], detach: ['X-Two'] },
    { path: '/b', set: [['X-Three', 'c: d']], detach: [] },
  ]);
  assert.throws(() => parseHeaders('  X-One: 1\n'), /before any rule/);
  assert.throws(() => parseHeaders('/a\n  no colon\n'), /line 2/);
  assert.throws(() => parseHeaders('/a\n  Bad Name: 1\n'), /line 2/);
  assert.throws(() => parseHeaders('https://example.org/*\n  X: 1\n'), /path/);
  assert.throws(() => parseHeaders('/*/*\n  X: 1\n'), /one splat/);
  assert.throws(() => parseHeaders('/:a/:a\n  X: 1\n'), /once/);
  assert.throws(() => parseHeaders('/a\n  X: 1\n/a\n  Y: 2\n'), /line 3: "\/a" is already a rule/);
});

// Cloudflare's rules (https://developers.cloudflare.com/workers/static-assets/headers/): a splat matches any
// characters, slashes included; a placeholder one path segment; a request takes every matching rule's headers; a
// header set twice joins with a comma; "! Name" removes what an earlier rule set; matched text fills :splat and
// :placeholder in a value.
test('headersFor applies every matching rule in order, as Cloudflare does', () => {
  const rules = parseHeaders([
    '/*', '  X-All: a', '  X-Gone: g',
    '/docs/*', '  x-all: b', '  ! X-Gone', '  X-Splat: :splat',
    '/docs/:page/', '  X-Page: :page',
    '/*.jpg', '  X-Jpg: yes',
  ].join('\n'));
  assert.deepEqual(headersFor(rules, '/'), { 'x-all': 'a', 'x-gone': 'g' });
  assert.deepEqual(headersFor(rules, '/docs/one/'), { 'x-all': 'a, b', 'x-splat': 'one/', 'x-page': 'one' });
  assert.deepEqual(headersFor(rules, '/docs/one/two/'), { 'x-all': 'a, b', 'x-splat': 'one/two/' });
  assert.deepEqual(headersFor(rules, '/docs/a/b.jpg'), { 'x-all': 'a, b', 'x-splat': 'a/b.jpg', 'x-jpg': 'yes' });
  assert.deepEqual(headersFor(rules, '/docs'), { 'x-all': 'a', 'x-gone': 'g' });
  // A pattern is matched whole and literally, not as a regular expression.
  assert.deepEqual(headersFor(parseHeaders('/a.b\n  X: 1\n'), '/aXb'), {});
  assert.deepEqual(headersFor(parseHeaders('/a\n  X: 1\n'), '/a/'), {});
});

test('the local server sends the headers _headers gives each path, 404s included, and never serves _headers itself', () =>
  withTemp('pp-headers-', async (dir) => {
    const root = join(dir, 'dist');
    mkdirSync(join(root, 'hacrp'), { recursive: true });
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), 'home');
    writeFileSync(join(root, '404.html'), 'not here');
    writeFileSync(join(root, 'hacrp', 'index.html'), 'hacrp');
    writeFileSync(join(root, 'assets', 'site.ab12cd34.css'), 'a{}');
    const text = headersFile({ env: undefined });
    writeFileSync(join(root, '_headers'), text);
    const rules = parseHeaders(text);
    const server = createSiteServer(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
      for (const [path, status] of [['/', 200], ['/hacrp/', 200], ['/nope/', 404], ['/assets/site.ab12cd34.css', 200], ['/hacrp', 301]]) {
        const res = await get(port, path);
        assert.equal(res.status, status, path);
        const sent = Object.fromEntries(Object.keys(headersFor(rules, path)).map((name) => [name, res.headers[name]]));
        assert.deepEqual(sent, headersFor(rules, path), path);
      }
      const missing = await get(port, '/nope/');
      assert.equal(missing.body, 'not here');
      assert.equal(missing.headers['content-security-policy'], CSP);
      const own = await get(port, '/_headers');
      assert.equal(own.status, 404);
      assert.equal(own.body, 'not here');
    } finally {
      server.close();
    }
  }));
