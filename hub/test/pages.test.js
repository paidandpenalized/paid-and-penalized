import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext } from '../../pipeline/site/context.js';
import { withTemp } from '../../pipeline/test/helpers.js';
import { generateHub, sitemapXml } from '../pages.js';

const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js' } };
const NOINDEX = '<meta name="robots" content="noindex">';

test('the hub writes the stub root, /methods/, the 404 page, robots.txt and a sitemap of the pages emitted indexable', () =>
  withTemp('pp-hub-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    ctx.emit({ path: '/hacrp/', robots: null, text: 'a' });
    ctx.emit({ path: '/hacrp/hospital/990001/', robots: null, text: 'b' });
    ctx.emit({ path: '/hacrp/hospital/990002/', robots: 'noindex', text: 'c' });
    await generateHub(ctx);
    assert.equal(ctx.pages, 3 + 3);
    assert.deepEqual(ctx.indexable, ['/hacrp/', '/hacrp/hospital/990001/']);
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
