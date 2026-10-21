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
import { HACRP, MAP_PLACEMENT, generateHacrp, hospitalRows, previewSamples, scoreRange } from '../web/generate.js';
import { compareDefault } from '../web/hospital-table.js';
import { MAP_PLACEMENTS, hospitalPage } from '../web/pages/hospital.js';
import { programPage } from '../web/pages/program.js';
import { largestSentence } from '../web/sentences.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, BOUNDARY_TEXT as BOUNDARY, CASES, esc, inputs, master, pick as pickFrom, WHATIF_STANDING } from './fixtures.js';
import { DATA, PROGRAM_ARGS, RANGES } from './pinned.js';

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
    assert.ok(yes.includes(`Above ${bt.highestNo}; this site recomputes`));
    assert.ok(no.includes(`Below ${bt.lowestYes}; this site recomputes`));
    assert.doesNotMatch(maryland, /Distance to the line/);

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
    // The hospitals, /hacrp/, the dictionary page, and the map previews: each sample in each placement, and their index.
    const samples = previewSamples(SLICE.hospitals.map((h) => ({ view: { ccn: h.ccn, status: h.paymentReduction === 'N/A' ? 'maryland' : h.total === null ? 'none' : h.paymentReduction.toLowerCase(), scored: h.total !== null, state: DATA.master.get(h.ccn).state } })));
    assert.equal(ctx.pages, SLICE.hospitals.length + 2 + samples.length * MAP_PLACEMENTS.length + 1);
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
  const text = hospitalPage({ view, source: DATA.source, robots: 'noindex', assets: ASSETS, ranges: RANGES });
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
const render = (h, overrides) => hospitalPage({ view: hospitalView(inputs(h, overrides)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
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

test('a scored page says which measure added the most, right after the measure table intro; a page with none says nothing', () => {
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const view = hospitalView(inputs(h));
    const sentence = largestSentence(view);
    assert.ok(sentence, `${h.ccn}: a synthetic case with a largest measure`);
    const text = render(h);
    const intro = text.indexOf(esc("CMS’s published value and z‑score for each measure."));
    assert.ok(intro > 0);
    assert.equal(text.indexOf(`<p>${esc(sentence)}</p>`), text.indexOf('</p>', intro) + 5, `${h.ccn}: directly after the intro`);
  }
  for (const h of [CASES.noScore, CASES.yesNoScore]) assert.doesNotMatch(render(h), /added the most/);
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

test('the measure table has a Notes column only when some measure has a note, wide only for prose notes', () => {
  const table = (h) => {
    const text = hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
    return /<table class="gb gb--measures[^"]*"[^>]*>[\s\S]*?<\/table>/.exec(text)[0];
  };
  for (const h of Object.values(CASES)) {
    const t = table(h);
    const heads = (/<thead>[\s\S]*?<\/thead>/.exec(t)[0].match(/<th /g) ?? []).length;
    for (const row of t.match(/<tbody>[\s\S]*<\/tbody>/)[0].split('</tr>').slice(0, -1)) {
      assert.equal((row.match(/<t[hd] /g) ?? []).length, heads, `${h.ccn}: every row has a cell per column`);
    }
    const notes = /<td class="notes">/.test(t);
    assert.equal(t.includes('>Notes</th>'), notes, `${h.ccn}: Notes column iff a note`);
    if (/class="gb gb--measures gb--notes"/.test(t)) assert.match(t, /<td class="notes"><p>/, `${h.ccn}: wide only for prose`);
  }
  // The unscored measure's footnote makes a prose note; the yes case has only estimate tags, so its column stays narrow.
  assert.match(table(CASES.no), /class="gb gb--measures gb--notes"/);
  assert.match(table(CASES.yes), /class="gb gb--measures" aria-labelledby="measures-h">/, 'named by its section heading');
});

test('the top: the record card (title bar, numbered fields from the name) beside the verdict (stamp, summary), before the notes', () => {
  for (const h of Object.values(CASES)) {
    const text = render(h);
    assert.match(text, /<article class="wrap page page--article hosp">\n<div class="hosp__top hosp__top--e">\n<div class="form hosp__id">\n<p class="form__title"><span>Hospital record · FY2026<\/span><span>CCN 99\d{4}<\/span><\/p>/, h.ccn);
    const card = /<div class="form hosp__id">[\s\S]*?\n<\/div>\n<section/.exec(text)[0];
    const numbers = [...card.matchAll(/<span class="field__no">(\d+)<\/span>([^<]+)</g)].map((m) => [Number(m[1]), m[2]]);
    assert.deepEqual(numbers.map(([n]) => n), numbers.map((_, i) => i + 1), `${h.ccn}: numbered in order`);
    assert.deepEqual(numbers.slice(0, 2).map(([, label]) => label), ['Hospital', 'Location']);
    assert.ok(numbers.some(([, l]) => l === 'Total HAC Score') && numbers.some(([, l]) => l === 'Payment reduction'), h.ccn);
    assert.ok(text.indexOf('class="hosp__verdict"') < text.indexOf('<div class="prose">'), h.ccn);
    assert.match(text, /<section class="hosp__verdict" aria-label="Score and payment decision">\n<p class="stamp[^"]*">/, `${h.ccn}: the verdict keeps the hero's name`);
    assert.ok(text.indexOf('For fiscal year') > text.indexOf('class="hosp__verdict"') && text.indexOf('For fiscal year') < text.indexOf('<div class="prose">'), `${h.ccn}: the summary in the verdict`);
  }
});

test("the score field names CMS's line, from CMS's text, under a scored hospital's number; not for Maryland or no score", () => {
  const line = `CMS’s line: between <span class="nw">${BOUNDARY.highestNo} and ${BOUNDARY.lowestYes}</span>`;
  for (const h of [CASES.yes, CASES.no]) assert.ok(render(h).includes(`As CMS reports it<br>${line}`), h.ccn);
  for (const h of [CASES.maryland, CASES.noScore, CASES.yesNoScore]) assert.ok(!render(h).includes(line), h.ccn);
});

test('the numbers card: CMS\'s line for a scored hospital, the distance for a Yes or No; none without a score', () => {
  const card = (h) => /<div class="form hosp__nums">[\s\S]*?\n<\/div>/.exec(render(h))?.[0] ?? null;
  assert.match(card(CASES.yes), /CMS’s line<\/p>\n<p class="field__value field__value--sm">between <span class="nw">0\.2500 and 0\.2507<\/span><\/p>/);
  assert.match(card(CASES.yes), /Distance to the line<\/p>\n<p class="field__value">0\.0500<\/p>\n<div class="field__note">Above 0\.2500; this site recomputes<\/div>/);
  assert.match(card(CASES.no), /Below 0\.2507; this site recomputes/);
  assert.doesNotMatch(card(CASES.maryland), /Distance/);
  assert.match(card(CASES.maryland), /Maryland’s hospitals are scored but not subject to the reduction\./);
  assert.equal(card(CASES.noScore), null);
  assert.equal(card(CASES.yesNoScore), null);
});

test('a page with a score says, beside the record, that the score is not a grade; a page with none says nothing of it', () => {
  for (const h of Object.values(CASES)) {
    const text = render(h);
    if (h.total === null) {
      assert.doesNotMatch(text, /not a grade/, h.ccn);
      continue;
    }
    const verdict = /<section class="hosp__verdict"[\s\S]*?<\/section>/.exec(text)[0];
    assert.match(verdict, /<p class="hosp__note">The score is not a grade of the quality of care\.<\/p>/, h.ccn);
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
  const text = hospitalPage({ view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  const list = /<dl class="asof__list">([\s\S]*?)<\/dl>/.exec(text)[1];
  const rows = [...list.matchAll(/<div><dt>(.*?)<\/dt><dd>(.*?)<\/dd><\/div>/g)].map(([, dt, dd]) => [dt.replace(/<[^>]+>/g, ''), dd.replace(/<[^>]+>/g, '')]);
  const fy = String(DATA.fy);
  assert.deepEqual(rows.map(([dt]) => dt), ['Fiscal year', 'PSI 90 period', 'Infection measures period', 'Latest public hospital results', 'Provider Data Catalog release']);
  assert.equal(rows[0][1], fy);
  assert.equal(rows[3][1], `FY${fy}; FY${DATA.fy + 1} expected early ${DATA.fy + 1}`);
  assert.equal(rows[4][1], cmsText(isoDateOf(DATA.source.pdcReleased)));
  assert.match(list, /<dd><span class="nw">[^<]+<\/span> to <span class="nw">[^<]+<\/span><\/dd>/, 'each period date whole');
});

test("a hospital page's verdict names the data's release; its foot runs back link, as-of, footnotes, data links, citation, with the source said once", () => {
  const text = hospitalPage({ view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  // Each part with the separator before it (glued to the part), so no line ends on a separator; the release part may
  // wrap, its date kept whole.
  assert.ok(text.includes(`<p class="small muted">Data: CMS, released <span class="nw">${cmsText(isoDateOf(DATA.source.pdcReleased))}</span></p>\n</section>`), 'the release under the verdict');
  const at = (s) => text.indexOf(s);
  const order = ['class="page__links"', 'class="asof"', 'id="fn-h"', 'class="data-links"', 'id="cite-h"'].map(at);
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `foot order ${order}`);
  assert.equal(text.split('Source: CMS Provider Data Catalog').length - 1, 1 + (text.match(/class="source fig__source"/g) ?? []).length, 'the citation and each figure say the source; no extra source line');
  const landing = DATA.source.landingPage.replace(/[.?]/g, '\\$&');
  assert.match(text, new RegExp(`<a href="${landing}">CMS’s dataset page</a></p>`), 'an absolute link prints its own href');
  // On paper the way back prints its full address (print.css).
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
  const hosp = hospitalPage({ view, source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  assert.match(/<header class="topbar">[\s\S]*?<\/header>/.exec(hosp)[0], /data-nav="hospitals" aria-current="true"/);
});

test('the record card: Type from the master in the site\'s words, Care Compare\'s stars or CMS\'s words, and a state map, its geocoder credited in the data list', () => {
  const profile = { zip: '35000', lat: 32.4, lon: -86.3, geo: 'zip', teach: 'major', beds: 1234, own: 'Government', urban: true, types: ['RRC', 'SCH'] };
  const page = (overrides, careCompare = null, state = 'AL') => hospitalPage({
    view: hospitalView(inputs(CASES.no, { master: master('990002', { state, ...profile, ...overrides }), careCompare })),
    source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES, shapes: DATA.shapes, careSource: DATA.careCompareSource, masterFy: 2027,
  });
  const text = page({}, { rating: '4', footnotes: [] });
  assert.ok(text.includes('<p class="field__value field__value--sm">Major teaching · 1,234 beds · Government · Urban · Rural referral center · Sole community hospital</p>'));
  assert.ok(text.includes('Teaching, urban and special status: CMS’s FY2027 IPPS impact file.'));
  assert.ok(text.includes('<p class="field__value">Exampleton, AL 35000</p>\n<div class="field__note">Example County</div>'));
  assert.match(text, /<span class="stars" aria-hidden="true">★★★★<span class="stars__off">☆<\/span><\/span><span class="vh">4 of 5 stars<\/span>/);
  assert.match(text, /href="https:\/\/www\.medicare\.gov\/care-compare\/details\/hospital\/990002" target="_blank" rel="noopener">Open on Care Compare/);
  assert.match(text, /<span class="geo geo--e"><svg class="chart chart--state-map"[^>]*aria-label="Map of Alabama with this hospital’s location marked"/);
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
  assert.doesNotMatch(page({ teach: null, beds: null, own: null, urban: null, types: [] }), />Type</);
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

test('map placements: e in the Hospital field, f in Location, g a postmark on the card, h beside the stamp, i a numbers cell, j a watermark; e the default', () => {
  const page = (mapPlacement, h = CASES.yes) => hospitalPage({ view: hospitalView(inputs(h, { master: master(h.ccn, { lat: 32.4, lon: -86.3, geo: 'address' }) })), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES, shapes: DATA.shapes, mapPlacement });
  assert.equal(MAP_PLACEMENT, 'e');
  assert.deepEqual([...MAP_PLACEMENTS], ['e', 'f', 'g', 'h', 'i', 'j']);
  const card = (text) => /<div class="form hosp__id">[\s\S]*?\n<\/div>\n<section/.exec(text)[0];
  const verdict = (text) => /<section class="hosp__verdict"[\s\S]*?<\/section>/.exec(text)[0];
  for (const p of MAP_PLACEMENTS) {
    const text = page(p);
    assert.match(text, new RegExp(`<div class="hosp__top hosp__top--${p}">`));
    assert.equal(text.split('chart--state-map').length, 2, `${p}: one map`);
    assert.match(text, new RegExp(`<span class="geo geo--${p}"><svg class="chart chart--state-map"`), p);
    assert.equal(card(text).includes('chart--state-map'), 'efgj'.includes(p), `${p}: in the card or not`);
  }
  // e: beside the h1, never inside it (the heading's name stays the hospital's).
  assert.match(page('e'), /<div class="field__row"><h1 class="field__value hosp__name">[^<]*<\/h1><span class="geo geo--e">/);
  assert.match(page('f'), /Location<\/p>\n<div class="field__row"><p class="field__value">[^]*?<\/p><span class="geo geo--f">/);
  assert.match(page('g'), /<div class="postmark"><svg class="postmark__waves"[^>]*aria-hidden="true"[^]*?<span class="postmark__ring"><span class="geo geo--g">[^]*?<span class="postmark__code">AL<\/span>/);
  assert.match(verdict(page('h')), /<div class="hosp__stamprow"><p class="stamp">[^<]*<\/p><span class="geo geo--h">/);
  assert.match(verdict(page('i')), /<div class="form hosp__nums hosp__nums--map">[^]*?<span class="field__no">C<\/span>On the map<\/p>\n<div class="field__value hosp__map-cell"><span class="geo geo--i">/);
  // i with no score: the map is the card's only cell.
  assert.match(page('i', CASES.noScore), /<div class="form hosp__nums hosp__nums--map">\n<div class="field">\n<p class="field__label"><span class="field__no">A<\/span>On the map/);
  assert.match(card(page('j')), /^<div class="form hosp__id">\n<div class="hosp__wm"><span class="geo geo--j">/);
  // The dot grows as the map shrinks.
  const dotR = (text) => Number(/class="chart-geo-dot"[^>]*r="([\d.]+)"/.exec(text)[1]);
  assert.ok(dotR(page('f')) > dotR(page('j')));
  assert.throws(() => page('a'), /placement "a"/);
});

test('previews: a preview build writes each sample hospital in each placement under /preview/, noindex, canonical to the real page, with an index; production writes none', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, undefined, { data: SLICE });
    const index = read(dir, '/preview/');
    assert.ok(index.includes(NOINDEX));
    const links = [...index.matchAll(/href="(\/preview\/map-([e-j])\/hacrp\/hospital\/(\w+)\/)"/g)];
    assert.ok(links.length >= MAP_PLACEMENTS.length * 3 && links.length % MAP_PLACEMENTS.length === 0, `${links.length} links`);
    assert.doesNotMatch(index, /map-[a-d]\//);
    for (const [, path, placement, ccn] of links) {
      const text = read(dir, path);
      assert.ok(text.includes(NOINDEX), path);
      assert.ok(text.includes(`<link rel="canonical" href="https://paidandpenalized.org/hacrp/hospital/${ccn}/">`), path);
      assert.ok(text.includes(`hosp__top--${placement}`), path);
      assert.ok(!ctx.indexable.includes(path));
    }
    const prod = join(dir, 'prod');
    await generate(prod, 'production', { data: SLICE, released: true });
    assert.throws(() => readdirSync(join(prod, 'preview')), /ENOENT/);
  }));

test('a section whose words explain a figure splits: the measures and Figure 1 on a hospital page, the counts and the histogram on the program page', () => {
  const scored = render(CASES.yes);
  assert.match(scored, /<section class="block split" aria-labelledby="measures-h">\n<div class="split__text">\n<h2 id="measures-h">The measures<\/h2>[\s\S]*?<\/table><\/div><\/div>\n<\/div>\n<div class="split__fig">\n<figure class="fig" id="figure-1"/);
  // No figure (no score): the measures stay one plain section.
  assert.match(render(CASES.noScore), /<section class="block" aria-labelledby="measures-h">\n<h2 id="measures-h">/);
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
