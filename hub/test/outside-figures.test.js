// The figures of a hospital's page outside Medicare's penalty programs (hub/hospital/outside-figures.js), and the map kit
// they share with the program sites (web/charts/geo.js nearestTo and areaMap's context dots). Rows are picked by property,
// never by name or CCN; failure messages print no hospital's name, CCN or figure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync } from 'node:zlib';
import { STATE_NAMES } from '../../engine/js/states.js';
import { ASSETS } from '../../pipeline/test/helpers.js';
import { areaMap, miles, nearestTo, pointOf, usProjected } from '../../web/charts/geo.js';
import { count } from '../../web/render/format.js';
import { escapeHtml } from '../../web/render/html.js';
import { milesText } from '../../web/render/miles.js';
import { hospitalPathOf } from '../../web/site.js';
import { MAP_WIDTH } from '../asset.js';
import { hubModel } from '../data.js';
import { hasOutside, fillOutside } from '../hospital/outside-copy.js';
import { NEAREST_K, NEAR_GROUPS, NEAR_MAX_MILES, likeBlock, nearBlock, outsideFigureContext } from '../hospital/outside-figures.js';
import { outsidePage } from '../hospital/page.js';
import { likeGroupOf } from '../outside.js';
import { mainOf } from './helpers.js';

const { hub: HUB, hospitals: HOSPITALS, outside: OUTSIDE, likeCounts: LIKE_COUNTS } = hubModel();
const FY = String(ASSETS.shell.fy);
const ESTIMATED = HOSPITALS.filter((h) => h.est);
const esc = (text) => String(escapeHtml(text));
const sameGroup = (h) => OUTSIDE.filter((x) => x.group === h.group);
// The figures' context, built once as the build builds it.
const CTX = outsideFigureContext({ hospitals: HOSPITALS, outside: OUTSIDE, likeCounts: LIKE_COUNTS, master: HUB.master, shapes: HUB.shapes, counties: HUB.counties, programYears: HUB.programYears, fy: HUB.fy });
const near = (h) => String(nearBlock(h, CTX));
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
// The rows a page should list, written out again: every estimated hospital by distance from h (ties by the lower CCN),
// the first NEAREST_K, only those within NEAR_MAX_MILES; and every one, unlimited (all).
const byDistance = (h) => ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, d: miles(pointOf(h), pointOf(x)) })).sort((a, b) => a.d - b.d || (a.ccn < b.ccn ? -1 : 1));
const within = (h) => byDistance(h).slice(0, NEAREST_K).filter((x) => x.d <= NEAR_MAX_MILES);

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
  assert.deepEqual(nearestTo(rows, [0, 0], { k: 0 }), [], 'k of zero: none');
  assert.deepEqual(nearestTo(rows, [0, 0], { k: -1 }), [], 'k below zero: none');
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
  const h = pick((x) => x.group === 'critical_access' && placed(x) && within(x).length === NEAREST_K, 'a critical access hospital with NEAREST_K estimated hospitals close');
  const block = near(h);
  assert.ok(block.includes('class="hh__near"'), 'the section');
  const ccns = linkedCcns(block);
  assert.equal(ccns.length, NEAREST_K, 'NEAREST_K rows');
  const byCcn = new Map(ESTIMATED.map((x) => [x.ccn, x]));
  assert.ok(ccns.every((c) => c && byCcn.has(c)), 'each row links an estimated hospital');
  for (const c of ccns) assert.ok(block.includes(`href="${hospitalPathOf('hub', c)}"`), 'linked to its hub page');
  const all = byDistance(h);
  assert.deepEqual(ccns, within(h).map((x) => x.ccn), 'the k nearest, nearest first');
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
  // The keyboard hint the figure script names as the map's description, as HACRP's hospital page has one.
  const id = /<figure class="fig hh__nearmap" id="([^"]+)"/.exec(block)?.[1];
  assert.ok(id && block.includes(`<p id="${id}-keys" hidden>${esc(fillOutside('nearKeys'))}</p>`), 'the map\'s keyboard hint, after it');
});

test('nearBlock: rural emergency and unlisted acute pages have it too', () => {
  const rows = ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, point: pointOf(x) }));
  for (const group of ['rural_emergency', 'not_listed']) {
    const h = pick((x) => x.group === group && placed(x) && nearestTo(rows, pointOf(x), { k: 1 })[0].miles <= NEAR_MAX_MILES, `a ${group} hospital near one the programs adjust`);
    assert.ok(isDeepStrictEqual(linkedCcns(near(h)), within(h).map((x) => x.ccn)), `${group}: the nearest hospitals`);
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
    assert.ok(linkedCcns(near(h)).length === within(h).length && (within(h).length > 0) === close, 'a Puerto Rico page has the nearest hospitals exactly when one is close');
  }
});

// Only hospitals within NEAR_MAX_MILES are listed, not just the closest: a page whose k-th nearest is farther lists fewer.
test('nearBlock: rows beyond NEAR_MAX_MILES are left out, though nearer than the k-th', () => {
  // Candidates found with the kit's nearestTo (fast), each then checked against the full sort.
  const rows = ESTIMATED.filter(placed).map((x) => ({ ccn: x.ccn, point: pointOf(x) }));
  const short = OUTSIDE.filter((x) => NEAR_GROUPS.has(x.group) && placed(x)).filter((x) => {
    const got = nearestTo(rows, pointOf(x), { k: NEAREST_K });
    return got[0].miles <= NEAR_MAX_MILES && got.at(-1).miles > NEAR_MAX_MILES;
  }).filter((x) => within(x).length > 0 && byDistance(x)[NEAREST_K - 1].d > NEAR_MAX_MILES);
  assert.ok(short.length > 0, 'the data has a page whose k-th nearest is beyond the limit');
  for (const h of short) {
    const block = near(h);
    const want = within(h);
    assert.ok(isDeepStrictEqual(linkedCcns(block), want.map((x) => x.ccn)), 'only those within the limit, nearest first');
    // The caption, written out again for the rows listed: its own words for a table of one.
    const k = want.filter((x) => ESTIMATED.find((e) => e.ccn === x.ccn).est.net < 0).length;
    const miles1 = milesText(want[0].d);
    const caption = want.length === 1 ? fillOutside(k ? 'nearCaptionOneCut' : 'nearCaptionOneNotCut', { miles: miles1 })
      : k === 0 ? fillOutside('nearCaptionNone', { miles: miles1, n: String(want.length) })
        : k === want.length ? fillOutside('nearCaptionAll', { miles: miles1, n: String(want.length) })
          : fillOutside('nearCaption', { miles: miles1, n: String(want.length), k: String(k) });
    assert.ok(block.includes(esc(caption)), 'the caption counts the rows listed');
    assert.ok(want.length > 1 || !block.includes('<svg'), 'a table of one stands alone (an area map needs two)');
  }
});

test('outside page: the nearest hospitals bring the figure script; a page without them has none', () => {
  const h = pick((x) => x.group === 'critical_access' && placed(x) && !x.listed, 'a critical access hospital with a place');
  const args = { h, assets: ASSETS, robots: null, master: HUB.master.get(h.ccn), medicaid: HUB.medicaid, programYears: HUB.programYears };
  const block = nearBlock(h, CTX);
  const page = outsidePage({ ...args, near: block });
  assert.ok(page.includes(`src="${ASSETS.js.figure}"`), 'the figure script');
  const main = mainOf(page);
  assert.ok(main.indexOf('class="hh__near"') > main.indexOf('class="wrap hh__hero"') && main.indexOf('class="hh__near"') < main.indexOf('class="hh__notes"'), 'after the hero, before the notes');
  assert.ok(!outsidePage(args).includes(`src="${ASSETS.js.figure}"`), 'no figure script without them');
});

// Hospitals like this one. Counts are checked against a recount from the hospital master itself (every record the dollar
// file does not estimate, grouped by its reason code), not against likeCounts, which the page reads.
const like = (h) => String(likeBlock(h, CTX));
const YEARS = { hacrpFy: String(HUB.programYears.hacrp), hrrpFy: String(HUB.programYears.hrrp) };
// A group's noun: the unlisted acute group's names the hospital-acquired conditions file's year.
const kindsOf = (group) => fillOutside(`likeCount.${group}`, group === 'not_listed' ? { hacrpFy: YEARS.hacrpFy } : {});
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
    if (g === 'not_listed') c.inHacrp = (c.inHacrp ?? 0) + Number(Boolean(r.programs.hacrp.inProgram));
    if (g === 'not_listed') c.inHrrp = (c.inHrrp ?? 0) + Number(Boolean(r.programs.hrrp.inProgram));
  }
  return out;
})();
// The sentence the block should print for h, filled from the recount.
function expectedLike(h) {
  const c = RECOUNT.get(h.group);
  const state = STATE_NAMES[h.state];
  const values = { n: count(c.n), kinds: kindsOf(h.group), ...(state ? { ns: count(c.byState.get(h.state)), state } : {}) };
  if (h.group !== 'not_listed') return fillOutside(state ? 'likeText' : 'likeTextNoState', values);
  const some = c.listed > 0;
  return fillOutside(`likeTextNotListed${some ? 'Some' : ''}${state ? '' : 'NoState'}`, { ...values, hrrpFy: YEARS.hrrpFy, ...(some ? { k: count(c.listed) } : {}) });
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
  // not_listed pages say what the files list, never that the programs adjust none of them. What they say holds for every
  // hospital of the group: none is in the hospital-acquired conditions file (its noun), and the Readmissions file lists
  // exactly the ones the sentence counts.
  const nl = pick((x) => x.group === 'not_listed', 'an unlisted acute hospital');
  assert.ok(!/adjust none/.test(textOf(like(nl))), 'not_listed: no "adjust none" sentence');
  const c = RECOUNT.get('not_listed');
  assert.ok(c.inHacrp === 0, 'not_listed: the hospital-acquired conditions file lists none of the group');
  assert.ok(c.inHrrp === c.listed, 'not_listed: the listed ones are all in the Readmissions file');
  const nlMapped = pick((x) => x.group === 'not_listed' && mapped(x), 'an unlisted acute hospital on the US map');
  assert.ok(like(nlMapped).includes(esc(fillOutside('nearKeyOther', { kinds: kindsOf('not_listed') }))), 'not_listed: the map key names the group by its noun');
  // A territory STATE_NAMES lacks: the national count alone.
  const terr = pick((x) => !STATE_NAMES[x.state], 'a hospital in a territory without a state name');
  assert.ok(textOf(like(terr)).includes(esc(expectedLike(terr))), 'a territory: the sentence without a state');
});

test('likeBlock: the map marks this hospital, and the dot count equals the group\'s mappable hospitals', () => {
  for (const group of ['critical_access', 'psychiatric', 'va']) {
    const h = pick((x) => x.group === group && mapped(x), `a ${group} hospital on the US map`);
    const block = like(h);
    const svg = /<svg [^>]*role="img"[^>]*>/.exec(block)?.[0];
    assert.ok(svg, `${group}: an image`);
    assert.ok(/aria-label="[^"]+"/.test(svg), `${group}: named`);
    assert.ok(block.includes('class="chart-land"'), `${group}: the state lines`);
    // The group's hospitals the projection places (this one's own dot sits under its ring), counted here, against the dots in the path.
    const want = usProjected(HUB.shapes, sameGroup(h).map(pointOf), MAP_WIDTH).filter(Boolean).length;
    const d = /<path class="chart-dots hh__likedot"[^>]* d="([^"]*)"/.exec(block)?.[1] ?? '';
    assert.ok((d.match(/h0/g) ?? []).length === want, `${group}: a dot for each mappable hospital of the group`);
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
    near: nearBlock(h, CTX),
    like: likeBlock(h, CTX),
  });
  const main = mainOf(page);
  assert.ok(main.indexOf('class="hh__like"') > main.indexOf('class="hh__near"') && main.indexOf('class="hh__like"') < main.indexOf('class="hh__notes"'), 'after the nearest hospitals, before the notes');
  assert.ok(gzipSync(page).length <= PAGE_GZIP_MAX, 'gzip size within PAGE_GZIP_MAX');
});

test('outsideFigureContext: refuses an unlisted acute hospital that the HACRP file lists', () => {
  const nl = OUTSIDE.find((x) => x.group === 'not_listed');
  assert.ok(nl, 'the data has an unlisted acute hospital');
  const rec = HUB.master.get(nl.ccn);
  const listed = new Map(HUB.master).set(nl.ccn, { ...rec, programs: { ...rec.programs, hacrp: { ...rec.programs.hacrp, inProgram: true } } });
  const args = { hospitals: HOSPITALS, outside: OUTSIDE, likeCounts: LIKE_COUNTS, master: HUB.master, shapes: HUB.shapes, counties: HUB.counties, programYears: HUB.programYears, fy: HUB.fy };
  assert.doesNotThrow(() => outsideFigureContext(args));
  assert.throws(() => outsideFigureContext({ ...args, master: listed }), /HACRP file/);
});
