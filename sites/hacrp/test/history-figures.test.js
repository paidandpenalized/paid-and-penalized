// The history's figures (web/history-figures.js): Part 4 of the program page, a place's years, and a hospital's
// record, on the small synthetic history (history-fixtures.js, every record written out) and on the committed one.
// Each figure is rendered and read back: its table is the data it draws, and the numbers in its takeaway are the ones
// historyData() computes. (figure() itself fails the build when a plotted value is missing from the table.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counter } from '../../../web/charts/figure.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { count, decimal, pct } from '../../../web/render/format.js';
import { STATE_NAMES } from '../../../web/charts/geo.js';
import { FEW_DECIDED, MAP_STEPS_PCT, SHORT_NAMES } from '../web/constants.js';
import { historyData } from '../web/history-data.js';
import { fill as wordsFill, t as words } from '../web/history/copy.js';
import {
  HIST_MAP_WIDE, HIST_WIDE, chanceFigure, coverageFigure, everFigure, gapFigure, historySource, hospitalInfectionsFigure, infectionsFigure, kindsFigure,
  part4, placeMembers, placeYearsFigure, recordStrip, rollAsset, rollFigure, ruleBreaks, spikeYear, statesYearsFigure, yearMapFigure, yearsFigure,
} from '../web/history-figures.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { ASSETS } from './fixtures.js';
import { HD, HISTORY_ARGS, HISTORY_URL, PAGE_CTX, SEARCH_URL, VIEWS, DATA, renderPlace, renderProgram, PLACES } from './pinned.js';
import { SYNTH_RECORDS, synthHistory, synthMaster } from './history-fixtures.js';

const S = historyData({ history: synthHistory(), master: synthMaster() });
const SM = synthMaster();
const SRC = 'Source: test';

// ---------- reading a figure back ----------

const text = (s) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const captionOf = (fig) => /<figcaption class="fig__cap" id="figure-(\d+)-cap"><span class="fig__n">Figure \d+\.<\/span> ([^<]*)<\/figcaption>/.exec(String(fig)).slice(1);
const takeaway = (fig) => text(captionOf(fig)[1]).replaceAll('‑', '-');
// A figure's table, body rows only: each cell's text.
const rowsOf = (fig) => {
  const s = String(fig);
  return [...s.slice(s.indexOf('<tbody>')).matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, tr]) => [...tr.matchAll(/<t[dh][^>]*>([^<]*)</g)].map((c) => text(c[1])));
};
const headOf = (fig) => [...String(fig).matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => text(m[1]));
// Every number written in a sentence, with its commas, point, sign and percent (a measure's short name, PSI 90, is a name).
const numbers = (s) => Object.values(SHORT_NAMES).reduce((x, name) => x.replaceAll(name, ''), s).match(/[−+]?\d+(,\d{3})*(\.\d+)?%?/g) ?? [];
// The same numbers whatever order the sentence puts them in.
const same = (actual, expected, message) => assert.deepEqual([...actual].sort(), [...expected].sort(), message);
const attr = (markup, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(String(markup));
  return m ? text(m[1]) : null;
};
const everCut = (hd) => [...hd.recs.values()].filter((r) => r.includes('Y')).length;
const pct0 = (x) => pct(x, 0);
const pct1 = (x) => pct(x, 1);
const classes = (svgMarkup) => [...String(svgMarkup).matchAll(/class="([^"]+)"/g)].map((m) => m[1]);
// The narrow drawing of a figure (the wide one follows it), and the text of each <text class="cls"> in a drawing.
const narrowOf = (fig) => String(fig).slice(0, String(fig).indexOf('data-fit="wide"'));
const textsOf = (svg, cls) => [...String(svg).matchAll(new RegExp(`<text class="${cls}"[^>]*>([^<]*)</text>`, 'g'))].map((m) => text(m[1]));
// The grid order a place's roll call carries: the JSON script its data-inline names.
const inlineOf = (markup) => JSON.parse(text(new RegExp(`<script type="application/json" id="${attr(markup, 'data-inline')}">([^<]*)</script>`).exec(String(markup))[1]));
// A figure's note (the line under the chart).
const noteOf = (fig) => text(/fig__note">([^<]*)</.exec(String(fig))[1]);

// ---------- the source line, the roll call and its asset ----------

test('historySource: the fiscal years of the files, and the second year of a cut list (the first year is the files\')', () => {
  const line = historySource(HD);
  assert.ok(line.includes(String(HD.fys[0])) && line.includes(String(HD.fys.at(-1))));
  const lists = HD.years.filter((y) => y.decisions === 'cut-list').map((y) => String(y.fy));
  assert.deepEqual(lists, ['2015', '2016']);
  assert.ok(line.includes('2016'));
  assert.equal(historySource(HD), line, 'remembered for the history');
});

test('rollAsset: the grid\'s hospitals in drawing order with their records and states, the cut-first order of the roll call', () => {
  const asset = rollAsset(S);
  assert.deepEqual(asset.fys, S.fys);
  assert.equal(asset.ccns.length, S.recs.size);
  assert.deepEqual([asset.recs.length, asset.states.length], [S.recs.size, S.recs.size]);
  asset.ccns.forEach((ccn, j) => {
    assert.equal(asset.recs[j], S.recs.get(ccn), ccn);
    assert.equal(asset.states[j], S.stateOf.get(ccn), ccn);
  });
  assert.equal(new Set(asset.ccns).size, asset.ccns.length);
  // Cut first, year by year with "no decision" read as "not cut": the hospitals cut in FY2021 stand first.
  const key = (rec) => rec.replaceAll('.', 'N');
  for (let j = 1; j < asset.recs.length; j++) assert.ok(key(asset.recs[j - 1]) >= key(asset.recs[j]), `row ${j}`);
  assert.deepEqual(asset.recs.slice(0, 2), ['YY.YY', 'YY.YN']);
  // Hospitals never cut are the block at the end.
  const firstNever = asset.recs.findIndex((r) => !r.includes('Y'));
  assert.equal(firstNever, everCut(S));
  assert.ok(asset.recs.slice(firstNever).every((r) => !r.includes('Y')));
  assert.ok(!('at' in asset), 'no places without the atlas and the master');
  // Each year's counts, as the year map's script says them: cut that year, and ever cut by then.
  assert.deepEqual(asset.counts, S.counts.map((c) => [c.cut, c.ever]));
  assert.deepEqual(JSON.parse(JSON.stringify(asset)), asset);
});

test('rollAsset with the atlas and the master: each hospital\'s place on the year map\'s one drawing, flat in tenths, nothing where there is no place', () => {
  const asset = rollAsset(S, { shapes: DATA.shapes, master: SM });
  assert.equal(asset.at.length, 2 * asset.ccns.length);
  asset.ccns.forEach((ccn, j) => {
    const [x, y] = [asset.at[2 * j], asset.at[2 * j + 1]];
    if (!SM.has(ccn)) assert.deepEqual([x, y], [null, null], `${ccn} is not in the master`);
    else assert.ok(Number.isInteger(x) && Number.isInteger(y) && x > 0 && x < HIST_MAP_WIDE * 10, `${ccn}: tenths, inside the map`);
  });
  assert.deepEqual(JSON.parse(JSON.stringify(asset)), asset, 'no NaN: it round-trips as JSON');
});

test('rollFigure: the roll call with the numbers of ever cut, hospitals and never cut in its takeaway, a row a year in its table', () => {
  for (const hd of [S, HD]) {
    const fig = rollFigure(hd, { n: 4, source: SRC });
    const ever = everCut(hd);
    assert.equal(captionOf(fig)[0], '4');
    const nums = numbers(takeaway(fig));
    for (const x of [count(ever), count(hd.recs.size), count(hd.recs.size - ever), String(hd.fys[0])]) assert.ok(nums.includes(x), `${x} in "${takeaway(fig)}"`);
    const rows = rowsOf(fig);
    assert.equal(rows.length, hd.fys.length);
    rows.forEach((row, i) => assert.deepEqual(row, [`FY${hd.fys[i]}`, count(hd.counts[i].decided), count(hd.counts[i].cut), count(hd.counts[i].first), count(hd.counts[i].ever)]));
    // Without the assets it is a picture: no picker, no data attributes for the script.
    assert.doesNotMatch(String(fig), /data-roll=|data-src=|roll__pick|data-hint/);
    assert.ok(String(fig).includes('class="roll__readout small" aria-live="polite"'));
    const geom = JSON.parse(attr(fig, 'data-geom'));
    assert.deepEqual(Object.keys(geom).sort(), [String(WIDTH), String(HIST_WIDE)].sort());
    // The geometry the script reads: [label column, right margin, row height, top], each drawing's own.
    assert.deepEqual(geom[String(WIDTH)], [30, 0, 11, 4]);
    assert.deepEqual(geom[String(HIST_WIDE)], [40, 0, 17, 4]);
    // The drawing agrees: the viewBox is the top, a row a year at that row height, and the room for the brackets.
    for (const svg of String(fig).split('<svg ').slice(1).filter((x) => /chart--roll/.test(x))) {
      const [width, height] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg).slice(1).map(Number);
      const [, , rowH, top] = geom[String(width)];
      assert.equal(height, top + hd.fys.length * rowH + 30, `width ${width}`);
      // Each run is a stroke along its row's band: the band's middle, a row of the geometry down, as wide as the band.
      const ys = new Set([...svg.matchAll(/M[\d.]+ ([\d.]+)H/g)].map((m) => Number(m[1])));
      const rows = hd.fys.map((_, i) => top + i * rowH + (rowH - 2) / 2);
      assert.ok(ys.size > 0 && [...ys].every((y) => rows.includes(y)), `width ${width}: every run lies along a row of the geometry`);
      assert.deepEqual([...svg.matchAll(/class="chart-roll__(?:yes|no)" stroke-width="([\d.]+)"/g)].map((m) => Number(m[1])), [rowH - 2, rowH - 2]);
    }
  }
});

test('rollFigure with the assets: the script\'s attributes and a picker of the states in the history, by name', () => {
  const fig = rollFigure(S, { n: 1, source: SRC, rollUrl: '/assets/h.json', src: '/assets/p.json' });
  assert.equal(attr(fig, 'data-roll'), '/assets/h.json');
  assert.equal(attr(fig, 'data-src'), '/assets/p.json');
  // When the script can run, the readout carries the hint it starts with; the markup alone leaves it empty.
  assert.equal(attr(/<p class="roll__readout[^>]*>/.exec(String(fig))[0], 'data-hint'), words('rollHint'));
  assert.ok(words('rollHint').length > 0);
  const options = [...String(fig).matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(options.slice(1), [['AL', STATE_NAMES.AL], ['GA', STATE_NAMES.GA], ['MD', STATE_NAMES.MD]]);
  assert.equal(options[0][0], '');
  // Two drawings, a narrow one and a wide one, each with the grid's records as cells.
  assert.equal([...String(fig).matchAll(/<svg [^>]*class="chart chart--roll"/g)].length, 2);
});

test('rollFigure\'s picker carries what the script redraws a state with: the grid\'s own words, and the nation\'s share ever cut from the takeaway\'s counts; its link waits hidden', () => {
  for (const hd of [S, HD]) {
    const fig = String(rollFigure(hd, { n: 1, source: SRC, rollUrl: '/assets/h.json', src: '/assets/p.json' }));
    const pick = /<p class="roll__pick" hidden[^>]*>/.exec(fig)[0];
    const ever = everCut(hd);
    assert.ok(numbers(takeaway(fig)).includes(count(ever)) && numbers(takeaway(fig)).includes(count(hd.recs.size)));
    assert.equal(attr(pick, 'data-nation'), pct0(ever / hd.recs.size));
    // The words are the national grid's own, with the count left to fill: the brackets read the same on a state's grid.
    const kept = JSON.parse(attr(pick, 'data-words'));
    assert.deepEqual(Object.keys(kept).sort(), ['rollEver', 'rollNever', 'rollNone']);
    assert.equal(kept.rollEver.replace('{n}', '7'), wordsFill('rollEver', { n: '7' }));
    assert.equal(kept.rollNever.replace('{n}', '7'), wordsFill('rollNever', { n: '7' }));
    assert.equal(kept.rollNone, words('rollNone'));
    for (const label of [wordsFill('rollEver', { n: count(ever) }), wordsFill('rollNever', { n: count(hd.recs.size - ever) })]) assert.ok(fig.includes(`>${label}</text>`), `the national grid's bracket "${label}"`);
    // The link to the picked state's page is in the picker, hidden and with nowhere to go until the script sets it.
    assert.match(fig, /<\/select> <a class="roll__open" hidden><\/a><\/p>/);
  }
});

// ---------- the staircase and the year map ----------

test('everFigure: cut each year against ever cut; its takeaway says the last year, how many were ever cut and their share of all', () => {
  for (const hd of [S, HD]) {
    const fig = everFigure(hd, { n: 2, source: SRC });
    const last = hd.counts.at(-1);
    const nums = numbers(takeaway(fig));
    for (const x of [String(hd.fys.at(-1)), count(last.ever), pct0(last.ever / hd.recs.size)]) assert.ok(nums.includes(x), `${x} in "${takeaway(fig)}"`);
    assert.deepEqual(rowsOf(fig), hd.counts.map((c, i) => [`FY${hd.fys[i]}`, count(c.cut), count(c.ever)]));
  }
  same(numbers(takeaway(everFigure(S, { n: 1, source: SRC }))), ['2025', '12', '55%']);
});

test('yearMapFigure: a dot for every hospital the master places, one control per year with the newest pressed, and a readout of the newest year', () => {
  const fig = yearMapFigure(S, { n: 3, source: SRC, shapes: DATA.shapes, master: SM, rollUrl: '/assets/h.json' });
  const s = String(fig);
  assert.equal(attr(s, 'data-roll'), '/assets/h.json');
  const buttons = [...s.matchAll(/<button type="button" class="ymap__y" data-i="(\d+)" aria-pressed="(\w+)">(\d+)<\/button>/g)];
  assert.deepEqual(buttons.map((m) => m[3]), ['21', '22', '23', '24', '25']);
  assert.deepEqual(buttons.map((m) => m[2]), ['false', 'false', 'false', 'false', 'true']);
  assert.match(s, /<button type="button" class="ymap__play" data-play="[^"]+" data-stop="[^"]+">/);
  // The newest year as it loads: 4 cut (red), 8 more cut earlier (pale), the other 10 not cut so far (gray); the closed hospital has no place.
  const readout = text(/<p class="ymap__readout"[^>]*>([^<]*)<\/p>/.exec(s)[1]);
  assert.ok(numbers(readout).includes('4') && numbers(readout).includes('12') && numbers(readout).includes('2025'), readout);
  // Each dot is one "h0" in its ink's path (a zero-length line with a round cap).
  const dotsPerClass = (cls) => {
    const path = new RegExp(`class="chart-dots ${cls}"[^>]*d="([^"]*)"`).exec(s.slice(0, s.indexOf('data-fit="wide"')));
    return path ? (path[1].match(/h0/g) ?? []).length : 0;
  };
  assert.equal(dotsPerClass('chart-dots--pen'), 4, 'cut in FY2025: 990101, 990102, 990110, 990207');
  assert.equal(dotsPerClass('chart-dots--years-scar'), 7, 'cut before, not in FY2025: eight, but 990303 is not in the master');
  assert.equal(dotsPerClass('chart-dots--years-clear'), 10, 'never cut so far');
  // The takeaway and the note about the hospital with no place.
  same(numbers(takeaway(fig)), ['12', '55%', '2025']);
  same(numbers(text(/fig__note">([^<]*)</.exec(String(fig))[1])), ['1']);
  assert.deepEqual(rowsOf(fig), S.counts.map((c, i) => [`FY${S.fys[i]}`, count(c.cut), count(c.ever)]));
  // No rollUrl: a picture, with the controls still in the markup for no script to reveal.
  assert.doesNotMatch(String(yearMapFigure(S, { n: 3, source: SRC, shapes: DATA.shapes, master: SM })), /data-roll=/);
});

test('yearMapFigure on the committed history: the dots the newest year draws are the hospitals the master places, by ink', () => {
  const fig = String(yearMapFigure(HD, { n: 1, source: SRC, shapes: DATA.shapes, master: DATA.master }));
  const last = HD.fys.length - 1;
  const placed = [...HD.recs].filter(([ccn]) => { const r = DATA.master.get(ccn); return r && Number.isFinite(r.lon) && Number.isFinite(r.lat); });
  const narrow = fig.slice(0, fig.indexOf('data-fit="wide"'));
  const dots = (cls) => { const m = new RegExp(`class="chart-dots ${cls}"[^>]*d="([^"]*)"`).exec(narrow); return m ? (m[1].match(/h0/g) ?? []).length : 0; };
  assert.equal(dots('chart-dots--pen'), placed.filter(([, r]) => r[last] === 'Y').length);
  assert.equal(dots('chart-dots--years-scar'), placed.filter(([, r]) => r[last] !== 'Y' && r.slice(0, last).includes('Y')).length);
  assert.equal(dots('chart-dots--years-clear'), placed.filter(([, r]) => !r.includes('Y')).length);
  assert.equal(captionOf(fig)[0], '1');
});

// ---------- infections ----------

const rate = (observed, predicted) => ({ hospitals: 10, median: 1, counted: 10, observed, predicted });
const flat = (observed, predicted) => ({ CLABSI: rate(observed, predicted), CAUTI: rate(observed, predicted), SSI_COLON: rate(observed, predicted), SSI_HYST: rate(observed, predicted), MRSA: rate(observed, predicted), CDI: rate(observed, predicted) });

test('spikeYear: the calendar year in which the most measures\' pooled rates rose over the year before; the earlier year on a tie', () => {
  const ids = ['CLABSI', 'CAUTI', 'SSI_COLON', 'SSI_HYST', 'MRSA', 'CDI'];
  // Every measure at 0.5 of predicted, except the ones named, at 0.6 or 0.9.
  const at = (high = [], rate = 6) => Object.fromEntries(ids.map((id) => [id, high.includes(id) ? ratio(rate, 10) : ratio(5, 10)]));
  function ratio(observed, predicted) { return { hospitals: 10, median: 1, counted: 10, observed, predicted }; }
  const years = [
    { cy: 2019, measures: at() },
    { cy: 2020, measures: at(ids.slice(0, 2)) },
    { cy: 2021, measures: at(ids.slice(0, 2), 7) },
    { cy: 2022, measures: at(ids.slice(0, 5), 9) },
  ];
  assert.equal(spikeYear(years), 2022, 'five of six rose in 2022');
  // A tie keeps the earlier year: two rose in 2020, two (the same two, higher) in 2021.
  assert.equal(spikeYear(years.slice(0, 3)), 2020);
  assert.equal(spikeYear(years.slice(0, 1)), 2019, 'one year: that year');
  // Pooled rates, observed over predicted: all six fell in 2020 and rose in 2021.
  const flat = (observed) => at(ids, observed);
  assert.equal(spikeYear([{ cy: 2019, measures: flat(5) }, { cy: 2020, measures: flat(4) }, { cy: 2021, measures: flat(9) }]), 2021);
  // A measure with nothing predicted has no rate, and is never counted as a rise.
  const empty = Object.fromEntries(ids.map((id) => [id, ratio(0, 0)]));
  assert.equal(spikeYear([{ cy: 2019, measures: empty }, { cy: 2020, measures: empty }]), 2020);
});

test('infectionsFigure: a panel per measure of the nation\'s pooled rate, the share cut each year, and the two biggest falls in its takeaway', () => {
  const fig = infectionsFigure(S, { n: 5, source: SRC });
  const inf = S.infections;
  const pooled = (cy, id) => { const m = inf.find((y) => y.cy === cy).measures[id]; return m.observed / m.predicted; };
  const rows = rowsOf(fig);
  assert.deepEqual(rows.map((r) => r[0]), inf.map((y) => String(y.cy)));
  assert.equal(headOf(fig).length, 7);
  // The first column of rates is CLABSI's, to three places as the table prints it.
  rows.forEach((row, i) => assert.equal(Number(row[1]), Math.round(pooled(inf[i].cy, 'CLABSI') * 1000) / 1000));
  // The takeaway: the first and last calendar year and how far the two measures that fell most fell (as percents).
  const falls = ['CLABSI', 'CAUTI', 'SSI_COLON', 'SSI_HYST', 'MRSA', 'CDI'].map((id) => 1 - pooled(2024, id) / pooled(2021, id)).sort((x, y) => y - x);
  same(numbers(takeaway(fig)), ['2021', '2024', pct0(falls[0]), pct0(falls[1])]);
  // The years Care Compare has no full-year file for are said in a note.
  assert.match(String(fig), /fig__note">[^<]*2023/);
  // A quarter strip for the fiscal years: the share cut where CMS cut anyone, "none" otherwise.
  const strip = [...String(fig).matchAll(/hrec__y--(cut|none)"><span class="hrec__fy">(\d+)<\/span><span class="hrec__v">([^<]*)<\/span>/g)].map((m) => [m[1], m[2], text(m[3])]);
  assert.equal(strip.length, S.fys.length);
  assert.deepEqual(strip.map((s) => s[0]), S.counts.map((c) => (c.cut ? 'cut' : 'none')));
  assert.equal(strip[0][2], pct0(S.counts[0].cut / S.counts[0].decided));
  assert.equal(infectionsFigure({ ...S, infections: [] }, { n: 1, source: SRC }), null);
  assert.equal(infectionsFigure({ ...S, infections: undefined }, { n: 1, source: SRC }), null);
});

test('hospitalInfectionsFigure: a panel per measure with two or more years of results, over the nation\'s median; none without them', () => {
  const sir = (cy, v) => ({ cy, sir: { CLABSI: v, CAUTI: v === null ? null : v + 0.5, SSI_COLON: null, SSI_HYST: null, MRSA: null, CDI: 2 } });
  const fig = hospitalInfectionsFigure([sir(2021, 1.2), sir(2022, 0.8), sir(2024, 0.4)], S, { n: 7, source: SRC });
  // CLABSI, CAUTI and CDI each have three years; the others none.
  assert.equal(captionOf(fig)[0], '7');
  assert.deepEqual(headOf(fig).slice(1).length, 3);
  same(numbers(takeaway(fig)), ['2', '3', '2021', '2024'], 'two of three measures fell between the first and the last result');
  assert.deepEqual(rowsOf(fig).map((r) => r[0]), ['2021', '2022', '2024']);
  // The nation's middle hospital is the solid gray line under each panel, named once, on the first panel; the dashed
  // line at one is the reference, named once too.
  const narrow = narrowOf(fig);
  assert.equal([...narrow.matchAll(/<path class="chart-lines__under chart-lines__under--solid"/g)].length, 3);
  assert.deepEqual(textsOf(narrow, 'chart-cap chart-label--halo').sort(), ['Nation’s middle', 'as predicted'].sort());
  // Only one year of results, or none, draws nothing.
  assert.equal(hospitalInfectionsFigure([sir(2021, 1)], S, { n: 1, source: SRC }), null);
  assert.equal(hospitalInfectionsFigure([], S, { n: 1, source: SRC }), null);
  assert.equal(hospitalInfectionsFigure(null, S, { n: 1, source: SRC }), null);
  assert.equal(hospitalInfectionsFigure([sir(2021, 1), sir(2022, 1)], { ...S, infections: [] }, { n: 1, source: SRC }), null);
  // A result far above the rest is held at the top of the chart and said so, and the table keeps the clipped value.
  const high = hospitalInfectionsFigure([sir(2021, 9), sir(2022, 2)], S, { n: 1, source: SRC });
  assert.match(String(high), /fig__note">/);
});

// ---------- chance, gaps, kinds, coverage, states ----------

test('chanceFigure: the panel by times cut against chance; its takeaway names the hospitals, the years, and the never-cut and always-cut ends', () => {
  const fig = chanceFigure(S, { n: 6, source: SRC });
  const p = S.panelChance;
  const rows = rowsOf(fig);
  assert.equal(rows.length, p.years + 1, 'no hospital can have been cut more often than CMS cut anyone');
  rows.forEach((row, k) => { assert.equal(row[0], String(k)); assert.equal(row[1], count(p.observed[k])); });
  // The chance cell reads as a whole number from one up, and as "one in N" below it.
  rows.forEach((row, k) => {
    if (p.chance[k] >= 0.995) assert.equal(row[2], count(Math.round(p.chance[k])), `k = ${k}`);
    else assert.match(row[2], /^one in [\d,]+$/, `k = ${k}`);
  });
  const nums = numbers(takeaway(fig));
  for (const x of [count(p.hospitals), String(p.years), count(p.observed[0]), count(Math.round(p.chance[0])), count(p.observed[p.years])]) assert.ok(nums.includes(x), `${x} in "${takeaway(fig)}"`);
  // On the committed history the panel is the hospitals with a decision in every year CMS cut anyone.
  const real = HD.panelChance;
  const nums2 = numbers(takeaway(chanceFigure(HD, { n: 1, source: SRC })));
  for (const x of [count(real.hospitals), String(real.years), count(real.observed[0]), count(real.observed[real.years])]) assert.ok(nums2.includes(x), `${x} in "${takeaway(chanceFigure(HD, { n: 1, source: SRC }))}"`);
  assert.equal(real.years, HD.cutYears);
  // A key under the chart names the dot and the ring, and the side.
  assert.match(noteOf(fig), /^● What happened\s+○ .*random.*hospitals/);
});

test('gapFigure: the share cut again after a cut, and after no cut, by years apart; the takeaway reads the first, second and furthest gap', () => {
  const fig = gapFigure(S, { n: 8, source: SRC });
  const again = (g) => g.cutAgain / g.cutBefore;
  const fresh = (g) => g.cutNew / g.notBefore;
  assert.deepEqual(rowsOf(fig), S.gaps.map((g) => [String(g.k), pct1(again(g)), pct1(fresh(g)), count(g.cutBefore + g.notBefore)]));
  const [one, two] = S.gaps;
  const far = S.gaps.at(-1);
  same(numbers(takeaway(fig)), [pct0(again(one)), pct0(fresh(one)), pct0(again(two)), pct0(fresh(two)), String(far.k), pct0(again(far)), pct0(fresh(far))]);
  // The note names the years CMS cut no one, whose pairs are left out.
  assert.match(String(fig), /fig__note">[^<]*2023/);
  // The drawing labels its points at one year apart, two, and the furthest: the line's value and the other line's, in
  // that order at each; the axis is named; the comparison is the solid gray line, named under its last point.
  const narrow = narrowOf(fig);
  const at = [S.gaps[0], S.gaps[1], far];
  assert.deepEqual(textsOf(narrow, 'chart-value chart-value--mark chart-label--halo'), at.flatMap((g) => [pct0(again(g)), pct0(fresh(g))]));
  assert.deepEqual(textsOf(narrow, 'chart-cap'), ['Years apart']);
  assert.deepEqual(textsOf(narrow, 'chart-cap chart-label--halo'), ['Cut, after no cut']);
  assert.equal([...narrow.matchAll(/<path class="chart-lines__under chart-lines__under--solid"/g)].length, 1);
  // On the committed history a cut makes a repeat likelier than none, at every gap.
  for (const g of HD.gaps) assert.ok(again(g) > fresh(g), `${g.k} years apart`);
  assert.deepEqual(HD.gaps.map((g) => g.k), Array.from({ length: HD.gaps.length }, (_, i) => i + 1));
});

test('kindsFigure: a panel per kind of hospital against the nation (solid gray), and the rural share cut against the nation\'s in the takeaway', () => {
  const fig = kindsFigure(S, { n: 9, source: SRC });
  const group = (kind, key) => S.byType.find((k) => k.kind === kind).groups.find((g) => g.key === key).years;
  const rate1 = (y) => y.cut / y.decided;
  const rural = group('urban', 'false');
  const urban = group('urban', 'true');
  const nation = (i) => S.counts[i].cut / S.counts[i].decided;
  const last = S.fys.length - 1;
  // Rural hospitals against all hospitals, the first year and the newest: the share cut, and the nation's beside it.
  same(numbers(takeaway(fig)), [String(S.fys[0]), pct0(rate1(rural[0])), pct0(nation(0)), String(S.fys[last]), pct0(rate1(rural[last])), pct0(nation(last))]);
  assert.deepEqual([pct0(rate1(rural[0])), pct0(nation(0)), pct0(rate1(rural[last])), pct0(nation(last))], ['20%', '29%', '9%', '19%'], 'FY2021: 2 of 10 rural hospitals against 6 of 21; FY2025: 1 of 11 against 4 of 21');
  assert.match(takeaway(fig), /^Rural hospitals flipped: in fiscal year 2021, CMS cut 20% of them against 29% of all hospitals; in fiscal year 2025, 9% against 19%\.$/);
  // The table: a row a year; the nation first; a year CMS cut no one is blank.
  const rows = rowsOf(fig);
  assert.equal(rows.length, S.fys.length);
  assert.equal(rows[0][1], pct1(S.counts[0].cut / S.counts[0].decided));
  assert.ok(rows[S.fys.indexOf(2023)].slice(1).every((c) => c === ''));
  const urbanTrue = headOf(fig).indexOf(headOf(fig).find((h) => /^Urban/.test(h)));
  assert.ok(urbanTrue > 0);
  assert.equal(rows[0][urbanTrue], pct1(rate1(urban[0])));
  // Six panels: each says how many cut years it sat above the nation.
  const narrow = narrowOf(fig);
  assert.equal([...narrow.matchAll(/above in \d+ of 4/g)].length, 6);
  // The nation is drawn solid and gray under each panel's line (not the dashed reference of the other charts).
  assert.equal([...narrow.matchAll(/<path class="chart-lines__under chart-lines__under--solid"/g)].length, 6);
  assert.equal([...narrow.matchAll(/<path class="chart-lines__under"/g)].length, 0);
});

test('coverageFigure: the share cut by what CMS scored a hospital on, four bars; the takeaway has the PSI 90-alone and no-PSI 90 shares and the years', () => {
  const fig = coverageFigure(S, { n: 10, source: SRC });
  const g = S.coverage.groups;
  const share = (x) => x.cut / x.decided;
  assert.deepEqual(rowsOf(fig).map((r) => r.slice(1)), [g.every, g.all, g.psiOnly, g.noPsi].map((x) => [count(x.decided), count(x.cut), pct1(share(x))]));
  same(numbers(takeaway(fig)).filter((x) => x.endsWith('%')), [pct0(share(g.psiOnly)), pct0(share(g.noPsi))]);
  assert.ok(numbers(takeaway(fig)).includes('2021') && numbers(takeaway(fig)).includes('2025'));
  // The bars and the table's rows are named the same short way.
  const names = ['Every hospital', 'Every measure', `${SHORT_NAMES.PSI90} only`, 'Infections only'];
  assert.deepEqual(rowsOf(fig).map((r) => r[0]), names);
  assert.deepEqual(textsOf(narrowOf(fig), 'chart-punch__row'), names);
  // On the committed history, a hospital scored on PSI 90 alone is rarely cut, and one with no PSI 90 score often is.
  assert.ok(share(HD.coverage.groups.psiOnly) < 0.1 && share(HD.coverage.groups.noPsi) > 0.4);
  assert.deepEqual(rowsOf(coverageFigure(HD, { n: 1, source: SRC }))[0].slice(1), [count(HD.coverage.groups.every.decided), count(HD.coverage.groups.every.cut), pct1(share(HD.coverage.groups.every))]);
});

test('statesYearsFigure: one small map a year, a state\'s column of shares in the table, and the state above the nation most years in the takeaway', () => {
  const fig = statesYearsFigure(S, { n: 11, source: SRC });
  assert.equal([...String(fig)].length > 0 && [...String(fig).matchAll(/class="smallmaps__m"/g)].length, S.fys.length);
  assert.equal([...String(fig).matchAll(/<p class="smallmaps__fy">FY\d+<\/p>/g)].length, S.fys.length);
  assert.deepEqual(headOf(fig), ['Fiscal year', 'AL', 'GA', 'MD']);
  const rows = rowsOf(fig);
  assert.deepEqual(rows[0], ['FY2021', pct1(0.3), pct1(0.2), pct1(1)]);
  assert.deepEqual(rows[S.fys.indexOf(2023)], ['FY2023', '', '', '']);
  // Alabama sat above the nation's share in all 4 cut years; Georgia in 1 (so below it in 3). Maryland has too few hospitals to be named.
  same(numbers(takeaway(fig)), [String(FEW_DECIDED), '4', '4', '3']);
  assert.match(takeaway(fig), new RegExp(`${STATE_NAMES.AL} was cut above`));
  assert.match(takeaway(fig), new RegExp(`${STATE_NAMES.GA}, below it in 3`));
  // One key above the maps, in HTML: a swatch for each step of the share cut, none cut, no decision, and the two states
  // the takeaway names, outlined on every map.
  const key = /<ul class="smallmaps__key" role="list">([\s\S]*?)<\/ul>/.exec(String(fig));
  assert.ok(key && String(fig).indexOf('smallmaps__key') < String(fig).indexOf('class="smallmaps"'), 'the key comes before the maps');
  const items = [...key[1].matchAll(/<li><span class="smallmaps__sw smallmaps__sw--(\w+)"><\/span>([^<]*)<\/li>/g)].map((m) => [m[1], m[2]]);
  const edges = [0, ...MAP_STEPS_PCT];
  assert.deepEqual(items, [
    ...edges.map((e, i) => [String(i + 1), i === edges.length - 1 ? `${e}% and up` : `${e}% to ${edges[i + 1]}%`]),
    ['zero', 'None cut'], ['empty', 'No decision'], ['ring', `Outlined: ${STATE_NAMES.AL} and ${STATE_NAMES.GA}`],
  ]);
  // Each small map outlines those two states (when they have a decision that year) and no other.
  const maps = String(fig).split('<div class="smallmaps__m">').slice(1);
  assert.equal(maps.length, S.fys.length);
  maps.forEach((m, i) => {
    const ringed = m.split('<g class="chart-mark"').slice(1).filter((g) => g.includes('chart-tile-ring')).map((g) => /data-state="(\w+)"/.exec(g)[1]);
    assert.deepEqual(ringed, S.fys[i] === 2023 ? [] : ['AL', 'GA'], `FY${S.fys[i]}`);
  });
  // A state resting on few hospitals (Maryland: under ten) carries the dashed inner outline in the maps.
  assert.match(maps[0], /data-state="MD"[^>]*>[\s\S]*?chart-tile-few/);
});

// ---------- the hospital page's record ----------

test('ruleBreaks: the first year of z-scores and of equal weights, where the history spans them', () => {
  assert.deepEqual(ruleBreaks(HD.fys).map((b) => b.at), [HD.fys.indexOf(2018), HD.fys.indexOf(2020)]);
  assert.deepEqual(ruleBreaks([2021, 2022]).length, 0, 'a history starting after both has no break');
  assert.deepEqual(ruleBreaks([2018, 2019, 2020, 2021]).map((b) => b.at), [2], 'a break at the first year is no break');
  assert.deepEqual(ruleBreaks([2015, 2016]), []);
  assert.ok(ruleBreaks(HD.fys).every((b) => typeof b.label === 'string' && b.label));
});

test('recordStrip: a box a year in the ink of its decision, with a sentence of how many of its years it was cut; none for no record', () => {
  assert.equal(String(recordStrip(null, S.fys)), '');
  const rec = S.recordOf('990101');
  const strip = String(recordStrip(rec, S.fys));
  const boxes = [...strip.matchAll(/<li class="hrec__y hrec__y--(cut|no|none)" title="([^"]*)">/g)];
  assert.deepEqual(boxes.map((m) => m[1]), ['cut', 'cut', 'none', 'cut', 'cut']);
  assert.equal(boxes.length, S.fys.length);
  boxes.forEach((m, i) => assert.ok(text(m[2]).includes(String(S.fys[i]))));
  assert.deepEqual([...strip.matchAll(/<span class="hrec__fy">(\d+)<\/span>/g)].map((m) => m[1]), ['21', '22', '23', '24', '25']);
  const summary = text(/<span class="hrec__sum">([^<]*)<\/span>/.exec(strip)[1]);
  same(numbers(summary), ['4', '4']);
  // A hospital never cut gets the other sentence, naming only how many years it was decided.
  const never = String(recordStrip(S.recordOf('990104'), S.fys));
  same(numbers(text(/<span class="hrec__sum">([^<]*)<\/span>/.exec(never)[1])), ['4']);
  assert.equal([...never.matchAll(/hrec__y--cut/g)].length, 0);
  // The heading names the first and last year.
  assert.ok(numbers(text(/<span class="cap">([^<]*)<\/span>/.exec(strip)[1])).join() === '2021,2025');
});

test('yearsFigure: where a hospital\'s score stood each year; the table gives CMS\'s score text, its place in line and its decision, blank for the year with no score', () => {
  const rec = S.recordOf('990101');
  const fig = yearsFigure(rec, S, { n: 5, source: SRC });
  const rows = rowsOf(fig);
  assert.equal(rows.length, S.fys.length);
  assert.deepEqual(rows[0].slice(0, 2), ['FY2021', '1.0100']);
  assert.equal(rows[0][2], pct1(16 / 21));
  assert.deepEqual(rows[S.fys.indexOf(2023)].slice(1, 3), ['', ''], 'FY2023: no score, no place');
  same(numbers(takeaway(fig)), ['4', '4']);
  // A key under the chart names the red dot and the hollow one.
  assert.match(noteOf(fig), /^● Red: a year CMS cut it\s+○ Hollow: a year it didn’t$/);
  // A never-cut hospital: the sentence has only the years decided.
  same(numbers(takeaway(yearsFigure(S.recordOf('990104'), S, { n: 5, source: SRC }))), ['4']);
  // On the committed history, a hospital that was cut in some year and decided in more than one.
  const [ccn] = [...HD.recs].find(([, r]) => r.includes('Y') && [...r].filter((c) => c !== '.').length > 3);
  const real = HD.recordOf(ccn);
  const realFig = yearsFigure(real, HD, { n: 2, source: SRC });
  same(numbers(takeaway(realFig)), [String(real.cut), String(real.decided)]);
  assert.equal(rowsOf(realFig).length, HD.fys.length);
});

// ---------- a place's years ----------

const AL = SYNTH_RECORDS.AL.map(([c]) => c);
const GA = SYNTH_RECORDS.GA.map(([c]) => c);
const place = (over = {}) => ({ kind: 'state', key: 'al', name: 'Example State', ccns: AL, stateCodes: [], ...over });
// A place of metro shape that holds only the hospitals it is given (the synthetic master places none in an area).
const metro = (ccns, over = {}) => place({ kind: 'metro', key: '99999', ccns, ...over });

test('placeMembers: a state takes its own hospitals with a record, a region or division those of its hospitals\' states, a metro area those of its CBSA', () => {
  // A state: every hospital with a record whose master state is its own code, whatever its list of hospitals holds.
  assert.deepEqual(placeMembers(place(), S, SM).sort(), AL);
  assert.deepEqual(placeMembers(place({ ccns: ['990101'] }), S, SM).sort(), AL, 'the state\'s code, not the hospitals listed, decides');
  assert.deepEqual(placeMembers(place({ key: 'ga', ccns: [] }), S, SM).sort(), GA);
  // A hospital with no record (Maryland-style: 990301 has a decision in no year) is in no place.
  assert.ok(!placeMembers(place({ key: 'md', ccns: ['990301', '990302'] }), S, SM).includes('990301'));
  // Including one the master no longer places (990303: in the history and the Maryland file, not in the master): its
  // last file's state stands in.
  assert.ok(!SM.has('990303') && S.stateOf.get('990303') === 'MD');
  assert.deepEqual(placeMembers(place({ key: 'md', ccns: ['990302'] }), S, SM).sort(), ['990302', '990303']);
  assert.ok(!placeMembers(place(), S, SM).includes('990303'), 'and it is not another state\'s');
  // The master's state wins over the history's: a hospital the master now puts in Georgia has left Alabama's list.
  const moved = new Map(SM).set('990101', { ...SM.get('990101'), state: 'GA' });
  assert.equal(S.stateOf.get('990101'), 'AL');
  assert.ok(!placeMembers(place({ ccns: ['990102'] }), S, moved).includes('990101'));
  assert.ok(placeMembers(place({ key: 'ga', ccns: [] }), S, moved).includes('990101'));
  // A region or a division: the states its hospitals are in (the master's), each state's every hospital.
  for (const kind of ['division', 'region']) {
    assert.deepEqual(placeMembers(place({ kind, key: 'south', ccns: ['990101', '990201'] }), S, SM).sort(), [...AL, ...GA], kind);
    assert.deepEqual(placeMembers(place({ kind, key: 'south', ccns: ['990302'] }), S, SM).sort(), ['990302', '990303'], `${kind}: the closed hospital comes with its state`);
  }
  // A hospital of its own that the master cannot place gives no state, but is still listed if it has a record.
  assert.deepEqual(placeMembers(place({ kind: 'division', key: 'south', ccns: ['990303'] }), S, SM), ['990303']);
  // A metro area: its own hospitals, and any other with a record whose master CBSA is its key; never a state's.
  const cbsa = new Map(SM);
  for (const [ccn, area] of [['990101', '10001'], ['990103', '10001'], ['990201', '10002']]) cbsa.set(ccn, { ...SM.get(ccn), cbsa: area });
  assert.deepEqual(placeMembers(metro(['990101'], { key: '10001' }), S, cbsa).sort(), ['990101', '990103']);
  assert.deepEqual(placeMembers(metro(['990101', '990999'], { key: '10001' }), S, cbsa).sort(), ['990101', '990103'], 'a hospital with no record is left out');
  assert.deepEqual(placeMembers(metro(['990302'], { key: '10003' }), S, cbsa), ['990302'], 'no hospital in that area but its own: the closed Maryland one, with no CBSA in the master, is not added');
  assert.deepEqual(placeMembers(metro([], { key: '10002' }), S, cbsa), ['990201'], 'an area with no hospital listed takes the history\'s hospitals in it');
  assert.deepEqual(placeMembers(metro(['990101']), S, SM), ['990101'], 'no CBSA in the master: only its own');
});

test('placeYearsFigure: a roll call of the place\'s hospitals with its share cut each year beside the nation\'s, in the table, and the inline order the script reads', () => {
  const fig = placeYearsFigure({ place: place({ name: 'Alabama' }), hd: S, master: SM, next: () => 6, source: SRC, src: '/assets/p.json' });
  assert.equal(captionOf(fig)[0], '6');
  const rows = rowsOf(fig);
  const own = [[10, 3], [10, 2], [0, 0], [10, 3], [10, 3]];
  rows.forEach((row, i) => {
    const [d, c] = own[i];
    assert.equal(row[0], `FY${S.fys[i]}`);
    assert.deepEqual(row.slice(1, 3), [count(d), count(c)]);
    assert.equal(row[3], d ? pct1(c / d) : '');
    assert.equal(row[4], S.counts[i].share === null ? '' : pct1(S.counts[i].share), 'the nation\'s, none in the year CMS cut no one');
  });
  // Alabama was above the nation's share in all 4 cut years; 6 of its 10 hospitals were ever cut.
  same(numbers(takeaway(fig)), ['4', '4', '6', '10']);
  assert.ok(takeaway(fig).startsWith('Alabama’s share cut was above'), takeaway(fig));
  // The script's names: the grid's own order inline, aligned.
  const inline = inlineOf(fig);
  assert.deepEqual(inline.fys, S.fys);
  assert.equal(inline.ccns.length, 10);
  inline.ccns.forEach((ccn, j) => { assert.equal(inline.recs[j], S.recs.get(ccn)); assert.equal(inline.states[j], 'AL'); });
  assert.deepEqual(inline.recs.slice(0, 3), ['YY.YY', 'YN.NY', 'YN.NN'], 'cut first');
  assert.equal(attr(fig, 'data-src'), '/assets/p.json');
  // The geometry the script reads: [label column, right margin for the notes, row height, top], by drawn width.
  const geom = JSON.parse(attr(fig, 'data-geom'));
  assert.deepEqual(geom, { [String(WIDTH)]: [30, 70, 12, 4], 760: [40, 90, 18, 4] });
  for (const svg of String(fig).split('<svg ').slice(1).filter((x) => /chart--roll/.test(x))) {
    const [width, height] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg).slice(1).map(Number);
    const [, , rowH, top] = geom[String(width)];
    assert.equal(height, top + S.fys.length * rowH + 30, `width ${width}: the top, a row a year at the geometry's height, and the brackets`);
  }
  // With the script's assets the readout carries its starting hint; without, it is a picture.
  assert.equal(attr(/<p class="roll__readout[^>]*>/.exec(String(fig))[0], 'data-hint'), words('rollHint'));
  const picture = String(placeYearsFigure({ place: place(), hd: S, master: SM, next: () => 1, source: SRC }));
  assert.doesNotMatch(picture, /data-src=|data-hint/);
});

test('placeYearsFigure names a region or a division with "the" in its takeaway, and a state or a metro area as it is', () => {
  const start = (p) => takeaway(placeYearsFigure({ place: p, hd: S, master: SM, next: () => 1, source: SRC }));
  assert.ok(start(place({ kind: 'region', key: 'south', name: 'South', ccns: ['990101'] })).startsWith('The South’s share cut was above'));
  assert.ok(start(place({ kind: 'division', key: 'east-south-central', name: 'East South Central', ccns: ['990101'] })).startsWith('The East South Central’s share cut was above'));
  assert.ok(start(place({ name: 'Alabama' })).startsWith('Alabama’s share cut'));
  assert.ok(start(metro(AL, { name: 'Example Metro' })).startsWith('Example Metro’s share cut'));
});

test('placeYearsFigure draws nothing for a place with fewer than two hospitals that have a record, and takes no figure number', () => {
  let drawn = 0;
  const next = () => ++drawn;
  assert.equal(placeYearsFigure({ place: metro(['990101']), hd: S, master: SM, next, source: SRC }), null);
  assert.equal(placeYearsFigure({ place: metro(['990301', '990302']), hd: S, master: SM, next, source: SRC }), null, 'one with no record');
  assert.equal(placeYearsFigure({ place: metro([]), hd: S, master: SM, next, source: SRC }), null);
  // A state with none of its own hospitals in the history (and a single listed one) is the same.
  assert.equal(placeYearsFigure({ place: place({ key: 'ak', ccns: ['990101'] }), hd: S, master: SM, next, source: SRC }), null);
  assert.equal(drawn, 0);
  // A place whose hospitals were never cut has no "ever cut" brackets, and says so with zero.
  const none = placeYearsFigure({ place: metro(['990104', '990107']), hd: S, master: SM, next: () => 1, source: SRC });
  assert.ok(numbers(takeaway(none)).includes('2') && numbers(takeaway(none)).includes('0'), takeaway(none));
});

// ---------- Part 4 as the program page assembles it ----------

const sections = (markup) => [...String(markup).matchAll(/<section class="psec(?: psec--wide)?" id="([^"]+)"/g)].map((m) => m[1]);
const figureNumbers = (markup) => [...String(markup).matchAll(/<figure class="fig" id="figure-(\d+)" data-figure>/g)].map((m) => Number(m[1]));

test('part4 on the synthetic history: the nine sections in order, each beside one numbered figure, the year map only with the atlas and the master', () => {
  const full = part4({ hd: S, figure: counter(5), rollUrl: '/assets/h.json', src: '/assets/p.json', shapes: DATA.shapes, master: SM });
  assert.deepEqual(sections(full), ['roll', 'ever', 'spread', 'infections', 'chance', 'again', 'kinds', 'coverage', 'statemaps']);
  assert.deepEqual(figureNumbers(full), [5, 6, 7, 8, 9, 10, 11, 12, 13], 'numbered in page order, from the counter');
  assert.deepEqual([...String(full).matchAll(/<section class="psec psec--wide" id="(\w+)"/g)].map((m) => m[1]), ['roll', 'spread', 'statemaps']);
  // Every figure carries the history's own source line (the infections figure, Care Compare's).
  assert.ok(String(full).includes(String(historySource(S))));
  // Without the atlas, the year map is left out and the rest are numbered without a gap.
  const noMap = part4({ hd: S, figure: counter() });
  assert.deepEqual(sections(noMap), ['roll', 'ever', 'infections', 'chance', 'again', 'kinds', 'coverage', 'statemaps']);
  assert.deepEqual(figureNumbers(noMap), [1, 2, 3, 4, 5, 6, 7, 8]);
  // Without infections, there is no infections section.
  const noInf = part4({ hd: { ...S, infections: [] }, figure: counter() });
  assert.ok(!sections(noInf).includes('infections'));
  assert.deepEqual(figureNumbers(noInf), [1, 2, 3, 4, 5, 6, 7]);
  // The spike year in the infections text is the one spikeYear finds.
  assert.ok(String(full).includes(String(spikeYear(S.infections))));
  assert.doesNotMatch(String(full), /#[0-9a-fA-F]{6}\b/, 'no color values in the markup');
});

test('part4 on the committed history: every part draws, and its figures\' numbers agree with the history', () => {
  const markup = part4({ hd: HD, figure: counter(14), rollUrl: HISTORY_URL, src: SEARCH_URL, shapes: DATA.shapes, master: DATA.master });
  assert.deepEqual(sections(markup), ['roll', 'ever', 'spread', 'infections', 'chance', 'again', 'kinds', 'coverage', 'statemaps']);
  assert.deepEqual(figureNumbers(markup), [14, 15, 16, 17, 18, 19, 20, 21, 22]);
  // The roll call and the staircase: the same ever-cut count, the history's.
  const ever = HD.counts.at(-1).ever;
  assert.ok(String(markup).includes(count(ever)));
  assert.equal(ever, everCut(HD));
  assert.ok(HD.cutYears === HD.fys.length - 1, 'every year but one');
  assert.equal(attr(markup, 'data-roll'), HISTORY_URL);
});

test('the program page with the history: Part 4 is #history, the figures run 1 to 22 once each, and the nav, the ids and the headings hold', () => {
  const page = renderProgram(HISTORY_ARGS);
  assert.match(page, /<section class="part" id="history" aria-labelledby="history-h">/);
  const nums = figureNumbers(page);
  assert.deepEqual([...nums].sort((a, b) => a - b), Array.from({ length: 22 }, (_, i) => i + 1));
  assert.equal(new Set(nums).size, nums.length);
  // Part 4 comes after the map and the hospital table, and holds the nine figures.
  const part = page.slice(page.indexOf('id="history"'), page.indexOf('class="prog__foot"'));
  assert.equal(figureNumbers(part).length, 9);
  assert.ok(page.indexOf('id="map"') < page.indexOf('id="history"'));
  assert.deepEqual(['roll', 'ever', 'spread', 'infections', 'chance', 'again', 'kinds', 'coverage', 'statemaps'].filter((id) => !new RegExp(`id="${id}"`).test(part)), []);
  // The heading says how many years and rounds of cuts, from the history.
  const heading = text(/<h2[^>]*id="history-h"[^>]*>([\s\S]*?)<\/h2>/.exec(page)[1].replace(/<[^>]+>/g, ''));
  same(numbers(heading), [String(HD.fys.length), String(HD.cutYears)]);
  // Without the history the page has no Part 4, and its figures are the first thirteen.
  const without = renderProgram();
  assert.doesNotMatch(without, /id="history"/);
  assert.equal(figureNumbers(without).length, 13);
});

// ---------- place and hospital pages ----------

test('a place page with the history has the years figure for a place with two or more hospitals with a record, numbered after the others', () => {
  const big = PLACES.list.find((p) => p.kind === 'state' && p.ccns.length > 20);
  const withHistory = renderPlace(big, { hd: HD });
  const without = renderPlace(big);
  assert.equal(figureNumbers(withHistory).length, figureNumbers(without).length + 1);
  assert.match(withHistory, /<section class="[^"]*" id="years"/);
  assert.doesNotMatch(without, /id="years"/);
  assert.match(withHistory, /<div class="roll" data-inline="/);
  const inline = inlineOf(withHistory);
  assert.deepEqual(inline.fys, HD.fys);
  assert.ok(inline.ccns.length >= big.ccns.filter((c) => HD.recs.has(c)).length);
  // A place with one hospital draws no years figure.
  const small = PLACES.list.find((p) => p.kind === 'metro' && p.ccns.filter((c) => HD.recs.has(c)).length === 1);
  if (small) assert.doesNotMatch(renderPlace(small, { hd: HD }), /id="years"/);
});

test('a hospital page with the history: the record strip in the verdict, the years figure, and its infections; none of them without it', () => {
  const [ccn] = [...HD.recs].find(([c, r]) => r.includes('Y') && [...r].filter((x) => x !== '.').length > 4 && DATA.infections.get(c)?.length > 2 && DATA.master.get(c));
  const view = VIEWS.find((v) => v.ccn === ccn);
  const hospital = DATA.hospitals.find((h) => h.ccn === ccn);
  const render = (history) => hospitalPage({ ...PAGE_CTX, view, hospital, master: DATA.master.get(ccn), source: DATA.source, robots: null, assets: ASSETS, shapes: DATA.shapes, history });
  const rec = HD.recordOf(ccn);
  const page = render({ rec, hd: HD, sir: DATA.infections.get(ccn) });
  assert.equal([...page.matchAll(/hrec__y--cut/g)].length, rec.cut, 'a box in the cut ink for each cut year');
  assert.equal([...page.matchAll(/<li class="hrec__y hrec__y--/g)].length, HD.fys.length);
  assert.match(page, /<section class="block hsec" id="years"/);
  assert.match(page, /<section class="block hsec" id="infections"/);
  const plain = render(null);
  assert.doesNotMatch(plain, /hrec__y|id="years"|id="infections"/);
  assert.equal(figureNumbers(page).length, figureNumbers(plain).length + 2);
  // A hospital with a record of one year gets the strip but no years figure.
  const single = [...HD.recs].find(([c, r]) => [...r].filter((x) => x !== '.').length === 1 && VIEWS.some((v) => v.ccn === c));
  if (single) {
    const v1 = VIEWS.find((v) => v.ccn === single[0]);
    const p1 = hospitalPage({ ...PAGE_CTX, view: v1, hospital: DATA.hospitals.find((h) => h.ccn === single[0]), master: DATA.master.get(single[0]), source: DATA.source, robots: null, assets: ASSETS, history: { rec: HD.recordOf(single[0]), hd: HD, sir: null } });
    assert.match(p1, /hrec__y/);
    assert.doesNotMatch(p1, /id="years"/);
  }
});
