// The HACRP figures on the pages: a hospital page's two figures (synthetic hospitals), and the program page's thirteen
// (the pinned model and data): Part 1's five steps on the median hospital, Part 2's picture of the year, and the US
// map. Every takeaway's numbers come from data: each is checked against numbers worked out here from CMS's rows, on the
// pinned file and again on a thinned copy of it, so a number typed into the code would not follow the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidedHospitals, isAssigned } from '../../../engine/js/hacrp/hospital.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { MEASURE_IDS, isSir } from '../../../engine/js/hacrp/measures.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { toUnit } from '../../../engine/js/stats.js';
import { cmsText, count, decimal, isoDate, ordinal, pct } from '../../../web/render/format.js';
import { US_MAP_CODES } from '../../../web/charts/geo.js';
import { CUTOFF_PERCENTILE, REDUCTION_TEXT, SHORT_NAMES, WINSOR_HIGH, WINSOR_LOW } from '../web/constants.js';
import { biggestLever } from '../web/compare.js';
import { csvPath } from '../web/links.js';
import { partsFigure } from '../web/figures.js';
import { counter } from '../../../web/charts/figure.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { buildPlaces } from '../web/places.js';
import { TYPE_KINDS, programData } from '../web/program-data.js';
import { spearman } from '../../../engine/js/stats.js';
import { mapFigure, part1, part2 } from '../web/program-figures.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, CASES, inputs, master } from './fixtures.js';
import { DATA, PAGE_CTX, PD, PLACES, RANGE, SEARCH_URL, VIEWS, renderPlace, renderProgram } from './pinned.js';

const { model, estimate } = DATA;
const MEDIAN = medianHospital(model, { fiscalYear: String(DATA.fy), periods: DATA.periods });
const COUNTS = { decided: PD.counts.decided, yes: PD.counts.yes, scored: PD.counts.scored };

// A hospital page with its what-if (scored hospitals), whose bars are the page's last figure.
const render = (h) => hospitalPage({
  ...PAGE_CTX,
  view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS,
  whatif: h.total === null ? null : { hospital: h, model, estimate, range: RANGE },
});
const PAGE = renderProgram();
const figures = (text) => [...text.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>([\s\S]*?)<\/figure>/g)];
const figureBody = (text, n) => figures(text).find(([, id]) => Number(id) === n)[2];
const drawings = (text) => [...text.matchAll(/<svg[\s\S]*?<\/svg>/g)].reduce((n, [m]) => n + m.length, 0);
// Each figure's [number, takeaway]; the takeaway's non-breaking hyphens (z-score's, a glyph only) read as hyphens.
const captions = (text) => figures(text).map(([, , body]) => /<figcaption class="fig__cap" id="figure-\d+-cap"><span class="fig__n">Figure (\d+)\.<\/span> ([^<]*)<\/figcaption>/.exec(body).slice(1).map((s) => s.replaceAll('‑', '-')));
// Every number written in a sentence: digits with their commas, decimal point and sign.
// Measure short names (PSI 90) are CMS's names, not numbers.
const numbers = (s) => Object.values(SHORT_NAMES).reduce((x, name) => x.replaceAll(name, ''), s.replaceAll('&#39;', "'")).match(/[−+]?\d+(,\d{3})*(\.\d+)?%?/g) ?? [];
// A figure's table, body rows only: each cell's text.
const tableRows = (body) => [...body.slice(body.indexOf('<tbody>')).matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, tr]) => [...tr.matchAll(/<t[dh][^>]*>([^<]*)</g)].map((c) => c[1]));
// The panel takeaways of a figure that shows one measure at a time, by measure.
const panelTakes = (body) => Object.fromEntries([...body.matchAll(/<div class="mpanel" data-measure="(\w+)"[^>]*>\s*<p class="mpanel__take">([^<]*)<\/p>/g)].map((m) => [m[1], m[2]]));

test('a figure\'s source line, the citation and the periods keep each date whole', () => {
  const text = render(CASES.yes);
  const date = isoDate(DATA.source.pdcReleased);
  for (const [, , body] of figures(text)) assert.ok(body.includes(`released <span class="nw">${date}</span>.`), 'figure source line');
  assert.match(text, new RegExp(`<p class="cite__text" data-cite-text>[^\\n]*released <span class="nw">${date}</span>\\.</p>`));
  // The program page: every figure's source line, its citation, the summary form's data windows and payment year, and the as-of strip.
  const found = figures(PAGE);
  assert.equal(found.length, 13);
  for (const [, id, body] of found) assert.ok(body.includes(`released <span class="nw">${date}</span>.`), `figure ${id}: source line`);
  assert.match(PAGE, new RegExp(`<p class="cite__text" data-cite-text>[^\\n]*released <span class="nw">${date}</span>\\.</p>`));
  const range = /<span class="nw">[A-Z][a-z]+ \d+, \d{4}<\/span> to <span class="nw">[A-Z][a-z]+ \d+, \d{4}<\/span>/g;
  const asof = /<dl class="asof__list">([\s\S]*?)<\/dl>/.exec(PAGE)[1];
  assert.equal(asof.match(range).length, 2, 'the as-of strip: both periods');
  const summary = /<div class="form prog__summary">([\s\S]*?)<\/div>\n<p class="stamp">/.exec(PAGE)[1];
  assert.equal(summary.match(range).length, 3, 'the summary form: both data windows and the payment year');
  assert.ok(summary.includes(`CMS data released <span class="nw">${date}</span>`));
});

test('every table in a scroll box carries a label in the page, which names the box when it scrolls (web/client/figure.js)', () => {
  const place = PLACES.places.get('state:oh') ?? PLACES.list.find((p) => p.kind === 'state' && p.children.length > 0);
  const metro = PLACES.list.find((p) => p.kind === 'metro' && p.stateCodes.length > 1);
  for (const text of [PAGE, render(CASES.yes), render(CASES.maryland), renderPlace(place), renderPlace(metro)]) {
    const tables = [...text.matchAll(/<div class="printout__scroll"><table([^>]*)>\n(?:<caption[^>]*id="([^"]+)")?/g)];
    assert.ok(tables.length >= 3);
    for (const [, attrs, captionId] of tables) {
      const id = /aria-labelledby="([^"]+)"/.exec(attrs)?.[1] ?? captionId;
      assert.ok(id, `a table with no label: ${attrs}`);
      assert.ok(text.includes(`id="${id}"`), `no element with id ${id}`);
    }
  }
  // The program page has every figure's table, the sandbox's, the hospitals' and no other.
  const labels = [...PAGE.matchAll(/<div class="printout__scroll"><table([^>]*)>/g)].map((m) => /aria-labelledby="([^"]+)"/.exec(m[1])?.[1] ?? 'caption');
  assert.equal(labels.filter((l) => /^figure-\d+-cap$/.test(l)).length, 13);
});

test('the program page numbers its figures 1 to 13, each once, from the data\'s five steps through the year to the map', () => {
  const numbersOnPage = figures(PAGE).map(([, id]) => Number(id));
  assert.deepEqual([...numbersOnPage].sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 1));
  assert.deepEqual(captions(PAGE).map(([n]) => Number(n)).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 1), 'a caption says its figure\'s number');
  // The keyboard hint for the map is named by its figure.
  assert.match(PAGE, /<p id="figure-13-keys" hidden>/);
});

test('Part 1 walks the formula in five steps, each beside its own figure, then the sandbox; its method numbers come from the constants', () => {
  const part = /<section class="part" id="how"[\s\S]*?<\/section>\n<section class="part" id="fy"/.exec(PAGE)[0];
  for (let n = 1; n <= 5; n++) {
    const step = new RegExp(`<section class="step" id="step-${n}" aria-labelledby="step-${n}-h">\\n<div class="step__text">\\n<p class="step__n" aria-hidden="true">${n}</p>[\\s\\S]*?</div>\\n<div class="step__fig">\\n<figure class="fig" id="figure-${n}" data-figure>`).exec(part);
    assert.ok(step, `step ${n}: its words beside figure ${n}`);
  }
  // The sandbox is the step after them, on the median hospital.
  assert.ok(part.indexOf('id="step-5"') < part.indexOf('id="step-6"') && part.indexOf('id="step-6"') < part.indexOf('id="whatif"'));
  assert.match(part, /id="step-6"[^>]*>6</, 'numbered 6');
  assert.equal([...part.matchAll(/id="whatif"/g)].length, 1);
  // The first step: how many measures, how many are infections, and the data windows, all from the engine's list and CMS's file.
  assert.ok(part.includes(`CMS scores hospitals on ${MEASURE_IDS.length} measures`));
  assert.ok(part.includes(`The measures are ${MEASURE_IDS.filter(isSir).length} kinds of infection and a patient-safety composite called ${SHORT_NAMES.PSI90}.`));
  const window = (period) => `<span class="nw">${isoShort(period.start)}</span> to <span class="nw">${isoShort(period.end)}</span>`;
  assert.ok(part.includes(`This year’s data cover ${window(DATA.periods.psi90)} for ${SHORT_NAMES.PSI90}, and ${window(DATA.periods.hai)} for infections.`));
  // The constants CMS publishes: the winsorizing percentiles, the cutoff percentile and the size of the cut.
  assert.ok(part.includes(`floor at the ${ordinal(WINSOR_LOW)} percentile of each measure’s results and a cap at the ${ordinal(WINSOR_HIGH)}`));
  assert.ok(part.includes(`above the ${ordinal(CUTOFF_PERCENTILE)} percentile of the scores of hospitals outside Maryland. A hospital it cuts is paid ${REDUCTION_TEXT} less`));
});
// A period's date as the page's prose writes it (a short month, no leading zero).
function isoShort(mmddyyyy) {
  const [m, d, y] = mmddyyyy.split('/').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}, ${y}`;
}

test('the measure figures (2, 3, 4) tabulate each measure from CMS\'s published values and the model\'s fitted numbers', () => {
  const fmt = (id) => (v) => decimal(v, model.params[id].decimals);
  const published = (id) => DATA.hospitals.map((h) => h.measures[id].value).filter((v) => v !== null);
  // Figure 2: how many have a value, how many are at zero, the national median, how many are above one.
  assert.deepEqual(tableRows(figureBody(PAGE, 2)), MEASURE_IDS.map((id) => {
    const v = published(id);
    return [SHORT_NAMES[id], count(v.length), count(v.filter((x) => x === 0).length), fmt(id)(medianAt(model.params[id])), count(v.filter((x) => x > 1).length)];
  }));
  // Figure 3: the floor and cap, and how many published values sit at or past each.
  assert.deepEqual(tableRows(figureBody(PAGE, 3)), MEASURE_IDS.map((id) => {
    const p = model.params[id];
    const v = published(id);
    return [SHORT_NAMES[id], fmt(id)(p.floor), fmt(id)(p.cap), count(v.filter((x) => x <= p.floor).length), count(v.filter((x) => x >= p.cap).length)];
  }));
  // Figure 4: the floor, cap, mean and standard deviation the model fits to CMS's z-scores.
  assert.deepEqual(tableRows(figureBody(PAGE, 4)), MEASURE_IDS.map((id) => {
    const p = model.params[id];
    return [SHORT_NAMES[id], fmt(id)(p.floor), fmt(id)(p.cap), fmt(id)(p.mean), fmt(id)(p.sd)];
  }));
  // Only the first measure's drawings are in the page; the others come from the explore asset, so each panel says so.
  for (const n of [2, 3, 4]) {
    const body = figureBody(PAGE, n);
    assert.equal((body.match(/<div class="mpanel"/g) ?? []).length, MEASURE_IDS.length, `figure ${n}: one panel per measure`);
    assert.equal((body.match(/<div class="mpanel"[^>]* data-lazy/g) ?? []).length, MEASURE_IDS.length - 1, `figure ${n}: the others are drawn by the page script`);
    assert.equal(Object.keys(panelTakes(body)).length, MEASURE_IDS.length, `figure ${n}: each says what it shows`);
  }
});

test('the median hospital\'s worksheet under the slide rule: its z-scores, their mean and the Total HAC Score, from medianHospital and the model', () => {
  const ws = /<div class="ws ws--prog"[\s\S]*?<\/div>/.exec(figureBody(PAGE, 4))[0];
  const terms = [...ws.matchAll(/<span class="ws__v">([^<]*)<\/span><span class="ws__k">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);
  const zs = MEASURE_IDS.map((id) => MEDIAN.measures[id].z);
  // Each z-score as CMS prints it at four decimals (the first signed, the rest after their + or −), then the count and the total.
  assert.deepEqual(terms.slice(0, MEASURE_IDS.length).map(([, k]) => k), MEASURE_IDS.map((id) => SHORT_NAMES[id]));
  assert.deepEqual(terms.slice(0, MEASURE_IDS.length).map(([v], i) => (i ? v : v.replace('−', '-'))), zs.map((z, i) => decimal(i ? Math.abs(z) : z, 4).replace('−', '-')));
  assert.equal(terms[MEASURE_IDS.length][0], String(MEASURE_IDS.length));
  assert.equal(terms.at(-1)[0], cmsText(MEDIAN.totalText));
  const operators = [...ws.matchAll(/<span class="ws__op">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(operators.slice(0, MEASURE_IDS.length - 1), zs.slice(1).map((z) => (z < 0 ? '−' : '+')));
  // The total is the mean of the z-scores, to the rounding of four-decimal figures.
  assert.ok(Math.abs(zs.reduce((a, b) => a + b, 0) / zs.length - MEDIAN.total) <= 1e-4);
  // The median hospital sits at each measure's median value.
  for (const id of MEASURE_IDS) assert.equal(MEDIAN.measures[id].value, medianAt(model.params[id]));
  assert.equal(MEDIAN.paymentReduction, 'No', 'the pinned median hospital sits below the line');
});

test('the program page\'s swarm (Figure 6): every hospital with a Yes/No decision, CMS\'s line marked, its takeaway and a table that splits at the line', () => {
  const { highestNo, lowestYes } = model.boundary;
  const body = figureBody(PAGE, 6);
  assert.deepEqual(numbers(captions(PAGE).find(([n]) => n === '6')[1]), [count(COUNTS.yes), count(COUNTS.decided), decimal(lowestYes - highestNo, 4)]);
  assert.match(body, /<div class="swarm" data-band="\[[\d.]+,[\d.]+\]"/);
  assert.deepEqual(JSON.parse(/data-band="([^"]+)"/.exec(body)[1]), [Number(DATA.boundaryText.highestNo), Number(DATA.boundaryText.lowestYes)], 'the line is CMS\'s two scores');
  // Both drawings (phone and wide) name the two sides' counts and CMS's two scores, in CMS's own text.
  const svgs = [...body.matchAll(/<svg[^>]*data-fit="(narrow|wide)"[^>]*class="chart chart--swarm"[\s\S]*?<\/svg>/g)];
  assert.deepEqual(svgs.map((s) => s[1]), ['narrow', 'wide']);
  for (const [svg] of svgs) {
    assert.ok(svg.includes(`>Not cut · ${count(COUNTS.decided - COUNTS.yes)}</text>`));
    assert.ok(svg.includes(`>Cut · ${count(COUNTS.yes)}</text>`));
    assert.ok(svg.includes(`>${DATA.boundaryText.highestNo} highest not cut</text>`));
    assert.ok(svg.includes(`>${DATA.boundaryText.lowestYes} lowest cut</text>`));
    assert.match(svg, /class="chart-boundary"/);
  }
  // The table: bins of scores with CMS's line as an edge; the hospitals add up, and a bin says Yes only above the line.
  const rows = tableRows(body).map(([from, to, n, decision]) => ({ from: Number(from.replace('−', '-')), to: Number(to.replace('−', '-')), n: Number(n.replaceAll(',', '')), decision }));
  assert.equal(rows.reduce((s, r) => s + r.n, 0), COUNTS.decided, 'every hospital with a decision is in one bin');
  assert.equal(rows.filter((r) => r.decision === 'Yes').reduce((s, r) => s + r.n, 0), COUNTS.yes);
  assert.equal(rows.filter((r) => r.decision === 'No').reduce((s, r) => s + r.n, 0), COUNTS.decided - COUNTS.yes);
  assert.ok(rows.filter((r) => r.n).every((r) => r.decision === (r.from >= lowestYes - 5e-5 ? 'Yes' : 'No')), 'a bin\'s decision follows its side of the line');
  // A bin ends exactly where the next begins (no hospital between them), and the line is one of the edges.
  rows.slice(1).forEach((r, i) => assert.equal(r.from, rows[i].to));
  assert.ok(rows.some((r) => r.from === Number(decimal(lowestYes, 4))), 'the line is a bin edge');
  // The magnifier sits on the line: Maryland's scored hospitals are said not to be shown, with the counts from CMS's file.
  assert.ok(PAGE.includes(`Not shown: Maryland’s ${count(PD.maryland.scored)} scored hospitals. ${count(PD.maryland.above)} of them`));
});

test('the line sentence on the program page is CMS\'s: the gap between its highest No and lowest Yes, named by both, in the summary form', () => {
  const { highestNo, lowestYes } = DATA.boundaryText;
  const summary = /<div class="form prog__summary">([\s\S]*?)<\/div>\n<p class="stamp">/.exec(PAGE)[1];
  assert.match(summary, new RegExp(`<span class="field__no">4</span>CMS’s line</p>\\n<p class="field__value">${lowestYes} and up</p>\\n<div class="field__note">The lowest score CMS cut\\. The highest it did not: ${highestNo}\\.</div>`));
  // The boundary is CMS's, scored hospitals with a decision on each side of it only.
  const decided = decidedHospitals(DATA.hospitals);
  assert.ok(decided.filter((h) => h.paymentReduction === 'Yes').every((h) => h.total >= Number(lowestYes)));
  assert.ok(decided.filter((h) => h.paymentReduction === 'No').every((h) => h.total <= Number(highestNo)));
  assert.equal(Number(highestNo), model.boundary.highestNo);
  assert.equal(Number(lowestYes), model.boundary.lowestYes);
});

test('the US map (Figure 13): hospitals cut of hospitals with a decision, a state a mark; Maryland hatched "not subject to the reduction"; no state drawn as zero', () => {
  const body = figureBody(PAGE, 13);
  assert.match(body, /class="chart chart--us-map"/);
  const mark = (code, fit) => new RegExp(`<g class="chart-mark" data-mark data-state="${code}"([^>]*)><title>([^<]*)</title><path class="([^"]*)"`, 'g').exec(body.slice(body.indexOf(`data-fit="${fit}"`), body.indexOf('</svg>', body.indexOf(`data-fit="${fit}"`))));
  for (const fit of ['narrow', 'wide']) {
    const md = mark('MD', fit);
    assert.equal(md[2], 'Maryland: not subject to the reduction');
    assert.doesNotMatch(md[1], /data-value/, 'no value on a state with none to show');
    assert.match(md[3], /chart-tile-na/);
    assert.equal(mark('PR', fit), null, 'Puerto Rico has no place on the US map');
    // A state with a share: its counts and its share, from the places' own counts, and a value to step the shade by.
    const al = PLACES.places.get('state:al').counts;
    const marked = mark('AL', fit);
    assert.equal(marked[2], `Alabama: ${al.yes} of ${al.decided} cut (${pct(al.yes / al.decided, 1)})`);
    assert.match(marked[1], /data-value="\d/);
    assert.equal(body.slice(body.indexOf(`data-fit="${fit}"`), body.indexOf('</svg>', body.indexOf(`data-fit="${fit}"`))).match(/data-state="/g).length, US_MAP_CODES.length, fit);
  }
  assert.match(body, /<pattern id="chart-states-wide-hatch"/, 'each variant names its own hatch');
  // The table lists every state the places hold, with its counts; Maryland has none with a decision, so its share is a dash.
  const rows = tableRows(body);
  assert.equal(rows.length, PLACES.list.filter((p) => p.kind === 'state').length);
  const md = PLACES.places.get('state:md').counts;
  assert.deepEqual(rows.find(([code]) => code === 'MD'), ['MD', count(md.yes), count(md.decided), '—']);
  assert.equal(md.decided, 0);
  assert.deepEqual(rows.map(([code]) => code), [...rows.map(([code]) => code)].sort(), 'by state code');
  // The wide map also draws every hospital as a dot over the states, and the figure says what the dots mean.
  assert.match(body, /usmap__sw--pen"><\/span>Cut</);
  assert.match(body, /class="chart-dots chart-dots--pen"/);
  assert.ok(PAGE.includes('<p id="figure-13-keys" hidden>Arrow keys step through the states; Enter lists the state’s hospitals in the table below.</p>'));
  const [, takeaway] = captions(PAGE).find(([n]) => n === '13');
  assert.ok(takeaway.includes(pct(COUNTS.yes / COUNTS.decided, 1)));
});

test('a state with no hospitals in CMS\'s file is drawn plain with its reason, never as zero', () => {
  // Places built from every hospital outside one state: that state has no place, so its mark is empty, not a 0% shade.
  const [gone] = PLACES.list.filter((p) => p.kind === 'state' && p.counts.decided > 20);
  const kept = DATA.hospitals.filter((h) => DATA.master.get(h.ccn).state !== gone.key.toUpperCase());
  const pd = programData({ hospitals: kept, master: DATA.master, model });
  const places = buildPlaces({ hospitals: kept, master: DATA.master, rows: pd.rows });
  const body = String(mapFigure({ pd, places, shapes: DATA.shapes, n: 13, source: 's' }));
  const code = gone.key.toUpperCase();
  const empty = new RegExp(`<g class="chart-mark" data-mark data-state="${code}"><title>[^<]*: no hospitals in CMS’s file</title><path class="chart-tile-empty chart-geo-state"`);
  assert.match(body, empty);
  assert.doesNotMatch(body, new RegExp(`data-state="${code}" data-value`));
  assert.equal(tableRows(body).length, PLACES.list.filter((p) => p.kind === 'state').length - 1, 'and it has no row in the table');
});

test('the hospital table section: the controls for client/table.js, the asset, and without JavaScript a sentence and the CSV link', () => {
  const section = /<section class="block hospitals" aria-labelledby="hospitals-h" id="hospitals">([\s\S]*?)<\/section>/.exec(PAGE)[1];
  assert.ok(section.includes(`<a href="${csvPath(DATA.fy)}"`));
  assert.equal(csvPath(DATA.fy), `/data/hacrp/fy${DATA.fy}/hacrp-hospitals.csv`);
  assert.match(section, /<p class="ht-nojs">[^<]+<\/p>/);
  assert.ok(section.includes('<p class="ht-retry" role="status"></p>'), 'an empty live region for a failed load (client/table.js)');
  assert.match(section, new RegExp(`<div class="ht" data-src="${SEARCH_URL.replaceAll('.', '\\.')}" hidden>`), 'every hospital: no data-area');
  assert.match(section, /<select id="ht-state">/);
  assert.match(section, /<input id="ht-name" type="search"/);
  assert.match(section, /aria-live="polite"/);
  assert.match(section, /<tbody><\/tbody>/, 'no hospital row in the page: the script fills them');
  for (const key of ['name', 'city', 'state', 'score', 'decision']) assert.match(section, new RegExp(`<th scope="col" data-key="${key}"${key === 'state' ? ' aria-sort="ascending"' : ''}${key === 'score' ? ' class="num"' : ''}><button type="button" class="fig__sort">`));
  // No hospital is listed in the page's words: a CCN anywhere outside the drawings and the figures' tables would be one.
  const words = PAGE.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<details class="fig__table">[\s\S]*?<\/details>/g, '');
  const ccns = new Set(DATA.hospitals.map((h) => h.ccn));
  assert.deepEqual([...words.matchAll(/\b\d{6}\b/g)].map((m) => m[0]).filter((c) => ccns.has(c)), [], 'no hospital list inlined');
  // The weight of the page: its drawings (about 630 kB of inline SVG) and, besides them, its words and tables (about 120 kB).
  assert.ok(drawings(PAGE) < 800_000, `the drawings stay thinned (${drawings(PAGE)} bytes)`);
  assert.ok(PAGE.length - drawings(PAGE) < 160_000, `the program page stays small (${PAGE.length - drawings(PAGE)} bytes besides its drawings)`);
});

// ---------- every takeaway's numbers ----------

// The numbers each figure's takeaway should hold, worked out from CMS's rows alone (not from programData): by figure.
function expectedNumbers(hospitals) {
  const six = String(MEASURE_IDS.length);
  const decided = decidedHospitals(hospitals);
  const yes = decided.filter((h) => h.paymentReduction === 'Yes');
  const scoredOn = (h) => MEASURE_IDS.filter((id) => h.measures[id].z !== null);
  const sd = (xs) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); };
  const spread = (k) => sd(decided.filter((h) => scoredOn(h).length === k).map((h) => h.total));
  // Figure 7: the share cut in each group of hospital, from the master.
  const shares = TYPE_KINDS.flatMap(([, groups]) => groups.map(([, test]) => {
    const members = decided.filter((h) => test(DATA.master.get(h.ccn)));
    return members.length ? members.filter((h) => h.paymentReduction === 'Yes').length / members.length : null;
  })).filter((s) => s !== null);
  // Figure 9: the two pairs of measures that agree most.
  const rho = [];
  for (let i = 0; i < MEASURE_IDS.length; i++) {
    for (let j = i + 1; j < MEASURE_IDS.length; j++) {
      const both = hospitals.filter((h) => h.measures[MEASURE_IDS[i]].value !== null && h.measures[MEASURE_IDS[j]].value !== null);
      rho.push(spearman(both.map((h) => h.measures[MEASURE_IDS[i]].value), both.map((h) => h.measures[MEASURE_IDS[j]].value)));
    }
  }
  rho.sort((a, b) => b - a);
  // Figure 11: cut hospitals that one measure at the national median would have put at or under CMS's highest No.
  const escaped = yes.filter((h) => { const lever = biggestLever(h, model); return lever && lever.after <= model.boundary.highestNo; }).length;
  // Figure 10 (in the words beside Figure 11): the measure with the largest z-score, for each cut hospital.
  const driver = Object.fromEntries(MEASURE_IDS.map((id) => [id, 0]));
  for (const h of yes) driver[MEASURE_IDS.reduce((best, id) => (h.measures[id].z !== null && (best === null || h.measures[id].z > h.measures[best].z) ? id : best), null)] += 1;
  const drive = Object.values(driver).sort((a, b) => b - a);
  // Figure 12: decided hospitals CMS gave its worst score on a measure, those it cut, and those with no measured result.
  const given = decided.filter((h) => MEASURE_IDS.some((id) => isAssigned(h.measures[id])));
  // Figure 13: the share cut by state (the places hold every state and DC), nationally and at each end.
  const byState = new Map();
  for (const h of decided) byState.set(DATA.master.get(h.ccn).state, [...(byState.get(DATA.master.get(h.ccn).state) ?? []), h]);
  const stateShares = [...byState.values()].map((hs) => toUnit((100 * hs.filter((h) => h.paymentReduction === 'Yes').length) / hs.length, 1));
  return {
    1: [count(hospitals.filter((h) => scoredOn(h).length === MEASURE_IDS.length).length), count(hospitals.length), six, count(hospitals.filter((h) => scoredOn(h).length === 1).length), count(hospitals.filter((h) => scoredOn(h).length === 0).length)],
    5: [count(yes.length)],
    6: [count(yes.length), count(decided.length), decimal(model.boundary.lowestYes - model.boundary.highestNo, 4)],
    7: [pct(Math.max(...shares), 0), pct(Math.min(...shares), 0), pct(yes.length / decided.length, 1)],
    8: [decimal(spread(1) / spread(MEASURE_IDS.length), 1), six, decimal(spread(1), 2), decimal(spread(MEASURE_IDS.length), 2)],
    9: [decimal(rho[0], 2), decimal(rho[1], 2)],
    10: [count(drive[0]), count(yes.length), count(drive.at(-1))],
    11: [count(escaped), count(yes.length)],
    12: [count(given.length), count(given.filter((h) => h.paymentReduction === 'Yes').length), count(given.filter((h) => scoredOn(h).every((id) => isAssigned(h.measures[id]))).length)],
    13: [pct(yes.length / decided.length, 1), pct(Math.min(...stateShares) / 100, 1), pct(Math.max(...stateShares) / 100, 1)],
  };
}

// The panels' takeaways for the measures one at a time (Figures 2, 3 and 4), from the published values.
function expectedPanels(hospitals) {
  const out = { 2: {}, 3: {}, 4: {} };
  for (const id of MEASURE_IDS) {
    const p = model.params[id];
    const fmt = (v) => decimal(v, p.decimals);
    const v = hospitals.map((h) => h.measures[id].value).filter((x) => x !== null);
    const atCap = count(v.filter((x) => x >= p.cap).length);
    out[2][id] = isSir(id) ? [count(v.filter((x) => x === 0).length), count(v.length), fmt(medianAt(p))] : ['1.0', fmt(medianAt(p)), count(v.filter((x) => x > 1).length), count(v.length), '1.0'];
    out[3][id] = p.floor > 0 ? [atCap, fmt(p.cap), fmt(p.cap), count(v.filter((x) => x <= p.floor).length), fmt(p.floor), fmt(p.floor)] : [atCap, fmt(p.cap), fmt(p.cap)];
    out[4][id] = [fmt(p.mean), fmt(p.sd)];
  }
  return out;
}

// Part 1, Part 2 and the map, drawn from a list of CMS's rows alone.
function drawFrom(hospitals) {
  const pd = programData({ hospitals, master: DATA.master, model });
  const places = buildPlaces({ hospitals, master: DATA.master, rows: pd.rows });
  const figure = counter();
  return String(part1({ pd, model, periods: DATA.periods, median: MEDIAN, source: 's', figure, step: counter() })) + String(part2({ pd, model, source: 's', figure })) + String(mapFigure({ pd, places, shapes: DATA.shapes, n: figure(), source: 's' }));
}

test('no figure takeaway holds a hand-typed number: every number in it comes from the data it was built from', () => {
  // The same checks run on the pinned file and on a copy with every third hospital left out: change the data and every
  // number in every takeaway changes with it, to the number worked out here from the rows alone.
  const thinned = DATA.hospitals.filter((_, i) => i % 3 !== 0);
  const drawn = [DATA.hospitals, thinned].map((hospitals) => {
    const text = drawFrom(hospitals);
    const takeaways = Object.fromEntries(captions(text).map(([n, t]) => [Number(n), numbers(t)]));
    const expected = expectedNumbers(hospitals);
    for (const [n, list] of Object.entries(expected)) assert.deepEqual(takeaways[n], list, `Figure ${n}${hospitals === thinned ? ' (thinned data)' : ''}`);
    // The figures that show one measure at a time say the same of each, in their panels.
    const panels = expectedPanels(hospitals);
    for (const n of [2, 3, 4]) {
      const found = panelTakes(figureBody(text, n));
      for (const id of MEASURE_IDS) assert.deepEqual(numbers(found[id]), panels[n][id], `Figure ${n}, ${id}${hospitals === thinned ? ' (thinned data)' : ''}`);
    }
    return takeaways;
  });
  // And they are different numbers: nothing in a takeaway with a number in it stayed put when the data changed.
  for (const n of Object.keys(expectedNumbers(DATA.hospitals))) assert.notDeepEqual(drawn[0][n], drawn[1][n], `Figure ${n}: its numbers follow the data`);
});

test('hostile names stay text in the hospital page\'s figures', () => {
  const name = '<img src=x onerror=alert(1)> & "Sons"';
  const view = hospitalView(inputs(CASES.yes, { master: master(CASES.yes.ccn, { name }) }));
  const text = hospitalPage({ ...PAGE_CTX, view, source: DATA.source, robots: null, assets: ASSETS });
  assert.ok(!text.includes('<img src=x'));
  for (const [, , body] of figures(text)) assert.ok(!body.includes(name));
});

test('partsFigure: plotted values all in its table (figure() checks), CSV name per hospital', () => {
  const view = hospitalView(inputs(CASES.yes));
  assert.ok(String(partsFigure(view, 1, 's')).includes(`data-figure-csv="hacrp-fy${DATA.fy}-990001-parts.csv"`));
});

test('Figure 1\'s bars, table and takeaway carry the same text for each part (one rounding)', () => {
  // Every pinned scored hospital: some parts sit on a rounding tie that two roundings would split.
  for (const [i, view] of VIEWS.filter((v) => v.scored).entries()) {
    const fig = String(partsFigure(view, 1, 's'));
    for (const m of view.measures.filter((x) => x.contribution !== null)) {
      assert.ok(fig.includes(`>${m.contributionText}</text>`), `scored row ${i} ${m.id}: bar label`);
      assert.ok(fig.includes(`data-value="${Number(m.contributionText.replace('−', '-'))}">${m.contributionText}</td>`), `scored row ${i} ${m.id}: table`);
      assert.equal(m.contributionRaw, Number(m.contributionText.replace('−', '-')), `scored row ${i} ${m.id}: the view’s number is its text’s`);
    }
  }
});

