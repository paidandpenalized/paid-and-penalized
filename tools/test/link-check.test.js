// The internal link check on a synthetic built site: what resolves, what is skipped, and what is reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../../web/site.js';
import { withTemp } from '../../pipeline/test/helpers.js';
import { checkLinks } from '../ci/link-check.js';

const ORIGIN = SITE.origin;
const page = (body, head = '') => `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

function build(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

const problems = (dir) => checkLinks(dir).map(({ from, href, problem }) => `${from} ${href} ${problem}`);

test('links that resolve pass: a folder, a file, the canonical origin, a relative path, a query, a fragment on a real id', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page(`<a href="/about/">a</a><a href="/about">no slash</a><a href="${ORIGIN}/about/">abs</a><a href="${ORIGIN}">root</a>`
        + '<a href="about/#who">rel + id</a><a href="/about/?x=1&amp;y=2#who">query</a><a href="#top">top</a><a href="#">bare</a>'
        + '<a href="/404.html">file</a><img src="/favicon.svg">', '<link rel="stylesheet" href="/assets/site.1.css"><script type="module" src="/assets/a.1.js"></script>'),
      'about/index.html': page('<h2 id="who">Who</h2><a href="../">up</a><a href="./index.html">self</a><a href="/">home</a>'),
      '404.html': page('<p>none</p>'),
      'favicon.svg': '<svg/>',
      'assets/site.1.css': 'a{}',
      'assets/a.1.js': '1',
    });
    assert.deepEqual(problems(dir), []);
  }));

test('a broken link is reported with the page it is on, the href as written, and "missing file"', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="/nope/">x</a><a href="/about/nope.html">y</a><img src="/assets/gone.png"><link rel="stylesheet" href="/assets/gone.1.css">'),
      'about/index.html': page('<a href="gone/">z</a><a href="/about/deeper/">w</a>'),
    });
    // Pages in file-name order, links in the order they appear.
    assert.deepEqual(problems(dir), [
      '/about/ gone/ missing file',
      '/about/ /about/deeper/ missing file',
      '/ /nope/ missing file',
      '/ /about/nope.html missing file',
      '/ /assets/gone.png missing file',
      '/ /assets/gone.1.css missing file',
    ]);
  }));

test('a fragment must name an id on its target page: same page, another page, and SVG elements count', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="#here">ok</a><a href="#gone">bad</a><a href="/other/#sym">svg ok</a><a href="/other/#nope">bad2</a>'
        + `<a href="${ORIGIN}/other/#nope2">bad3</a><span id="here"></span><a href="/other/#Sym">case</a>`),
      'other/index.html': page('<svg><symbol id="sym"></symbol><use href="#sym"/><use href="#missing"/></svg>'),
    });
    assert.deepEqual(problems(dir), [
      '/ #gone missing id',
      '/ /other/#nope missing id',
      `/ ${ORIGIN}/other/#nope2 missing id`,
      '/ /other/#Sym missing id',
      '/other/ #missing missing id',
    ]);
  }));

test('a fragment that carries page state: "#state=TX" names no element, "#whatif&A=1" names the element before the "&"', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="/p/#state=TX">state</a><a href="/p/#whatif&amp;MRSA=0.9&amp;SSI=1.2">ok</a><a href="/p/#nothere&amp;MRSA=0.9">bad</a>'
        + '<a href="/p/#a=1&amp;whatif">pure state</a><a href="/gone/#state=TX">no page</a>'),
      'p/index.html': page('<section id="whatif"></section>'),
    });
    assert.deepEqual(problems(dir), ['/ /p/#nothere&MRSA=0.9 missing id', '/ /gone/#state=TX missing file']);
  }));

test('a fragment on a page that does not exist is a missing file, not also a missing id', () =>
  withTemp('links-', (dir) => {
    build(dir, { 'index.html': page('<a href="/gone/#x">x</a>') });
    assert.deepEqual(problems(dir), ['/ /gone/#x missing file']);
  }));

test('off-site links, mailto:, tel:, data: and other schemes are skipped, even when the target could not exist here', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="https://example.org/nope/">e</a><a href="//example.org/x">proto</a><a href="mailto:a@example.org">m</a>'
        + '<a href="tel:+10000000000">t</a><img src="data:image/gif;base64,R0lGODlh"><a href="http://paidandpenalized.org.example.net/x">lookalike</a>'
        + `<a href="${ORIGIN}.example.net/x">lookalike2</a>`),
    });
    assert.deepEqual(problems(dir), []);
  }));

test('hrefs are read as the browser reads them: entities decoded, percent-escapes resolved, single and bare quoting', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="/a%20b/?q=1&amp;r=2">enc</a><a href=\'/c/\'>single</a><a href=/c/>bare</a><a href="/a%2e/">dots</a><a href="/%zz/">bad</a>'),
      'a b/index.html': page('x'),
      'c/index.html': page('x'),
    });
    assert.deepEqual(problems(dir), ['/ /a%2e/ missing file', '/ /%zz/ missing file']);
  }));

test('links inside a comment or a script body are not links; a script src is', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<!-- <a href="/gone/">x</a> --><script type="application/json">{"u":"<a href=\\"/gone/\\">"}</script><script src="/assets/x.js"></script>'),
    });
    assert.deepEqual(problems(dir), ['/ /assets/x.js missing file']);
  }));

test('a link cannot reach outside the built folder', () =>
  withTemp('links-', (dir) => {
    build(dir, { 'site/index.html': page('<a href="/..%2f..%2fpackage.json">up</a><a href="/%2e%2e/%2e%2e/etc/">up2</a>'), 'package.json': '{}' });
    assert.deepEqual(checkLinks(join(dir, 'site')).map((p) => p.problem), ['missing file', 'missing file']);
  }));

test('the same bad link on two pages is reported on each; one page repeating it is reported once', () =>
  withTemp('links-', (dir) => {
    build(dir, {
      'index.html': page('<a href="/gone/">x</a><a href="/gone/">again</a>'),
      'b/index.html': page('<a href="/gone/">x</a>'),
    });
    assert.deepEqual(problems(dir), ['/b/ /gone/ missing file', '/ /gone/ missing file']);
  }));

test('an empty build is an error, not a pass', () =>
  withTemp('links-', (dir) => {
    assert.throws(() => checkLinks(dir), /no pages/);
  }));

test('CLI: exits 0 when every link resolves, and 1 listing each problem', () =>
  withTemp('links-', (dir) => {
    const cli = (target) => spawnSync('node', [join(REPO_ROOT, 'tools/ci/link-check.js'), target], { encoding: 'utf8' });
    build(dir, { 'index.html': page('<a href="/about/#who">ok</a>'), 'about/index.html': page('<h2 id="who"></h2>') });
    const ok = cli(dir);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /2 pages, 0 problems/);

    build(dir, { 'about/index.html': page('<a href="/gone/">x</a><a href="/#none">y</a>') });
    const bad = cli(dir);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /\/about\/ -> \/gone\/: missing file/);
    assert.match(bad.stderr, /\/about\/ -> \/#none: missing id/);
    // The home page's link to the id the rewrite removed is a problem too.
    assert.match(bad.stderr, /\/ -> \/about\/#who: missing id/);
    assert.match(bad.stderr, /3 problems/);

    assert.equal(cli(join(dir, 'absent')).status, 1);
  }));
