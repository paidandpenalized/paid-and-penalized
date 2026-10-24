import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { REPO_ROOT, dollarsPath, masterPath, newestYear, repoFiles } from '../files.js';
import { buildAssets, hash8, stylesheet } from '../site/assets.js';
import { HUB } from '../../hub/pages.js';
import { generateHacrp, HACRP } from '../../sites/hacrp/web/generate.js';
import { emittedPath } from '../../sites/hacrp/pipeline/build.js';
import { historyPath } from '../../sites/hacrp/pipeline/history.js';
import { loadHacrp } from '../../sites/hacrp/web/data.js';
import { SHARED_ENTRIES, SITES, build, mergeEntries } from '../site/build.js';
import { createContext, robotsFor } from '../site/context.js';
import { headersFile, headersFor, parseHeaders } from '../site/headers.js';
import { createSiteServer } from '../site/serve.js';
import { get, withTemp as inTemp } from './helpers.js';

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

// The bundles target ES2020 (assets.js), and esbuild lowers syntax but never adds a missing built-in, so a newer
// built-in in browser code would throw in an older browser that runs the rest. Each name here is newer than ES2020.
const NEWER_BUILT_INS = [
  ['Object.hasOwn', /\bObject\.hasOwn\b/], ['String#replaceAll', /\.replaceAll\(/], ['Array/String#at', /\.at\(/],
  ['structuredClone', /\bstructuredClone\b/], ['Array#findLast', /\.findLast(Index)?\(/],
  ['Array#toSorted and kin', /\.(toSorted|toReversed|toSpliced)\(/], ['Object.groupBy', /\bObject\.groupBy\b/],
];

test('no browser bundle calls a built-in newer than the ES2020 target', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    const entries = mergeEntries(SHARED_ENTRIES, ...SITES.map((s) => s.entries ?? {}));
    const { js } = await buildAssets({ outDir: out, entries });
    assert.ok(Object.keys(js).length >= 5);
    for (const [name, path] of Object.entries(js)) {
      const text = readFileSync(join(out, path), 'utf8');
      for (const [builtIn, re] of NEWER_BUILT_INS) assert.doesNotMatch(text, re, `${name}: ${builtIn}`);
    }
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

test('the hub runs last: its sitemap lists the indexable pages every other site emitted', () => {
  assert.equal(SITES.at(-1), HUB);
  assert.equal(SITES.filter((s) => s === HUB).length, 1);
});

test('emit refuses a path outside the site; asset writes a content-hashed file', () =>
  withTemp(async (dir) => {
    const ctx = createContext({ outDir: dir, env: undefined, assets: {} });
    for (const path of ['a/', '/../x/', '/a/../../x/', '/A/', '/a b/', '//x/']) assert.throws(() => ctx.emit({ path, text: '' }), RangeError, path);
    // Capitals only in a file that is not a page; a repeat is refused whatever its case.
    for (const path of ['/Page.html', '/a/Index.html']) assert.throws(() => ctx.emit({ path, text: '' }), RangeError, path);
    ctx.emit({ path: '/data/x/DATA-DICTIONARY.md', text: 'd' });
    assert.throws(() => ctx.emit({ path: '/data/x/data-dictionary.md', text: 'e' }), /already written/);
    assert.throws(() => ctx.emit({ path: '/data/x/DATA-DICTIONARY.md', text: 'e' }), /already written/);
    ctx.emit({ path: '/p/', text: 'p' });
    assert.throws(() => ctx.emit({ path: '/p/index.html', text: 'q' }), /already written/);
    assert.equal(readFileSync(join(dir, 'data/x/DATA-DICTIONARY.md'), 'utf8'), 'd');
    const url = ctx.asset('demo', 'json', '[1]');
    assert.equal(url, `/assets/demo.${hash8('[1]')}.json`);
    assert.equal(readFileSync(join(dir, url), 'utf8'), '[1]');
  }));

test('setUpdated records a site\'s two dates once, as real calendar dates; updated is a Map read in the order they were set', () =>
  withTemp(async (dir) => {
    const ctx = createContext({ outDir: dir, env: undefined, assets: {} });
    assert.ok(ctx.updated instanceof Map);
    assert.equal(ctx.updated.size, 0);
    ctx.setUpdated('hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' });
    ctx.setUpdated('other', { cmsReleased: '2026-01-02', changed: '2026-01-03' });
    assert.deepEqual([...ctx.updated], [['hacrp', { cmsReleased: '2026-08-13', changed: '2026-10-22' }], ['other', { cmsReleased: '2026-01-02', changed: '2026-01-03' }]]);
    assert.throws(() => ctx.setUpdated('hacrp', { cmsReleased: '2026-08-14', changed: '2026-10-23' }), /"hacrp" is already set/);
    assert.equal(ctx.updated.get('hacrp').cmsReleased, '2026-08-13');
    for (const bad of [{}, { cmsReleased: '2026-08-13' }, { changed: '2026-08-13' }, { cmsReleased: '2026-02-30', changed: '2026-08-13' },
      { cmsReleased: '2026-08-13', changed: '08/13/2026' }, { cmsReleased: '2026-08-13', changed: '2026-08-13T10:00:00Z' }, { cmsReleased: 20260813, changed: '2026-08-13' }]) {
      assert.throws(() => ctx.setUpdated('x', bad), /setUpdated\(x\)/, JSON.stringify(bad));
    }
    assert.equal(ctx.updated.has('x'), false, 'a refused call records nothing');
    assert.throws(() => ctx.setUpdated('', { cmsReleased: '2026-08-13', changed: '2026-08-13' }), TypeError);
  }));

// The newest built_at date among the emitted files the HACRP pages read (the HACRP file, the hospital master, the
// history and the dollars), each file read from its newest year.
const newestBuilt = () => [
  emittedPath(newestYear('data/emitted/hacrp')), masterPath(newestYear('data/emitted/hospital')),
  historyPath(newestYear('data/emitted/hacrp-history')), dollarsPath(newestYear('data/emitted/dollars')),
].map((f) => JSON.parse(readFileSync(REPO_ROOT + f, 'utf8')).built_at.slice(0, 10)).sort().at(-1);

// Every .html file under dir, as paths from it.
const htmlFiles = (dir, rel = '') => readdirSync(join(dir, rel), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? htmlFiles(dir, join(rel, e.name)) : e.name.endsWith('.html') ? [join(rel, e.name)] : []));

// HACRP released on its first four hospitals: every page type, built in well under a second.
function hacrpSlice() {
  const data = loadHacrp();
  const slice = { ...data, hospitals: data.hospitals.slice(0, 4) };
  return { data, site: { ...HACRP, generate: (ctx) => generateHacrp(ctx, { released: true, data: slice, log: () => {} }) } };
}

test('HACRP gives the build its two dates, and the corrections address is on /corrections/ and no other built page', () =>
  withTemp(async (dir) => {
    const { data, site: hacrp } = hacrpSlice();
    const out = join(dir, 'dist');
    let updated;
    const watch = { ...HUB, generate: (ctx) => { updated = new Map(ctx.updated); return HUB.generate(ctx); } };
    await build({ outDir: out, env: 'production', sites: [hacrp, watch] });
    assert.deepEqual([...updated.keys()], ['hacrp']);
    const dates = updated.get('hacrp');
    assert.match(dates.cmsReleased, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(dates.changed, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(dates.cmsReleased, data.source.pdcReleased);
    assert.equal(dates.changed, newestBuilt());
    const pages = htmlFiles(out);
    assert.ok(pages.length > 10);
    const withAddress = pages.filter((f) => readFileSync(join(out, f), 'utf8').includes('corrections@'));
    assert.deepEqual(withAddress, [join('corrections', 'index.html')]);
    // The page shows the site's two dates.
    const text = readFileSync(join(out, 'corrections', 'index.html'), 'utf8');
    assert.ok(text.includes(`<time datetime="${dates.cmsReleased}">`));
    assert.ok(text.includes(`<time datetime="${dates.changed}">`));
  }));

test('build writes Cloudflare\'s _headers for its env, beside the pages', () =>
  withTemp(async (dir) => {
    for (const env of ['preview', 'production']) {
      const out = join(dir, env);
      await build({ outDir: out, env, sites: [] });
      assert.equal(readFileSync(join(out, '_headers'), 'utf8'), headersFile({ env }), env);
    }
  }));

// A tag's attributes: a script with no src runs inline unless it is a data block; an on* attribute and a javascript:
// URL are inline script too. script-src 'self' blocks all three, and style-src-elem 'self' blocks a <style> element.
const DATA_BLOCK = /\stype="application\/(ld\+)?json"/;
const SCRIPT_TAG = /<script\b([^>]*)>/gi;
const HANDLER = /<[a-z][^>]*\son[a-z]+\s*=/i;

test('every built page runs under the CSP: no inline script but data blocks, no <style> element, no on* handler or javascript: URL', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    await build({ outDir: out, env: 'production', sites: [hacrpSlice().site, HUB] });
    const pages = htmlFiles(out);
    assert.ok(pages.length > 10);
    let dataBlocks = 0;
    for (const f of pages) {
      const text = readFileSync(join(out, f), 'utf8');
      for (const [, attrs] of text.matchAll(SCRIPT_TAG)) {
        if (DATA_BLOCK.test(attrs)) dataBlocks++;
        else assert.match(attrs, /\ssrc="\/[^/]/, `${f}: <script${attrs}>`);
      }
      assert.doesNotMatch(text, /<style[\s>]/i, f);
      assert.doesNotMatch(text, HANDLER, f);
      assert.doesNotMatch(text, /=\s*"\s*javascript:/i, f);
    }
    assert.ok(dataBlocks > 0, 'the checks see the data blocks');
    // The checks see what they are meant to.
    assert.match('<button onclick="x()">', HANDLER);
    assert.doesNotMatch('<p data-on="1" class="on">on=</p>', HANDLER);
    assert.doesNotMatch(' type="module"', DATA_BLOCK);
  }));

test('the immutable rule matches the content-hashed files under /assets/ and nothing else the build writes', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    await build({ outDir: out, env: 'production', sites: [hacrpSlice().site, HUB] });
    const rules = parseHeaders(readFileSync(join(out, '_headers'), 'utf8'));
    const files = (rel) => readdirSync(join(out, rel), { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(join(rel, e.name)) : [join(rel, e.name)]));
    const seen = new Set();
    for (const f of files('')) {
      const path = `/${f.split(sep).join('/')}`;
      const hashed = /^\/assets\/[a-z0-9-]+\.[0-9a-f]{8}\.[a-z]+$/.test(path);
      const cache = headersFor(rules, path)['cache-control'] ?? '';
      assert.equal(cache.includes('immutable'), hashed, path);
      if (hashed) seen.add(path.split('.').at(-1));
    }
    assert.deepEqual([...seen].sort(), ['css', 'js', 'json']);
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

// CSS Color 4's named colors. transparent, currentColor and the forced-colors system colors (CanvasText and kin) have
// no color of their own, so they are allowed anywhere.
const NAMED_COLORS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
  darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue
  darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
  forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory
  khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen
  lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
  limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
  mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive
  olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke
  yellow yellowgreen`.split(/\s+/));
const COLOR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
// The words of a CSS file's declaration values, comments and quoted strings left out.
const cssValueWords = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, '')
  .match(/:[^;{}]*(?=[;}])/g)?.flatMap((v) => v.toLowerCase().match(/[a-z-]+/g) ?? []) ?? [];
// A color an SVG or style attribute in a script names: fill="red", stroke: 'navy', color=white.
const JS_COLOR_ATTR = /\b(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*[=:]\s*["'`]?\s*([a-z]+)/gi;

test("no file under web/ but tokens.css, and no site's own styles or scripts, hold a color value (hex, a color function, a named color)", () => {
  const files = [...repoFiles('web/', { untracked: true }), ...repoFiles('sites/', { untracked: true })]
    .filter((f) => /\.(css|js|mjs)$/.test(f) && f !== 'web/styles/tokens.css')
    .filter((f) => f.startsWith('web/') || /^sites\/[^/]+\/(web|client)\//.test(f));
  assert.ok(files.includes('sites/hacrp/web/styles.css'));
  for (const f of files) {
    const text = readFileSync(REPO_ROOT + f, 'utf8');
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, f);
    assert.doesNotMatch(text, COLOR_FUNCTION, f);
    const named = f.endsWith('.css') ? cssValueWords(text) : [...text.matchAll(JS_COLOR_ATTR)].map((m) => m[1].toLowerCase());
    assert.deepEqual(named.filter((w) => NAMED_COLORS.has(w)), [], f);
  }
  // The checks see what they are meant to.
  assert.deepEqual(cssValueWords('a { color: Navy; } /* red */ b { content: "white"; fill: transparent; }').filter((w) => NAMED_COLORS.has(w)), ['navy']);
  assert.deepEqual([...'<rect fill="red"/> fill="currentColor"'.matchAll(JS_COLOR_ATTR)].map((m) => m[1]), ['red', 'currentColor']);
  assert.match('a { color: rgb(0 0 0); }', COLOR_FUNCTION);
});

test('the bundled stylesheet puts each site\'s styles after the shared ones', () => {
  const css = stylesheet(['sites/hacrp/web/styles.css']);
  assert.ok(css.indexOf('.home__mark') < css.indexOf('.hosp__top {'));
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

test('print forces the light tokens on white: every color token the light block sets, the print block sets with !important', () => {
  const tokens = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
  const decls = (block) => new Map([...block.matchAll(/(--[\w-]+):\s*([^;]+?)\s*(?:!important)?;/g)].map((m) => [m[1], m[2]]));
  const light = decls(/^:root \{([^}]*)\}/m.exec(tokens)[1]);
  const block = /@media print \{\s*:root \{([^}]*)\}\s*\}/.exec(tokens);
  assert.ok(block, 'print block');
  const print = decls(block[1]);
  for (const [name, value] of light) {
    if (!/#|rgba?\(/.test(value) || name === '--grain') continue;
    assert.equal(print.get(name), name === '--paper' ? '#ffffff' : value, name);
  }
  assert.equal(block[1].match(/;/g).length, block[1].match(/!important;/g).length, 'every print declaration is !important');
  assert.ok(stylesheet().includes('@media print'), 'the bundle carries the print rules');
});

test('the local server serves index.html for directories, 404.html for unknown paths, and nothing outside its root', () =>
  withTemp(async (dir) => {
    const root = join(dir, 'dist');
    mkdirSync(join(root, 'hacrp'), { recursive: true });
    writeFileSync(join(root, 'index.html'), 'home');
    writeFileSync(join(root, '404.html'), 'not here');
    writeFileSync(join(root, 'hacrp', 'index.html'), 'hacrp');
    writeFileSync(join(dir, 'secret.txt'), 'outside');
    writeFileSync(join(root, 'd.csv'), 'a');
    writeFileSync(join(root, 'D.md'), 'b');
    const server = createSiteServer(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
      const home = await get(port, '/');
      assert.deepEqual([home.status, home.type, home.location, home.body], [200, 'text/html; charset=utf-8', undefined, 'home']);
      assert.equal((await get(port, '/hacrp/?x=1')).body, 'hacrp');
      assert.equal((await get(port, '/d.csv')).type, 'text/csv; charset=utf-8');
      assert.equal((await get(port, '/D.md')).type, 'text/markdown; charset=utf-8');
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
