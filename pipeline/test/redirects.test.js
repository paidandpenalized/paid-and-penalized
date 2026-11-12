// The short links: the _redirects file the build writes for Cloudflare, the parser and matcher that read it back (as
// Cloudflare does), and the local server that answers them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { headersFile, headersFor, parseHeaders } from '../site/headers.js';
import { REDIRECTS, parseRedirects, redirectFor, redirectsFile } from '../site/redirects.js';
import { createSiteServer } from '../site/serve.js';
import { get, withServer, withTemp, writeTree } from './helpers.js';

const LOOKUP = 'https://inpatient-only-lookup.vercel.app/';
const STAKE = `${LOOKUP}revenue-at-stake/`;
// The four short addresses and where each goes.
const SHORT = [['/ipo', LOOKUP], ['/ipo/', LOOKUP], ['/ipo/stake', STAKE], ['/ipo/stake/', STAKE]];

test('redirectsFile: each short link, without and with its "/", as a 302, under a comment Cloudflare skips', () => {
  assert.equal(redirectsFile(), [
    '# Written by pipeline/site/redirects.js. Cloudflare reads this file and does not serve it.',
    `/ipo ${LOOKUP} 302`,
    `/ipo/ ${LOOKUP} 302`,
    `/ipo/stake ${STAKE} 302`,
    `/ipo/stake/ ${STAKE} 302`,
    '',
  ].join('\n'));
  assert.deepEqual(parseRedirects(redirectsFile()), REDIRECTS);
});

test('parseRedirects: a line is "source destination [code]", 302 when left out; comments and blank lines are skipped', () => {
  const text = '# a comment\n\n/a https://x.example/a\n  /b   https://x.example/b   301  \n';
  assert.deepEqual(parseRedirects(text), [
    { from: '/a', to: 'https://x.example/a', status: 302 },
    { from: '/b', to: 'https://x.example/b', status: 301 },
  ]);
});

test('parseRedirects refuses what Cloudflare would skip or read otherwise, and what this reader does not support, naming the line', () => {
  for (const [line, why] of [
    ['/a', /expected "source destination \[code\]"/],
    ['/a https://x.example/ 302 extra', /expected "source destination \[code\]"/],
    ['/a https://x.example/ 301 # a trailing note is no comment to Cloudflare', /expected "source destination \[code\]"/],
    ['/a?x=1 https://x.example/', /holds no "\?" or "#"/],
    ['/a#b https://x.example/', /holds no "\?" or "#"/],
    ['a https://x.example/', /a source must be a path/],
    ['https://host/a https://x.example/', /a source must be a path/],
    ['/a/* https://x.example/:splat', /splats and ":placeholder"/],
    ['/a/:id https://x.example/', /splats and ":placeholder"/],
    ['/a /b', /an absolute http\(s\) URL/],
    ['/a //x.example/', /an absolute http\(s\) URL/],
    ['/a https://x.example/ 200', /the code must be one of 301, 302, 303, 307, 308/],
    ['/a https://x.example/ 404', /the code must be one of/],
    ['/a https://x.example/ found', /the code must be one of/],
  ]) assert.throws(() => parseRedirects(`# first\n${line}\n`), (err) => why.test(err.message) && /_redirects line 2/.test(err.message), line);
  assert.throws(() => parseRedirects('/a https://x.example/1\n/a https://x.example/2\n'), /line 2: "\/a" is already a rule/);
});

test('redirectFor: the source matched whole, in its letter case, with no "/" folded; the request\'s query kept when the destination has none', () => {
  const rules = REDIRECTS;
  for (const [path, location] of SHORT) assert.deepEqual(redirectFor(rules, path), { status: 302, location }, path);
  for (const path of ['/IPO', '/Ipo/stake', '/ipo//', '/ipo/stake/x', '/ipox', '/ip', '/', '/ipo/index.html']) assert.equal(redirectFor(rules, path), null, path);
  assert.equal(redirectFor(rules, '/ipo', '?q=a').location, `${LOOKUP}?q=a`);
  assert.equal(redirectFor(rules, '/ipo/stake/', '?a=1&b=2').location, `${STAKE}?a=1&b=2`);
  // A destination's own query wins, and its fragment stays at the end.
  const own = parseRedirects('/q https://x.example/p?x=1#top\n/f https://x.example/p#top\n');
  assert.equal(redirectFor(own, '/q', '?y=2').location, 'https://x.example/p?x=1#top');
  assert.equal(redirectFor(own, '/f', '?y=2').location, 'https://x.example/p?y=2#top');
  // The destination goes out as written, as Cloudflare sends it: no host lowercased, no "/" added.
  const raw = parseRedirects('/r https://X.example\n');
  assert.equal(redirectFor(raw, '/r').location, 'https://X.example');
  assert.equal(redirectFor(raw, '/r', '?y=2').location, 'https://X.example?y=2');
});

test('the local server answers each short link with its 302 and Location, query kept, carrying _headers\' headers; never serves _redirects', () =>
  withTemp('pp-redirects-', async (dir) => {
    const root = join(dir, 'dist');
    const text = headersFile({ env: undefined });
    // A page at /ipo/ too: Cloudflare answers the short link before it looks for a file, and so does the server.
    writeTree(root, { 'index.html': 'home', '404.html': 'not here', 'ipo/index.html': 'hidden', _headers: text, _redirects: redirectsFile() });
    const rules = parseHeaders(text);
    await withServer(root, async (port) => {
      for (const [path, location] of SHORT) {
        const res = await get(port, path);
        assert.equal(res.status, 302, path);
        assert.equal(res.location, location, path);
        assert.equal(res.body, '', path);
        for (const [name, value] of Object.entries(headersFor(rules, path))) assert.equal(res.headers[name], value, `${path} ${name}`);
      }
      assert.equal((await get(port, '/ipo/stake?q=a')).location, `${STAKE}?q=a`);
      for (const [path, status] of [['/IPO/stake', 404], ['/ipo/stake/x', 404], ['/', 200]]) assert.equal((await get(port, path)).status, status, path);
      for (const path of ['/_redirects', '/_REDIRECTS', '/_Redirects', '/%5Fredirects']) {
        const own = await get(port, path);
        assert.equal(own.status, 404, path);
        assert.equal(own.body, 'not here', path);
      }
    });
  }));

test('the local server reads _redirects again when a rebuild changes it, answers none once it is gone, and refuses a malformed one', () =>
  withTemp('pp-redirects-', async (dir) => {
    const root = join(dir, 'dist');
    writeTree(root, { 'index.html': 'home', '404.html': 'not here', _redirects: redirectsFile() });
    await withServer(root, async (port) => {
      assert.equal((await get(port, '/ipo')).status, 302);
      writeFileSync(join(root, '_redirects'), '/ipo https://x.example/ 307\n');
      const after = await get(port, '/ipo');
      assert.deepEqual([after.status, after.location], [307, 'https://x.example/']);
      writeFileSync(join(root, '_redirects'), '');
      assert.equal((await get(port, '/ipo')).status, 404);
      writeFileSync(join(root, '_redirects'), '/ipo /elsewhere\n');
      const bad = await get(port, '/');
      assert.equal(bad.status, 500);
      assert.match(bad.body, /^dist\/_redirects: _redirects line 1: /);
      assert.throws(() => createSiteServer(root), /_redirects line 1/);
    });
  }));
