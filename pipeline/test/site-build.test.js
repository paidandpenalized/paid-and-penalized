import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT, repoFiles } from '../files.js';
import { buildAssets, hash8, stylesheet } from '../site/assets.js';
import { build, mergeEntries } from '../site/build.js';
import { createContext, robotsFor } from '../site/context.js';
import { createSiteServer } from '../site/serve.js';
import { withTemp as inTemp } from './helpers.js';

const FONTS = ['alfa-slab-one-400', 'ibm-plex-mono-400', 'ibm-plex-mono-700', 'libre-franklin-400',
  'libre-franklin-600', 'libre-franklin-700'];
const withTemp = (fn) => inTemp('pp-site-', fn);

test('build writes hashed CSS holding the tokens and the dark copy, the six fonts, their licenses and the favicon', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    assert.deepEqual(await build({ outDir: out, sites: [] }), { pages: 0 });
    const css = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.css'));
    assert.equal(css.length, 1);
    assert.match(css[0], /^site\.[0-9a-f]{8}\.css$/);
    const text = readFileSync(join(out, 'assets', css[0]), 'utf8');
    assert.equal(css[0], `site.${hash8(text)}.css`);
    assert.match(text, /--pen:/);
    assert.match(text, /:root:not\(\[data-theme="?light"?\]\)/);
    assert.match(text, /:root\[data-theme="?dark"?\]\{[^}]*--pen:/);
    const fonts = readdirSync(join(out, 'assets', 'fonts'));
    for (const f of FONTS) assert.ok(fonts.includes(`${f}.woff2`), f);
    assert.equal(fonts.filter((f) => f.startsWith('OFL-')).length, 3);
    assert.ok(existsSync(join(out, 'favicon.svg')));
  }));

test('two sites (or a site and the shared theme script) naming one JS entry fail the build', () =>
  withTemp(async (dir) => {
    assert.deepEqual(mergeEntries({ theme: 'a.js' }, { x: 'b.js' }, {}), { theme: 'a.js', x: 'b.js' });
    assert.throws(() => mergeEntries({ theme: 'a.js' }, { theme: 'b.js' }), /"theme" is defined twice/);
    assert.throws(() => mergeEntries({ theme: 'a.js' }, { x: 'b.js' }, { x: 'c.js' }), /"x" is defined twice/);
    const clash = { id: 'clash', entries: { theme: 'web/client/theme.js' }, generate: () => {} };
    await assert.rejects(build({ outDir: join(dir, 'dist'), sites: [clash] }), /"theme" is defined twice/);
  }));

test('buildAssets bundles each JS entry as minified ESM under a content hash and returns the public paths', () =>
  withTemp(async (dir) => {
    const entry = join(dir, 'entry.js');
    writeFileSync(entry, 'export const greeting = (name) => `hello, ${name}`;\n');
    const out = join(dir, 'dist');
    const assets = await buildAssets({ outDir: out, entries: { demo: entry } });
    assert.match(assets.css, /^\/assets\/site\.[0-9a-f]{8}\.css$/);
    assert.match(assets.js.demo, /^\/assets\/demo\.[0-9a-f]{8}\.js$/);
    const js = readFileSync(join(out, assets.js.demo), 'utf8');
    assert.equal(assets.js.demo, `/assets/demo.${hash8(js)}.js`);
    assert.match(js, /export\s*\{/);
    assert.deepEqual((await buildAssets({ outDir: out, entries: {} })).js, {});
    await assert.rejects(buildAssets({ outDir: out, entries: { '../x': entry } }), /entry name/);
  }));

test('build runs the sites in order with one context: assets, env, and what earlier sites emitted', () =>
  withTemp(async (dir) => {
    const seen = [];
    const sites = [
      { id: 'first', generate: async (ctx) => {
        seen.push(['first', ctx.assets.css, ctx.env]);
        ctx.emit({ path: '/a/', robots: null, text: 'a' });
        ctx.emit({ path: '/b.html', robots: 'noindex', text: 'b' });
      } },
      { id: 'second', generate: async (ctx) => {
        seen.push(['second', [...ctx.indexable]]);
        ctx.emit({ path: '/robots.txt', text: 'r' });
      } },
    ];
    const out = join(dir, 'dist');
    assert.deepEqual(await build({ outDir: out, env: 'preview', sites }), { pages: 2 });
    assert.equal(seen[0][0], 'first');
    assert.match(seen[0][1], /^\/assets\/site\./);
    assert.equal(seen[0][2], 'preview');
    assert.deepEqual(seen[1], ['second', ['/a/']]);
    assert.equal(readFileSync(join(out, 'a', 'index.html'), 'utf8'), 'a');
    assert.equal(readFileSync(join(out, 'robots.txt'), 'utf8'), 'r');
  }));

test('emit refuses a path outside the site; asset writes a content-hashed file', () =>
  withTemp(async (dir) => {
    const ctx = createContext({ outDir: dir, env: undefined, assets: {} });
    for (const path of ['a/', '/../x/', '/a/../../x/', '/A/', '/a b/', '//x/']) assert.throws(() => ctx.emit({ path, text: '' }), RangeError, path);
    const url = ctx.asset('demo', 'json', '[1]');
    assert.equal(url, `/assets/demo.${hash8('[1]')}.json`);
    assert.equal(readFileSync(join(dir, url), 'utf8'), '[1]');
  }));

test('robotsFor: only a production build of a released site indexes, and only eligible pages', () => {
  const cases = [
    [{ env: 'production', released: true }, null],
    [{ env: 'production', released: true, eligible: false }, 'noindex'],
    [{ env: 'production', released: false }, 'noindex'],
    [{ env: 'production', released: undefined }, 'noindex'],
    [{ env: undefined, released: true }, 'noindex'],
    [{ env: 'preview', released: true }, 'noindex'],
  ];
  for (const [input, want] of cases) assert.equal(robotsFor(input), want, JSON.stringify(input));
});

test('build refuses to empty a directory that is not dist/ or under the temp directory', async () => {
  for (const outDir of ['/', REPO_ROOT, REPO_ROOT + 'web', REPO_ROOT + '..', tmpdir(), join(tmpdir(), '..', 'elsewhere')]) {
    await assert.rejects(build({ outDir, sites: [] }), /refusing/, outDir);
  }
  assert.ok(existsSync(REPO_ROOT + 'web/styles/tokens.css'));
});

test("no file under web/ but tokens.css, and no site's own styles or scripts, hold a hex color", () => {
  const files = [...repoFiles('web/', { untracked: true }), ...repoFiles('sites/', { untracked: true })]
    .filter((f) => /\.(css|js|mjs)$/.test(f) && f !== 'web/styles/tokens.css')
    .filter((f) => f.startsWith('web/') || /^sites\/[^/]+\/(web|client)\//.test(f));
  assert.ok(files.includes('sites/hacrp/web/styles.css'));
  for (const f of files) assert.doesNotMatch(readFileSync(REPO_ROOT + f, 'utf8'), /#[0-9a-fA-F]{3,8}\b/, f);
});

test('the bundled stylesheet puts each site\'s styles after the shared ones', () => {
  const css = stylesheet(['sites/hacrp/web/styles.css']);
  assert.ok(css.indexOf('.home__mark') < css.indexOf('.hero {'));
  assert.ok(!stylesheet().includes('.hero {'));
});

test('tokens.css keeps the dark block in the shape the build copies, and every token it sets in light it sets in dark', () => {
  const tokens = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
  const decls = (block) => new Map([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
  const dark = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}\s*\}/.exec(tokens);
  assert.ok(dark, 'dark media block');
  const light = /^:root \{([^}]*)\}/m.exec(tokens);
  assert.ok(light, 'light block');
  const darkNames = decls(dark[1]);
  for (const [name, value] of decls(light[1])) {
    if (/#|rgba?\(/.test(value)) assert.ok(darkNames.has(name), `${name} has no dark value`);
  }
});

// A raw request, so the path reaches the server exactly as written (no client-side normalising of ..).
function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], location: res.headers.location, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the local server serves index.html for directories, 404.html for unknown paths, and nothing outside its root', () =>
  withTemp(async (dir) => {
    const root = join(dir, 'dist');
    mkdirSync(join(root, 'hacrp'), { recursive: true });
    writeFileSync(join(root, 'index.html'), 'home');
    writeFileSync(join(root, '404.html'), 'not here');
    writeFileSync(join(root, 'hacrp', 'index.html'), 'hacrp');
    writeFileSync(join(dir, 'secret.txt'), 'outside');
    const server = createSiteServer(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
      assert.deepEqual(await get(port, '/'), { status: 200, type: 'text/html; charset=utf-8', location: undefined, body: 'home' });
      assert.equal((await get(port, '/hacrp/?x=1')).body, 'hacrp');
      const bare = await get(port, '/hacrp');
      assert.equal(bare.status, 301);
      assert.equal(bare.location, '/hacrp/');
      for (const path of ['/nope/', '/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/a%00b', '/%E0%A4%A']) {
        const res = await get(port, path);
        assert.equal(res.status, path === '/%E0%A4%A' ? 400 : 404, path);
        assert.notEqual(res.body, 'outside', path);
      }
      assert.equal((await get(port, '/nope/')).body, 'not here');
    } finally {
      server.close();
    }
  }));
