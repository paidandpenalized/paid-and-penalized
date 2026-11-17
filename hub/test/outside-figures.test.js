// The figures of a hospital's page outside Medicare's penalty programs (hub/hospital/outside-figures.js), and the map kit
// they share with the program sites (web/charts/geo.js nearestTo and areaMap's context dots). Rows are picked by property,
// never by name or CCN; failure messages print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { STATE_NAMES } from '../../engine/js/states.js';
import { ASSETS } from '../../pipeline/test/helpers.js';
import { areaMap, miles, nearestTo, pointOf, usProjected } from '../../web/charts/geo.js';
import { count } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { hospitalPathOf } from '../../web/site.js';
import { MAP_WIDTH } from '../asset.js';
import { hubModel } from '../data.js';
import { hasOutside, fillOutside } from '../hospital/outside-copy.js';
import { NEAREST_K, NEAR_MAX_MILES, likeBlock, milesText, nearBlock } from '../hospital/outside-figures.js';
import { outsidePage } from '../hospital/page.js';
import { likeGroupOf } from '../outside.js';
import { mainOf } from './helpers.js';

const { hub: HUB, hospitals: HOSPITALS, outside: OUTSIDE, likeCounts: LIKE_COUNTS } = hubModel();
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
    const h = pick((x) => x.group === group && placed(x), `a ${group} hospital with a place`);
    assert.equal(near(h), '', `${group}: no nearest hospitals`);
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

// Hospitals like this one. Counts are checked against a recount from the hospital master itself (every record the dollar
// file does not estimate, grouped by its reason code), not against likeCounts, which the page reads.
const like = (h) => String(likeBlock(h, { counts: LIKE_COUNTS, sameGroup: sameGroup(h), shapes: HUB.shapes, programYears: HUB.programYears }));
const YEARS = { hacrpFy: String(HUB.programYears.hacrp), hrrpFy: String(HUB.programYears.hrrp) };
const textOf = (block) => block.replace(/<[^>]*>/g, '');
const projected = (h) => usProjected(HUB.shapes, [pointOf(h)], MAP_WIDTH)[0];
const mapped = (h) => placed(h) && projected(h) !== null;
const DOLLAR_CCNS = new Set(HUB.dollars.hospitals.map((r) => r.ccn));
const RECOUNT = (() => {
  const out = new Map();
  for (const [ccn, r] of HUB.master) {
    if (DOLLAR_CCNS.has(ccn)) continue;
    const g = likeGroupOf(r);
    if (!out.has(g)) out.set(g, { n: 0, byState: new Map(), listed: 0 });
    const c = out.get(g);
    c.n += 1;
    c.byState.set(r.state, (c.byState.get(r.state) ?? 0) + 1);
    if (r.programs.hacrp.inProgram || r.programs.hrrp.inProgram) c.listed += 1;
  }
  return out;
})();
// The sentence the block should print for h, filled from the recount.
function expectedLike(h) {
  const c = RECOUNT.get(h.group);
  const state = STATE_NAMES[h.state];
  const values = { n: count(c.n), kinds: fillOutside(`likeCount.${h.group}`), ...(state ? { ns: count(c.byState.get(h.state)), state } : {}) };
  if (h.group !== 'not_listed') return fillOutside(state ? 'likeText' : 'likeTextNoState', values);
  const some = c.listed > 0;
  return fillOutside(`likeTextNotListed${some ? 'Some' : ''}${state ? '' : 'NoState'}`, { ...values, ...YEARS, ...(some ? { k: count(c.listed) } : {}) });
}

test('likeBlock: the count and state count equal a recount from the master', () => {
  for (const group of RECOUNT.keys()) {
    const h = pick((x) => x.group === group && STATE_NAMES[x.state], `a ${group} hospital in a named state`);
    const block = like(h);
    assert.ok(block.includes('class="hh__like"'), `${group}: the section`);
    assert.ok(block.includes(esc(fillOutside('likeHeading'))), `${group}: the heading`);
    assert.ok(block.includes(`<span class="hh__likek">${count(RECOUNT.get(group).n)}</span>`), `${group}: the big count is the group's national count`);
    assert.ok(textOf(block).includes(esc(expectedLike(h))), `${group}: the sentence names the national and state counts from the master`);
    const own = `own.${group}`;
    assert.ok(hasOutside(own) ? block.includes(esc(fillOutside(own))) : !block.includes('class="hh__likeown"'), `${group}: its own program's line where it has one`);
  }
  // not_listed pages say what the files list, never that the programs adjust none of them.
  const nl = pick((x) => x.group === 'not_listed', 'an unlisted acute hospital');
  assert.ok(!/adjust none/.test(textOf(like(nl))), 'not_listed: no "adjust none" sentence');
  // A territory STATE_NAMES lacks: the national count alone.
  const terr = pick((x) => !STATE_NAMES[x.state], 'a hospital in a territory without a state name');
  assert.ok(textOf(like(terr)).includes(esc(expectedLike(terr))), 'a territory: the sentence without a state');
});

test('likeBlock: the map marks this hospital, and the dot count equals the group\'s mappable hospitals minus one', () => {
  for (const group of ['critical_access', 'psychiatric', 'va']) {
    const h = pick((x) => x.group === group && mapped(x), `a ${group} hospital on the US map`);
    const block = like(h);
    const svg = /<svg [^>]*role="img"[^>]*>/.exec(block)?.[0];
    assert.ok(svg, `${group}: an image`);
    assert.ok(/aria-label="[^"]+"/.test(svg), `${group}: named`);
    assert.ok(block.includes('class="chart-land"'), `${group}: the state lines`);
    // The same group's other hospitals the projection places, counted here, against the dots in the path.
    const others = sameGroup(h).filter((x) => x.ccn !== h.ccn);
    const want = usProjected(HUB.shapes, others.map(pointOf), MAP_WIDTH).filter(Boolean).length;
    const d = /<path class="chart-dots hh__likedot"[^>]* d="([^"]*)"/.exec(block)?.[1] ?? '';
    assert.ok((d.match(/h0/g) ?? []).length === want, `${group}: a dot for each other mappable hospital of the group`);
    // This hospital: a ring and a dot at its place.
    const [x, y] = projected(h);
    assert.ok(block.includes(`<circle class="hh__likering" cx="${x}" cy="${y}"`) && block.includes(`<circle class="hh__likeme" cx="${x}" cy="${y}"`), `${group}: this hospital ringed at its place`);
    assert.ok(block.indexOf('class="hh__likeme"') > block.indexOf('hh__likedot'), `${group}: drawn over the other dots`);
  }
});

test('likeBlock: no map for a Puerto Rico or Guam hospital, or one without coordinates, and the text is still there', (t) => {
  const cases = [
    pick((x) => x.state === 'PR', 'a Puerto Rico hospital'),
    pick((x) => x.state === 'GU', 'a Guam hospital'),
    pick((x) => !placed(x), 'a hospital without coordinates'),
  ];
  for (const h of cases) {
    const block = like(h);
    assert.ok(!block.includes('<svg'), 'no map');
    assert.ok(textOf(block).includes(esc(expectedLike(h))), 'the count and sentence');
  }
  const none = OUTSIDE.filter((x) => !mapped(x)).length;
  assert.ok(none > 0, 'some pages have no map');
  t.diagnostic(`${none} outside pages have no "hospitals like this one" map (a territory the US map has no inset for, or no coordinates)`);
});

// The page-weight ceiling for an outside page, gzip: the HACRP hospital page for the example CCN measured about 39 KB
// gzip on the 11-17 build; this allows that plus room for the shell's growth. A rendered page is measured here, not dist/.
const PAGE_GZIP_MAX = 45 * 1024;

test('outside page weight: a critical access page (nearest plus like map) is within the HACRP hospital page\'s gzip size', () => {
  const h = pick((x) => x.group === 'critical_access' && mapped(x) && !x.listed && near(x) !== '', 'a critical access hospital with both figures');
  const page = outsidePage({
    h, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), medicaid: HUB.medicaid, programYears: HUB.programYears,
    near: nearBlock(h, { estimated: ESTIMATED, outsideSameGroup: sameGroup(h), shapes: HUB.shapes, counties: HUB.counties, fy: FY }),
    like: likeBlock(h, { counts: LIKE_COUNTS, sameGroup: sameGroup(h), shapes: HUB.shapes, programYears: HUB.programYears }),
  });
  const main = mainOf(page);
  assert.ok(main.indexOf('class="hh__like"') > main.indexOf('class="hh__near"') && main.indexOf('class="hh__like"') < main.indexOf('class="hh__notes"'), 'after the nearest hospitals, before the notes');
  assert.ok(gzipSync(page).length <= PAGE_GZIP_MAX, 'gzip size within PAGE_GZIP_MAX');
});
