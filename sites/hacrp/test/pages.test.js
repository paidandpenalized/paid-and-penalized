// The HACRP page generator on the pinned data (rows picked by property, never by name or CCN), plus escaping of
// hostile text on synthetic hospitals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { footnoteList } from '../../../engine/js/footnotes.js';
import { decidedHospitals } from '../../../engine/js/hacrp/hospital.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { HUB } from '../../../hub/pages.js';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { SHARED_ENTRIES, build, mergeEntries } from '../../../pipeline/site/build.js';
import { createContext } from '../../../pipeline/site/context.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { cmsText, count, decimal, isoDate as isoDateOf, shortIsoDate } from '../../../web/render/format.js';
import { REDUCTION_TEXT } from '../web/constants.js';
import { HACRP, generateHacrp, hospitalRows, placeEntries, scoreRange } from '../web/generate.js';
import { compareDefault } from '../web/hospital-table.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { METHODS_PATH } from '../web/pages/methods.js';
import { programPage } from '../web/pages/program.js';
import { KINDS, buildPlaces } from '../web/places.js';
import { programData } from '../web/program-data.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, BOUNDARY_TEXT as BOUNDARY, CASES, esc, inputs, master, pick as pickFrom, WHATIF_STANDING } from './fixtures.js';
import { DATA, HISTORY_ARGS, PLACES, PROGRAM_ARGS, PAGE_CTX, renderPlace, renderProgram } from './pinned.js';

const quiet = () => {};
const NOINDEX = '<meta name="robots" content="noindex">';
const FN = (code) => DATA.footnotes.get(code);

const read = (dir, path) => readFileSync(join(dir, path, 'index.html'), 'utf8');
const hospitalPath = (h) => `/hacrp/hospital/${h.ccn.toLowerCase()}/`;
const pick = (pred, what) => pickFrom(DATA.hospitals, pred, what);
const temp = (fn) => withTemp('pp-hacrp-', fn);
const generate = (dir, env, options) => {
  const ctx = createContext({ outDir: dir, env, assets: ASSETS });
  return generateHacrp(ctx, { log: quiet, ...options }).then(() => ctx);
};

// A few pinned rows, one of each kind (scored Yes and No, Maryland, no score, Yes with no score), for the tests
// that only check indexing; the production test keeps every hospital.
const SLICE = {
  ...DATA,
  hospitals: [
    (h) => h.total !== null && h.paymentReduction === 'Yes',
    (h) => h.total !== null && h.paymentReduction === 'No',
    (h) => h.paymentReduction === 'N/A',
    (h) => h.total === null && h.paymentReduction === 'No',
    (h) => h.total === null && h.paymentReduction === 'Yes',
  ].map((pred, i) => pick(pred, `slice row ${i}`)),
};

// The places a build of SLICE writes pages for.
const SLICE_PLACES = buildPlaces({
  hospitals: SLICE.hospitals, master: DATA.master,
  rows: programData({ hospitals: SLICE.hospitals, master: DATA.master, model: DATA.model }).rows,
});

// Every id is on the page once, and every aria-labelledby, aria-controls, aria-describedby and for names one that is.
function brokenIds(text) {
  const body = text.replace(/<script[\s\S]*?<\/script>/g, '');
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const set = new Set(ids);
  const refs = [...body.matchAll(/\s(?:aria-labelledby|aria-controls|aria-describedby|for)="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
  return { repeated: ids.filter((id, i) => ids.indexOf(id) !== i), missing: refs.filter((ref) => !set.has(ref)) };
}
// The heading levels in a page, in order.
const levels = (text) => [...text.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));

test('production, released: every hospital page and every place page plus /hacrp/, one <h1> each; odd rows as CMS published them', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, 'production', { released: true, data: DATA });
    assert.equal(DATA.hospitals.length, 3055);
    assert.equal(ctx.pages, DATA.hospitals.length + PLACES.list.length + 3, 'the hospitals, the places, /hacrp/, the data dictionary page and Methods');
    assert.equal(readdirSync(join(dir, 'hacrp', 'hospital')).length, DATA.hospitals.length);
    // A page for every place, under its kind: the build writes exactly the places there are.
    for (const kind of KINDS) {
      assert.deepEqual(readdirSync(join(dir, 'hacrp', kind)).sort(), PLACES.list.filter((p) => p.kind === kind).map((p) => p.path.split('/')[3]).sort(), kind);
    }

    const pages = new Map([
      ['/hacrp/', read(dir, '/hacrp/')],
      ...PLACES.list.map((p) => [p.path, read(dir, p.path)]),
      ...DATA.hospitals.map((h) => [hospitalPath(h), read(dir, hospitalPath(h))]),
    ]);
    const page = (h) => pages.get(hospitalPath(h));
    const placePaths = new Set(PLACES.list.map((p) => p.path));
    const cmsCell = /class="[^"]*\bcms\b[^"]*"[^>]*>([^<]*)</g;
    for (const [path, text] of pages) {
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, `${path}: one h1`);
      const cells = [...text.matchAll(cmsCell)];
      // A hospital page: twelve measure cells, and the score in the record card when CMS published one.
      if (path.startsWith('/hacrp/hospital/')) assert.ok(cells.length >= (text.includes(' hosp__score"') ? 13 : 12), `${path}: CMS cells found`);
      for (const [, cell] of cells) assert.doesNotMatch(cell, /-[\d.]/, `${path}: hyphen-minus in "${cell}"`);
      assert.deepEqual(brokenIds(text), { repeated: [], missing: [] }, `${path}: ids`);
      // The program page and the hospital pages step down one heading level at a time (the place pages are not checked here).
      if (!placePaths.has(path)) assert.ok(levels(text).every((level, i, all) => (i === 0 ? level === 1 : level <= all[i - 1] + 1)), `${path}: heading levels ${levels(text)}`);
      // A page loads the figure script exactly when it has a figure, and the cite script when it has the citation.
      assert.equal(text.includes(`src="${ASSETS.js.figure}"`), text.includes(' data-figure>'), `${path}: figure script`);
      assert.equal(text.includes(`src="${ASSETS.js.cite}"`), text.includes(' data-cite-copy '), `${path}: cite script`);
    }
    // A place page loads its own script (the table, the rule and the map), and the program page its own. It names its
    // place in its one h1, its canonical address and its breadcrumb's last item, and its hospital table lists exactly the
    // place's hospitals (data-area).
    for (const place of PLACES.list) {
      const text = pages.get(place.path);
      assert.ok(text.includes(`<script type="module" src="${ASSETS.js['hacrp-place']}"></script>`), `${place.path}: the place script`);
      assert.ok(!text.includes(`src="${ASSETS.js['hacrp-program']}"`), `${place.path}: and not the program page's`);
      assert.ok(text.includes(`<h1 class="place__title">${esc(place.name)}</h1>`), `${place.path}: h1`);
      assert.ok(text.includes(`<link rel="canonical" href="https://paidandpenalized.org${place.path}">`), `${place.path}: canonical`);
      assert.ok(text.includes(`<li aria-current="page">${esc(place.name)}</li>`), `${place.path}: breadcrumb`);
      const area = /<div class="ht" data-src="[^"]+" data-area="([^"]*)" hidden>/.exec(text)[1].split(' ');
      assert.deepEqual([...area].sort(), [...place.ccns].sort(), `${place.path}: the table's hospitals are the place's`);
    }
    assert.ok(pages.get('/hacrp/').includes(`<script type="module" src="${ASSETS.js['hacrp-program']}"></script>`));

    // The Methods page: one h1, its ids once, its headings a step down at a time, the figure script because it has figures.
    const methods = read(dir, METHODS_PATH);
    assert.equal(methods.match(/<h1[\s>]/g)?.length, 1, 'Methods: one h1');
    assert.deepEqual(brokenIds(methods), { repeated: [], missing: [] }, 'Methods: ids');
    assert.ok(levels(methods).every((level, i, all) => (i === 0 ? level === 1 : level <= all[i - 1] + 1)), `Methods: heading levels ${levels(methods)}`);
    assert.ok(methods.includes(' data-figure>') && methods.includes(`src="${ASSETS.js.figure}"`), 'Methods: figures, and the script that serves them');
    assert.ok(!methods.includes(NOINDEX), 'Methods is indexed as the program page is');

    // Scored pages may be indexed; a page with no score never is, even in production on a released site. Only a
    // scored page has the what-if.
    for (const h of DATA.hospitals) {
      assert.equal(page(h).includes(NOINDEX), h.total === null, hospitalPath(h));
      assert.equal(page(h).includes('<section class="block whatif" id="whatif"'), h.total !== null, `${hospitalPath(h)}: what-if`);
    }
    // The program page and every place page are indexed as the program is: on a released production site, all of them.
    for (const place of PLACES.list) assert.ok(!pages.get(place.path).includes(NOINDEX), place.path);
    const scored = DATA.hospitals.filter((h) => h.total !== null).map(hospitalPath);
    assert.deepEqual(ctx.indexable, ['/hacrp/data/', '/hacrp/', ...PLACES.list.map((p) => p.path), ...scored, METHODS_PATH]);
    assert.ok(!pages.get('/hacrp/').includes(NOINDEX));

    const maryland = page(pick((h) => h.paymentReduction === 'N/A' && h.paymentReductionFootnote === 'a', 'Maryland'));
    assert.ok(maryland.includes(esc(FN('a'))), 'footnote a text');
    assert.ok(maryland.includes('pill--na'));
    assert.doesNotMatch(maryland, /distance to CMS/);
    assert.doesNotMatch(maryland, /CMS’s value:/, 'the pill already reads CMS’s value');
    assert.match(maryland, /pill--na">N\/A</);

    const yesNoScoreRow = pick((h) => h.total === null && h.paymentReduction === 'Yes', 'Yes with no score');
    const yesNoScore = page(yesNoScoreRow);
    assert.doesNotMatch(yesNoScore, /CMS’s value:/, 'the pill already reads CMS’s value');
    assert.match(yesNoScore, /pill--pen">Yes</);
    assert.doesNotMatch(yesNoScore, /hosp__score/);
    assert.match(yesNoScore, /<span class="hosp__none"><span>No score published<\/span><\/span>/);
    assert.doesNotMatch(yesNoScore, /% cut|Cut 1%/);
    assert.match(yesNoScore, /<p class="stamp">Yes<\/p>/, "the stamp carries CMS's literal value");
    assert.ok(yesNoScoreRow.totalFootnote, 'the row carries a CMS score footnote');
    for (const { code, text } of footnoteList(DATA.footnotes, yesNoScoreRow.totalFootnote)) {
      assert.ok(yesNoScore.includes(esc(text)), `CMS score footnote ${code}`);
    }
    assert.doesNotMatch(yesNoScore, /id="whatif"/);
    assert.doesNotMatch(yesNoScore, /largest|added the most/);
    assert.doesNotMatch(yesNoScore, /distance to CMS/);
    assert.ok(yesNoScore.includes(NOINDEX));

    const yes = page(pick((h) => h.total !== null && h.paymentReduction === 'Yes', 'scored Yes'));
    assert.match(yes, /pill--pen">1% cut</);
    assert.ok(yes.includes(esc("CMS’s value: Yes")));
    assert.doesNotMatch(yes, /No score published|hosp__none/);
    assert.match(yes, /<section class="block whatif" id="whatif"/);
    assert.match(yes, /class="field__value field__value--big cms hosp__score">\S+</);
    assert.match(yes, /<p class="stamp">Cut 1%<\/p>/);
    assert.match(yes, /"isBasedOn":"https:\/\/data\.cms\.gov\/provider-data\/dataset\/yq43-i98g"/);
    const no = page(pick((h) => h.total !== null && h.paymentReduction === 'No', 'scored No'));
    assert.match(no, /class="pill">No cut</);
    assert.ok(no.includes(esc("CMS’s value: No")));
    assert.match(no, /<p class="stamp stamp--ink">No cut<\/p>/);
    assert.match(maryland, /<p class="stamp stamp--ink">Not subject<\/p>/);

    // The numbers card's distance quotes CMS's own text for the boundary scores, as this site's recompute.
    const bt = DATA.boundaryText;
    assert.ok(yes.includes(`above ${bt.highestNo}, the highest score CMS marked No.`));
    assert.ok(no.includes(`below ${bt.lowestYes}, the lowest score CMS marked Yes.`));

    // Penalty counts use A1(b)'s population: scored hospitals with a Yes/No decision.
    const decided = decidedHospitals(DATA.hospitals);
    const cut = decided.filter((h) => h.paymentReduction === 'Yes').length;
    // The line is stated for Yes/No decisions only: Maryland hospitals score above it and were not cut.
    const program = pages.get('/hacrp/');
    assert.ok(DATA.hospitals.some((h) => h.paymentReduction === 'N/A' && h.total >= DATA.model.boundary.lowestYes), 'the scope matters in the pinned data');
    assert.match(program, new RegExp(`<p class="field__value">${bt.lowestYes} and up</p>\\n<div class="field__note">The lowest score CMS cut\\. The highest it did not: ${bt.highestNo}\\.</div>`), 'the summary form names the line by both of CMS\'s scores');
    const notSubject = DATA.hospitals.filter((h) => h.total !== null && h.paymentReduction === 'N/A');
    const above = notSubject.filter((h) => h.total >= Number(bt.lowestYes)).length;
    assert.ok(program.includes(esc(`Not shown: Maryland’s ${count(notSubject.length)} scored hospitals. ${count(above)} of them scored at or above the lowest score CMS cut elsewhere, and none were cut.`)));
    assert.ok(program.includes(`<p>${esc("Maryland’s hospitals are scored but not cut. Maryland has its own arrangement with Medicare: the state sets what its hospitals are paid, by Medicare as well as other payers, and it is held to a target for the growth of traditional Medicare spending in the state.")}</p>`));
    // Step 1 says once that a measure needs enough patients; the SIR's term opens a box with its arithmetic and baseline.
    assert.ok(program.includes(`${esc('for infections. Hospitals with too few patients for a measure aren’t scored on it.')}</p>`));
    const sir = /<div class="step__p">Each infection measure is a <details class="def def--inline"><summary>standardized infection ratio \(SIR\)[\s\S]*?<\/details>: the infections a hospital reported/.exec(program);
    assert.ok(sir, 'the SIR term opens a box, inside its sentence');
    assert.match(sir[0], /SIR = infections reported ÷ infections predicted/);
    assert.match(sir[0], /national data for 2015, its baseline year/);
    assert.match(sir[0], /moving it to 2022 data, a change that reaches this program in fiscal year 2028\./);
    // The score rule names its ends' scores and marks the average.
    const scores = decided.map((h) => h.total).sort((a, b) => a - b);
    assert.ok(program.includes(`Lowest score: ${decimal(scores[0], 4)}`) && program.includes(`Highest score: ${decimal(scores.at(-1), 4)}`));
    assert.match(program, /<line class="chart-rule__avg"[^>]*\/>\n<text[^>]*>Average<\/text>/);

    assert.ok(program.includes(`<strong>For fiscal year ${DATA.fy}, that was ${count(cut)} of the ${count(decided.length)} scored hospitals</strong> with a payment decision.`));
  }));

test('released: false: every page is noindex in production and the sitemap lists none', () =>
  temp(async (dir) => {
    const out = join(dir, 'dist');
    const hacrp = { ...HACRP, generate: (ctx) => generateHacrp(ctx, { released: false, data: SLICE, log: quiet }) };
    await build({ outDir: out, env: 'production', sites: [hacrp, HUB] });
    for (const h of SLICE.hospitals) assert.ok(read(out, hospitalPath(h)).includes(NOINDEX), hospitalPath(h));
    for (const p of SLICE_PLACES.list) assert.ok(read(out, p.path).includes(NOINDEX), p.path);
    for (const path of ['/hacrp/', '/hacrp/data/', '/', '/methods/']) assert.ok(read(out, path).includes(NOINDEX), path);
    assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<url>/);
  }));

test('a preview build (no PP_ENV) is noindex everywhere, released or not', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, undefined, { released: true, data: SLICE });
    assert.deepEqual(ctx.indexable, []);
    // The hospitals, the places, /hacrp/, the dictionary page and Methods.
    assert.equal(ctx.pages, SLICE.hospitals.length + SLICE_PLACES.list.length + 3);
    for (const path of ['/hacrp/', '/hacrp/data/', METHODS_PATH, ...SLICE_PLACES.list.map((p) => p.path), ...SLICE.hospitals.map(hospitalPath)]) assert.ok(read(dir, path).includes(NOINDEX), path);
  }));

test('A1 failing stops the build and names the mismatched CCN', async () => {
  const moved = DATA.hospitals.map((h) => ({ ...h }));
  const i = moved.findIndex((h) => h.total !== null && h.paymentReduction === 'No');
  moved[i] = { ...moved[i], ccn: '990001', paymentReduction: 'Yes' };
  await temp((dir) => assert.rejects(generate(dir, 'production', { data: { ...DATA, hospitals: moved } }), /A1 failed.*990001/));
});

test('hostile text in a hospital name renders as text in the page, the title and the JSON-LD', () => {
  const name = '<script>alert("x")</script> & Sons\' Hospital';
  const view = hospitalView(inputs(CASES.yes, { master: master(CASES.yes.ccn, { name, city: 'A<b' }) }));
  const text = hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: 'noindex', assets: ASSETS });
  assert.ok(!text.includes('<script>alert'));
  assert.ok(text.includes(`<h1 class="field__value hosp__name">${esc(name)}</h1>`));
  assert.ok(text.includes(`aria-label="Map of`) || !text.includes('chart--state-map'));
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(text)[1];
  assert.ok(!ld.includes('<'));
  assert.equal(JSON.parse(ld).name.startsWith(name), true);
});

test('the program page links the hospitals asset and inlines no hospital data; hostile names stay data', () => {
  const name = '</script><script>alert(1)</script> & "Sons"';
  const views = [CASES.yes, CASES.noScore].map((h) => hospitalView(inputs(h, { master: master(h.ccn, { name: h.ccn === '990001' ? name : 'A' }) })));
  const asset = JSON.parse(JSON.stringify(hospitalRows(views)));
  // State, then name: both are AL, and "A" sorts after "<".
  assert.deepEqual(asset, {
    hospitalPath: '/hacrp/hospital/',
    rows: [[name, 0], ['A', 1]].map(([n, i]) => [views[i].ccn, n, 'Exampleton', 'AL', ['0.3000', 'N/A'][i], ['Yes', 'No'][i], '']),
  });
  const text = programPage({
    ...PROGRAM_ARGS, boundaryText: { highestNo: '0.2500', lowestYes: '0.2507' },
    searchUrl: '/assets/hacrp-hospitals.0000abcd.json', robots: 'noindex',
  });
  // The search sits in the top bar: a combobox over the asset, hidden until its script shows it. It finds places too.
  const header = /<header class="topbar">[\s\S]*?<\/header>/.exec(text)[0];
  assert.match(header, /<form class="omni" role="search" aria-label="Find a hospital" data-src="\/assets\/hacrp-hospitals\.0000abcd\.json" hidden>/);
  assert.match(header, /<label class="omni__field" for="omni-q"><span class="omni__label cap">Find<span class="vh"> a hospital or place by name, city, state, ZIP code or CCN<\/span><\/span><input id="omni-q" type="search" role="combobox" aria-expanded="false" aria-controls="omni-list" aria-autocomplete="list"/);
  assert.match(header, /<ul class="omni__list" id="omni-list" role="listbox" aria-label="Find a hospital" hidden><\/ul>/);
  assert.match(header, /<p class="vh" role="status" aria-live="polite"><\/p>/);
  // The hero's larger box reads the same asset, with its own ids.
  assert.match(text, /<form class="omni omni--hero" role="search" aria-label="Find a hospital" data-src="\/assets\/hacrp-hospitals\.0000abcd\.json" hidden>\n<label class="omni__field" for="hero-q"><span class="omni__label cap">Find<span class="vh"> a hospital, state or metro area<\/span><\/span><input id="hero-q" type="search" role="combobox"/);
  assert.match(text, /<ul class="omni__list" id="hero-list" role="listbox"/);
  assert.doesNotMatch(text, /<datalist/);
  assert.doesNotMatch(text, /application\/json/);
  // CMS's line, quoted from CMS's text for both scores, in the summary form.
  assert.match(text, /<p class="field__value">0\.2507 and up<\/p>\n<div class="field__note">The lowest score CMS cut\. The highest it did not: 0\.2500\.<\/div>/);
  // Without a search asset there is no hero box.
  assert.doesNotMatch(programPage({ ...PROGRAM_ARGS, searchUrl: null }), /omni--hero/);
});

test('hospitalRows adds the places the search finds: [kind, key, name, page, hospitals in CMS\'s file], kind by kind and by name', () => {
  const views = [CASES.yes].map((h) => hospitalView(inputs(h)));
  assert.deepEqual(Object.keys(hospitalRows(views)), ['hospitalPath', 'rows'], 'no places asked for, none given');
  const asset = JSON.parse(JSON.stringify(hospitalRows(views, PLACES)));
  assert.deepEqual(Object.keys(asset), ['hospitalPath', 'rows', 'places']);
  assert.equal(asset.places.length, PLACES.list.length);
  for (const [kind, key, name, path, n] of asset.places) {
    const place = PLACES.places.get(`${kind}:${key}`);
    assert.deepEqual([name, path, n], [place.name, place.path, place.counts.file], `${kind}:${key}`);
  }
  // Region, division, state, then metro area; by name within a kind.
  const order = asset.places.map(([kind]) => KINDS.indexOf(kind));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const kind of KINDS) {
    const names = asset.places.filter(([k]) => k === kind).map(([, , name]) => name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')), kind);
  }
  assert.deepEqual(placeEntries(PLACES), asset.places);
});

test('hospitalRows: the table\'s default order, state then name (then city, then CCN), whatever order the views come in', () => {
  const rows = [
    ['990031', 'Beta Hospital', 'Exampleton', 'CA'], ['990032', 'Alpha Hospital', 'Exampleton', 'MD'],
    ['990033', 'Beta Hospital', 'Aville', 'AL'], ['990034', 'Alpha Hospital', 'Zville', 'AL'], ['990035', 'Alpha Hospital', 'Zville', 'AL'],
  ];
  const views = rows.reverse().map(([ccn, name, city, state]) => hospitalView(inputs(CASES.yes, { hospital: { ...CASES.yes, ccn }, master: master(ccn, { name, city, state }) })));
  assert.deepEqual(hospitalRows(views).rows.map((r) => r[0]), ['990034', '990035', '990033', '990031', '990032']);
});

test('the build writes the hospitals asset with one row per hospital, in the table\'s default order (state, then name)', () =>
  temp(async (dir) => {
    await generate(dir, undefined, { data: SLICE });
    const url = /data-src="([^"]+)"/.exec(read(dir, '/hacrp/'))[1];
    assert.match(url, /^\/assets\/hacrp-hospitals\.[0-9a-f]{8}\.json$/);
    const { hospitalPath, rows } = JSON.parse(readFileSync(join(dir, url), 'utf8'));
    assert.equal(hospitalPath, '/hacrp/hospital/');
    assert.deepEqual(rows.map((r) => r[0]).sort(), SLICE.hospitals.map((h) => h.ccn).sort());
    // The places in the asset are the pages the build wrote, each with the hospitals it holds.
    const { places } = JSON.parse(readFileSync(join(dir, url), 'utf8'));
    assert.deepEqual(places.map(([kind, key]) => `${kind}:${key}`).sort(), SLICE_PLACES.list.map((p) => p.id).sort());
    for (const [kind, key, name, path, n] of places) {
      const place = SLICE_PLACES.places.get(`${kind}:${key}`);
      assert.deepEqual([name, path, n], [place.name, place.path, place.ccns.length]);
      assert.ok(read(dir, path).includes(esc(name)), `${path}: a page that names the place`);
    }
    assert.deepEqual(rows, [...rows].sort(compareDefault));
    assert.ok(new Set(rows.map((r) => r[3])).size > 1, 'the slice spans states');
    for (const [ccn, , , , total] of rows) {
      const text = read(dir, `${hospitalPath}${ccn.toLowerCase()}/`);
      assert.ok(total === 'N/A' ? text.includes('No score published') : text.includes(`cms">${cmsText(total)}<`), ccn);
    }
  }));

// The hospital page as the build renders it, for a synthetic case.
const render = (h, overrides) => hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(h, overrides)), source: DATA.source, robots: null, assets: ASSETS });
const meta = (text, name) => new RegExp(`<meta name="${name}" content="([^"]*)">`).exec(text)[1];

test('a hospital with no score shows a hatched "No score published" block, not an N/A headline', () => {
  for (const h of [CASES.noScore, CASES.yesNoScore]) {
    const text = render(h);
    assert.match(text, /<span class="hosp__none"><span>No score published<\/span><\/span>/);
    assert.doesNotMatch(text, /hosp__score/);
    assert.doesNotMatch(text, /cms">N\/A</);
  }
  const scored = render(CASES.yes);
  assert.match(scored, /class="field__value field__value--big cms hosp__score">0<span class="dp">\.<\/span>3000</, "CMS’s text, its point in a span");
  assert.doesNotMatch(scored, /No score published/);
});

test('the decision pill and the "CMS\'s value" line: shown under a cut or no-cut pill, skipped when the pill is CMS\'s own text', () => {
  const says = (h) => render(h).includes(esc("CMS’s value:"));
  assert.deepEqual([CASES.yes, CASES.no].map(says), [true, true]);
  assert.deepEqual([CASES.maryland, CASES.yesNoScore].map(says), [false, false]);
  assert.match(render(CASES.yesNoScore), /pill--pen">Yes</);
  assert.match(render(CASES.maryland), /pill--na">N\/A</);
});

test('titles and descriptions: the hospital page ends with the site name; both pages describe the program, CMS and the year', () => {
  const text = render(CASES.yes);
  const name = 'Example General Hospital';
  assert.match(text, new RegExp(`<title>${name}, Exampleton, AL: Hospital-Acquired Conditions, FY${DATA.fy} · Paid &amp; Penalized</title>`));
  // A neutral sentence, the same for every verdict (ARCH-23): it names the hospital, the year and the kinds of facts the
  // page holds, and no decision, no score and no dollar figure. The Share control's sentence is the reader's to copy.
  // These pages render with no estimate (PAGE_CTX), so the sentence doesn't mention dollars; money.test.js checks both.
  const description = esc(`${name} (Exampleton, AL): CMS’s FY${DATA.fy} Hospital-Acquired Condition score and payment decision, from public CMS data.`);
  assert.equal(meta(text, 'description'), description);
  assert.equal(text.match(/<meta property="og:description" /g).length, 1, 'one og:description');
  assert.ok(text.includes(`<meta property="og:description" content="${description}">`), 'the same sentence');
  for (const h of [CASES.yes, CASES.no, CASES.maryland, CASES.yesNoScore]) assert.doesNotMatch(meta(render(h), 'description'), /\$|\bcut\b|\bYes\b|\bNo\b|\d%/, `${h.ccn}: no decision value and no dollar figure`);
  const program = programPage(PROGRAM_ARGS);
  assert.equal(meta(program, 'description'), esc(`How Medicare’s Hospital-Acquired Condition Reduction Program works, and CMS’s FY${DATA.fy} scores and payment decisions for every hospital in its file.`));
});

test('the ledger says which measure added the most (its row tagged in red) and, with the what-if, which one at the median would lower the score most', () => {
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const view = hospitalView(inputs(h));
    const text = render(h);
    const row = new RegExp(`<li class="ledger__row is-top[^"]*">\\n<div class="ledger__name"><div class="ledger__short"><details class="def"><summary>${view.largest.short}[\\s\\S]*? <span class="ledger__tag">added the most</span>`);
    assert.match(text, row, `${h.ccn}: the largest part's row`);
    assert.equal(text.match(/class="ledger__row is-top/g).length, 1, `${h.ccn}: one row tagged`);
  }
  for (const h of [CASES.noScore, CASES.yesNoScore]) assert.doesNotMatch(render(h), /added the most/);
  // The lever needs CMS's row (the what-if's hospital): the measure above its median whose median lowers the score most.
  const text = hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(CASES.yes)), hospital: CASES.yes, source: DATA.source, robots: null, assets: ASSETS });
  assert.match(text, /<p class="hsec__lever">Bringing \S+( \S+)? down to the national median \([\d.]+\) would lower the score the most: by [\d.]+, to −?[\d.]+\. (That change alone would put the score under CMS’s line\. )?<a class="hsec__try" href="#whatif&amp;\w+=[\d.]+">Try it in the what-if<\/a><\/p>/);
  assert.doesNotMatch(render(CASES.yes), /hsec__lever/, 'no lever without CMS’s row');
});

test('an estimate tag opens a visible note with the maximum error and a methods link; no dashed badge', () => {
  const view = hospitalView(inputs(CASES.yes));
  const psi = view.measures.find((m) => m.id === 'PSI90');
  assert.equal(psi.tagged, true);
  const text = render(CASES.yes);
  assert.ok(text.includes(esc(`The recompute can differ from CMS’s z‑score by up to ${psi.maxErrorText}.`)));
  assert.match(text, /<details class="est"><summary>estimate<\/summary>/);
  assert.match(text, /<a href="\/methods\/#estimate">/);
  assert.doesNotMatch(text, /title="This site/);
});

// The program page's sandbox: the what-if on the synthetic median hospital, with no way to share a scenario.
const SANDBOX_LABEL = 'a hypothetical hospital at the national median on every measure';
const sandboxProgram = () => {
  const { model, estimate } = DATA;
  return programPage({
    ...PROGRAM_ARGS,
    whatif: { hospital: medianHospital(model, { fiscalYear: String(DATA.fy), periods: DATA.periods }), model, estimate, range: scoreRange(DATA.hospitals) },
  });
};

test('the program page holds the sandbox on the median hospital: labeled, no share banner, no NHSN field, standing line', () => {
  const text = sandboxProgram();
  assert.match(text, /<section class="block whatif" id="whatif"/);
  assert.ok(text.includes(SANDBOX_LABEL));
  assert.match(text, /<section class="block whatif" id="whatif"[^>]*>\n<h2 id="whatif-h">[^<]*<\/h2>\n<p class="wi-label">Sandbox: a hypothetical/,
    'the label sits inside the section, under its heading');
  assert.doesNotMatch(text, /data-wi="banner"|data-wi="predicted"|Reader-made scenario/);
  assert.ok(text.includes(esc(WHATIF_STANDING)));
  assert.ok(text.includes('<script type="module" src="/assets/hacrp-program.test.js"></script>'));
  assert.equal([...text.matchAll(/id="whatif"/g)].length, 1);
});

test('the sandbox page data is the median record, the model, the estimate tags and the texts\' page fields; "<" is escaped', () => {
  const text = sandboxProgram();
  const [, json] = /<script type="application\/json" id="hacrp-program">(.*?)<\/script>/s.exec(text);
  assert.ok(!json.includes('<'));
  const data = JSON.parse(json);
  assert.deepEqual(Object.keys(data).sort(), ['estimate', 'hospital', 'model', 'page', 'range']);
  assert.equal(data.hospital.ccn, '000000');
  assert.equal(data.page.name, null);
  assert.deepEqual([data.page.share, data.page.baseline], [false, 'sandbox']);
  assert.equal(data.page.path, '/hacrp/');
  assert.deepEqual(data.page.source, { id: DATA.source.id, pdcReleased: DATA.source.pdcReleased });
  assert.deepEqual(data.page.boundaryText, BOUNDARY);
  assert.equal(data.range.low < data.range.high, true);
});

test('without whatif data the program page has no sandbox (the other tests render it that way)', () => {
  const text = programPage(PROGRAM_ARGS);
  assert.doesNotMatch(text, /id="whatif"|hacrp-program"/);
});

test('the build writes the sandbox into /hacrp/, its page data saying share false; every page has the search', () =>
  temp(async (dir) => {
    await generate(dir, undefined, { data: SLICE });
    const text = read(dir, '/hacrp/');
    assert.match(text, /id="whatif"/);
    assert.ok(text.includes(SANDBOX_LABEL));
    assert.doesNotMatch(text, /data-wi="banner"/);
    const [, json] = /<script type="application\/json" id="hacrp-program">(.*?)<\/script>/s.exec(text);
    assert.equal(JSON.parse(json).page.share, false);
    assert.match(text, /<form class="omni" role="search"[^>]*data-src="\/assets\/hacrp-hospitals\.[0-9a-f]{8}\.json"/, 'the top bar searches the same asset');
    for (const path of SLICE.hospitals.map(hospitalPath)) assert.ok(read(dir, path).includes('<form class="omni" role="search"'), `${path}: a search on every page`);
  }));

test('the ledger: one row per measure, CMS\'s value and z-score (a dash where CMS published none), CMS\'s footnotes and this site\'s part', () => {
  for (const h of Object.values(CASES)) {
    const view = hospitalView(inputs(h));
    const text = render(h);
    const rows = [...text.matchAll(/<li class="ledger__row[^"]*">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.equal(rows.length, 6, h.ccn);
    view.measures.forEach((m, i) => {
      const cells = [...rows[i].matchAll(/<span class="cms">(.*?)<\/span><\/p>/g)].map((c) => c[1]);
      assert.equal(cells[0].startsWith('<span aria-hidden="true">—'), !m.hasValue, `${h.ccn} ${m.id}: value`);
      if (m.hasValue) assert.equal(cells[0], m.valueText);
      if (m.hasZ) assert.equal(cells[1], m.zText);
      for (const f of m.footnotes) assert.ok(rows[i].includes(esc(f.text)), `${h.ccn} ${m.id}: footnote ${f.code}`);
      if (m.contributionText) assert.ok(rows[i].includes(`<span>${m.contributionText}</span>`), `${h.ccn} ${m.id}: part`);
    });
  }
});

test('the top: the record card (title bar, numbered fields from the name) beside the verdict (stamp, summary), the state map a watermark', () => {
  for (const h of Object.values(CASES)) {
    const text = render(h);
    assert.match(text, /<article class="wrap page page--hosp hosp">\n<div class="hosp__top">\n<div class="form hosp__id">\n<p class="form__title"><span>Hospital record · FY2026<\/span><span>CCN 99\d{4}<\/span><\/p>/, h.ccn);
    const card = /<div class="form hosp__id">[\s\S]*?\n<\/div>\n<\/div>\n<section/.exec(text)[0];
    const numbers = [...card.matchAll(/<span class="field__no">(\d+)<\/span>([^<]+)</g)].map((m) => [Number(m[1]), m[2]]);
    assert.deepEqual(numbers.map(([n]) => n), numbers.map((_, i) => i + 1), `${h.ccn}: numbered in order`);
    assert.deepEqual(numbers.slice(0, 2).map(([, label]) => label), ['Hospital', 'Location']);
    assert.ok(numbers.some(([, l]) => l === 'Total HAC Score') && numbers.some(([, l]) => l === 'Payment reduction'), h.ccn);
    assert.match(text, /<section class="hosp__verdict" aria-label="Score and payment decision">\n<div class="hosp__stampline">\n<p class="stamp[^"]*">/, `${h.ccn}: the verdict keeps the hero's name`);
    assert.ok(text.indexOf('For fiscal year') > text.indexOf('class="hosp__verdict"') && text.indexOf('For fiscal year') < text.indexOf('id="measures"'), `${h.ccn}: the summary in the verdict`);
  }
});

test("the verdict says CMS's line in plain words, from CMS's text, over the line bar; not without a score", () => {
  const line = `CMS cut scores of <span class="nw">${BOUNDARY.lowestYes}</span> and above.`;
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const text = render(h);
    assert.ok(text.includes(`<p class="hosp__line">${line}</p>`), h.ccn);
    assert.ok(text.indexOf('chart--line-bar') > text.indexOf('hosp__line'), `${h.ccn}: the bar under it`);
    assert.match(text, /<p class="hosp__rank">Higher than \d+% of the other [\d,]+ scores CMS published \(higher is worse\)\.<\/p>/);
  }
  for (const h of [CASES.noScore, CASES.yesNoScore]) assert.ok(!render(h).includes('hosp__line'), h.ccn);
});

test('the line bar: two drawings (phone and wide), each an image named in words, marking this score, the middle score and CMS\'s line', () => {
  const text = render(CASES.yes);
  const bars = [...text.matchAll(/<svg role="img" aria-label="([^"]*)" data-fit="(narrow|wide)" class="chart chart--line-bar"[\s\S]*?<\/svg>/g)];
  assert.deepEqual(bars.map((b) => b[2]), ['narrow', 'wide']);
  const middle = cmsText(PAGE_CTX.nat.medianScore.toFixed(4));
  assert.equal(bars[0][1], esc(`Every Total HAC Score CMS published, from ${cmsText(PAGE_CTX.nat.domain[0].toFixed(4))} to ${cmsText(PAGE_CTX.nat.domain[1].toFixed(4))}: this hospital’s is 0.3000, the middle hospital’s ${middle}, and CMS cut scores of ${BOUNDARY.lowestYes} and above.`));
  for (const [svg] of bars) {
    assert.ok(svg.includes('<title>This hospital: 0.3000</title>'));
    assert.ok(svg.includes(`<title>Middle hospital: ${middle}</title>`));
    assert.ok(svg.includes(`data-value="${BOUNDARY.highestNo.replace(/0+$/, '')} ${BOUNDARY.lowestYes}"`) || svg.includes(`data-value="0.25 0.2507"`));
  }
});

test('a page with a score says, beside the record, that the score compares hospitals and is not a grade, once; a page with none says nothing of it', () => {
  for (const h of Object.values(CASES)) {
    const text = render(h);
    if (h.total === null) {
      assert.doesNotMatch(text, /not a grade/, h.ccn);
      continue;
    }
    const verdict = /<section class="hosp__verdict"[\s\S]*?<\/section>/.exec(text)[0];
    assert.ok(verdict.includes('The score compares hospitals with each other; it is not a grade of the quality of care.'), h.ccn);
    assert.equal(text.split('not a grade of the quality of care.').length, 2, `${h.ccn}: said once`);
  }
});

test("the phone's Sort by menu offers each column head's key both ways, the default (state, ascending) selected", () => {
  const text = programPage({ ...PROGRAM_ARGS, searchUrl: '/assets/hacrp-hospitals.0000abcd.json', robots: null });
  const menu = /<select id="ht-sort">([\s\S]*?)<\/select>/.exec(text)[1];
  const heads = [...text.matchAll(/<th scope="col" data-key="(\w+)"/g)].map((m) => m[1]);
  const values = [...menu.matchAll(/<option value="([\w:-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, heads.flatMap((k) => [`${k}:1`, `${k}:-1`]));
  assert.match(menu, /<option value="state:1" selected>State, ascending<\/option>/);
  assert.match(menu, /<option value="score:-1">Total HAC Score, descending<\/option>/);
  assert.match(text, /<label for="ht-sort">Sort by<\/label>/);
});

test('the as-of strip is a list of facts, each a term and its value from their own copy entries', () => {
  const text = hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS });
  const list = /<dl class="asof__list">([\s\S]*?)<\/dl>/.exec(text)[1];
  const rows = [...list.matchAll(/<div><dt>(.*?)<\/dt><dd>(.*?)<\/dd><\/div>/g)].map(([, dt, dd]) => [dt.replace(/<[^>]+>/g, ''), dd.replace(/<[^>]+>/g, '')]);
  const fy = String(DATA.fy);
  assert.deepEqual(rows.map(([dt]) => dt), ['Fiscal year', 'PSI 90 period', 'Infection measures period', 'Latest public hospital results', 'Provider Data Catalog release']);
  assert.equal(rows[0][1], fy);
  assert.equal(rows[3][1], `FY${fy}; FY${DATA.fy + 1} expected early ${DATA.fy + 1}`);
  assert.equal(rows[4][1], cmsText(isoDateOf(DATA.source.pdcReleased)));
  assert.match(list, /<dd><span class="nw">[^<]+<\/span> to <span class="nw">[^<]+<\/span><\/dd>/, 'each period date whole');
});

test("a hospital page's foot sets the facts (the data's release among them), data links, footnotes and way back beside the standing line and citation", () => {
  const text = hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS });
  const foot = text.slice(text.indexOf('class="hosp__foot"'));
  assert.ok(foot.includes(`<dd><span class="nw">${cmsText(isoDateOf(DATA.source.pdcReleased))}</span></dd>`), 'the release in the facts');
  const at = (s) => text.indexOf(s);
  const order = ['class="hosp__foot"', 'class="asof"', 'class="data-links"', 'id="fn-h"', 'class="page__links"', 'class="hosp__cite"', 'class="standing"', 'id="cite-h"'].map(at);
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `foot order ${order}`);
  assert.equal(text.split('Source: CMS Provider Data Catalog').length - 1, 1 + (text.match(/class="source fig__source"/g) ?? []).length, 'the citation and each figure say the source; no extra source line');
  const landing = DATA.source.landingPage.replace(/[.?]/g, '\\$&');
  assert.match(text, new RegExp(`<a href="${landing}">CMS’s dataset page</a></p>`), 'an absolute link prints its own href');
  assert.ok(text.includes('<p class="page__links"><a href="/hacrp/" data-print-href="https://paidandpenalized.org/hacrp/">'));
});

test("the HACRP top bar: the program's name and FY tag, its nav to the program page's sections (each id on the page) and Methods", () => {
  const program = renderProgram(HISTORY_ARGS);
  const header = /<header class="topbar">[\s\S]*?<\/header>/.exec(program)[0];
  assert.ok(header.includes('<span class="wordmark__name">Hospital-Acquired Conditions</span> <span class="wordmark__tag">HACRP · FY2026</span>'));
  const targets = [...header.matchAll(/<a href="([^"]+)" data-nav="(\w+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(targets.map(([id]) => id), ['how', 'fy', 'money', 'map', 'history', 'methods']);
  for (const [id, href] of targets.slice(0, 5)) {
    assert.equal(href, `/hacrp/#${id}`);
    assert.match(program, new RegExp(`<[a-z]+ [^>]*id="${id}"`), `the program page holds #${id}`);
  }
  assert.equal(targets[5][1], METHODS_PATH, 'Methods is its own page under the program');
  assert.ok(header.includes(`href="${METHODS_PATH}" data-nav="methods"`));
  assert.match(header, /data-nav="how" aria-current="true"/);
  assert.ok(program.includes(`<script type="module" src="${ASSETS.js.topbar}">`));
  const view = hospitalView(inputs(CASES.yes));
  const hosp = hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: null, assets: ASSETS });
  const barOf = (text) => /<header class="topbar">[\s\S]*?<\/header>/.exec(text)[0];
  const currentOf = (text) => [...barOf(text).matchAll(/data-nav="(\w+)"( aria-current="true")?/g)].filter((m) => m[2]).map((m) => m[1]);
  // The hospital and place pages mark "Every hospital" (the program page's #map), the Methods page marks Methods, and
  // each bar has the same five links.
  assert.deepEqual(currentOf(hosp), ['map']);
  assert.deepEqual(currentOf(renderPlace(PLACES.list[0], HISTORY_ARGS)), ['map']);
  assert.deepEqual(currentOf(program), ['how']);
  assert.match(barOf(hosp), /data-nav="map"[^>]*><span class="nav__num">4<\/span>Every hospital</);
});

test('the record card: Type from the master in the site\'s words, Care Compare\'s stars or CMS\'s words, and a state map, its geocoder credited in the data list', () => {
  const profile = { zip: '35000', lat: 32.4, lon: -86.3, geo: 'zip', teach: 'major', beds: 1234, own: 'Government', urban: true, types: ['RRC', 'SCH'] };
  const page = (overrides, careCompare = null, state = 'AL') => hospitalPage({
    ...PAGE_CTX,
    view: hospitalView(inputs(CASES.no, { master: master('990002', { state, ...profile, ...overrides }), careCompare })),
    source: DATA.source, robots: null, assets: ASSETS, shapes: DATA.shapes, careSource: DATA.careCompareSource, masterFy: 2027,
  });
  const text = page({}, { rating: '4', footnotes: [] });
  assert.ok(text.includes('<p class="field__value field__value--sm">Major teaching · 1,234 beds · Government · Urban · Rural referral center · Sole community hospital</p>'));
  // The Type field reads just the facts; their sources are in the data list, with the field only.
  assert.match(text, /<p class="field__value field__value--sm">Major teaching[^<]*<\/p>\n<\/div>/);
  assert.doesNotMatch(text, /field__note">Teaching/);
  assert.match(text, /<div><dt>Teaching, urban and special status<\/dt><dd>CMS’s FY2027 IPPS impact file<\/dd><\/div><div><dt>Beds<\/dt><dd>CMS’s Provider of Services file<\/dd><\/div>/);
  assert.match(text, /<p class="field__value">Exampleton, <a class="hosp__state" href="\/hacrp\/#state=AL">AL<span class="vh"> \(Alabama’s hospitals on the map and in the table\)<\/span><\/a> 35000<\/p>\n<div class="field__note">Example County<\/div>/);
  assert.match(page({ zip: null }), /<p class="field__value">Exampleton, <a class="hosp__state" href="\/hacrp\/#state=AL">AL<span class="vh">[^<]*<\/span><\/a><\/p>/);
  assert.match(text, /<span class="stars" aria-hidden="true">★★★★<span class="stars__off">☆<\/span><\/span><span class="vh">4 of 5 stars<\/span>/);
  assert.match(text, /href="https:\/\/www\.medicare\.gov\/care-compare\/details\/hospital\/990002" target="_blank" rel="noopener">Open on Care Compare/);
  assert.match(text, /<div class="hosp__wm" aria-hidden="true"><span class="geo geo--j"><svg class="chart chart--state-map"[^>]*aria-label="Map of Alabama with this hospital’s location marked"/);
  // No caption on how the dot was placed; the data list credits the geocoder once, for a geocoded address only.
  assert.doesNotMatch(text, /Placed /);
  assert.doesNotMatch(text, /Geocoder/, 'a ZIP-centered dot');
  const geocoded = page({ geo: 'address' });
  assert.equal(geocoded.split('Geocoder').length, 2);
  assert.match(geocoded, /<div><dt>Map location<\/dt><dd>U\.S\. Census Bureau Geocoder<\/dd><\/div>/);
  assert.doesNotMatch(page({ geo: 'address', lat: null }), /Geocoder/, 'no map, no credit');
  // CMS's words where it gives no rating, with its footnote; no stars field when Care Compare doesn't list the hospital.
  const fn = FN('16');
  const none = page({}, { rating: 'Not Available', footnotes: [{ code: '16', text: fn }] });
  assert.match(none, /<p class="field__value field__value--sm">Not Available<\/p>/);
  assert.ok(none.includes(`CMS footnote 16: ${esc(fn)}`));
  assert.doesNotMatch(page({}), /Care Compare stars/);
  // No Type field when the master knows nothing; no map for a territory or a missing point.
  const untyped = page({ teach: null, beds: null, own: null, urban: null, types: [] });
  assert.doesNotMatch(untyped, />Type</);
  assert.doesNotMatch(untyped, /IPPS impact file|Provider of Services/, 'no Type field, no sources for it');
  assert.doesNotMatch(page({}, null, 'GU'), /chart--state-map/);
  assert.doesNotMatch(page({ lat: null }), /chart--state-map/);
});

test("careCompareRatings: CMS's rating text and footnotes by CCN; a missing column fails", async () => {
  const { careCompareRatings } = await import('../web/data.js');
  const csv = '"Facility ID","Hospital overall rating","Hospital overall rating footnote"\n"990001","3",""\n"990002","Not Available","16"\n';
  const ratings = careCompareRatings(csv, DATA.footnotes);
  assert.deepEqual(ratings.get('990001'), { rating: '3', footnotes: [] });
  assert.deepEqual(ratings.get('990002'), { rating: 'Not Available', footnotes: [{ code: '16', text: FN('16') }] });
  assert.throws(() => careCompareRatings('"Facility ID","Hospital overall rating"\n"990001","3"\n', DATA.footnotes), /missing column/);
  // The pinned file rates most of HACRP's hospitals.
  const rated = DATA.hospitals.filter((h) => /^[1-5]$/.test(DATA.careCompare.get(h.ccn)?.rating ?? '')).length;
  assert.ok(rated > DATA.hospitals.length / 2, `${rated} rated`);
});

test('a section whose words explain a figure splits: each hospital section beside its figure; on the program page each step and each section of the year beside its own', () => {
  const scored = render(CASES.yes);
  assert.match(scored, /<section class="block hsec hsec--full" id="measures" aria-labelledby="measures-h">\n<div class="hsec__text">\n<h2 id="measures-h">Where the score came from<\/h2>[\s\S]*?<\/div>\n<div class="hsec__fig">\n<figure class="fig" id="figure-1"/);
  assert.match(scored, /<section class="block hsec" id="sum" aria-labelledby="sum-h">\n<div class="hsec__text">\n<h2 id="sum-h">How the parts add up<\/h2>[\s\S]*?<div class="hsec__fig">\n<figure class="fig" id="figure-2"/);
  // No score: the ledger alone, no sum.
  assert.doesNotMatch(render(CASES.noScore), /id="sum"/);
  const program = renderProgram();
  // Part 1: five steps, the words (with the step's number) beside the figure of the same number.
  for (let n = 1; n <= 5; n++) {
    assert.match(program, new RegExp(`<section class="step" id="step-${n}" aria-labelledby="step-${n}-h">\\n<div class="step__text">\\n<p class="step__n" aria-hidden="true">${n}</p>[\\s\\S]*?</div>\\n<div class="step__fig">\\n<figure class="fig" id="figure-${n}" data-figure>`), `step ${n}`);
  }
  // Part 2: the year's sections, words left and figure right, in the order the page tells them.
  const sections = [['swarm', 6, ' psec--wide'], ['types', 7, ''], ['funnel', 8, ''], ['agree', 9, ''], ['escape', 11, ''], ['assigned', 12, '']];
  for (const [id, n, wide] of sections) {
    assert.match(program, new RegExp(`<section class="psec${wide}" id="${id}" aria-labelledby="${id}-h">\\n<div class="psec__text">\\n<h3 class="psec__title" id="${id}-h">[\\s\\S]*?</div>\\n<div class="psec__fig">\\n<figure class="fig" id="figure-${n}" data-figure>`), id);
  }
  // The money's sections, each beside (or over) its figure.
  const money = [['bill', 13, ' psec--wide'], ['across', 14, ' psec--wide'], ['shares', 15, ''], ['states', 16, ' psec--wide'], ['three', 17, ' psec--wide']];
  for (const [id, n, wide] of money) {
    assert.match(program, new RegExp(`<section class="psec${wide}" id="${id}" aria-labelledby="${id}-h">\\n<div class="psec__text">\\n<h3 class="psec__title" id="${id}-h">[\\s\\S]*?</div>\\n<div class="psec__fig">\\n<figure class="fig" id="figure-${n}" data-figure>`), id);
  }
  assert.deepEqual([...program.matchAll(/<section class="psec[ \w-]*" id="(\w+)"/g)].map((m) => m[1]), [...sections, ...money].map(([id]) => id));
  // Part 4: the map's figure, then the table of every hospital beside the way down by place.
  assert.match(program, /<section class="part" id="map" aria-labelledby="map-h">[\s\S]*?<figure class="fig" id="figure-18" data-figure>[\s\S]*?<div class="prog__browse">\n<section class="block hospitals"[\s\S]*?<nav class="block browse"/);
});
test("the program page's top: the name with its last word in the penalty ink, the lede, the search, and a summary form of this year's counts, the cut and CMS's line, under the stamp", () => {
  const counts = { decided: 1240, yes: 310, scored: 1305 };
  const places = { state: PLACES.list.find((p) => p.kind === 'state'), metro: PLACES.list.find((p) => p.kind === 'metro') };
  const text = programPage({ ...PROGRAM_ARGS, counts, tryPlaces: places });
  const top = /<header class="page__head prog__top">[\s\S]*?<\/header>/.exec(text)[0];
  assert.ok(top.includes('<h1 class="prog__title">Hospital-Acquired <span class="prog__title-pen">Conditions</span></h1>'));
  assert.ok(top.includes('<p class="cap kicker prog__kicker">HACRP · fiscal year 2026</p>'));
  // The lede carries the counts as the build passes them (A1's), and the cut as the method constant.
  assert.ok(top.includes('<strong>For fiscal year 2026, that was 310 of the 1,240 scored hospitals</strong> with a payment decision.'));
  assert.match(top, /<p class="form__title"><span>Program summary · FY2026<\/span><span>CMS data released <span class="nw">[A-Z][a-z]+ \d+, \d{4}<\/span><\/span><\/p>/);
  const fields = [...top.matchAll(/<span class="field__no">(\d)<\/span>([^<]+)<\/p>\n<p class="field__value[^"]*">([\s\S]*?)<\/p>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(fields.map(([n, label]) => [n, label]), [['1', 'Hospitals cut'], ['2', 'The cut'], ['3', 'Scored'], ['4', 'CMS’s line'], ['5', 'Data window'], ['6', 'Payment year']]);
  assert.deepEqual(fields.slice(0, 4).map(([, , v]) => v), ['310', '1%', '1,305', '0.2507 and up']);
  assert.ok(top.includes('Of 1,240 scored hospitals with a Yes or No'));
  assert.ok(top.includes('The lowest score CMS cut. The highest it did not: 0.2500.'));
  // The data windows and the payment year, whole dates from the periods and the year.
  assert.ok(fields[4][2].includes(`PSI 90: <span class="nw">Jul 1, 2022</span> to <span class="nw">Jun 30, 2024</span><br>Infections: <span class="nw">Jan 1, 2023</span> to <span class="nw">Dec 31, 2024</span>`));
  assert.ok(fields[5][2].includes(`<span class="nw">Oct 1, ${DATA.fy - 1}</span> to <span class="nw">Sep 30, ${DATA.fy}</span>`));
  assert.ok(top.includes(`<p class="stamp">Final · released ${shortIsoDate(DATA.source.pdcReleased)}</p>`));
  // The hero search and the places to try: the busiest state and metro area, then the table and Part 1.
  assert.match(top, /<form class="omni omni--hero"/);
  assert.ok(top.includes(`<p class="prog__try">Try <a href="${places.state.path}">${esc(places.state.name)}</a>, <a href="${places.metro.path}">${esc(places.metro.name)}</a>, or <a href="#hospitals">browse every hospital</a>. New to this? Start with <a href="#how">how the program works</a>.</p>`));
  assert.doesNotMatch(programPage({ ...PROGRAM_ARGS }), /prog__try/, 'no suggestions without places');
  // The map's section: Part 3's heading under the id the nav's Map item names, its figure only with its data.
  assert.match(text, /<section class="part" id="map" aria-labelledby="map-h">\n<header class="part__head">\n<p class="part__tag">Part 3<\/p>\n<h2 class="part__title" id="map-h">Where the cuts land<\/h2>/);
  assert.doesNotMatch(text, /usmap|figure-13/, 'no map without its data');
  assert.match(renderProgram(), /<div class="usmap" data-mode="share">/);
});

test('the HACRP manifest bundles one script per kind of page (program, place, hospital) and the search; every script a page loads is one it bundles', () => {
  assert.equal(HACRP.id, 'hacrp');
  assert.deepEqual(Object.keys(HACRP.entries).sort(), ['hacrp-hospital', 'hacrp-place', 'hacrp-program', 'hacrp-search']);
  for (const file of Object.values(HACRP.entries)) assert.ok(existsSync(REPO_ROOT + file), file);
  const bundled = new Set(Object.keys(mergeEntries(SHARED_ENTRIES, HACRP.entries)));
  const loads = (text) => [...text.matchAll(/<script type="module" src="\/assets\/([\w-]+)\.test\.js"><\/script>/g)].map((m) => m[1]);
  const own = (text) => loads(text).filter((name) => Object.hasOwn(HACRP.entries, name) && name !== 'hacrp-search');
  const hospital = hospitalPage({
    ...PAGE_CTX, view: hospitalView(inputs(CASES.yes)), hospital: CASES.yes, source: DATA.source, robots: null, assets: ASSETS, searchUrl: '/assets/hacrp-hospitals.0000abcd.json',
    whatif: { hospital: CASES.yes, model: DATA.model, estimate: DATA.estimate, range: scoreRange(DATA.hospitals) },
  });
  const pages = [[renderProgram(), 'hacrp-program'], [renderPlace(PLACES.list[0]), 'hacrp-place'], [hospital, 'hacrp-hospital']];
  for (const [text, script] of pages) {
    assert.ok(loads(text).every((name) => bundled.has(name)), `${script}: ${loads(text)}`);
    assert.deepEqual(own(text), [script], 'each kind of page loads its own script and no other');
    assert.ok(loads(text).includes('hacrp-search'), `${script}: every page has the search`);
  }
});
