// The program page's "Map" Part: the four measures' bins (applied to the value as shown), the states left plain or hatched, the
// hospital dots, "Every state" (sorted, 15 to a page, its CSV) and "Browse by region", on synthetic hospitals in real states
// and on the whole file.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { US_MAP_CODES } from '../../../web/charts/geo.js';
import { parseCsv } from '../../../engine/js/csv.js';
import { placeColumns, placeCsv } from '../web/csv.js';
import { DOT_TIERS, MEASURES, binOf, dotPoints, mapData, shownValue, statesCsvRows } from '../web/figures/map-data.js';
import { mapPart } from '../web/figures/map.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { areaContext, programView } from '../web/view.js';
import { ASSETS, CONDITIONS, HISTORY, META, hospital, loadHrrpOnce } from './fixtures.js';

const measure = (key) => MEASURES.find((m) => m.key === key);
const m = (n, flag) => ({ n, err: 1.1, flag, ratio: 0.1 });
const SHAPES = loadHrrpOnce().shapes;
const ctxOf = (hospitals) => areaContext({ hospitals, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(hospitals, META), shapes: SHAPES });
const partOf = (hospitals) => mapPart(mapData(ctxOf(hospitals)), { figure: () => 7, edition: 'FY2027' }).text;
// The ramp step a state is drawn in on the map of a measure (the first drawing of it), 'zero', or null for a plain or hatched state.
const stepIn = (html, key, code) => {
  const from = html.indexOf(`<div class="usmap__m" data-measure="${key}"`);
  const block = html.slice(from, html.indexOf('</svg>', from));
  const at = block.indexOf(`data-state="${code}"`);
  if (at < 0) return undefined;
  const g = block.slice(at, block.indexOf('</g>', at));
  const seq = /chart-seq-(\d)/.exec(g);
  return seq ? Number(seq[1]) : /chart-tile-zero/.test(g) ? 'zero' : null;
};
const inState = (st, n, extra) => Array.from({ length: n }, (_, i) => hospital({ id: `9900${st === 'TX' ? 1 : st === 'OH' ? 2 : 3}${i}`, st, ...extra }));

test('a value is binned as it is shown: 0.3499 shows 0.35 and takes the bin above the 0.35 edge', () => {
  const avg = measure('avg');
  assert.equal(shownValue(avg, 0.3499), 0.35);
  assert.equal(binOf(avg, 0.3499), 3);
  assert.equal(binOf(avg, 0.3449), 2);
  assert.equal(binOf(avg, 0.001), 0, 'shown as 0.00: plain');
  assert.equal(binOf(avg, 0.6), 5);
  assert.equal(binOf(measure('share'), 84.5), 4, 'shown as 85%');
  assert.equal(binOf(measure('dollars'), 4.96), 3, 'shown as $5.0M');
  assert.equal(binOf(measure('dollars'), 1.94), 1);
  assert.equal(binOf(measure('ge1'), 3.5), 2, 'shown as 4%');
  assert.equal(binOf(measure('avg'), null), null);
});

test('the map draws each state in the bin of its shown value, on all four measures', () => {
  // Texas: one hospital cut 0.3499 (shown 0.35), penalized, $4.96M (shown $5.0M); Ohio: measured, not cut, $1M.
  const tx = [hospital({ id: '990011', st: 'TX', red: 0.3499, paf: 0.9965, pen: 4960000, c: { HF: m(40, 1) } })];
  const html = partOf([...tx, hospital({ id: '990021', st: 'OH', red: 0, paf: 1, pen: 1000000, c: { HF: m(40, 0) } })]);
  assert.equal(stepIn(html, 'avg', 'TX'), 3);
  assert.equal(stepIn(html, 'avg', 'OH'), 'zero');
  assert.equal(stepIn(html, 'share', 'TX'), 5, '100% penalized');
  assert.equal(stepIn(html, 'share', 'OH'), 'zero');
  assert.equal(stepIn(html, 'dollars', 'TX'), 3, '$5.0M as shown');
  assert.equal(stepIn(html, 'dollars', 'OH'), 1);
  assert.equal(stepIn(html, 'ge1', 'TX'), 'zero', 'cut by less than 1%: 0% shown');
});

test('the shares are over the hospitals measured on a condition, and a state with none measured has no color', () => {
  const hs = [
    hospital({ id: '990011', st: 'TX', red: 2, paf: 0.98, pen: 100, c: { HF: m(40, 1) } }),
    hospital({ id: '990012', st: 'TX', red: 0, paf: 1, pen: 0, c: { HF: m(40, 0) } }),
    hospital({ id: '990013', st: 'TX', red: 0, paf: 1, pen: 0, c: {} }),
    hospital({ id: '990021', st: 'OH', red: 0, paf: 1, pen: null, base: null, c: {} }),
  ];
  const d = mapData(ctxOf(hs));
  const tx = d.rows.find((r) => r.code === 'TX');
  const oh = d.rows.find((r) => r.code === 'OH');
  assert.equal(tx.s.nMeasured, 2);
  assert.equal(tx.m.share.value, 50, '1 cut of 2 measured, not of 3');
  assert.equal(tx.m.ge1.value, 33, '1 cut 1% or more of ALL 3 hospitals, as the old site (the other shares are of the 2 measured)');
  assert.equal(tx.m.avg.value, 0.67, 'the average cut counts all three');
  assert.equal(oh.m.share, null);
  assert.equal(oh.m.ge1.value, 0, 'over all hospitals: 0 of 1, not nothing to measure');
  assert.equal(oh.m.dollars, null, 'no hospital with a dollar estimate');
  assert.ok(oh.m.avg);
  const html = partOf(hs);
  assert.equal(stepIn(html, 'share', 'OH'), null);
  assert.equal(stepIn(html, 'dollars', 'OH'), null);
  assert.match(html, /<title>Ohio: no hospital measured on a condition<\/title>/);
});

test('Maryland is hatched with the sourced wording, other missing states are plain, and no reason is given for Maryland', () => {
  const html = partOf([hospital({ id: '990011', st: 'TX' })]);
  assert.match(html, /Maryland: hospitals not in the program/);
  assert.match(html, /Ohio: no hospitals in the program/);
  assert.match(html, /non-Maryland subsection \(d\) hospitals/);
  assert.doesNotMatch(html, /payment model|Exempt/i);
  assert.match(html, /chart-tile-na chart-geo-state/, 'Maryland hatched');
  assert.match(html, /chart-tile-empty chart-geo-state/, 'other missing states plain');
  // A file that does hold Maryland hospitals shades it and says nothing of the exemption.
  const withMd = partOf([hospital({ id: '990011', st: 'TX' }), hospital({ id: '990012', st: 'MD' })]);
  assert.doesNotMatch(withMd, /non-Maryland|not in the program<\/p>/);
});

test('four maps are drawn, the first shown and the other three hidden for the switch; the dots layer is there and off', () => {
  const html = partOf([hospital({ id: '990011', st: 'TX' }), hospital({ id: '990021', st: 'OH' })]);
  const maps = [...html.matchAll(/<div class="usmap__m" data-measure="(\w+)"( hidden)?>/g)];
  assert.deepEqual(maps.map((x) => x[1]), ['avg', 'share', 'dollars', 'ge1']);
  assert.deepEqual(maps.map((x) => Boolean(x[2])), [false, true, true, true]);
  assert.match(html, /<div class="usmap" data-measure="avg" data-dots="off">/);
  assert.match(html, /<div class="usmap__controls" hidden>/);
  assert.match(html, /<g class="chart-us__points">/);
  assert.match(html, /data-dots aria-pressed="false"/);
  assert.equal((html.match(/<svg /g) ?? []).length, 9, 'a narrow and a wide drawing of each measure, and the dot layer once');
  assert.equal((html.match(/<g class="chart-us__points">/g) ?? []).length, 1);
  // each measure's legend is its own
  for (const title of ['Average cut', 'Share penalized', 'Estimated dollars', 'Share cut 1% or more']) assert.ok(html.includes(title), title);
});

test('no outlines or nothing to shade: no map figure, no figure number used', () => {
  const hs = [hospital({ id: '990011', st: 'TX' })];
  let used = 0;
  const data = mapData({ ...ctxOf(hs), shapes: null });
  const html = mapPart(data, { figure: () => ++used, edition: 'FY2027' }).text;
  assert.equal(used, 0);
  assert.doesNotMatch(html, /<svg/);
  assert.match(html, /Every state/);
});

test('dot area follows base payments, from a fixed set of sizes; a hospital with no base is the smallest', () => {
  const hs = [1e6, 4e6, 9e6, 16e6, null].map((base, i) => hospital({ id: `99003${i}`, base }));
  const dots = dotPoints(hs);
  assert.equal(dots.length, 5);
  const tiers = dots.map((d) => d.tier);
  assert.deepEqual(tiers.slice(0, 4), [...tiers.slice(0, 4)].sort((a, b) => a - b), 'larger base, larger dot');
  assert.equal(tiers[3], DOT_TIERS);
  assert.equal(tiers[4], 1);
  // area (tier squared) is about proportional to the base where the tiers resolve it: 16M is four times 4M
  assert.ok(Math.abs((tiers[3] ** 2) / (tiers[1] ** 2) - 4) < 1.5);
  assert.deepEqual(dotPoints([hospital({ id: '990040', lat: null })]), []);
});

test('"Every state": average cut descending, 15 to a page, a link on each state', () => {
  const codes = US_MAP_CODES.filter((c) => c !== 'MD').slice(0, 20);
  const hs = codes.map((st, i) => hospital({ id: `9900${String(i).padStart(2, '0')}`, st, red: i % 7, paf: 1 - (i % 7) / 100 }));
  const d = mapData(ctxOf(hs));
  assert.equal(d.pages.length, 2);
  assert.deepEqual(d.pages.map((p) => p.length), [15, 5]);
  const flat = d.pages.flat();
  for (let i = 1; i < flat.length; i++) assert.ok(flat[i - 1].s.meanRed >= flat[i].s.meanRed);
  const html = partOf(hs);
  const bodies = [...html.matchAll(/<tbody data-page="(\d+)">(.*?)<\/tbody>/gs)];
  assert.deepEqual(bodies.map((b) => (b[2].match(/<tr>/g) ?? []).length), [15, 5]);
  assert.match(html, /<nav class="states__pager"[^>]* hidden>/);
  for (const r of flat) assert.ok(bodies.map((b) => b[2]).join('').includes(`href="${r.path}"`));
  assert.match(html, /href="\/data\/hrrp\/fy2027\/states\.csv" download/);
});

test('the states CSV has the eight columns with the counts behind each share', () => {
  const hs = [
    hospital({ id: '990011', st: 'TX', red: 2, paf: 0.98, pen: 100, c: { HF: m(40, 1) } }),
    hospital({ id: '990012', st: 'TX', red: 0, paf: 1, pen: 0, c: {} }),
    hospital({ id: '990021', st: 'OH', red: 0.5, paf: 0.995, pen: 50, c: { HF: m(40, 1) } }),
  ];
  const rows = statesCsvRows(mapData(ctxOf(hs)).pages);
  const text = placeCsv(rows);
  assert.equal(placeColumns('State').length, 8);
  const parsed = parseCsv(text);
  assert.deepEqual(Object.keys(parsed[0]), ['State', 'Hospitals', 'Hospitals measured', 'Hospitals penalized', 'Penalized (% of measured)', 'Average cut (%)', 'Cut 1% or more (hospitals)', 'Estimated penalties ($, modeled)']);
  const tx = parsed.find((r) => r.State === 'TX');
  assert.deepEqual([tx.Hospitals, tx['Hospitals measured'], tx['Hospitals penalized'], tx['Penalized (% of measured)'], tx['Average cut (%)'], tx['Cut 1% or more (hospitals)']], ['2', '1', '1', '100', '1', '1']);
  assert.equal(parsed[0].State, 'TX', 'the highest average cut first');
  assert.ok(text.includes('\r\n'));
});

test('"Browse by region" links every region, division and state page', () => {
  const hs = [hospital({ id: '990011', st: 'TX' }), hospital({ id: '990021', st: 'OH', division: 'Great Lakes', region: 'Midland' }), hospital({ id: '990031', st: 'WA', division: 'Pacific Coast' })];
  const ctx = ctxOf(hs);
  const html = partOf(hs);
  const block = html.slice(html.indexOf('id="map-browse-h"'));
  for (const p of ctx.places.list.filter((x) => ['region', 'division', 'state'].includes(x.kind))) assert.ok(block.includes(`href="${p.path}"`), p.path);
  assert.doesNotMatch(block, /href="\/hrrp\/metro\//);
});

test('on the whole file: the Part is on the program page, its numbers are the data, the page is not over budget', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const ctx = areaContext({ ...data, places });
  const view = programView(ctx);
  assert.ok(view.map.shapes);
  const states = places.list.filter((p) => p.kind === 'state');
  assert.equal(view.map.rows.length, states.length);
  assert.equal(view.map.pages.flat().length, states.length);
  assert.equal(view.map.pages.every((p) => p.length <= 15), true);
  assert.equal(view.map.notInProgram, 'MD');
  // every shaded state's bin agrees with its shown value
  for (const r of view.map.rows) for (const me of MEASURES) if (r.m[me.key]) assert.equal(r.m[me.key].bin, binOf(me, r.m[me.key].raw));
  const page = programPage({ view, robots: null, assets: ASSETS });
  assert.match(page, /id="map"/);
  assert.equal((page.match(/data-measure="\w+"( hidden)?>/g) ?? []).length >= 4, true);
  assert.equal(stepIn(page, 'avg', 'TX') != null, true);
  assert.equal(stepIn(page, 'avg', 'MD'), null);
});

test('the share cut 1% or more is over all the state\'s hospitals, an unmeasured one included, on the map, tip and table', () => {
  const hs = [
    hospital({ id: '990011', st: 'TX', red: 2, paf: 0.98, pen: 100, c: { HF: m(40, 1) } }),
    hospital({ id: '990012', st: 'TX', red: 0, paf: 1, pen: 0, c: { HF: m(40, 0) } }),
    hospital({ id: '990013', st: 'TX', red: 0, paf: 1, pen: 0, c: {} }),
    hospital({ id: '990014', st: 'TX', red: 0, paf: 1, pen: 0, c: {} }),
  ];
  const tx = mapData(ctxOf(hs)).rows.find((r) => r.code === 'TX');
  assert.equal(tx.s.nMeasured, 2);
  assert.equal(tx.m.ge1.raw, 25, '1 of 4, not 1 of 2');
  const html = partOf(hs);
  assert.equal(stepIn(html, 'ge1', 'TX'), 5, '25% shown is past the 16 edge (it would be 50% over the 2 measured, also 5, so the tip pins the count)');
  assert.match(html, /<title>Texas: 25% cut 1% or more: 1 of 4 hospitals<\/title>/);
});

test('dollars: a state at $0 modeled takes the first step; no color only where no hospital has an estimate', () => {
  const hs = [
    hospital({ id: '990011', st: 'TX', red: 0, paf: 1, pen: 0, c: { HF: m(40, 0) } }),
    hospital({ id: '990021', st: 'OH', red: 0, paf: 1, pen: null, base: null, c: { HF: m(40, 0) } }),
  ];
  const d = mapData(ctxOf(hs));
  assert.equal(d.rows.find((r) => r.code === 'TX').m.dollars.bin, 1);
  assert.equal(d.rows.find((r) => r.code === 'OH').m.dollars, null);
  const html = partOf(hs);
  assert.equal(stepIn(html, 'dollars', 'TX'), 1);
  assert.equal(stepIn(html, 'dollars', 'OH'), null);
  assert.equal(stepIn(html, 'avg', 'TX'), 'zero', 'the other measures still draw a zero plain');
});

test('the dot layer shows only at the wide drawing\'s widths: its on-state rule sits only under the min-width query', () => {
  const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
  const rule = '.usmap[data-dots="on"] .usmap__dots';
  assert.equal(css.split(rule).length - 1, 1);
  const line = css.split('\n').find((l) => l.includes(rule));
  assert.match(line, /^@media \(min-width: 560px\)/);
  assert.doesNotMatch(css, /max-width: 559px\) \{ \.usmap \.usmap__dots/);
});

test('the sheet pins the map Part\'s grids to the column so the states table cannot widen the page', () => {
  const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
  for (const sel of ['usmap', 'states', 'browse']) assert.match(css, new RegExp(`^\\.${sel} \\{[^}]*grid-template-columns: minmax\\(0, 1fr\\)`, 'm'), `.${sel} has an implicit grid column`);
  assert.match(css, /^\.browse__regions \{[^}]*minmax\(min\(16rem, 100%\), 1fr\)/m);
});
