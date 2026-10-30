import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT, filesUnder, readJson, repoFiles } from '../files.js';
import { buildAssets, hash8, stylesheet } from '../site/assets.js';
import { HUB } from '../../hub/pages.js';
import { sliceBuild } from '../../sites/hacrp/test/fixtures.js';
import { loadHacrp } from '../../sites/hacrp/web/data.js';
import { CLASSIC_ENTRIES, SHARED_ENTRIES, SITES, build, buildContext, mergeEntries } from '../site/build.js';
import { buildEnv, createContext, robotsFor, siteDates } from '../site/context.js';
import { headersFile, headersFor, parseHeaders } from '../site/headers.js';
import { addressOf } from '../site/address.js';
import { htmlPages, tags } from '../site/html.js';
import { pageType } from '../../tools/ci/page-types.js';
import { get, testAssets, withServer, withTemp as inTemp, writeTree } from './helpers.js';

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

test('two sites (or a site and the shared shell script) naming one JS entry fail the build', () =>
  withTemp(async (dir) => {
    assert.deepEqual(mergeEntries({ shell: 'a.js' }, { x: 'b.js' }, {}), { shell: 'a.js', x: 'b.js' });
    assert.throws(() => mergeEntries({ shell: 'a.js' }, { shell: 'b.js' }), /"shell" is defined twice/);
    assert.throws(() => mergeEntries({ shell: 'a.js' }, { x: 'b.js' }, { x: 'c.js' }), /"x" is defined twice/);
    const clash = { id: 'clash', entries: { shell: 'web/client/shell.js' }, generate: () => {} };
    await assert.rejects(build({ outDir: join(dir, 'dist'), sites: [clash] }), /"shell" is defined twice/);
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

// A classic entry (the head's theme script) runs as a plain script: one self-contained function call, so nothing it
// bundles becomes a global name, and no import or export, which a classic script can't parse.
test('buildAssets bundles a classic entry as one function call with no import, export or top-level name; an unknown name throws', () =>
  withTemp(async (dir) => {
    const helper = join(dir, 'helper.js');
    writeFileSync(helper, 'export const mark = (root, v) => { root.dataset.zz = v; };\nexport const unused = 1;\n');
    const entry = join(dir, 'early.js');
    writeFileSync(entry, "import { mark } from './helper.js';\nconst value = 'zz';\nmark(document.documentElement, value);\n");
    const out = join(dir, 'dist');
    const { js } = await buildAssets({ outDir: out, entries: { early: entry, demo: helper }, classic: ['early'] });
    assert.match(js.early, /^\/assets\/early\.[0-9a-f]{8}\.js$/);
    const text = readFileSync(join(out, js.early), 'utf8').trim();
    assert.match(text, /^\(\(\)=>\{[\s\S]*\}\)\(\);$/, 'one arrow function, called');
    assert.doesNotMatch(text, /\b(import|export)\b/);
    assert.match(readFileSync(join(out, js.demo), 'utf8'), /export\s*\{/, 'the other entries stay modules');
    await assert.rejects(buildAssets({ outDir: out, entries: { demo: helper }, classic: ['nope'] }), /classic entry "nope"/);
  }));

test('the build\'s one classic entry is the head\'s theme script', () => {
  assert.deepEqual(CLASSIC_ENTRIES, ['theme']);
  assert.equal(SHARED_ENTRIES.theme, 'web/client/theme.js');
});

test('buildAssets writes each named sheet (siteStyles) as its own minified CSS under a content hash, outside the shared bundle', () =>
  withTemp(async (dir) => {
    const own = join(dir, 'own.css');
    const more = join(dir, 'more.css');
    writeFileSync(own, '.zz-own {\n  margin: 1px;\n}\n');
    writeFileSync(more, '.zz-more { margin: 2px; }\n');
    const out = join(dir, 'dist');
    const assets = await buildAssets({ outDir: out, siteStyles: { demo: [own, more] } });
    assert.deepEqual(Object.keys(assets.sheets), ['demo']);
    assert.match(assets.sheets.demo, /^\/assets\/demo\.[0-9a-f]{8}\.css$/);
    const text = readFileSync(join(out, assets.sheets.demo), 'utf8');
    assert.equal(assets.sheets.demo, `/assets/demo.${hash8(text)}.css`);
    // Its files in order, minified; none of the shared bundle (the tokens, their dark copy and print block) in it.
    assert.equal(text.trim(), '.zz-own{margin:1px}.zz-more{margin:2px}');
    assert.doesNotMatch(readFileSync(join(out, assets.css), 'utf8'), /zz-own|zz-more/);
    assert.deepEqual((await buildAssets({ outDir: out })).sheets, {});
    // The shared bundle is site.<hash>.css, so no sheet takes that name; nor a name that isn't a plain file name.
    for (const name of ['site', '../x', 'Hub', '']) {
      await assert.rejects(buildAssets({ outDir: out, siteStyles: { [name]: [own] } }), /stylesheet name/, name);
    }
  }));

test('each site\'s styles are a stylesheet of its own, named by its id; the shared bundle holds no site\'s, and a site with none has none', () =>
  withTemp(async (dir) => {
    const own = join(dir, 'own.css');
    const other = join(dir, 'other.css');
    writeFileSync(own, '.zz-own { margin: 1px; }\n');
    writeFileSync(other, '.zz-other { margin: 2px; }\n');
    const seen = [];
    const sites = [
      { id: 'plain', styles: [other], generate: (ctx) => { seen.push(ctx.assets); } },
      { id: 'mine', styles: [own], generate: () => {} },
      { id: 'bare', generate: () => {} },
    ];
    const out = join(dir, 'dist');
    await build({ outDir: out, sites });
    const [{ css, sheets }] = seen;
    const text = (path) => readFileSync(join(out, path), 'utf8');
    assert.deepEqual(Object.keys(sheets), ['plain', 'mine']);
    assert.match(sheets.mine, /^\/assets\/mine\.[0-9a-f]{8}\.css$/);
    assert.doesNotMatch(text(css), /zz-own|zz-other/);
    assert.equal(text(sheets.mine).trim(), '.zz-own{margin:1px}');
    assert.equal(text(sheets.plain).trim(), '.zz-other{margin:2px}');
    assert.equal(readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.css')).length, 3);
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

test('build writes the hub\'s asset once and hands every site the shell\'s facts, with hubUrl naming that file', () =>
  withTemp(async (dir) => {
    const seen = [];
    const sites = ['first', 'second'].map((id) => ({ id, generate: (ctx) => { seen.push(ctx.assets.shell); } }));
    const out = join(dir, 'dist');
    await build({ outDir: out, sites });
    const files = readdirSync(join(out, 'assets')).filter((f) => f.startsWith('hub-hospitals.'));
    assert.equal(files.length, 1);
    assert.match(files[0], /^hub-hospitals\.[0-9a-f]{8}\.json$/);
    const text = readFileSync(join(out, 'assets', files[0]), 'utf8');
    assert.equal(files[0], `hub-hospitals.${hash8(text)}.json`);
    // Computed once: every site gets the same facts, and the asset behind hubUrl is the one the facts describe.
    assert.equal(seen.length, 2);
    assert.equal(seen[0], seen[1]);
    const shell = seen[0];
    assert.equal(shell.hubUrl, `/assets/${files[0]}`);
    const asset = JSON.parse(text);
    assert.equal(shell.fy, asset.fy);
    assert.equal(shell.hospitals, asset.rows.filter((row) => row[asset.cols.indexOf('status')] === 'e').length);
    assert.match(shell.changed, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(shell.programs), ['hrrp', 'hacrp', 'hvbp']);
    assert.ok(shell.programs.hrrp.dollars < 0 && shell.programs.hrrp.cutN > 0);
    assert.ok(shell.programs.hacrp.dollars < 0 && shell.programs.hacrp.cutN > 0);
    assert.ok(shell.programs.hvbp.moved > 0 && Number.isInteger(shell.programs.hvbp.net));
    // The test helper's invented facts have the build's shape, so a page rendered in a test meets the same fields.
    const shape = (facts) => ({ ...Object.fromEntries(Object.keys(facts).map((k) => [k, typeof facts[k]])),
      programs: Object.fromEntries(Object.entries(facts.programs).map(([id, figures]) => [id, Object.keys(figures)])) });
    assert.deepEqual(shape(testAssets().shell), shape(shell));
  }));

test('a build with no sites still writes the hub\'s asset, once', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    await build({ outDir: out, sites: [] });
    assert.equal(readdirSync(join(out, 'assets')).filter((f) => f.startsWith('hub-hospitals.')).length, 1);
  }));

test('createContext puts the shell\'s facts on ctx.assets.shell without changing the assets it was given', () => {
  const assets = testAssets();
  const { shell } = assets;
  const other = { ...shell, fy: 2099 };
  assert.equal(createContext({ outDir: '/x', env: undefined, assets }).assets.shell, shell, 'the assets\' own shell stays');
  const ctx = createContext({ outDir: '/x', env: undefined, assets, shell: other });
  assert.equal(ctx.assets.shell, other);
  assert.equal(assets.shell, shell, 'the caller\'s object is not edited');
  assert.equal(ctx.assets.css, assets.css);
});

test('buildContext, the build\'s own path to a context, writes the hub\'s asset and passes the shell through createContext, leaving the assets it was given untouched', () =>
  withTemp(async (dir) => {
    const assets = Object.freeze({ css: '/assets/site.test.css', js: Object.freeze({ shell: '/assets/shell.test.js' }) });
    const ctx = buildContext({ outDir: dir, env: 'preview', assets });
    assert.notEqual(ctx.assets, assets);
    assert.equal(assets.shell, undefined, 'the caller\'s object is not edited');
    assert.equal(ctx.assets.css, assets.css);
    assert.equal(ctx.assets.js, assets.js);
    assert.equal(ctx.env, 'preview');
    const { hubUrl, ...facts } = ctx.assets.shell;
    assert.match(hubUrl, /^\/assets\/hub-hospitals\.[0-9a-f]{8}\.json$/);
    assert.ok(existsSync(join(dir, hubUrl)), 'the asset the facts name is written');
    assert.deepEqual(Object.keys(facts), ['fy', 'hospitals', 'changed', 'programs']);
  }));

test('the hub runs last: its sitemap lists the indexable pages every other site emitted', () => {
  assert.equal(SITES.at(-1), HUB);
  assert.equal(SITES.filter((s) => s === HUB).length, 1);
});

test('emit refuses a path outside the site; asset writes a content-hashed file', () =>
  withTemp(async (dir) => {
    const ctx = createContext({ outDir: dir, env: undefined, assets: testAssets() });
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

test('siteDates takes a site\'s two dates from what its generate returned; none, or a date that is not YYYY-MM-DD on the calendar, throws naming the site', () => {
  const ok = { cmsReleased: '2026-08-13', changed: '2026-10-22' };
  assert.deepEqual(siteDates('hacrp', { updated: ok }), ok);
  for (const none of [undefined, null, {}]) assert.throws(() => siteDates('hacrp', none), (err) => err instanceof RangeError && /"hacrp" gave the build no dates/.test(err.message), JSON.stringify(none));
  for (const bad of [undefined, null, '', '2026-02-30', '10/22/2026', '2026-8-13', '2026-10-22T00:00:00Z']) {
    assert.throws(() => siteDates('hacrp', { updated: { ...ok, cmsReleased: bad } }), (err) => err instanceof RangeError && /"hacrp".*cmsReleased/.test(err.message), `cmsReleased ${bad}`);
    assert.throws(() => siteDates('hacrp', { updated: { ...ok, changed: bad } }), (err) => err instanceof RangeError && /"hacrp".*changed/.test(err.message), `changed ${bad}`);
  }
  assert.throws(() => siteDates('hacrp', { updated: { cmsReleased: '2026-02-30', changed: '2026-10-22' } }), /2026-02-30/);
});

// A site that runs without writing anything, and (when asked) returns its dates.
const quietSite = (id, { dates = false } = {}) => ({ id, generate: () => (dates ? { updated: { cmsReleased: '2026-08-13', changed: '2026-10-22' } } : undefined) });

test('a program site that returns no dates stops the build; the hub alone, or every program site with its dates, builds; another site owes none', () =>
  withTemp(async (dir) => {
    await assert.rejects(build({ outDir: join(dir, 'a'), sites: [quietSite('hacrp'), HUB] }), /"hacrp" gave the build no dates/);
    assert.ok((await build({ outDir: join(dir, 'b'), sites: [HUB] })).pages > 0);
    assert.ok((await build({ outDir: join(dir, 'c'), sites: [quietSite('hacrp', { dates: true }), quietSite('faux'), HUB] })).pages > 0);
  }));

// The newest built_at date among the emitted files the numbers come from: the files loadHacrp lists (builtFiles; the
// history is null in a build without one), each read again from disk.
const newestBuilt = ({ builtFiles }) => builtFiles.filter(([, file]) => file)
  .map(([path]) => readJson(REPO_ROOT + path).built_at.slice(0, 10)).sort().at(-1);

// HACRP released on its first four hospitals (every page type, in well under a second) with the hub: built once, in
// production, for the tests that read a whole build.
const DATA = loadHacrp();
const builtSlice = sliceBuild({ ...DATA, hospitals: DATA.hospitals.slice(0, 4) });

test('HACRP gives the build its two dates, which /corrections/ shows', async () => {
  const out = await builtSlice();
  // The dates: CMS's release of the file the site uses, and the newest built_at of the emitted files it reads.
  const text = readFileSync(join(out, 'corrections', 'index.html'), 'utf8');
  assert.ok(text.includes(`<time datetime="${DATA.source.pdcReleased}">`));
  assert.ok(text.includes(`<time datetime="${newestBuilt(DATA)}">`));
});

// A rule for a hub page's own parts: the hospital page's (.hh), the home page's story (.story) or the interim Readmissions
// pages' (.rd), as a selector names it (minified: followed by a combinator, another selector or the block).
const HUB_RULE = /\.(hh|story|rd)(__[\w-]+|--[\w-]+)?(?=[\s,{.:>+~[)])/;

test('each page links the shared stylesheet and then its own site\'s alone: a HACRP page HACRP\'s, a hub page the hub\'s; the shared one holds neither\'s rules', async () => {
  const out = await builtSlice();
  const sheetsOf = (file) => [...tags(readFileSync(join(out, file), 'utf8'), { names: ['link'] })]
    .filter(({ attrs }) => attrs.rel === 'stylesheet').map(({ attrs }) => attrs.href);
  const PROGRAM_TYPES = ['program', 'hospital', 'place', 'methods', 'dictionary'];
  const seen = new Set();
  const shared = new Set();
  const own = { hacrp: new Set(), hub: new Set() };
  for (const file of htmlPages(out)) {
    const type = pageType(addressOf(file));
    const links = sheetsOf(file);
    seen.add(type);
    assert.equal(links.length, 2, file);
    shared.add(links[0]);
    own[PROGRAM_TYPES.includes(type) ? 'hacrp' : 'hub'].add(links[1]);
  }
  for (const type of [...PROGRAM_TYPES, 'hub', 'policy', 'coming', 'hubHospital', 'notFound']) assert.ok(seen.has(type), `the slice built a ${type} page`);
  assert.equal(shared.size, 1, 'one shared stylesheet');
  assert.deepEqual([own.hacrp.size, own.hub.size], [1, 1], 'one stylesheet for each site');
  const [site] = shared;
  const [[hacrp], [hub]] = [[...own.hacrp], [...own.hub]];
  assert.match(site, /^\/assets\/site\.[0-9a-f]{8}\.css$/);
  assert.match(hacrp, /^\/assets\/hacrp\.[0-9a-f]{8}\.css$/);
  assert.match(hub, /^\/assets\/hub\.[0-9a-f]{8}\.css$/);
  // (Each check is a yes or no: a failing match would print the whole stylesheet.)
  const css = (href) => readFileSync(join(out, href), 'utf8');
  assert.equal(HUB_RULE.exec(css(site))?.[0] ?? null, null, 'the shared stylesheet holds no hub page\'s rule');
  assert.equal(HUB_RULE.exec(css(hacrp))?.[0] ?? null, null, 'HACRP\'s stylesheet holds no hub page\'s rule');
  for (const root of ['.prog__lede', '.step__n']) {
    assert.ok(css(hacrp).includes(root), `HACRP's stylesheet holds ${root}`);
    assert.ok(!css(site).includes(root) && !css(hub).includes(root), `only HACRP's stylesheet holds ${root}`);
  }
  for (const root of ['.hh__', '.story', '.rd__']) assert.ok(css(hub).includes(root), `the hub's stylesheet holds ${root}`);
  // The chart and what-if kit (KIT_STYLES) rides in HACRP's sheet alone; the hub's keeps the scale bar's two dot rules.
  for (const rule of ['.chart-tile', '.wi-cliff__pit', '.fig__key']) {
    assert.ok(css(hacrp).includes(rule) && !css(site).includes(rule) && !css(hub).includes(rule), `only HACRP's stylesheet holds ${rule}`);
  }
  assert.ok(css(hub).includes('.sbar .chart-dots--ink'), 'the hub\'s stylesheet holds the scale bar\'s dots');
  // The theme is the tokens' (the shared bundle: the dark block, its copy for the toggle and the print block); the hub's
  // sheet reads the tokens and sets none of that, so the shared bundle's dark and print values reach its rules.
  assert.ok(/:root\[data-theme="?dark"?\]\{[^}]*--pen:/.test(css(site)), 'the shared stylesheet\'s copy of the dark tokens for the toggle');
  assert.ok(/@media print\{:root\{[^}]*--paper: ?#fff(fff)? ?!important/.test(css(site)), 'the shared stylesheet\'s print block');
  assert.equal(/:root|prefers-color-scheme|data-theme/.exec(css(hub))?.[0] ?? null, null, 'the hub\'s stylesheet sets no theme');
  assert.ok(css(hub).includes('var(--pen)'), 'the hub\'s stylesheet reads the tokens');
  // The check sees what it is meant to.
  assert.match('.hh__card{margin:0}', HUB_RULE);
  assert.match('.story>.step{margin:0}', HUB_RULE);
  assert.match('.x,.rd .y{margin:0}', HUB_RULE);
  assert.doesNotMatch('.hhx{margin:0}.history{margin:0}.rdx{margin:0}', HUB_RULE);
});

test('build writes Cloudflare\'s _headers for its env, beside the pages', () =>
  withTemp(async (dir) => {
    for (const env of ['preview', 'production']) {
      const out = join(dir, env);
      await build({ outDir: out, env, sites: [] });
      assert.equal(readFileSync(join(out, '_headers'), 'utf8'), headersFile({ env }), env);
    }
  }));

// What a page holds that runs as inline script or style: a script with no src of the site's own runs inline unless it
// is a data block; an on* attribute and a javascript: URL are inline script too. script-src 'self' blocks all three,
// and style-src-elem 'self' blocks a <style> element. dataBlocks: the data blocks, which may stay.
const DATA_TYPES = new Set(['application/json', 'application/ld+json']);
function inlineCode(page) {
  const problems = [];
  let dataBlocks = 0;
  for (const { name, attrs } of tags(page)) {
    if (name === 'script' && DATA_TYPES.has(attrs.type)) dataBlocks++;
    else if (name === 'script' && !/^\/[^/]/.test(attrs.src ?? '')) problems.push(`<script src="${attrs.src ?? ''}">`);
    if (name === 'style') problems.push('<style>');
    for (const [attr, value] of Object.entries(attrs)) {
      if (/^on[a-z]+$/.test(attr)) problems.push(`<${name} ${attr}>`);
      if (/^\s*javascript:/i.test(value)) problems.push(`<${name} ${attr}="javascript:...">`);
    }
  }
  return { problems, dataBlocks };
}

test('every built page runs under the CSP: no inline script but data blocks, no <style> element, no on* handler or javascript: URL', async () => {
  const out = await builtSlice();
  const pages = htmlPages(out);
  assert.ok(pages.length > 10);
  let dataBlocks = 0;
  for (const f of pages) {
    const found = inlineCode(readFileSync(join(out, f), 'utf8'));
    assert.deepEqual(found.problems, [], f);
    dataBlocks += found.dataBlocks;
  }
  assert.ok(dataBlocks > 0, 'the checks see the data blocks');
  // The checks see what they are meant to.
  assert.deepEqual(inlineCode('<button onclick="x()">').problems, ['<button onclick>']);
  assert.deepEqual(inlineCode('<p data-on="1" class="on">on=</p>'), { problems: [], dataBlocks: 0 });
  assert.equal(inlineCode('<script type="module">x()</script><script src="//elsewhere.example/x.js"></script>').problems.length, 2);
  assert.deepEqual(inlineCode('<script type="application/ld+json">{}</script><script src="/assets/x.js"></script>'), { problems: [], dataBlocks: 1 });
  assert.equal(inlineCode('<style>p{}</style><a href=" javascript:x()">').problems.length, 2);
});

test('the immutable rule matches the content-hashed files under /assets/ and nothing else the build writes', async () => {
  const out = await builtSlice();
  const rules = parseHeaders(readFileSync(join(out, '_headers'), 'utf8'));
  const seen = new Set();
  for (const f of filesUnder(out)) {
    const path = `/${f}`;
    const hashed = /^\/assets\/[a-z0-9-]+\.[0-9a-f]{8}\.[a-z]+$/.test(path);
    const cache = headersFor(rules, path)['cache-control'] ?? '';
    assert.equal(cache.includes('immutable'), hashed, path);
    if (hashed) seen.add(path.split('.').at(-1));
  }
  assert.deepEqual([...seen].sort(), ['css', 'js', 'json']);
});

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

test('buildEnv: PP_ENV when set; otherwise production only for Workers Builds\' build of main', () => {
  const cases = [
    [{}, undefined],
    [{ PP_ENV: 'production' }, 'production'],
    [{ PP_ENV: 'preview', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }, 'preview'],
    [{ PP_ENV: '', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }, ''],
    [{ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }, 'production'],
    [{ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'go-live' }, undefined],
    [{ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'Main' }, undefined],
    [{ WORKERS_CI: '1' }, undefined],
    // Only on Workers Builds: a branch name alone, elsewhere, is not a production build.
    [{ WORKERS_CI_BRANCH: 'main' }, undefined],
  ];
  for (const [env, want] of cases) assert.equal(buildEnv(env), want, JSON.stringify(env));
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

test("no file under web/ but tokens.css, and no site's or the hub's own styles or scripts, hold a color value (hex, a color function, a named color)", () => {
  const files = [...repoFiles('web/', { untracked: true }), ...repoFiles('sites/', { untracked: true }), ...repoFiles('hub/', { untracked: true })]
    .filter((f) => /\.(css|js|mjs)$/.test(f) && f !== 'web/styles/tokens.css')
    .filter((f) => f.startsWith('web/') || /^sites\/[^/]+\/(web|client)\//.test(f) || /^hub\/(?!test\/)/.test(f));
  assert.ok(files.includes('sites/hacrp/web/styles.css'));
  // The hub's own files are checked too (its tests are not).
  assert.ok(files.includes('hub/model.js'));
  assert.ok(!files.some((f) => f.startsWith('hub/test/')));
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

test('the shared stylesheet holds web/styles/ alone: no site\'s styles', () => {
  const css = stylesheet();
  assert.ok(css.includes('.pol__top {'));
  for (const rule of ['.hosp__top {', '.hero {']) assert.ok(!css.includes(rule), rule);
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

test('print forces the light tokens on white: the bundle\'s print block sets every color token the light block sets, each !important', () => {
  const tokens = readFileSync(REPO_ROOT + 'web/styles/tokens.css', 'utf8');
  const decls = (block) => new Map([...block.matchAll(/(--[\w-]+):\s*([^;]+?)\s*;/g)].map((m) => [m[1], m[2]]));
  const light = [...decls(/^:root \{([^}]*)\}/m.exec(tokens)[1])].filter(([, value]) => /^(#|rgba?\()/.test(value));
  assert.ok(light.length > 10, 'the light block\'s colors');
  const block = /@media print \{\s*:root \{([^}]*)\}\s*\}/.exec(stylesheet());
  assert.ok(block, 'print block');
  const print = decls(block[1]);
  for (const [name, value] of light) assert.equal(print.get(name), `${name === '--paper' ? '#ffffff' : value} !important`, name);
  assert.equal(print.get('--grain'), 'none !important');
  assert.equal(block[1].match(/;/g).length, block[1].match(/!important;/g).length, 'every print declaration is !important');
});

test('the local server serves index.html for directories, 404.html for unknown paths, and nothing outside its root', () =>
  withTemp(async (dir) => {
    const root = join(dir, 'dist');
    writeTree(root, { 'index.html': 'home', '404.html': 'not here', 'hacrp/index.html': 'hacrp', 'd.csv': 'a', 'D.md': 'b' });
    writeFileSync(join(dir, 'secret.txt'), 'outside');
    await withServer(root, async (port) => {
      const home = await get(port, '/');
      assert.deepEqual([home.status, home.type, home.location, home.body], [200, 'text/html; charset=utf-8', undefined, 'home']);
      assert.equal((await get(port, '/hacrp/?x=1')).body, 'hacrp');
      assert.equal((await get(port, '/d.csv')).type, 'text/csv; charset=utf-8');
      assert.equal((await get(port, '/D.md')).type, 'text/markdown; charset=utf-8');
      // Redirected as Cloudflare redirects them (address.js lookup), with a 307, the query kept.
      for (const [path, to] of [['/hacrp', '/hacrp/'], ['/hacrp?x=1', '/hacrp/?x=1'], ['/hacrp/index.html', '/hacrp/'], ['/404.html', '/404']]) {
        const res = await get(port, path);
        assert.deepEqual([res.status, res.location], [307, to], path);
      }
      const notFoundPage = await get(port, '/404');
      assert.deepEqual([notFoundPage.status, notFoundPage.body], [200, 'not here'], 'the not-found page at its own address');
      for (const path of ['/nope/', '/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/a%00b', '/%E0%A4%A']) {
        const res = await get(port, path);
        assert.equal(res.status, path === '/%E0%A4%A' ? 400 : 404, path);
        assert.notEqual(res.body, 'outside', path);
      }
      assert.equal((await get(port, '/nope/')).body, 'not here');
    });
  }));
