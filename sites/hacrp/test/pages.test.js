// The HACRP page generator on the pinned data (rows picked by property, never by name or CCN), plus escaping of
// hostile text on synthetic hospitals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { footnoteList } from '../../../engine/js/footnotes.js';
import { decidedHospitals } from '../../../engine/js/hacrp/hospital.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { HUB } from '../../../hub/pages.js';
import { build } from '../../../pipeline/site/build.js';
import { createContext } from '../../../pipeline/site/context.js';
import { withTemp } from '../../../pipeline/test/helpers.js';
import { cmsText, count, isoDate as isoDateOf } from '../../../web/render/format.js';
import { HACRP, generateHacrp, hospitalRows, scoreRange } from '../web/generate.js';
import { compareDefault } from '../web/hospital-table.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { programPage } from '../web/pages/program.js';
import { largestSentence } from '../web/sentences.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, BOUNDARY_TEXT as BOUNDARY, CASES, esc, inputs, master, pick as pickFrom, WHATIF_STANDING } from './fixtures.js';
import { DATA, PROGRAM_ARGS, RANGES, PAGE_CTX } from './pinned.js';

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

test('production, released: every hospital page plus /hacrp/, one <h1> each; odd rows as CMS published them', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, 'production', { released: true, data: DATA });
    assert.equal(DATA.hospitals.length, 3055);
    assert.equal(ctx.pages, DATA.hospitals.length + 2, 'the hospitals, /hacrp/ and the data dictionary page');
    assert.equal(readdirSync(join(dir, 'hacrp', 'hospital')).length, DATA.hospitals.length);

    const pages = new Map([['/hacrp/', read(dir, '/hacrp/')], ...DATA.hospitals.map((h) => [hospitalPath(h), read(dir, hospitalPath(h))])]);
    const page = (h) => pages.get(hospitalPath(h));
    const cmsCell = /class="[^"]*\bcms\b[^"]*"[^>]*>([^<]*)</g;
    for (const [path, text] of pages) {
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, `${path}: one h1`);
      const cells = [...text.matchAll(cmsCell)];
      // Twelve measure cells, and the score in the record card when CMS published one.
      if (path !== '/hacrp/') assert.ok(cells.length >= (text.includes(' hosp__score"') ? 13 : 12), `${path}: CMS cells found`);
      for (const [, cell] of cells) assert.doesNotMatch(cell, /-[\d.]/, `${path}: hyphen-minus in "${cell}"`);
      // A page loads the figure script exactly when it has a figure, and the cite script when it has the citation.
      assert.equal(text.includes(`src="${ASSETS.js.figure}"`), text.includes(' data-figure>'), `${path}: figure script`);
      assert.equal(text.includes(`src="${ASSETS.js.cite}"`), text.includes(' data-cite-copy '), `${path}: cite script`);
    }

    // Scored pages may be indexed; a page with no score never is, even in production on a released site. Only a
    // scored page has the what-if.
    for (const h of DATA.hospitals) {
      assert.equal(page(h).includes(NOINDEX), h.total === null, hospitalPath(h));
      assert.equal(page(h).includes('<section class="block whatif" id="whatif"'), h.total !== null, `${hospitalPath(h)}: what-if`);
    }
    const scored = DATA.hospitals.filter((h) => h.total !== null).map(hospitalPath);
    assert.deepEqual(ctx.indexable, ['/hacrp/data/', '/hacrp/', ...scored]);
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
    assert.ok(program.includes(esc(`Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of ${bt.lowestYes} or higher and none at ${bt.highestNo} or lower.`)));
    assert.ok(program.includes(esc("Maryland’s hospitals are scored but not subject to the reduction.")));

    assert.ok(pages.get('/hacrp/').includes(`CMS cut Medicare inpatient payments to ${count(cut)} of the ${count(decided.length)} hospitals with a Total HAC Score`));
  }));

test('released: false: every page is noindex in production and the sitemap lists none', () =>
  temp(async (dir) => {
    const out = join(dir, 'dist');
    const hacrp = { ...HACRP, generate: (ctx) => generateHacrp(ctx, { released: false, data: SLICE, log: quiet }) };
    await build({ outDir: out, env: 'production', sites: [hacrp, HUB] });
    for (const h of SLICE.hospitals) assert.ok(read(out, hospitalPath(h)).includes(NOINDEX), hospitalPath(h));
    for (const path of ['/hacrp/', '/hacrp/data/', '/', '/methods/']) assert.ok(read(out, path).includes(NOINDEX), path);
    assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<url>/);
  }));

test('a preview build (no PP_ENV) is noindex everywhere, released or not', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, undefined, { released: true, data: SLICE });
    assert.deepEqual(ctx.indexable, []);
    // The hospitals, /hacrp/ and the dictionary page.
    assert.equal(ctx.pages, SLICE.hospitals.length + 2);
    for (const path of ['/hacrp/', '/hacrp/data/', ...SLICE.hospitals.map(hospitalPath)]) assert.ok(read(dir, path).includes(NOINDEX), path);
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
  const text = hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: 'noindex', assets: ASSETS, ranges: RANGES });
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
  // The search sits in the top bar: a combobox over the asset, hidden until its script shows it.
  const header = /<header class="topbar">[\s\S]*?<\/header>/.exec(text)[0];
  assert.match(header, /<form class="omni" role="search" aria-label="Find a hospital" data-src="\/assets\/hacrp-hospitals\.0000abcd\.json" hidden>/);
  assert.match(header, /<label class="omni__field" for="omni-q"><span class="omni__label cap">Find<span class="vh"> a hospital by name, city, ZIP code or CCN<\/span><\/span><input id="omni-q" type="search" role="combobox" aria-expanded="false" aria-controls="omni-list" aria-autocomplete="list"/);
  assert.match(header, /<ul class="omni__list" id="omni-list" role="listbox" aria-label="Find a hospital" hidden><\/ul>/);
  assert.match(header, /<p class="vh" role="status" aria-live="polite"><\/p>/);
  assert.doesNotMatch(text, /<datalist/);
  assert.doesNotMatch(text, /application\/json/);
  assert.match(text, /Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of <span class="nw">0\.2507<\/span> or higher and none at <span class="nw">0\.2500<\/span> or lower\./);
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
    assert.deepEqual(rows, [...rows].sort(compareDefault));
    assert.ok(new Set(rows.map((r) => r[3])).size > 1, 'the slice spans states');
    for (const [ccn, , , , total] of rows) {
      const text = read(dir, `${hospitalPath}${ccn.toLowerCase()}/`);
      assert.ok(total === 'N/A' ? text.includes('No score published') : text.includes(`cms">${cmsText(total)}<`), ccn);
    }
  }));

// The hospital page as the build renders it, for a synthetic case.
const render = (h, overrides) => hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(h, overrides)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
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
  assert.doesNotMatch(scored, /hosp__none|No score published/);
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
  assert.equal(meta(text, 'description'), esc(`${name} (Exampleton, AL): CMS’s FY${DATA.fy} Hospital-Acquired Condition score and payment decision, from public CMS data.`));
  const program = programPage(PROGRAM_ARGS);
  assert.equal(meta(program, 'description'), esc(`How Medicare’s Hospital-Acquired Condition Reduction Program works, and CMS’s FY${DATA.fy} scores and payment decisions for every hospital in its file.`));
});

test('the ledger says which measure added the most (its row tagged in red) and, with the what-if, which one at the median would lower the score most', () => {
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const view = hospitalView(inputs(h));
    const text = render(h);
    const row = new RegExp(`<li class="ledger__row is-top[^"]*">\\n<div class="ledger__name"><div class="ledger__short">(<details class="def"><summary>)?${view.largest.short}[\\s\\S]*? <span class="ledger__tag">added the most</span>`);
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
    assert.match(text, /<section class="hosp__verdict" aria-label="Score and payment decision">\n<p class="stamp[^"]*">/, `${h.ccn}: the verdict keeps the hero's name`);
    assert.ok(text.indexOf('For fiscal year') > text.indexOf('class="hosp__verdict"') && text.indexOf('For fiscal year') < text.indexOf('id="measures"'), `${h.ccn}: the summary in the verdict`);
  }
});

test("the verdict says CMS's line in plain words, from CMS's text, over the line bar; not without a score", () => {
  const line = `CMS cut scores of <span class="nw">${BOUNDARY.lowestYes}</span> and above.`;
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const text = render(h);
    assert.ok(text.includes(`<p class="hosp__line">${line}</p>`), h.ccn);
    assert.ok(text.indexOf('chart--line-bar') > text.indexOf('hosp__line'), `${h.ccn}: the bar under it`);
    assert.match(text, /<p class="hosp__rank">Higher than \d+% of the [\d,]+ scores CMS published \(higher is worse\)\.<\/p>/);
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
  const text = hospitalPage({ ...PAGE_CTX, view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
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
  const program = programPage({ ...PROGRAM_ARGS, states: { AL: { hospitals: 12, decided: 12, yes: 3, na: 0 } }, shapes: DATA.shapes });
  const header = /<header class="topbar">[\s\S]*?<\/header>/.exec(program)[0];
  assert.ok(header.includes('<span class="wordmark__name">Hospital-Acquired Conditions</span> <span class="wordmark__tag">HACRP · FY2026</span>'));
  const targets = [...header.matchAll(/<a href="([^"]+)" data-nav="(\w+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(targets.map(([id]) => id), ['how', 'fy', 'map', 'hospitals', 'methods']);
  for (const [id, href] of targets.slice(0, 4)) {
    assert.equal(href, `/hacrp/#${id}`);
    assert.match(program, new RegExp(`<[a-z]+ [^>]*id="${id}"`), `the program page holds #${id}`);
  }
  assert.ok(header.includes('href="/methods/" data-nav="methods"'));
  assert.match(header, /data-nav="how" aria-current="true"/);
  assert.ok(program.includes(`<script type="module" src="${ASSETS.js.topbar}">`));
  const view = hospitalView(inputs(CASES.yes));
  const hosp = hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  assert.match(/<header class="topbar">[\s\S]*?<\/header>/.exec(hosp)[0], /data-nav="hospitals" aria-current="true"/);
});

test('the record card: Type from the master in the site\'s words, Care Compare\'s stars or CMS\'s words, and a state map, its geocoder credited in the data list', () => {
  const profile = { zip: '35000', lat: 32.4, lon: -86.3, geo: 'zip', teach: 'major', beds: 1234, own: 'Government', urban: true, types: ['RRC', 'SCH'] };
  const page = (overrides, careCompare = null, state = 'AL') => hospitalPage({
    ...PAGE_CTX,
    view: hospitalView(inputs(CASES.no, { master: master('990002', { state, ...profile, ...overrides }), careCompare })),
    source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES, shapes: DATA.shapes, careSource: DATA.careCompareSource, masterFy: 2027,
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

test('a section whose words explain a figure splits: each hospital section beside its figure, the counts and the histogram on the program page', () => {
  const scored = render(CASES.yes);
  assert.match(scored, /<section class="block hsec hsec--full" id="measures" aria-labelledby="measures-h">\n<div class="hsec__text">\n<h2 id="measures-h">Where the score came from<\/h2>[\s\S]*?<\/div>\n<div class="hsec__fig">\n<figure class="fig" id="figure-1"/);
  assert.match(scored, /<section class="block hsec" id="sum" aria-labelledby="sum-h">\n<div class="hsec__text">\n<h2 id="sum-h">How the parts add up<\/h2>[\s\S]*?<div class="hsec__fig">\n<figure class="fig" id="figure-2"/);
  // No score: the ledger alone, no sum.
  assert.doesNotMatch(render(CASES.noScore), /id="sum"/);
  const { model } = DATA;
  const program = programPage({ ...PROGRAM_ARGS, scores: [{ total: 0.5, yes: true }, { total: 0.1, yes: false }], boundary: model.boundary });
  assert.match(program, /<section class="block split" id="fy" aria-labelledby="counts-h">\n<div class="split__text">\n<h2 id="counts-h">[\s\S]*?<\/div>\n<div class="split__fig">\n<figure class="fig" id="figure-1"/);
});
test("the program page's top: the name with its last word in the penalty ink, the dek, and a summary form of this year's counts, the cut and CMS's line, under the stamp", () => {
  const text = programPage({ ...PROGRAM_ARGS, counts: { decided: 1240, yes: 310, scored: 1305 } });
  const top = /<header class="page__head prog__top">[\s\S]*?<\/header>/.exec(text)[0];
  assert.ok(top.includes('<h1 class="prog__title">Hospital-Acquired <span class="prog__title-pen">Conditions</span></h1>'));
  assert.match(top, /<p class="form__title"><span>Program summary · FY2026<\/span><span>CMS data released <span class="nw">[A-Z][a-z]+ \d+, \d{4}<\/span><\/span><\/p>/);
  const fields = [...top.matchAll(/<span class="field__no">(\d)<\/span>([^<]+)<\/p>\n<p class="field__value[^"]*">([\s\S]*?)<\/p>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(fields.map(([n, label]) => [n, label]), [['1', 'Hospitals cut'], ['2', 'The cut'], ['3', 'Scored'], ['4', 'CMS’s line']]);
  assert.deepEqual(fields.slice(0, 3).map(([, , v]) => v), ['310', '1%', '1,305']);
  assert.ok(top.includes('Of 1,240 with a Yes or No payment decision'));
  assert.match(top, /<p class="stamp">Cut 1%<\/p>/);
  // The map's section: its words beside the figure, under the id the nav's Map item names.
  const withMap = programPage({ ...PROGRAM_ARGS, states: { AL: { hospitals: 12, decided: 12, yes: 3, na: 0 } }, shapes: DATA.shapes });
  assert.match(withMap, /<section class="block split" id="map" aria-labelledby="map-h">\n<div class="split__text">\n<h2 id="map-h">By state<\/h2>/);
  assert.doesNotMatch(programPage(PROGRAM_ARGS), /id="map"/, 'no map without its data');
});
