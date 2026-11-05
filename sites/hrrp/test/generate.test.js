// The Readmissions generator: the formula check before any page, the program page and one page per hospital, noindex
// while the site is unreleased, and the two dates the build collects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, siteDates } from '../../../pipeline/site/context.js';
import { escapeHtml } from '../../../web/render/html.js';
import { ASSETS, withTemp } from '../../../pipeline/test/helpers.js';
import { HRRP, generateHrrp } from '../web/generate.js';
import { loadHrrp } from '../web/data.js';
import { PROGRAM_PATH, hospitalPath } from '../web/links.js';

const DATA = loadHrrp();
const SLICE = { ...DATA, hospitals: DATA.hospitals.slice(0, 5) };
const quiet = { log: () => {} };

test('the manifest: id hrrp, no browser scripts, the kit and the site\'s own sheet', () => {
  assert.equal(HRRP.id, 'hrrp');
  assert.deepEqual(HRRP.entries, {});
  assert.equal(HRRP.styles.at(-1), 'sites/hrrp/web/styles.css');
});

test('writes the program page and a page per hospital, noindex while unreleased, and gives its two dates', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    const result = generateHrrp(ctx, { data: SLICE, released: false, ...quiet });
    assert.equal(ctx.pages, SLICE.hospitals.length + 1);
    assert.deepEqual(ctx.indexable, []);
    const program = readFileSync(join(dir, PROGRAM_PATH, 'index.html'), 'utf8');
    assert.match(program, /<meta name="robots" content="noindex">/);
    for (const h of SLICE.hospitals) {
      const text = readFileSync(join(dir, hospitalPath(h.id), 'index.html'), 'utf8');
      assert.ok(text.includes(`<h1>${escapeHtml(h.name)}</h1>`), 'the hospital\'s name is the h1');
      assert.match(text, /<meta name="robots" content="noindex">/);
    }
    assert.doesNotThrow(() => siteDates('hrrp', result));
  }));

test('released in production, the pages are indexable', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    generateHrrp(ctx, { data: SLICE, released: true, ...quiet });
    assert.equal(ctx.indexable.length, SLICE.hospitals.length + 1);
  }));

test('a factor the formula does not reproduce stops the build and names the first such hospital, before any page', () =>
  withTemp('pp-hrrp-', async (dir) => {
    const moved = SLICE.hospitals.map((h, i) => (i === 2 ? { ...h, paf: h.paf === 1 ? 0.99 : 1 } : h));
    const ctx = createContext({ outDir: dir, env: 'production', assets: ASSETS });
    assert.throws(() => generateHrrp(ctx, { data: { ...SLICE, hospitals: moved }, ...quiet }), (e) => e.message.includes(moved[2].id) && !e.message.includes(moved[3].id));
    assert.equal(ctx.pages, 0);
  }));
