// The HACRP page generator on the pinned data (rows picked by property, never by name or CCN), plus escaping of
// hostile text on synthetic hospitals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateHub } from '../../../hub/pages.js';
import { build } from '../../../pipeline/site/build.js';
import { loadHacrp } from '../web/data.js';
import { generateHacrp } from '../web/generate.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { programPage } from '../web/pages/program.js';
import { hospitalView } from '../web/view.js';
import { CASES, inputs, master } from './fixtures.js';

const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js', 'hacrp-program': '/assets/hacrp-program.test.js' } };
const DATA = loadHacrp();
const quiet = () => {};
const NOINDEX = '<meta name="robots" content="noindex">';
const FN = (code) => DATA.footnotes.get(code);
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pp-hacrp-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

const read = (dir, path) => readFileSync(join(dir, path, 'index.html'), 'utf8');
const hospitalPath = (h) => `/hacrp/hospital/${h.ccn.toLowerCase()}/`;
const pick = (pred, what) => {
  const h = DATA.hospitals.find(pred);
  assert.ok(h, `no pinned row: ${what}`);
  return h;
};

test('production, released: every hospital page plus /hacrp/, one <h1> each; odd rows as CMS published them', () =>
  withTemp(async (dir) => {
    const result = await generateHacrp({ outDir: dir, assets: ASSETS, env: 'production', released: true, data: DATA, log: quiet });
    assert.equal(DATA.hospitals.length, 3055);
    assert.equal(result.pages, DATA.hospitals.length + 1);
    assert.equal(readdirSync(join(dir, 'hacrp', 'hospital')).length, DATA.hospitals.length);

    const pages = [['/hacrp/', read(dir, '/hacrp/')], ...DATA.hospitals.map((h) => [hospitalPath(h), read(dir, hospitalPath(h))])];
    const cmsCell = /class="[^"]*\bcms\b[^"]*">([^<]*)</g;
    for (const [path, text] of pages) {
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, `${path}: one h1`);
      for (const [, cell] of text.matchAll(cmsCell)) assert.doesNotMatch(cell, /-[\d.]/, `${path}: hyphen-minus in "${cell}"`);
    }

    // Scored pages may be indexed; a page with no score never is, even in production on a released site.
    for (const h of DATA.hospitals) {
      const text = read(dir, hospitalPath(h));
      assert.equal(text.includes(NOINDEX), h.total === null, hospitalPath(h));
    }
    const scored = DATA.hospitals.filter((h) => h.total !== null).map(hospitalPath);
    assert.deepEqual(result.indexable, ['/hacrp/', ...scored]);
    assert.ok(!read(dir, '/hacrp/').includes(NOINDEX));

    const maryland = read(dir, hospitalPath(pick((h) => h.paymentReduction === 'N/A' && h.paymentReductionFootnote === 'a', 'Maryland')));
    assert.ok(maryland.includes(esc(FN('a'))), 'footnote a text');
    assert.ok(maryland.includes('pill--na'));
    assert.doesNotMatch(maryland, /distance to CMS/);
    assert.match(maryland, /id="whatif"/);

    const yesNoScore = read(dir, hospitalPath(pick((h) => h.total === null && h.paymentReduction === 'Yes', 'Yes with no score')));
    assert.ok(yesNoScore.includes(esc("CMS's value: Yes")));
    assert.ok(yesNoScore.includes(esc(FN('5'))), 'CMS score footnote');
    assert.doesNotMatch(yesNoScore, /id="whatif"/);
    assert.doesNotMatch(yesNoScore, /distance to CMS/);
    assert.ok(yesNoScore.includes(NOINDEX));

    const yes = read(dir, hospitalPath(pick((h) => h.total !== null && h.paymentReduction === 'Yes', 'scored Yes')));
    assert.match(yes, /pill--pen">1% cut</);
    assert.match(yes, /class="hero__num cms">\S+</);
    assert.match(yes, /"isBasedOn":"https:\/\/data\.cms\.gov\/provider-data\/dataset\/yq43-i98g"/);
    const no = read(dir, hospitalPath(pick((h) => h.total !== null && h.paymentReduction === 'No', 'scored No')));
    assert.match(no, /class="pill">No cut</);
  }));

test('released: false: every page is noindex in production and the sitemap lists none', () =>
  withTemp(async (dir) => {
    const out = join(dir, 'dist');
    const generators = [
      { name: 'hacrp', generate: (ctx) => generateHacrp({ ...ctx, released: false, data: DATA, log: quiet }) },
      { name: 'hub', generate: (ctx) => generateHub({ ...ctx, sitemap: ctx.results.hacrp.indexable }) },
    ];
    await build({ outDir: out, env: 'production', generators });
    for (const h of DATA.hospitals) assert.ok(read(out, hospitalPath(h)).includes(NOINDEX), hospitalPath(h));
    for (const path of ['/hacrp/', '/', '/methods/']) assert.ok(read(out, path).includes(NOINDEX), path);
    assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<url>/);
  }));

test('a preview build (no PP_ENV) is noindex everywhere, released or not', () =>
  withTemp(async (dir) => {
    const result = await generateHacrp({ outDir: dir, assets: ASSETS, env: undefined, released: true, data: DATA, log: quiet });
    assert.deepEqual(result.indexable, []);
    assert.ok(read(dir, '/hacrp/').includes(NOINDEX));
  }));

test('A1 failing stops the build and names the mismatched CCN', async () => {
  const moved = DATA.hospitals.map((h) => ({ ...h }));
  const i = moved.findIndex((h) => h.total !== null && h.paymentReduction === 'No');
  moved[i] = { ...moved[i], ccn: '990001', paymentReduction: 'Yes' };
  await withTemp((dir) => assert.rejects(
    generateHacrp({ outDir: dir, assets: ASSETS, env: 'production', data: { ...DATA, hospitals: moved }, log: quiet }),
    /A1 failed.*990001/,
  ));
});

test('hostile text in a hospital name renders as text in the page, the title and the JSON-LD', () => {
  const name = '<script>alert("x")</script> & Sons\' Hospital';
  const view = hospitalView(inputs(CASES.yes, { master: master(CASES.yes.ccn, { name, city: 'A<b' }) }));
  const text = hospitalPage({ view, source: DATA.source, robots: 'noindex', assets: ASSETS });
  assert.ok(!text.includes('<script>alert'));
  assert.ok(text.includes(`<h1>${esc(name)}</h1>`));
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(text)[1];
  assert.ok(!ld.includes('<'));
  assert.equal(JSON.parse(ld).name.startsWith(name), true);
});

test('the program page search data escapes "<" so no name can close its script', () => {
  const text = programPage({
    fy: DATA.fy, counts: { decided: 2, yes: 1, scored: 2 }, boundaryText: { highestNo: '0.2500', lowestYes: '0.2507' },
    measures: hospitalView(inputs(CASES.yes)).measures, periods: DATA.periods,
    search: [['990001', '</script><script>alert(1)</script>', 'Exampleton', 'AL']],
    source: DATA.source, robots: 'noindex', assets: ASSETS,
  });
  const json = /<script type="application\/json" id="hacrp-search-data">(.*?)<\/script>/s.exec(text)[1];
  assert.ok(!json.includes('<'));
  assert.equal(JSON.parse(json)[0][1], '</script><script>alert(1)</script>');
  assert.match(text, /CMS cut hospitals with a published Total HAC Score of 0\.2507 or higher; none at 0\.2500 or lower\./);
});
