// The Readmissions generator: the formula check before any page, the program page and one page per hospital, noindex
// while the site is unreleased, and the two dates the build collects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, siteDates } from '../../../pipeline/site/context.js';
import { escapeHtml } from '../../../web/render/html.js';
import { ASSETS, withTemp } from '../../../pipeline/test/helpers.js';
import { HRRP, generateHrrp } from '../web/generate.js';
import { PROGRAM_PATH, hospitalPath } from '../web/links.js';
import { buildPlaces } from '../web/places.js';
import { loadHrrpOnce } from './fixtures.js';

const DATA = loadHrrpOnce();
const SLICE = { ...DATA, hospitals: DATA.hospitals.slice(0, 5) };
const quiet = { log: () => {} };

test('the manifest: id hrrp, the program page\'s one script, the kit and the site\'s own sheet', () => {
  assert.equal(HRRP.id, 'hrrp');
  assert.deepEqual(HRRP.entries, { 'hrrp-program': 'sites/hrrp/client/program.js', 'hrrp-hospital': 'sites/hrrp/client/hospital.js', 'hrrp-place': 'sites/hrrp/client/place.js', 'hrrp-search': 'sites/hrrp/client/bar.js' });
  assert.equal(HRRP.styles.at(-1), 'sites/hrrp/web/styles.css');
});

test('writes the program page and a page per hospital, noindex while unreleased, and gives its two dates', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    const result = generateHrrp(ctx, { data: SLICE, released: false, ...quiet });
    assert.equal(ctx.pages, SLICE.hospitals.length + buildPlaces(SLICE.hospitals, SLICE.meta).list.length + 3, 'the hospitals, the places, the program page, the data dictionary page and Methods');
    assert.deepEqual(ctx.indexable, []);
    const program = readFileSync(join(dir, PROGRAM_PATH, 'index.html'), 'utf8');
    assert.match(program, /<meta name="robots" content="noindex">/);
    for (const h of SLICE.hospitals) {
      const text = readFileSync(join(dir, hospitalPath(h.id), 'index.html'), 'utf8');
      assert.ok(text.includes(`<h1 class="field__value hosp__name">${escapeHtml(h.name)}</h1>`), 'the hospital\'s name is the h1');
      assert.match(text, /<meta name="robots" content="noindex">/);
    }
    assert.doesNotThrow(() => siteDates('hrrp', result));
  }));

// Methods says every chart on these pages has its numbers in a table on the same page (methods/copy.js accessText): each figure
// that draws a chart carries one.
test('every figure that draws a chart, on every page written, carries a table of its numbers', () =>
  withTemp('pp-hrrp-', async (dir) => {
    generateHrrp(createContext({ outDir: dir, env: 'production', assets: ASSETS }), { data: SLICE, released: false, ...quiet });
    const pages = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('index.html'));
    let charts = 0;
    for (const file of pages) {
      for (const [fig] of readFileSync(join(dir, file), 'utf8').matchAll(/<figure\b[^]*?<\/figure>/g)) {
        if (!/<svg[^>]*class="[^"]*\bchart\b/.test(fig)) continue;
        charts += 1;
        assert.ok(fig.includes('<table'), `${file}: a chart with no table: ${/<figcaption[^]*?<\/figcaption>/.exec(fig)?.[0].slice(0, 120)}`);
      }
    }
    assert.ok(charts > 20, `found ${charts} charts`);
  }));

test('released in production, the pages are indexable', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data: SLICE, released: true, ...quiet });
    assert.equal(ctx.indexable.length, ctx.pages);
  }));

test('released in production, a hospital no CMS file names keeps its page, unindexed, and the rest stay indexable', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const unnamed = SLICE.hospitals[1];
    const hospitals = SLICE.hospitals.map((h) => (h === unnamed ? { ...h, name: `Hospital ${h.id} (name not in CMS files)` } : h));
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data: { ...SLICE, hospitals }, released: true, ...quiet });
    const path = hospitalPath(unnamed.id);
    assert.match(readFileSync(join(dir, path, 'index.html'), 'utf8'), /<meta name="robots" content="noindex">/);
    assert.ok(!ctx.indexable.includes(path), 'not in the sitemap');
    assert.equal(ctx.indexable.length, ctx.pages - 1);
  }));

test('a factor the formula does not reproduce stops the build and names the first such hospital, before any page', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const moved = SLICE.hospitals.map((h, i) => (i === 2 ? { ...h, paf: h.paf === 1 ? 0.99 : 1 } : h));
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    assert.throws(() => generateHrrp(ctx, { data: { ...SLICE, hospitals: moved }, ...quiet }), (e) => e.message.includes(moved[2].id) && !e.message.includes(moved[3].id));
    assert.equal(ctx.pages, 0);
  }));
