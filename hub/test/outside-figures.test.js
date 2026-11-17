// The figures of a hospital's page outside Medicare's penalty programs (hub/hospital/outside-figures.js), and the map kit
// they share with the program sites (web/charts/geo.js nearestTo and areaMap's context dots). Rows are picked by property,
// never by name or CCN; failure messages print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS } from '../../pipeline/test/helpers.js';
import { areaMap, miles, nearestTo, pointOf } from '../../web/charts/geo.js';
import { escapeHtml } from '../../web/render/html.js';
import { hospitalPathOf } from '../../web/site.js';
import { hubModel } from '../data.js';
import { fillOutside } from '../hospital/outside-copy.js';
import { NEAREST_K, NEAR_MAX_MILES, milesText, nearBlock } from '../hospital/outside-figures.js';
import { outsidePage } from '../hospital/page.js';
import { mainOf } from './helpers.js';

const { hub: HUB, hospitals: HOSPITALS, outside: OUTSIDE } = hubModel();
const FY = String(ASSETS.shell.fy);
const ESTIMATED = HOSPITALS.filter((h) => h.est);
const esc = (text) => String(escapeHtml(text));
const sameGroup = (h) => OUTSIDE.filter((x) => x.group === h.group);
const near = (h) => String(nearBlock(h, { estimated: ESTIMATED, outsideSameGroup: sameGroup(h), shapes: HUB.shapes, counties: HUB.counties, fy: FY }));
const pick = (pred, what) => {
  const h = OUTSIDE.find(pred);
  assert.ok(h, `the data has ${what}`);
  return h;
};
const placed = (h) => pointOf(h) !== null;
// The table body's rows, and the hub page each links, in order.
const bodyOf = (block) => block.slice(block.indexOf('<tbody>'), block.indexOf('</tbody>'));
const rowsOf = (block) => bodyOf(block).split('<tr').slice(1);
const linkedCcns = (block) => rowsOf(block).map((row) => /href="\/hospital\/([0-9a-z]+)\/"/.exec(row)?.[1]?.toUpperCase() ?? null);

test('nearestTo: returns the k nearest, nearest first, ties by CCN', () => {
  // On the equator, a degree of longitude apart; two rows tie at the same place; one has no place; one is skipped.
  const rows = [
    { ccn: '000005', point: [3, 0] },
    { ccn: '000002', point: [1, 0] },
    { ccn: '000004', point: [2, 0] },
    { ccn: '000003', point: [2, 0] },
    { ccn: '000009', point: null },
    { ccn: '000001', point: [0.5, 0] },
    { ccn: '000006', point: [0, 0] },
  ];
  const got = nearestTo(rows, [0, 0], { k: 4, skip: '000006' });
  assert.deepEqual(got.map((r) => r.ccn), ['000001', '000002', '000003', '000004'], 'nearest first, the tie by the lower CCN, the skipped and the unplaced left out');
  assert.ok(got.every((r) => Math.abs(r.miles - miles([0, 0], r.point)) < 1e-9), 'each carries its distance in miles');
  assert.deepEqual(got[0], { ccn: '000001', point: [0.5, 0], miles: got[0].miles }, 'each row is the input row with miles added');
  assert.equal(nearestTo(rows, [0, 0], { k: 10 }).length, 6, 'fewer than k placed rows: all of them');
  assert.equal(nearestTo(rows, [0, 0], { k: 10 })[0].ccn, '000006', 'nothing skipped by default');
});

test('areaMap: context dots are plain circles under the pins, inside the frame only', () => {
  const shapes = new Map();
  const pts = [{ point: [-86.5, 34.7], n: 1, cls: 'chart-pin--no', tip: 'one' }, { point: [-86.9, 34.8], n: 2, cls: 'chart-pin--yes', tip: 'two' }];
  const context = [{ point: [-86.7, 34.75], cls: 'ctx-a' }, { point: [-60, 10], cls: 'ctx-a' }, { point: null, cls: 'ctx-a' }];
  const svg = String(areaMap({ shapes, center: { point: [-86.6, 34.7], tip: 'x' }, points: pts, context, label: 'Map' }));
  assert.equal((svg.match(/<circle class="ctx-a"/g) ?? []).length, 1, 'the one in the frame, as a circle');
  assert.ok(svg.indexOf('class="ctx-a"') < svg.indexOf('class="chart-pin '), 'under the pins');
  assert.ok(!/<g class="chart-mark"[^>]*><title>[^<]*<\/title><circle class="ctx-a"/.test(svg), 'not a mark');
  const bare = String(areaMap({ shapes, center: { point: [-86.6, 34.7], tip: 'x' }, points: pts, label: 'Map' }));
  assert.ok(!bare.includes('ctx-a'), 'none without context');
});

test('nearBlock: on a critical access page, 5 rows, all estimated, sorted by miles, caption counts match the rows', () => {
  const h = pick((x) => x.group === 'critical_access' && placed(x), 'a critical access hospital with a place');
  const block = near(h);
  assert.ok(block.includes('class="hh__near"'), 'the section');
  const ccns = linkedCcns(block);
  assert.equal(ccns.length, NEAREST_K, 'NEAREST_K rows');
  const byCcn = new Map(ESTIMATED.map((x) => [x.ccn, x]));
  assert.ok(ccns.every((c) => c && byCcn.has(c)), 'each row links an estimated hospital');
  for (const c of ccns) assert.ok(block.includes(`href="${hospitalPathOf('hub', c)}"`), 'linked to its hub page');
  // The nearest, written out again: every estimated hospital by distance (ties by the lower CCN), the first k.
  const at = pointOf(h);
  const all = ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, d: miles(at, pointOf(x)) })).sort((a, b) => a.d - b.d || (a.ccn < b.ccn ? -1 : 1));
  assert.deepEqual(ccns, all.slice(0, NEAREST_K).map((x) => x.ccn), 'the k nearest, nearest first');
  // The caption: the closest one's distance, and how many of the rows the programs cut on net.
  const rows = ccns.map((c) => byCcn.get(c));
  const k = rows.filter((x) => x.est.net < 0).length;
  const key = k === 0 ? 'nearCaptionNone' : k === rows.length ? 'nearCaptionAll' : 'nearCaption';
  const caption = fillOutside(key, { miles: milesText(all[0].d), n: String(rows.length), ...(key === 'nearCaption' ? { k: String(k) } : {}) });
  assert.ok(block.includes(esc(caption)), 'the caption counts the rows');
  assert.equal(rowsOf(block).filter((r) => r.includes('near__cut--pen')).length, k, 'a cut in the pen ink, row by row');
  assert.ok(block.includes(esc(fillOutside('nearHeading'))), 'the heading');
  assert.ok(block.includes(esc(fillOutside('nearColNet', { fy: FY }))), 'the net column names the year');
  // The map: a numbered pin per row, and the same group's hospitals as context dots, this one not among them.
  assert.equal((block.match(/class="chart-pin /g) ?? []).length, NEAREST_K, 'a pin per row');
  assert.ok(block.includes('class="chart chart--area-map"'), 'the area map');
  assert.ok(block.includes('data-figure'), 'a figure the tooltip script wires');
});

test('nearBlock: rural emergency and unlisted acute pages have it too', () => {
  const rows = ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, point: pointOf(x) }));
  for (const group of ['rural_emergency', 'not_listed']) {
    const h = pick((x) => x.group === group && placed(x) && nearestTo(rows, pointOf(x), { k: 1 })[0].miles <= NEAR_MAX_MILES, `a ${group} hospital near one the programs adjust`);
    assert.equal(linkedCcns(near(h)).length, NEAREST_K, `${group}: the nearest hospitals`);
  }
});

test('nearBlock: none on a federal or psychiatric page; none when the nearest is over 250 miles', () => {
  for (const group of ['va', 'dod', 'psychiatric', 'childrens', 'cancer', 'long_term', 'inactive']) {
    const h = OUTSIDE.find((x) => x.group === group && placed(x));
    if (h) assert.equal(near(h), '', `${group}: no nearest hospitals`);
  }
  const cah = pick((x) => x.group === 'critical_access' && placed(x), 'a critical access hospital with a place');
  // A point in the Pacific, far from any hospital the programs adjust.
  const sea = { ...cah, lat: 30, lon: -140 };
  assert.ok(ESTIMATED.filter(placed).every((x) => miles(pointOf(sea), pointOf(x)) > NEAR_MAX_MILES), 'the test point is beyond the limit');
  assert.equal(near(sea), '', 'no table beyond NEAR_MAX_MILES');
  assert.equal(near({ ...cah, lat: null, lon: null }), '', 'none without a place');
});

// Puerto Rico's unlisted hospitals follow the same distance rule as every page, not a rule of their own: the section shows
// exactly when the closest estimated hospital is within NEAR_MAX_MILES. (No Puerto Rico hospital is in the dollar file, so
// on today's files the closest is on the mainland and none of these pages has it.)
test('nearBlock: Puerto Rico not_listed pages follow the distance rule', () => {
  const pr = OUTSIDE.filter((x) => x.state === 'PR' && x.group === 'not_listed' && placed(x));
  assert.ok(pr.length > 0, 'the data has unlisted Puerto Rico hospitals with a place');
  const rows = ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, point: pointOf(x) }));
  for (const h of pr) {
    const close = nearestTo(rows, pointOf(h), { k: 1 })[0].miles <= NEAR_MAX_MILES;
    assert.equal(linkedCcns(near(h)).length, close ? NEAREST_K : 0, 'a Puerto Rico page has the nearest hospitals exactly when one is close');
  }
});

test('outside page: the nearest hospitals bring the figure script; a page without them has none', () => {
  const h = pick((x) => x.group === 'critical_access' && placed(x) && !x.listed, 'a critical access hospital with a place');
  const args = { h, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), medicaid: HUB.medicaid, programYears: HUB.programYears };
  const block = nearBlock(h, { estimated: ESTIMATED, outsideSameGroup: sameGroup(h), shapes: HUB.shapes, counties: HUB.counties, fy: FY });
  const page = outsidePage({ ...args, near: block });
  assert.ok(page.includes(`src="${ASSETS.js.figure}"`), 'the figure script');
  const main = mainOf(page);
  assert.ok(main.indexOf('class="hh__near"') > main.indexOf('class="wrap hh__hero"') && main.indexOf('class="hh__near"') < main.indexOf('class="hh__notes"'), 'after the hero, before the notes');
  assert.ok(!outsidePage(args).includes(`src="${ASSETS.js.figure}"`), 'no figure script without them');
});
