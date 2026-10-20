import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateHub, sitemapXml } from '../pages.js';

const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js' } };
const NOINDEX = '<meta name="robots" content="noindex">';

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pp-hub-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('the hub writes the stub root, /methods/, the 404 page, robots.txt and the sitemap it is given', () =>
  withTemp(async (dir) => {
    assert.deepEqual(await generateHub({ outDir: dir, assets: ASSETS, env: 'production', sitemap: ['/hacrp/', '/hacrp/hospital/990001/'] }), { pages: 3 });
    const read = (f) => readFileSync(join(dir, f), 'utf8');

    const home = read('index.html');
    assert.ok(home.includes('Public Medicare data, made visible.'));
    assert.match(home, /href="\/hacrp\/">Hospital-Acquired Conditions <span class="short">\(HACRP\)<\/span>/);

    const methods = read('methods/index.html');
    assert.match(methods, /id="estimate"/);
    assert.match(methods, /AI tools/);

    const notFound = read('404.html');
    assert.match(notFound, /href="\/"/);
    assert.match(notFound, /href="\/hacrp\/"/);

    for (const text of [home, methods, notFound]) {
      assert.ok(text.includes(NOINDEX), 'hub pages stay noindex until the hub is built');
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1);
    }

    assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://paidandpenalized.org/sitemap.xml\n');
    const sitemap = read('sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/paidandpenalized\.org\/hacrp\/hospital\/990001\/<\/loc>/);
    assert.equal(sitemap.match(/<url>/g).length, 2);
  }));

test('an empty sitemap is a valid empty urlset; a path that is not a plain site path is refused', () => {
  assert.doesNotMatch(sitemapXml([]), /<url>/);
  assert.match(sitemapXml([]), /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n<\/urlset>\n$/);
  for (const bad of ['hacrp/', '/a b/', '/x?y', '/<x>/', 'https://elsewhere.example/']) assert.throws(() => sitemapXml([bad]), RangeError, bad);
});
