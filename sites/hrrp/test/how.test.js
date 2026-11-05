// The program page's "How it works" Part: Step 1's punch card, Step 2's swarm data (undrawn), Step 3's one-point bins,
// Step 4's medians table, and the two callouts, on synthetic hospitals and (for the whole file) on the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS, PEERS, isMeasured, peerMedian } from '../../../engine/js/hrrp/formula.js';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { exampleHospital, withDerived } from '../web/derive.js';
import { BAND, SWARM_ORDER, condSets, dualBins, exampleIdOf, howData, mediansRows, newFor, roundedCount, swarmData } from '../web/figures/how-data.js';
import { NOTE_SOURCES, calloutNewFor, calloutSources, calloutWho, howPart, mediansTable } from '../web/figures/how.js';
import { COPY } from '../web/program/copy.js';
import { programView } from '../web/view.js';
import { programPage } from '../web/pages/program.js';
import { ASSETS, CONDITIONS, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';
import { areaContext } from '../web/view.js';
import { buildPlaces } from '../web/places.js';

const m = (n, err, flag = 0) => ({ n, err, flag, ratio: 0.1 });
// Peer 2's heart failure median is 1.00 (the fixture's), peer 3's is raised to 1.05 for these tests.
const META3 = { ...META, peerMedians: { ...META.peerMedians, 3: { ...META.peerMedians[3], HF: 1.05 } } };

const POOL = [
  hospital({ id: '990020', peer: 2, dual: 0.15, red: 1, c: { HF: m(40, 1.1, 1), AMI: m(30, 0.9) } }),
  hospital({ id: '990021', peer: 3, dual: 0.2, red: 0, paf: 1, c: { HF: m(40, 1.1, 1), AMI: m(30, 0.9) } }),
  hospital({ id: '990022', peer: 2, dual: 0.151, red: 0, paf: 1, c: { HF: m(40, 1.005) } }),
  hospital({ id: '990023', peer: 3, dual: 0.3, red: 0, paf: 1, c: { HF: m(40, 1.05) } }),
  hospital({ id: '990024', peer: 3, dual: 0.31, red: 0, paf: 1, c: { HF: m(10, 1.5), AMI: m(30, 1.2) } }),
  hospital({ id: '990025', peer: 5, dual: null, red: 0, paf: 1, c: {} }),
];

test("Step 1: the sets of measured conditions add up to the hospitals with any, largest first, with the cut ones counted", () => {
  const { sets, none, rows, measured, yes } = condSets(POOL);
  assert.deepEqual(sets.map((s) => [s.conds.join('+'), s.n, s.yes]), [['AMI+HF', 2, 1], ['HF', 2, 0], ['AMI', 1, 0]]);
  assert.equal(none, 1);
  assert.equal(measured, 5);
  assert.equal(measured + none, POOL.length);
  assert.equal(yes, 1);
  assert.deepEqual(rows, { AMI: 3, COPD: 0, HF: 4, PN: 0, CABG: 0, THA_TKA: 0 });
});

test('Step 1 on the data: the sets sum to the hospitals measured on at least one condition', () => {
  const { hospitals } = loadHrrpOnce();
  const { sets, none, measured } = condSets(hospitals);
  assert.equal(measured, hospitals.filter((h) => CONDS.some((k) => isMeasured(h.c[k]))).length);
  assert.equal(measured + none, hospitals.length);
  assert.deepEqual(sets.map((s) => s.n), sets.map((s) => s.n).sort((a, b) => b - a));
});

test("Step 2: one dot for each measured hospital, ratio minus its own group's median", () => {
  const sw = swarmData(POOL, META3, 'HF', '990020');
  assert.equal(sw.cond, 'HF');
  assert.deepEqual(sw.items.map((i) => i.id), ['990020', '990021', '990022', '990023'], 'the hospital with 10 cases is left out, and so is the one with no condition');
  const d = Object.fromEntries(sw.items.map((i) => [i.id, i.d]));
  assert.deepEqual(d, { 990020: 0.1, 990021: 0.05, 990022: 0.005, 990023: 0 }, 'peer 3 is measured against 1.05, peer 2 against 1.00');
  assert.deepEqual(sw.items.map((i) => [i.flag, i.peer, i.example]), [[true, 2, true], [true, 3, false], [false, 2, false], [false, 3, false]]);
  assert.equal(sw.over, 3);
  assert.equal(sw.atOrUnder, 1);
  assert.equal(sw.over + sw.atOrUnder, sw.items.length);
  assert.deepEqual(sw.band, { half: BAND, n: 2, over: 1, atOrUnder: 1 });
  assert.equal(BAND, 0.01);
});

test('Step 2: the six switches, heart failure first, the chosen one on', () => {
  assert.deepEqual(SWARM_ORDER, ['HF', 'AMI', 'COPD', 'PN', 'CABG', 'THA_TKA']);
  assert.deepEqual(swarmData(POOL, META3, 'HF').conds.map((c) => [c.key, c.on]), [['HF', true], ['AMI', false], ['COPD', false], ['PN', false], ['CABG', false], ['THA_TKA', false]]);
  assert.deepEqual(swarmData(POOL, META3, 'AMI').conds.filter((c) => c.on).map((c) => c.key), ['AMI']);
});

test("Step 2: the table bins the dots (lo exclusive, hi inclusive), so it never lists a hospital", () => {
  const sw = swarmData(POOL, META3, 'HF', '990020');
  assert.deepEqual(sw.table, [{ lo: -0.05, hi: 0, n: 1, flagged: 0 }, { lo: 0, hi: 0.05, n: 2, flagged: 1 }, { lo: 0.05, hi: 0.1, n: 1, flagged: 1 }]);
  assert.equal(sw.table.reduce((s, b) => s + b.n, 0), sw.items.length);
  assert.equal(sw.items.length, 4);
});

test('Step 2: the example hospital is derive.js exampleHospital, the one Worksheet R uses', () => {
  const { hospitals, meta } = loadHrrpOnce();
  const want = exampleHospital(hospitals.map((h) => withDerived(h, meta))).id;
  assert.equal(exampleIdOf(hospitals, meta), want);
  for (const k of CONDS) {
    const sw = swarmData(hospitals, meta, k);
    assert.equal(sw.exampleId, want);
    const marked = sw.items.filter((i) => i.example);
    assert.ok(marked.length <= 1);
    assert.equal(marked.length, isMeasured(hospitals.find((h) => h.id === want).c[k]) ? 1 : 0);
    assert.equal(sw.items.length, hospitals.filter((h) => isMeasured(h.c[k])).length);
    assert.ok(sw.table.length < 80, 'a table of bins, not of 2,600 hospitals');
  }
  const hf = swarmData(hospitals, meta, 'HF');
  const how = howData({ hospitals, meta, edition: { conditions: [] }, whatsNew: null, whatsNewFy: null });
  assert.equal(how.exampleId, want, 'found once for the page');
  assert.deepEqual(how.swarm('HF'), hf, 'the page\'s closure gives the same swarm');
  const h = hospitals.find((x) => x.id === hf.items[0].id);
  assert.equal(hf.items[0].d, Math.round((h.c.HF.err - peerMedian(meta, h.peer, 'HF')) * 1e6) / 1e6, "CMS's median for the hospital's own group");
});

test('Step 3: the dual share in one-point bins, the five groups and their cutoffs', () => {
  const dual = dualBins(POOL, META.peerCutoffs);
  assert.equal(dual.top, 35);
  assert.equal(dual.bins.length, 35);
  assert.ok(dual.bins.every((b, i) => b.x0 === i && b.x1 === i + 1), 'one point wide');
  assert.equal(dual.n, 5, 'a hospital without a dual share is not binned');
  assert.equal(dual.bins.reduce((s, b) => s + b.n, 0), 5);
  assert.deepEqual(dual.bins.filter((b) => b.n).map((b) => [b.x0, b.n]), [[15, 2], [20, 1], [30, 1], [31, 1]]);
  assert.deepEqual(dual.groups.map((g) => [g.peer, g.n]), [[1, 0], [2, 2], [3, 3], [4, 0], [5, 1]], "CMS's own assignment");
  assert.deepEqual(dual.groups.map((g) => [g.lo, g.hi]), META.peerCutoffs);
  assert.deepEqual(dual.ticks, [14, 18, 23, 31]);
  assert.deepEqual(dual.bands, [{ peer: 1, x0: 0, x1: 14 }, { peer: 2, x0: 14, x1: 18 }, { peer: 3, x0: 18, x1: 23 }, { peer: 4, x0: 23, x1: 31 }, { peer: 5, x0: 31, x1: 35 }]);
});

test('Step 4: five rows by six conditions', () => {
  const rows = mediansRows(META3);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.peer), PEERS);
  assert.deepEqual(rows[2].cells.map((c) => c.cond), CONDS);
  assert.equal(rows[2].cells[2].value, 1.05);
});

test('Step 4: the table is open under a title and a note, labeled with the dual range, six columns at four decimals, a median above one shaded', () => {
  const text = mediansTable({ rows: mediansRows(META3), conditions: CONDITIONS, edition: 'FY2027' }).text;
  assert.match(text, /^<div class="meds">/);
  assert.ok(!text.includes('<details'), 'nothing to open: the table shows');
  assert.ok(text.includes('Peer-group medians for FY2027') && text.includes('Shaded cells are above 1.0.'));
  assert.equal(text.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g).length, 5);
  const heads = [...text.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((x) => x[1]);
  assert.deepEqual(heads, ['Peer group', ...CONDITIONS.map((c) => c.short)]);
  for (const label of ['Group 1 · 0%–14% dual', 'Group 2 · 14%–18% dual', 'Group 3 · 18%–23% dual', 'Group 4 · 23%–31% dual', 'Group 5 · 31%–100% dual']) assert.ok(text.includes(label), label);
  const cells = [...text.matchAll(/<td[^>]*>([^<]+)<\/td>/g)].map((x) => x[1]);
  assert.equal(cells.length, 30);
  assert.ok(cells.every((c) => /^\d\.\d{4}$/.test(c)), cells.join());
  assert.equal(cells[14], '1.0500', 'group 3, heart failure');
  const shaded = [...text.matchAll(/<td class="num( hi)?">([^<]+)<\/td>/g)].filter((x) => x[1]).map((x) => x[2]);
  assert.deepEqual(shaded, cells.filter((c) => Number(c) > 1), 'exactly the medians above one are shaded');
});

test('Step 4, collapsed (Methods): the same table in a disclosure', () => {
  const text = mediansTable({ rows: mediansRows(META3), conditions: CONDITIONS, edition: 'FY2027', collapsed: true }).text;
  assert.match(text, /^<details class="meds">/);
  assert.ok(!/<details[^>]* open/.test(text));
});

test('"New for" shows only for the fiscal year the notes are for', () => {
  const items = [{ title: 'A note.', body: 'Its words.' }];
  assert.deepEqual(newFor({ whatsNew: items, whatsNewFy: 2027, fy: 2027 }), items);
  assert.equal(newFor({ whatsNew: items, whatsNewFy: 2026, fy: 2027 }), null);
  assert.equal(newFor({ whatsNew: items, whatsNewFy: null, fy: 2027 }), null);
  assert.equal(newFor({ whatsNew: [], whatsNewFy: 2027, fy: 2027 }), null);
  assert.equal(calloutNewFor({ items: null, edition: 'FY2027' }), '');
  const box = calloutNewFor({ items, edition: 'FY2027' }).text;
  assert.ok(box.includes('New for FY2027') && box.includes('<b>A note.</b> Its words.'));
  assert.ok(!calloutNewFor({ items: [{ title: '<i>x</i>', body: 'y' }], edition: 'FY2027' }).text.includes('<i>'), 'escaped');
});

test('"New for" names its source from an item\'s claim field, not from its wording', () => {
  const line = 'payment methodology sheet';
  const sources = (items) => calloutSources({ items, edition: 'FY2027' });
  assert.ok(!calloutNewFor({ items: [{ title: 'A note.', body: 'x', claim: 'HRRP-14' }], edition: 'FY2027' }).text.includes(line), 'the callout itself holds no source line');
  assert.equal(sources([{ title: 'Medicare Advantage patients now count.', body: 'x' }]), '', 'wording alone adds no source line');
  assert.ok(sources([{ title: 'A note.', body: 'x', claim: 'HRRP-14' }]).text.includes(line));
  assert.equal(sources([{ title: 'A note.', body: 'x', claim: 'HRRP-99' }]), '');
  assert.equal(sources(null), '');
  // One small disclosure for every note's source, each line a copy entry that carries its claim id.
  const all = sources(Object.keys(NOTE_SOURCES).map((claim) => ({ title: 't', body: 'b', claim }))).text;
  assert.equal(all.match(/<details/g).length, 1);
  assert.match(all, /^<details class="srcs">\n<summary>Sources<\/summary>/);
  assert.equal(all.match(/<p class="small muted">/g).length, Object.keys(NOTE_SOURCES).length);
  assert.ok(!/<details[^>]* open/.test(all));
  for (const key of Object.values(NOTE_SOURCES)) assert.ok(COPY[key].claim && COPY[key].claim !== null, `${key} carries its claim id`);
  const content = JSON.parse(readFileSync(`${REPO_ROOT}sites/hrrp/content/whats_new.json`, 'utf8'));
  for (const i of content.items) if (i.claim) assert.ok(i.claim in NOTE_SOURCES, `${i.claim} has a source line`);
  assert.ok(content.items.some((i) => i.claim === 'HRRP-14'));
});

test('"Who is in the program" rounds the count to the hundred and names who is out', () => {
  assert.equal(roundedCount(2912), 2900);
  assert.equal(roundedCount(2950), 3000);
  assert.equal(roundedCount(2949), 2900);
  const box = calloutWho({ rounded: 2900 }).text;
  assert.ok(box.includes('About 2,900'));
  for (const w of ['critical access', 'children', 'cancer', 'psychiatric', 'rehabilitation', 'long-term care', 'Maryland', 'Puerto Rico']) assert.ok(box.includes(w), w);
});

test('the Part on the program page: callouts, steps 1 to 5, the four figures and the medians table', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const area = areaContext({ ...data, places });
  assert.equal(area.whatsNewFy, data.fy);
  const view = programView(area);
  assert.equal(view.how.newFor?.length, data.whatsNew.length);
  const text = programPage({ view, robots: null, assets: ASSETS });
  const how = /<section class="part" id="how"[\s\S]*?<\/section>\s*<section class="part" id="picture"/.exec(text)[0];
  assert.equal(how.match(/<figure class="fig"/g).length, 4, 'the punch card, the swarm, the dual-share columns and the waterfall');
  assert.equal(how.match(/<svg [^>]*chart--punch/g).length, 2, 'the punch card, phone and wide');
  assert.equal(how.match(/<svg [^>]*chart--columns/g).length, 2, 'the columns, phone and wide');
  assert.equal(how.match(/class="chart-band( chart-band--tint)?"/g).length, 10, 'five bands in each drawing');
  for (const n of [1, 2, 3, 4, 5]) assert.equal(how.match(new RegExp(`>Group ${n}<`, 'g')).length, 2, `Group ${n} is named in both drawings (phone and wide)`);
  assert.equal(how.match(/<section class="hstep[ "]/g).length, 5, 'steps 1 to 5');
  assert.equal(how.match(/<details class="srcs">/g).length, 1, 'one Sources disclosure for both callouts');
  assert.ok(!how.slice(how.indexOf('class="hgrid"'), how.indexOf('class="srcs"')).includes('is from CMS'), 'no source line inside a callout');
  assert.equal(how.match(/<svg [^>]*chart--swarm/g).length, 12, 'the swarm for each of six conditions, phone and wide');
  assert.equal(how.match(/<svg [^>]*chart--waterfall/g).length, 2, 'the waterfall, phone and wide');
  assert.ok(how.includes(`New for ${view.edition}`) && how.includes('Who is in the program'));
  assert.ok(!how.includes('<details class="meds">'), 'the medians are open, not collapsed');
  assert.equal(how.match(/<div class="meds">/g).length, 1);
  assert.equal([...how.matchAll(/<figure class="fig" id="figure-(\d+)"/g)].map((x) => x[1]).join(), '1,2,3,4');
  const fresh = howPart(howData({ ...areaOf(), whatsNew: null }), { figure: (() => { let n = 0; return () => ++n; })(), edition: 'FY2027', sourceLine: 'x' });
  assert.ok(!fresh.text.includes('New for'), 'no notes for another year');
});
