// The size budget: a page's brotli weight (its HTML plus each stylesheet and module script it loads, each once),
// every page type's budget, and the over-budget report, on a synthetic built site. The page types are page-types.js's
// (page-types.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { REPO_ROOT } from '../../pipeline/files.js';
import { withTemp, writeTree } from '../../pipeline/test/helpers.js';
import { BUDGETS, JS_BUDGET, measure, overBudget, pageWeight } from '../ci/size-budget.js';

// Brotli's size of the text; quality 5 is the one the budget counts.
const br = (text, quality = 5) => brotliCompressSync(Buffer.from(text), { params: { [constants.BROTLI_PARAM_QUALITY]: quality } }).length;
// Text that brotli can't shrink much, so a size is easy to aim at.
const noise = (n) => randomBytes(n).toString('base64');

const page = (...refs) => `<!doctype html><html><head><title>t</title>${refs.join('')}</head><body><p>hello</p></body></html>`;
const css = (href) => `<link rel="stylesheet" href="${href}">`;
const js = (src) => `<script type="module" src="${src}"></script>`;

test('pageWeight: brotli of the HTML, each stylesheet and each script, a script shared or repeated counted once', () =>
  withTemp('size-', (dir) => {
    const site = noise(300);
    const a = noise(200);
    const shared = noise(150);
    const hospital = page(css('/assets/site.1.css'), js('/assets/a.1.js'), js('/assets/shared.1.js'), js('/assets/shared.1.js'));
    const other = page(css('/assets/site.1.css'), js('/assets/shared.1.js'));
    writeTree(dir, {
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
    writeTree(dir, { 'assets/classic.1.js': classic, 'classic/index.html': page('<script src="/assets/classic.1.js" defer></script>') });
    assert.equal(pageWeight(dir, 'classic/index.html').js, br(classic));

    const text = '<link rel="preload" href="/assets/fonts/a.woff2" as="font"><link rel="icon" href="/favicon.svg">'
      + '<a href="/assets/other.1.js">x</a><script type="application/json" id="d">{"a":1}</script><script>var x = 1;</script>';
    const body = page(text);
    writeTree(dir, { 'index.html': body });
    assert.deepEqual(pageWeight(dir, 'index.html'), { html: br(body), css: 0, js: 0, total: br(body) });
  }));

test('pageWeight: a referenced file that is not in dist throws, and so does a script that imports another file', () =>
  withTemp('size-', (dir) => {
    writeTree(dir, { 'index.html': page(css('/assets/gone.1.css')) });
    assert.throws(() => pageWeight(dir, 'index.html'), /gone\.1\.css/);

    writeTree(dir, {
      'a/index.html': page(js('/assets/split.1.js')),
      'assets/split.1.js': 'import{x as a}from"/assets/chunk.2.js";a();',
    });
    assert.throws(() => pageWeight(dir, 'a/index.html'), /split\.1\.js.*imports/);
    writeTree(dir, { 'b/index.html': page(js('/assets/rel.1.js')), 'assets/rel.1.js': 'const m=await import("./chunk.2.js");' });
    assert.throws(() => pageWeight(dir, 'b/index.html'), /rel\.1\.js.*imports/);
    // Words that only look like an import do not.
    writeTree(dir, { 'c/index.html': page(js('/assets/ok.1.js')), 'assets/ok.1.js': 'e.textContent="data from",f("import")' });
    assert.equal(pageWeight(dir, 'c/index.html').js, br('e.textContent="data from",f("import")'));
  }));

test('every page type has a budget; hub and policy start at 100 KB and scripts at 120 KB (ARCH-27)', () => {
  assert.deepEqual(Object.keys(BUDGETS).sort(), ['coming', 'dictionary', 'hospital', 'hub', 'methods', 'notFound', 'place', 'policy', 'program']);
  assert.ok(BUDGETS.coming <= 100 * 1024, 'a placeholder is a hub page (ARCH-27)');
  assert.equal(BUDGETS.hub, 100 * 1024);
  assert.equal(BUDGETS.policy, 100 * 1024);
  assert.equal(JS_BUDGET, 120 * 1024);
  for (const b of Object.values(BUDGETS)) assert.ok(Number.isInteger(b) && b > 0);
});

test('overBudget: lists the pages over their type\'s budget, and only those', () =>
  withTemp('size-', (dir) => {
    const big = page(`<!-- ${noise(3000)} -->`);
    const small = page();
    writeTree(dir, {
      'hacrp/hospital/990001/index.html': big,
      'hacrp/hospital/990002/index.html': small,
      'hacrp/state/ca/index.html': big,
      'index.html': small,
    });
    const budgets = { hub: 1000, policy: 1000, coming: 1000, program: 1000, hospital: 2000, place: 10000, methods: 1000, dictionary: 1000, notFound: 1000 };
    const over = overBudget(measure(dir), { budgets });
    assert.deepEqual(over, [{ path: '/hacrp/hospital/990001/', type: 'hospital', part: 'total', bytes: br(big), budget: 2000 }]);
    // Everything fits a generous budget.
    assert.deepEqual(overBudget(measure(dir), { budgets: { ...budgets, hospital: 50000 } }), []);
  }));

test('overBudget: a page whose scripts alone pass the script budget is reported, whatever its total', () =>
  withTemp('size-', (dir) => {
    const heavy = noise(4000);
    writeTree(dir, { 'assets/big.1.js': heavy, 'hacrp/index.html': page(js('/assets/big.1.js')) });
    const budgets = { ...BUDGETS };
    const over = overBudget(measure(dir), { budgets, js: 1000 });
    assert.deepEqual(over, [{ path: '/hacrp/', type: 'program', part: 'js', bytes: br(heavy), budget: 1000 }]);
  }));

test('measure: a page of no known type, or a build with no pages, throws', () =>
  withTemp('size-', (dir) => {
    assert.throws(() => measure(dir), /no pages/);
    writeTree(dir, { 'brand-new/index.html': page() });
    assert.throws(() => measure(dir), /new page type needs a budget/);
  }));

test('measure: one row per page, with its type and weight', () =>
  withTemp('size-', (dir) => {
    const p = page();
    writeTree(dir, { 'index.html': p, '404.html': p });
    const rows = measure(dir).sort((x, y) => x.path.localeCompare(y.path));
    assert.deepEqual(rows.map((r) => [r.path, r.type, r.total]), [['/', 'hub', br(p)], ['/404', 'notFound', br(p)]]);
  }));

test('CLI: exits 0 on a site within budget, and 1 naming each page over it', () =>
  withTemp('size-', (dir) => {
    const cli = (...args) => spawnSync('node', [join(REPO_ROOT, 'tools/ci/size-budget.js'), ...args], { encoding: 'utf8' });
    writeTree(dir, { 'index.html': page(), 'terms/index.html': page() });
    const ok = cli(dir);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /2 pages within budget/);

    // Past the policy pages' 100 KB, which random text can't be squeezed under.
    writeTree(dir, { 'terms/index.html': page(`<!-- ${noise(110 * 1024)} -->`) });
    const bad = cli(dir);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /OVER BUDGET \/terms\/ \(policy\): 1\d\d\.\d KB > 100\.0 KB/);

    // A build that isn't there, or holds a page of no type, is an error too, not a pass.
    assert.equal(cli(join(dir, 'missing')).status, 1);
    writeTree(dir, { 'brand-new/index.html': page() });
    const unknown = cli(dir);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /new page type needs a budget/);
  }));

test('pageWeight: measured at brotli quality 5, the quality the budgets were set at', () =>
  withTemp('size-', (dir) => {
    // Repetitive words, which brotli compresses noticeably better at quality 11 than at 5.
    const text = page(`<p>${Array.from({ length: 3000 }, (_, i) => `w${(i * i) % 997}`).join(' ')}</p>`);
    assert.notEqual(br(text, 11), br(text), 'precondition: the two qualities differ on this text');
    writeTree(dir, { 'index.html': text });
    assert.equal(pageWeight(dir, 'index.html').html, br(text));
  }));
