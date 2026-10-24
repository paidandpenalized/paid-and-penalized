// The size budget: a page's brotli weight (its HTML plus each stylesheet and module script it loads, each once),
// the page types, and the over-budget report, on a synthetic built site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../../web/site.js';
import { withTemp } from '../../pipeline/test/helpers.js';
import { BUDGETS, JS_BUDGET, checkBudgets, measure, pageType, pageWeight } from '../ci/size-budget.js';

const brAt = (quality) => (text) => brotliCompressSync(Buffer.from(text), { params: { [constants.BROTLI_PARAM_QUALITY]: quality } }).length;
// The size the budget counts: quality 5.
const br = brAt(5);
// Text that brotli can't shrink much, so a size is easy to aim at.
const noise = (n) => randomBytes(n).toString('base64');

const page = (...refs) => `<!doctype html><html><head><title>t</title>${refs.join('')}</head><body><p>hello</p></body></html>`;
const css = (href) => `<link rel="stylesheet" href="${href}">`;
const js = (src) => `<script type="module" src="${src}"></script>`;

function build(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

test('pageWeight: brotli of the HTML, each stylesheet and each script, a script shared or repeated counted once', () =>
  withTemp('size-', (dir) => {
    const site = noise(300);
    const a = noise(200);
    const shared = noise(150);
    const hospital = page(css('/assets/site.1.css'), js('/assets/a.1.js'), js('/assets/shared.1.js'), js('/assets/shared.1.js'));
    const other = page(css('/assets/site.1.css'), js('/assets/shared.1.js'));
    build(dir, {
      'assets/site.1.css': site, 'assets/a.1.js': a, 'assets/shared.1.js': shared,
      'hacrp/hospital/990001/index.html': hospital, 'hacrp/hospital/990002/index.html': other,
    });
    assert.deepEqual(pageWeight(dir, 'hacrp/hospital/990001/index.html'), {
      html: br(hospital), css: br(site), js: br(a) + br(shared), total: br(hospital) + br(site) + br(a) + br(shared),
    });
    // Each page counts its own references: the second page's one script is the shared file, once.
    assert.deepEqual(pageWeight(dir, 'hacrp/hospital/990002/index.html'), {
      html: br(other), css: br(site), js: br(shared), total: br(other) + br(site) + br(shared),
    });
  }));

test('pageWeight: a script with a src counts, module or not; a data script, a font preload and a page link do not', () =>
  withTemp('size-', (dir) => {
    const classic = noise(120);
    build(dir, { 'assets/classic.1.js': classic, 'classic/index.html': page('<script src="/assets/classic.1.js" defer></script>') });
    assert.equal(pageWeight(dir, 'classic/index.html').js, br(classic));

    const text = '<link rel="preload" href="/assets/fonts/a.woff2" as="font"><link rel="icon" href="/favicon.svg">'
      + '<a href="/assets/other.1.js">x</a><script type="application/json" id="d">{"a":1}</script><script>var x = 1;</script>';
    const body = page(text);
    build(dir, { 'index.html': body });
    assert.deepEqual(pageWeight(dir, 'index.html'), { html: br(body), css: 0, js: 0, total: br(body) });
  }));

test('pageWeight: a referenced file that is not in dist throws, and so does a script that imports another file', () =>
  withTemp('size-', (dir) => {
    build(dir, { 'index.html': page(css('/assets/gone.1.css')) });
    assert.throws(() => pageWeight(dir, 'index.html'), /gone\.1\.css/);

    build(dir, {
      'a/index.html': page(js('/assets/split.1.js')),
      'assets/split.1.js': 'import{x as a}from"/assets/chunk.2.js";a();',
    });
    assert.throws(() => pageWeight(dir, 'a/index.html'), /split\.1\.js.*imports/);
    build(dir, { 'b/index.html': page(js('/assets/rel.1.js')), 'assets/rel.1.js': 'const m=await import("./chunk.2.js");' });
    assert.throws(() => pageWeight(dir, 'b/index.html'), /rel\.1\.js.*imports/);
    // Words that only look like an import do not.
    build(dir, { 'c/index.html': page(js('/assets/ok.1.js')), 'assets/ok.1.js': 'e.textContent="data from",f("import")' });
    assert.equal(pageWeight(dir, 'c/index.html').js, br('e.textContent="data from",f("import")'));
  }));

test('pageType: every page of the site sorts into one type', () => {
  const sorted = {
    '/': 'hub',
    '/404.html': 'notFound',
    '/hacrp/': 'program',
    '/hacrp/methods/': 'methods',
    '/hacrp/data/': 'dictionary',
    '/hacrp/hospital/990001/': 'hospital',
    '/hacrp/hospital/99A001/': 'hospital',
    '/hacrp/region/northeast/': 'place',
    '/hacrp/division/south-atlantic/': 'place',
    '/hacrp/state/ca/': 'place',
    '/hacrp/metro/new-york-newark-jersey-city-ny-nj/': 'place',
  };
  for (const path of Object.values(SITE.pages)) sorted[path] = 'policy';
  for (const [path, type] of Object.entries(sorted)) assert.equal(pageType(path), type, path);
  // The hub's methods page and the program's are different pages.
  assert.equal(pageType('/methods/'), 'policy');
  assert.equal(pageType('/hacrp/methods/'), 'methods');
});

test('pageType: a path that matches no type throws, so a new kind of page needs a budget', () => {
  for (const path of ['/hacrp/hospital/', '/hacrp/hospital/12345/', '/hacrp/hospital/9900011/', '/hacrp/county/x/', '/hacrp/state/', '/new/', '/other.html', '/hacrp/hospital/990001/extra/'])
    assert.throws(() => pageType(path), /new page type needs a budget/, path);
});

test('every page type has a budget; hub and policy start at 100 KB and scripts at 120 KB (ARCH-27)', () => {
  assert.deepEqual(Object.keys(BUDGETS).sort(), ['dictionary', 'hospital', 'hub', 'methods', 'notFound', 'place', 'policy', 'program']);
  assert.equal(BUDGETS.hub, 100 * 1024);
  assert.equal(BUDGETS.policy, 100 * 1024);
  assert.equal(JS_BUDGET, 120 * 1024);
  for (const b of Object.values(BUDGETS)) assert.ok(Number.isInteger(b) && b > 0);
});

test('checkBudgets: lists the pages over their type\'s budget, and only those', () =>
  withTemp('size-', (dir) => {
    const big = page(`<!-- ${noise(3000)} -->`);
    const small = page();
    build(dir, {
      'hacrp/hospital/990001/index.html': big,
      'hacrp/hospital/990002/index.html': small,
      'hacrp/state/ca/index.html': big,
      'index.html': small,
    });
    const budgets = { hub: 1000, policy: 1000, program: 1000, hospital: 2000, place: 10000, methods: 1000, dictionary: 1000, notFound: 1000 };
    const over = checkBudgets(dir, { budgets });
    assert.deepEqual(over, [{ path: '/hacrp/hospital/990001/', type: 'hospital', part: 'total', total: br(big), budget: 2000 }]);
    // Everything fits a generous budget.
    assert.deepEqual(checkBudgets(dir, { budgets: { ...budgets, hospital: 50000 } }), []);
  }));

test('checkBudgets: a page whose scripts alone pass the script budget is reported, whatever its total', () =>
  withTemp('size-', (dir) => {
    const heavy = noise(4000);
    build(dir, { 'assets/big.1.js': heavy, 'hacrp/index.html': page(js('/assets/big.1.js')) });
    const budgets = { ...BUDGETS };
    const over = checkBudgets(dir, { budgets, js: 1000 });
    assert.deepEqual(over, [{ path: '/hacrp/', type: 'program', part: 'js', total: br(heavy), budget: 1000 }]);
  }));

test('checkBudgets: a page of no known type, or a build with no pages, throws', () =>
  withTemp('size-', (dir) => {
    assert.throws(() => checkBudgets(dir), /no pages/);
    build(dir, { 'brand-new/index.html': page() });
    assert.throws(() => checkBudgets(dir), /new page type needs a budget/);
  }));

test('measure: one row per page, with its type and weight', () =>
  withTemp('size-', (dir) => {
    const p = page();
    build(dir, { 'index.html': p, '404.html': p });
    const rows = measure(dir).sort((x, y) => x.path.localeCompare(y.path));
    assert.deepEqual(rows.map((r) => [r.path, r.type, r.total]), [['/', 'hub', br(p)], ['/404.html', 'notFound', br(p)]]);
  }));

test('CLI: exits 0 on a site within budget, and 1 naming each page over it', () =>
  withTemp('size-', (dir) => {
    const cli = (...args) => spawnSync('node', [join(REPO_ROOT, 'tools/ci/size-budget.js'), ...args], { encoding: 'utf8' });
    build(dir, { 'index.html': page(), 'terms/index.html': page() });
    const ok = cli(dir);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /2 pages within budget/);

    // Past the policy pages' 100 KB, which random text can't be squeezed under.
    build(dir, { 'terms/index.html': page(`<!-- ${noise(110 * 1024)} -->`) });
    const bad = cli(dir);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /OVER BUDGET \/terms\/ \(policy\): 1\d\d\.\d KB > 100\.0 KB/);

    // A build that isn't there, or holds a page of no type, is an error too, not a pass.
    assert.equal(cli(join(dir, 'missing')).status, 1);
    build(dir, { 'brand-new/index.html': page() });
    const unknown = cli(dir);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /new page type needs a budget/);
  }));

// Words picked by a fixed generator: text brotli compresses well, and noticeably better at quality 11 than at 5.
function prose(words) {
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const vocabulary = Array.from({ length: 400 }, (_, i) => `w${(i * 7919).toString(36)}`);
  return Array.from({ length: words }, () => vocabulary[next() % vocabulary.length]).join(' ');
}

test('pageWeight: measured at brotli quality 5, the quality the budgets were set at', () =>
  withTemp('size-', (dir) => {
    const text = page(`<p>${prose(20000)}</p>`);
    assert.notEqual(brAt(11)(text), brAt(5)(text), 'precondition: the two qualities differ on this text');
    build(dir, { 'index.html': text });
    assert.equal(pageWeight(dir, 'index.html').html, brAt(5)(text));
  }));
