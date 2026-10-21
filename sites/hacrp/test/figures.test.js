// The HACRP figures on the pages: a hospital page's two figures (synthetic hospitals), and the program page's
// formula stepper on the median hospital, its histogram, its state tile grid and its hospital table section (the
// pinned model and data). Every takeaway's numbers come from data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidedHospitals } from '../../../engine/js/hacrp/hospital.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { clamp, toUnit } from '../../../engine/js/stats.js';
import { cmsText, count, decimal, pct } from '../../../web/render/format.js';
import { TILES } from '../../../web/charts/states.js';
import { SHORT_NAMES } from '../web/constants.js';
import { loadHacrp } from '../web/data.js';
import { scoreRange } from '../web/generate.js';
import { csvPath } from '../web/links.js';
import { measureRanges, partsFigure, rangeFigure, scoresFigure, stateCounts, statesFigure, stepRows, lineFigure } from '../web/figures.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { programPage } from '../web/pages/program.js';
import { hospitalView } from '../web/view.js';
import { CASES, esc, inputs, master } from './fixtures.js';

const DATA = loadHacrp();
const { model, estimate } = DATA;
const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js', figure: '/assets/figure.test.js', 'hacrp-program': '/assets/hacrp-program.test.js', 'hacrp-hospital': '/assets/hacrp-hospital.test.js' } };
const RANGES = measureRanges(model);
const RANGE = scoreRange(DATA.hospitals);
const MEDIAN = medianHospital(model, { fiscalYear: String(DATA.fy), periods: DATA.periods });
const SCORES = decidedHospitals(DATA.hospitals).map((h) => ({ total: h.total, yes: h.paymentReduction === 'Yes' }));
const COUNTS = { decided: SCORES.length, yes: SCORES.filter((s) => s.yes).length, scored: DATA.hospitals.filter((h) => h.total !== null).length };
const VIEWS = DATA.hospitals.map((h) => hospitalView({ hospital: h, model, estimate, footnotes: DATA.footnotes, master: DATA.master.get(h.ccn), fy: DATA.fy, periods: DATA.periods, boundaryText: DATA.boundaryText }));
const STATES = stateCounts(VIEWS);

const render = (h) => hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
const program = (overrides = {}) => programPage({
  fy: DATA.fy, counts: COUNTS, boundaryText: DATA.boundaryText, measures: VIEWS[0].measures, periods: DATA.periods,
  searchUrl: '/assets/hacrp-hospitals.0000abcd.json', source: DATA.source, robots: null, assets: ASSETS,
  whatif: { hospital: MEDIAN, model, estimate, range: RANGE }, scores: SCORES, boundary: model.boundary, states: STATES, ...overrides,
});
const figures = (text) => [...text.matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>([\s\S]*?)<\/figure>/g)];
const captions = (text) => figures(text).map(([, , body]) => /<figcaption class="fig__cap"><span class="fig__n">Figure (\d+)\.<\/span> ([^<]*)<\/figcaption>/.exec(body).slice(1));
// Every number written in a sentence: digits with their commas, decimal point and sign.
// Measure short names (PSI 90) are CMS's names, not numbers.
const numbers = (s) => Object.values(SHORT_NAMES).reduce((x, name) => x.replaceAll(name, ''), s.replaceAll('&#39;', "'")).match(/[−+]?\d+(,\d{3})*(\.\d+)?%?/g) ?? [];

test('a scored hospital page has Figure 1 (each measure\'s part) and Figure 2 (each value against the national range), before the what-if', () => {
  const text = render(CASES.yes);
  assert.deepEqual(captions(text).map(([n]) => n), ['1', '2']);
  const [[, part], [, range]] = captions(text);
  const view = hospitalView(inputs(CASES.yes));
  assert.equal(part, esc(`CLABSI added the most to this hospital's Total HAC Score of ${view.score.text} among its measured results: ${view.largest.contributionText}.`));
  assert.match(range, /^Of the 6 measures with a published value, this hospital&#39;s value is above the national median on \d and at or below it on \d\.$/);
  assert.ok(text.indexOf('id="figure-1"') > text.indexOf('gb--measures'));
  // The what-if is not rendered here (no whatif data), so check order against the as-of bar instead.
  assert.ok(text.indexOf('id="figure-2"') < text.indexOf('class="asof'));
  assert.ok(text.includes('<script type="module" src="/assets/figure.test.js"></script>'));
});

test('Figure 1 hatches an assigned measure, says so in its label, and never names it as the largest', () => {
  const text = render(CASES.assignedLargest);
  const [fig] = figures(text);
  assert.match(fig[2], /class="chart-bar-na" fill="url\(#chart-parts-hatch\)"/);
  assert.ok(fig[2].includes('>SSI, assigned</text>'));
  assert.doesNotMatch(captions(text)[0][1], /SSI/);
});

test('Figure 1 with no measured result that adds to the score says what each bar is; one measure gives one bar', () => {
  const text = render(CASES.allAssigned);
  const view = hospitalView(inputs(CASES.allAssigned));
  assert.equal(captions(text)[0][1], esc(`Each bar is one measure's part of this hospital's Total HAC Score of ${view.score.text}: its z-score divided by 2, the number of measures scored.`));
  assert.deepEqual(captions(text).map(([n]) => n), ['1'], 'no Figure 2: no measure has a published value');
  const one = render(CASES.oneMeasure);
  assert.equal(figures(one)[0][2].match(/data-row="/g).length, 1);
  assert.match(captions(one)[1][1], /^This hospital has a published value for one measure, PSI 90, and it is (above|at or below) the national median\.$/);
});

test('Figure 2: a measure with no value has no triangle and says so; its table quotes CMS\'s footnotes', () => {
  const text = render(CASES.no);
  const [, [, , body]] = figures(text);
  assert.equal(body.match(/class="chart-this"/g).length, 5, 'one triangle per published value');
  assert.ok(body.includes('>SSI: no value published</text>'));
  const footnote = hospitalView(inputs(CASES.no)).measures.find((m) => m.id === 'SSI').footnotes[0];
  assert.ok(body.includes(esc(footnote.text)), 'CMS footnote text in the table');
  // The range's ends and median are the model's: CMS's floor and cap and the median at CMS's decimals.
  const r = RANGES.CLABSI;
  assert.deepEqual(r, { floor: model.params.CLABSI.floor, cap: model.params.CLABSI.cap, median: toUnit(model.params.CLABSI.median, model.params.CLABSI.decimals), decimals: 3 });
  assert.ok(body.includes(`<title>National median: ${decimal(r.median, 3)}</title>`));
});

test('no-score pages and the unscored "Yes" row get no figures; Maryland gets both', () => {
  for (const h of [CASES.noScore, CASES.yesNoScore]) {
    const text = hospitalPage({ view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS });
    assert.equal(figures(text).length, 0);
    assert.doesNotMatch(text, /figure\.test\.js/);
  }
  assert.deepEqual(captions(render(CASES.maryland)).map(([n]) => n), ['1', '2']);
  assert.throws(() => hospitalPage({ view: hospitalView(inputs(CASES.yes)), source: DATA.source, robots: null, assets: ASSETS }), /ranges/);
});

test('the program page\'s stepper walks the median hospital with medianHospital\'s numbers and the model\'s', () => {
  const text = program();
  const steps = /<section class="block" aria-labelledby="steps-h">([\s\S]*?)<\/section>/.exec(text)[1];
  assert.ok(steps.includes(esc("so its numbers are this site's, not CMS's")), 'the stepper says its hospital is synthetic');
  const rows = stepRows(MEDIAN, model);
  assert.deepEqual(rows.map((r) => r.id), MEASURE_IDS);
  for (const r of rows) {
    const m = MEDIAN.measures[r.id];
    const p = model.params[r.id];
    assert.equal(r.valueText, cmsText(m.valueText));
    assert.equal(r.zText, cmsText(m.zText));
    assert.equal(r.floorText, decimal(p.floor, p.decimals));
    assert.equal(r.capText, decimal(p.cap, p.decimals));
    assert.equal(r.limitedText, decimal(clamp(m.value, p.floor, p.cap), p.decimals));
    assert.equal(r.meanText, decimal(p.mean, 4));
    assert.equal(r.sdText, decimal(p.sd, 4));
    for (const step of ['value', 'z']) {
      const row = new RegExp(`<tr data-measure="${r.id}" data-step="${step}">([\\s\\S]*?)</tr>`).exec(steps)[1];
      const cells = [...row.matchAll(/<t[dh][^>]*>([^<]*)</g)].map((c) => c[1]);
      assert.deepEqual(cells, step === 'value'
        ? [r.short, r.valueText, r.floorText, r.capText, r.limitedText]
        : [r.short, r.limitedText, r.meanText, r.sdText, r.zText], `${r.id} ${step}`);
    }
  }
  const sum = toUnit(MEASURE_IDS.reduce((t, id) => t + MEDIAN.measures[id].z, 0), 4);
  assert.ok(steps.includes(`add up to ${decimal(sum, 4)}, and ${decimal(sum, 4)} ÷ 6 is ${cmsText(MEDIAN.totalText)}, the Total HAC Score.`));
  // The last step is the ramp: the median hospital against CMS's line, as Figure 1 (hypothetical).
  assert.match(steps, /<figure class="fig" id="figure-1" data-figure>/);
  assert.match(steps, /class="chart chart--ramp"/);
  assert.match(steps, /<span class="pill">Hypothetical<\/span>/);
  assert.equal(captions(steps)[0][1], esc(`This site's hypothetical median hospital scores ${cmsText(MEDIAN.totalText)}, at or below ${DATA.boundaryText.highestNo}, the highest score CMS marked No, so its decision would be No.`));
  assert.equal(MEDIAN.paymentReduction, 'No', 'the pinned median hospital sits below the line');
});

test('the program page\'s histogram: Total HAC Scores of hospitals with a Yes/No decision, the line marked, the brief\'s takeaway', () => {
  const text = program();
  const caps = captions(text);
  assert.deepEqual(caps.map(([n]) => n), ['1', '2', '3']);
  assert.equal(caps[1][1], esc(`CMS cut payments to ${count(COUNTS.yes)} of ${count(COUNTS.decided)} hospitals with a payment decision: those whose Total HAC Score was above its line.`));
  const body = figures(text)[1][2];
  assert.match(body, /class="chart chart--histogram"/);
  assert.match(body, /class="chart-boundary"/);
  const counts = [...body.matchAll(/<g class="chart-mark" data-mark data-value="(\d+)">/g)].map((m) => Number(m[1]));
  assert.equal(counts.reduce((a, b) => a + b, 0), COUNTS.decided, 'every decided hospital in one bin');
  // Bins above the line hold the Yes decisions, the rest the No.
  const yes = scoresFigure({ scores: SCORES, boundary: model.boundary, counts: COUNTS, n: 2, source: 's', fy: DATA.fy });
  assert.ok(String(yes).includes('<td>Yes</td>') && String(yes).includes('<td>No</td>'));
  assert.throws(() => scoresFigure({ scores: [{ total: 1, yes: false }, ...SCORES], boundary: model.boundary, counts: COUNTS, n: 2, source: 's', fy: DATA.fy }), /both/);
});

test('the state tile grid: hospitals cut of hospitals with a decision; Maryland hatched "not subject to the reduction"; no code drawn as zero', () => {
  const text = program();
  const body = figures(text)[2][2];
  assert.match(body, /class="chart chart--tile-map"/);
  const tile = (code) => new RegExp(`<g class="chart-mark" data-mark data-state="${code}"[^>]*>([\\s\\S]*?)</g>`).exec(body);
  assert.match(tile('MD')[0], /<title>MD: not subject to the reduction<\/title>/);
  assert.doesNotMatch(tile('MD')[0], /data-value/);
  assert.match(tile('MD')[1], /chart-tile-na/);
  assert.equal(Object.hasOwn(STATES, 'PR'), false, 'PR has no hospitals in the pinned file');
  assert.match(tile('PR')[0], /<title>PR: no hospitals in CMS(&#39;|')s file<\/title>/);
  const al = STATES.AL;
  assert.match(tile('AL')[0], new RegExp(`<title>AL: ${al.yes} of ${al.decided} hospitals with a payment decision cut \\(${pct(al.yes / al.decided, 1).replace('.', '\\.')}\\)</title>`));
  assert.equal(body.match(/data-state="/g).length, Object.keys(TILES).length);
  // The table lists every tile.
  assert.equal(body.match(/<th scope="row">[A-Z]{2}<\/th>/g).length, Object.keys(TILES).length);
  const [, takeaway] = captions(text)[2];
  assert.match(takeaway, /^Nationally, CMS cut payments to \d+\.\d% of hospitals with a payment decision; by state, the share ran from \d+\.\d% to \d+\.\d%\.$/);
  assert.ok(takeaway.includes(pct(COUNTS.yes / COUNTS.decided, 1)));
});

test('stateCounts counts by the master\'s state; an unknown state code stops the figure', () => {
  const total = Object.values(STATES).reduce((t, s) => t + s.hospitals, 0);
  assert.equal(total, DATA.hospitals.length);
  assert.equal(Object.values(STATES).reduce((t, s) => t + s.decided, 0), COUNTS.decided);
  assert.equal(Object.values(STATES).reduce((t, s) => t + s.yes, 0), COUNTS.yes);
  assert.equal(STATES.MD.decided, 0);
  assert.ok(STATES.MD.na > 0);
  assert.throws(() => statesFigure({ states: { ...STATES, ZZ: STATES.AL }, counts: COUNTS, n: 3, source: 's', fy: DATA.fy }), /ZZ/);
});

test('the hospital table section: the controls for client/program.js, the asset, and without JavaScript a sentence and the CSV link', () => {
  const text = program();
  const section = /<section class="block hospitals" aria-labelledby="hospitals-h" id="hospitals">([\s\S]*?)<\/section>/.exec(text)[1];
  assert.ok(section.includes(`<a href="${csvPath(DATA.fy)}"`));
  assert.equal(csvPath(DATA.fy), `/data/hacrp/fy${DATA.fy}/hacrp-hospitals.csv`);
  assert.match(section, /<p class="ht-nojs">[^<]+<\/p>/);
  assert.match(section, /<div class="ht" data-src="\/assets\/hacrp-hospitals\.0000abcd\.json" hidden>/);
  assert.match(section, /<select id="ht-state">/);
  assert.match(section, /<input id="ht-name" type="search"/);
  assert.match(section, /aria-live="polite"/);
  for (const key of ['name', 'city', 'state', 'score', 'decision']) assert.match(section, new RegExp(`<th scope="col" data-key="${key}"${key === 'state' ? ' aria-sort="ascending"' : ''}${key === 'score' ? ' class="num"' : ''}><button type="button" class="fig__sort">`));
  assert.doesNotMatch(text, /Exampleton|EXAMPLE GENERAL/, 'no hospital list inlined');
  assert.ok(text.length < 80_000, `the program page stays small (${text.length} bytes)`);
  console.log(`program page: ${text.length} bytes`);
});

test('no figure takeaway holds a hand-typed number: every number in it comes from the data it was built from', () => {
  // Hospital pages: each number in a takeaway is the score, the largest part, or a count of the view's measures.
  for (const h of Object.values(CASES).filter((x) => x.total !== null)) {
    const view = hospitalView(inputs(h));
    const valued = view.measures.filter((m) => m.hasValue);
    const above = valued.filter((m) => Number(m.valueRaw) > RANGES[m.id].median).length;
    const allowed = new Set([view.score.text, view.largest?.contributionText, String(view.n), String(valued.length), String(above), String(valued.length - above)]);
    for (const [, takeaway] of captions(render(h))) for (const x of numbers(takeaway)) assert.ok(allowed.has(x), `${h.ccn}: "${x}" in "${takeaway}"`);
  }
  // Counts in a hospital takeaway follow the data: drop a measure's value and the count drops with it.
  const fewer = { ...CASES.yes, measures: { ...CASES.yes.measures, MRSA: { ...CASES.yes.measures.MRSA, value: null, valueText: 'N/A' } } };
  assert.match(captions(render(fewer))[1][1], /^Of the 5 measures/);

  // The program page: change the data and every number in its takeaways changes with it.
  const fake = { decided: 4321, yes: 1234, scored: 5000 };
  const states = { ...STATES, AL: { ...STATES.AL, yes: 1, decided: 8 } };
  const text = program({ counts: fake, states });
  const caps = captions(text).map(([, t]) => t);
  assert.ok(caps[1].includes('1,234 of 4,321'));
  assert.ok(caps[2].includes(pct(1234 / 4321, 1)));
  const shares = Object.entries(states).filter(([c, s]) => Object.hasOwn(TILES, c) && s.decided > 0).map(([, s]) => toUnit(100 * s.yes / s.decided, 1));
  const allowed = new Set([count(1234), count(4321), pct(1234 / 4321, 1), pct(Math.min(...shares) / 100, 1), pct(Math.max(...shares) / 100, 1),
    cmsText(MEDIAN.totalText), DATA.boundaryText.highestNo, DATA.boundaryText.lowestYes]);
  for (const t of caps) for (const x of numbers(t)) assert.ok(allowed.has(x), `"${x}" in "${t}"`);
  // The figure builders take their words from copy.js and their numbers only from their arguments.
  assert.ok(String(lineFigure({ hospital: MEDIAN, model, range: RANGE, boundaryText: DATA.boundaryText, n: 1, source: 's' })).includes('Figure 1.'));
});

test('hostile names stay text in the hospital page\'s figures', () => {
  const name = '<img src=x onerror=alert(1)> & "Sons"';
  const view = hospitalView(inputs(CASES.yes, { master: master(CASES.yes.ccn, { name }) }));
  const text = hospitalPage({ view, source: DATA.source, robots: null, assets: ASSETS, ranges: RANGES });
  assert.ok(!text.includes('<img src=x'));
  for (const [, , body] of figures(text)) assert.ok(!body.includes(name));
});

test('partsFigure and rangeFigure: plotted values all in their tables (figure() checks), CSV names per hospital', () => {
  const view = hospitalView(inputs(CASES.yes));
  assert.ok(String(partsFigure(view, 1, 's')).includes(`data-figure-csv="hacrp-fy${DATA.fy}-990001-parts.csv"`));
  assert.ok(String(rangeFigure(view, RANGES, 2, 's')).includes(`data-figure-csv="hacrp-fy${DATA.fy}-990001-ranges.csv"`));
  assert.equal(rangeFigure(hospitalView(inputs(CASES.allAssigned)), RANGES, 2, 's'), null);
});

test('Figure 1\'s bars, table and takeaway carry the same text for each part (one rounding)', () => {
  // Every pinned scored hospital: some parts sit on a rounding tie that two roundings would split.
  for (const [i, view] of VIEWS.filter((v) => v.scored).entries()) {
    const fig = String(partsFigure(view, 1, 's'));
    for (const m of view.measures.filter((x) => x.contribution !== null)) {
      assert.ok(fig.includes(`>${m.contributionText}</text>`), `scored row ${i} ${m.id}: bar label`);
      assert.ok(fig.includes(`data-value="${Number(m.contributionText.replace('−', '-'))}">${m.contributionText}</td>`), `scored row ${i} ${m.id}: table`);
    }
  }
});
