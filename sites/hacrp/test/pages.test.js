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
    assert.equal(ctx.pages, DATA.hospitals.length + 1);
    assert.equal(readdirSync(join(dir, 'hacrp', 'hospital')).length, DATA.hospitals.length);

    const pages = new Map([['/hacrp/', read(dir, '/hacrp/')], ...DATA.hospitals.map((h) => [hospitalPath(h), read(dir, hospitalPath(h))])]);
    const page = (h) => pages.get(hospitalPath(h));
    const cmsCell = /class="[^"]*\bcms\b[^"]*"[^>]*>([^<]*)</g;
    for (const [path, text] of pages) {
      assert.equal(text.match(/<h1[\s>]/g)?.length, 1, `${path}: one h1`);
      const cells = [...text.matchAll(cmsCell)];
      // Twelve measure cells, and the score in the hero when CMS published one.
      if (path !== '/hacrp/') assert.ok(cells.length >= (text.includes('class="hero__num') ? 13 : 12), `${path}: CMS cells found`);
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
    assert.deepEqual(ctx.indexable, ['/hacrp/', ...scored]);
    assert.ok(!pages.get('/hacrp/').includes(NOINDEX));

    const maryland = page(pick((h) => h.paymentReduction === 'N/A' && h.paymentReductionFootnote === 'a', 'Maryland'));
    assert.ok(maryland.includes(esc(FN('a'))), 'footnote a text');
    assert.ok(maryland.includes('pill--na'));
    assert.doesNotMatch(maryland, /distance to CMS/);
    assert.doesNotMatch(maryland, /CMS(&#39;|')s value:/, 'the pill already reads CMS\'s value');
    assert.match(maryland, /pill--na">N\/A</);

    const yesNoScoreRow = pick((h) => h.total === null && h.paymentReduction === 'Yes', 'Yes with no score');
    const yesNoScore = page(yesNoScoreRow);
    assert.doesNotMatch(yesNoScore, /CMS(&#39;|')s value:/, 'the pill already reads CMS\'s value');
    assert.match(yesNoScore, /pill--pen">Yes</);
    assert.doesNotMatch(yesNoScore, /hero__num/);
    assert.match(yesNoScore, /<p class="hero__none"><span>No score published<\/span><\/p>/);
    assert.doesNotMatch(yesNoScore, /% cut/);
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
    assert.ok(yes.includes(esc("CMS's value: Yes")));
    assert.doesNotMatch(yes, /No score published|hero__none/);
    assert.match(yes, /<section class="block whatif" id="whatif"/);
    assert.match(yes, /class="hero__num cms">\S+</);
    assert.match(yes, /"isBasedOn":"https:\/\/data\.cms\.gov\/provider-data\/dataset\/yq43-i98g"/);
    const no = page(pick((h) => h.total !== null && h.paymentReduction === 'No', 'scored No'));
    assert.match(no, /class="pill">No cut</);
    assert.ok(no.includes(esc("CMS's value: No")));

    // The distance sentence quotes CMS's own text for the boundary scores.
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
    assert.ok(program.includes(esc("Maryland's hospitals are scored but not subject to the reduction.")));

    assert.ok(pages.get('/hacrp/').includes(`CMS cut Medicare inpatient payments to ${count(cut)} of the ${count(decided.length)} hospitals with a Total HAC Score`));
  }));

test('released: false: every page is noindex in production and the sitemap lists none', () =>
  temp(async (dir) => {
    const out = join(dir, 'dist');
    const hacrp = { ...HACRP, generate: (ctx) => generateHacrp(ctx, { released: false, data: SLICE, log: quiet }) };
    await build({ outDir: out, env: 'production', sites: [hacrp, HUB] });
    for (const h of SLICE.hospitals) assert.ok(read(out, hospitalPath(h)).includes(NOINDEX), hospitalPath(h));
    for (const path of ['/hacrp/', '/', '/methods/']) assert.ok(read(out, path).includes(NOINDEX), path);
    assert.doesNotMatch(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<url>/);
  }));

test('a preview build (no PP_ENV) is noindex everywhere, released or not', () =>
  temp(async (dir) => {
    const ctx = await generate(dir, undefined, { released: true, data: SLICE });
    assert.deepEqual(ctx.indexable, []);
    assert.equal(ctx.pages, SLICE.hospitals.length + 1);
    for (const path of ['/hacrp/', ...SLICE.hospitals.map(hospitalPath)]) assert.ok(read(dir, path).includes(NOINDEX), path);
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
  assert.ok(text.includes(`<h1>${esc(name)}</h1>`));
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
    rows: [[name, 0], ['A', 1]].map(([n, i]) => [views[i].ccn, n, 'Exampleton', 'AL', ['0.3000', 'N/A'][i], ['Yes', 'No'][i]]),
  });
  const text = programPage({
    ...PROGRAM_ARGS, boundaryText: { highestNo: '0.2500', lowestYes: '0.2507' },
    searchUrl: '/assets/hacrp-hospitals.0000abcd.json', robots: 'noindex',
  });
  assert.match(text, /<form class="block search" role="search" aria-label="Find a hospital" data-src="\/assets\/hacrp-hospitals\.0000abcd\.json" hidden>/);
  assert.match(text, /<label class="h-sm" for="hospital-search">Hospital name, city or CCN<\/label>\n<div class="search__row"><input id="hospital-search"[^>]*><button type="submit" class="fig__btn">Search<\/button><\/div>/);
  assert.match(text, /<p class="small search__status" role="status"><\/p>/);
  assert.doesNotMatch(text, /application\/json/);
  assert.match(text, /Among hospitals with a Yes or No payment decision, CMS cut those with a published Total HAC Score of 0\.2507 or higher and none at 0\.2500 or lower\./);
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
    assert.match(text, /<p class="hero__none"><span>No score published<\/span><\/p>/);
    assert.doesNotMatch(text, /hero__num/);
    assert.doesNotMatch(text, /cms">N\/A</);
  }
  const scored = render(CASES.yes);
  assert.match(scored, /class="hero__num cms">0<span class="dp">\.<\/span>3000</, "CMS's text, its point in a span");
  assert.doesNotMatch(scored, /hero__none|No score published/);
});

test('the decision pill and the "CMS\'s value" line: shown under a cut or no-cut pill, skipped when the pill is CMS\'s own text', () => {
  const says = (h) => render(h).includes(esc("CMS's value:"));
  assert.deepEqual([CASES.yes, CASES.no].map(says), [true, true]);
  assert.deepEqual([CASES.maryland, CASES.yesNoScore].map(says), [false, false]);
  assert.match(render(CASES.yesNoScore), /pill--pen">Yes</);
  assert.match(render(CASES.maryland), /pill--na">N\/A</);
});

test('titles and descriptions: the hospital page ends with the site name; both pages describe the program, CMS and the year', () => {
  const text = render(CASES.yes);
  const name = 'Example General Hospital';
  assert.match(text, new RegExp(`<title>${name}, Exampleton, AL: Hospital-Acquired Conditions, FY${DATA.fy} · Paid &amp; Penalized</title>`));
  assert.equal(meta(text, 'description'), esc(`${name} (Exampleton, AL): CMS's FY${DATA.fy} Hospital-Acquired Condition score and payment decision, from public CMS data.`));
  const program = programPage(PROGRAM_ARGS);
  assert.equal(meta(program, 'description'), esc(`How Medicare's Hospital-Acquired Condition Reduction Program works, and CMS's FY${DATA.fy} scores and payment decisions for every hospital in its file.`));
});

test('a scored page says which measure added the most, right after the measure table intro; a page with none says nothing', () => {
  for (const h of [CASES.yes, CASES.no, CASES.maryland]) {
    const view = hospitalView(inputs(h));
    const sentence = largestSentence(view);
    assert.ok(sentence, `${h.ccn}: a synthetic case with a largest measure`);
    const text = render(h);
    const intro = text.indexOf(esc("CMS's published value and z-score for each measure."));
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
  assert.ok(text.includes(esc(`The recompute can differ from CMS's z-score by up to ${psi.maxErrorText}.`)));
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
  assert.match(text, /<section class="block whatif" id="whatif"[^>]*>\n<h2 id="whatif-h">[^<]*<\/h2>\n<p class="cap">Sandbox: a hypothetical/,
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

test('the build writes the sandbox into /hacrp/, its page data saying share false; the search shares the entry', () =>
  temp(async (dir) => {
    await generate(dir, undefined, { data: SLICE });
    const text = read(dir, '/hacrp/');
    assert.match(text, /id="whatif"/);
    assert.ok(text.includes(SANDBOX_LABEL));
    assert.doesNotMatch(text, /data-wi="banner"/);
    const [, json] = /<script type="application\/json" id="hacrp-program">(.*?)<\/script>/s.exec(text);
    assert.equal(JSON.parse(json).page.share, false);
    const client = readFileSync(join(import.meta.dirname, '..', 'client', 'program.js'), 'utf8');
    assert.match(client, /\.search\[data-src\]/, 'the search stays in the same entry');
  }));

test('the measure table has a Notes column only when some measure has a note, wide only for prose notes', () => {
  const table = (h) => {
    const text = hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
    return /<table class="gb gb--measures[^"]*">[\s\S]*?<\/table>/.exec(text)[0];
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
  assert.match(table(CASES.yes), /class="gb gb--measures">/);
});

test('the hero is the lede: right after the page head, before the summary sentences', () => {
  for (const h of Object.values(CASES)) {
    const text = hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
    assert.match(text, /<\/header>\n<section class="hero"/, h.ccn);
    assert.ok(text.indexOf('class="hero"') < text.indexOf('For fiscal year'), `${h.ccn}: hero before the summary`);
  }
});

test("the hero names CMS's line under a scored hospital's number, from CMS's text; not for Maryland or no score", () => {
  const page = (h) => hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  const line = `<p class="hero__ref">CMS&#39;s line: between ${BOUNDARY.highestNo} and ${BOUNDARY.lowestYes}</p>`;
  for (const h of [CASES.yes, CASES.no]) assert.ok(page(h).includes(line), h.ccn);
  for (const h of [CASES.maryland, CASES.noScore, CASES.yesNoScore]) assert.doesNotMatch(page(h), /hero__ref/, h.ccn);
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

test("a hospital page's head names the data's release; its foot runs back link, as-of, footnotes, data links, citation, with the source said once", () => {
  const text = hospitalPage({ view: hospitalView(inputs(CASES.no)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  assert.match(text, new RegExp(`<p class="place">Exampleton, AL · CCN 990002 · <span class="nw">Data: CMS, released ${cmsText(isoDateOf(DATA.source.pdcReleased))}</span></p>`));
  const at = (s) => text.indexOf(s);
  const order = ['class="page__links"', 'class="asof"', 'id="fn-h"', 'class="data-links"', 'id="cite-h"'].map(at);
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `foot order ${order}`);
  assert.equal(text.split('Source: CMS Provider Data Catalog').length - 1, 1 + (text.match(/class="source fig__source"/g) ?? []).length, 'the citation and each figure say the source; no extra source line');
  assert.match(text, new RegExp(`<a href="${DATA.source.landingPage.replace(/[.?]/g, '\\$&')}">CMS(&#39;|')s dataset page</a></p>`));
});
