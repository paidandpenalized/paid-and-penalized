// The program page's "The FY2027 picture" Part: the lede, the largest-penalties table and the five figures (the size of the cuts,
// the share cut by conditions measured, the cuts by peer group, the traits' ranges, the conditions' flags and dollars): their
// numbers and words, on synthetic hospitals and on the whole file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS } from '../../../engine/js/hrrp/formula.js';
import { parseCsv } from '../../../engine/js/csv.js';
import { HOSPITAL_COLUMNS, hospitalCsv } from '../web/csv.js';
import { largestPenalties, moreConditions, pairedBars, peerGroups, pictureData, pictureLede, sizeSwarm, typeDots, typeSpread, wilson } from '../web/figures/picture-data.js';
import { barsTakeaway, cutsTakeaway, ledeText, measuredTakeaway, peerTakeaway, picturePart, typeTakeaway } from '../web/figures/picture.js';
import { stripShade } from '../web/figures/picture-draw.js';
import { CONDITIONS } from './fixtures.js';
import { programPage } from '../web/pages/program.js';
import { programView } from '../web/view.js';
import { ASSETS, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const m = (n, err, flag = 0, ratio = 0.1) => ({ n, err, flag, ratio });
const POOL = [
  hospital({ id: '990020', red: 3, paf: 0.97, pen: 300, base: 10000, peer: 1, beds: 50, teach: 'none', own: 'Government', urban: false, c: { HF: m(40, 1.3, 1), AMI: m(30, 1.2, 1) } }),
  hospital({ id: '990021', red: 1, paf: 0.99, pen: 100, base: 10000, peer: 2, beds: 150, teach: 'minor', own: 'Nonprofit', c: { HF: m(40, 1.1, 1), AMI: m(30, 0.9) } }),
  hospital({ id: '990022', red: 0.5, paf: 0.995, pen: 50, base: 10000, peer: 2, beds: 350, teach: 'major', own: 'For-profit', c: { HF: m(40, 1.05, 1) } }),
  hospital({ id: '990023', red: 0, paf: 1, pen: 0, base: 10000, peer: 3, beds: 600, teach: 'none', own: 'Nonprofit', c: { HF: m(40, 0.9), AMI: m(30, 0.9) } }),
  hospital({ id: '990024', red: 0, paf: 1, pen: 0, base: 10000, peer: 3, beds: 20, teach: 'none', own: 'Nonprofit', c: { HF: m(10, 1.5) } }),
  hospital({ id: '990025', red: 0, paf: 1, pen: null, base: null, peer: 5, beds: null, teach: null, own: 'Nonprofit', urban: null, c: {} }),
];
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('the lede: the median cut among the cut, the count at 1% or more, the count at the cap', () => {
  const l = pictureLede(POOL);
  assert.equal(l.n, 6);
  assert.equal(l.nCut, 3);
  assert.equal(l.medianCut, 1);
  assert.equal(l.nOnePlus, 2);
  assert.equal(l.nCap, 1);
});

test('the size swarm: one item for each hospital, the zero pile counted, a table of bins', () => {
  const s = sizeSwarm(POOL);
  assert.equal(s.items.length, POOL.length);
  assert.equal(s.zero, 3);
  // denominators: 990024 and 990025 are measured on nothing, so the measured zero pile is one hospital
  assert.equal(s.zeroMeasured, 1); assert.equal(s.zeroUnmeasured, 2);
  assert.deepEqual(s.items.filter((i) => !i.measured).map((i) => i.id), ['990024', '990025']);
  assert.equal(s.takeaway.zero, 1); assert.equal(s.takeaway.nMeasured, 4);
  assert.equal(s.table.reduce((a, r) => a + r.n, 0), POOL.length);
  assert.deepEqual(s.items.find((i) => i.id === '990020'), { id: '990020', red: 3, peer: 1, cut: true, measured: true });
  assert.equal(s.table[0].n, 1); assert.equal(s.table[0].measured, true); assert.equal(s.table[1].n, 2); assert.equal(s.table[1].measured, false);
  assert.equal(s.takeaway.median, 1);
});

test('more conditions measured: the share cut and its 95% interval for each number of conditions, empty groups left out of the table', () => {
  const c = moreConditions(POOL);
  assert.deepEqual(c.rows.map((r) => r.k), [1, 2, 3, 4, 5, 6]);
  const [one, two] = c.rows;
  assert.equal(one.n, 1); assert.equal(one.nCut, 1); near(one.share, 1);
  assert.equal(two.n, 3); assert.equal(two.nCut, 2); near(two.share, 2 / 3);
  for (const r of c.rows.filter((x) => x.n)) assert.ok(r.interval[0] <= r.share && r.share <= r.interval[1] && r.interval[0] >= 0 && r.interval[1] <= 1, `k=${r.k}: the interval holds the share inside 0 to 1`);
  const empty = c.rows[2];
  assert.equal(empty.n, 0); assert.equal(empty.share, null); assert.equal(empty.interval, null);
  assert.equal(c.rows.reduce((a, r) => a + r.n, 0), 4, 'hospitals measured on nothing are in no row');
  assert.deepEqual(c.table.map((r) => r.k), [1, 2], 'the table holds the groups that have a hospital');
  assert.equal(c.takeaway.first.k, 1); assert.equal(c.takeaway.last.k, 2);
  assert.equal(moreConditions([POOL[5]]).takeaway, null);
  assert.equal(moreConditions([POOL[0]]).takeaway.last, null);
});

test('the Wilson interval: 50 of 100 is 40.4% to 59.6%, wider for fewer hospitals, and 0 or all of n stays inside 0 to 1', () => {
  const [lo, hi] = wilson(50, 100);
  near(lo, 0.4038, 1e-3); near(hi, 0.5962, 1e-3);
  const [lo10, hi10] = wilson(5, 10);
  assert.ok(hi10 - lo10 > hi - lo);
  assert.equal(wilson(0, 0), null);
  const all = wilson(10, 10);
  assert.ok(all[1] <= 1 && all[0] > 0.6);
  assert.equal(wilson(0, 10)[0], 0);
});

test('the share-cut figure says nothing of a coin or independence, and its words arrive without a pooled count', () => {
  const view = programView(areaOf(POOL));
  const html = picturePart(view.picture, { figure: (() => { let n = 4; return () => ++n; })(), edition: view.edition }).text;
  assert.doesNotMatch(html, /coin|independen|fair|chance|move together|moving together/i);
  assert.equal(measuredTakeaway(moreConditions(POOL)), 'Measured on one condition, 100% of hospitals are cut; measured on two conditions, 67%.');
  assert.equal(measuredTakeaway({ takeaway: { first: { k: 1, share: 0.37 }, last: { k: 6, share: 0.92 } } }), 'Measured on one condition, 37% of hospitals are cut; measured on all six, 92%.');
  assert.equal(measuredTakeaway({ takeaway: { first: { k: 3, share: 0.5 }, last: null } }), 'Measured on three conditions, 50% of hospitals are cut.');
  assert.match(measuredTakeaway({ takeaway: null }), /No hospital is measured/);
});

test('the paired bars: share of measured flagged beside share of dollars, shares of all flags adding to one, sorted by dollar share', () => {
  const b = pairedBars(POOL, META);
  assert.equal(b.rows.length, CONDS.length);
  const hf = b.rows.find((r) => r.cond === 'HF');
  assert.equal(hf.measured, 4); assert.equal(hf.flags, 3);
  near(hf.shareFlagged, 0.75);
  near(b.rows.reduce((a, r) => a + r.shareOfFlags, 0), 1);
  near(b.rows.reduce((a, r) => a + r.shareOfDollars, 0), 1);
  near(b.rows.reduce((a, r) => a + r.dollars, 0), 450);
  assert.deepEqual(b.rows.map((r) => r.shareOfDollars), [...b.rows.map((r) => r.shareOfDollars)].sort((x, y) => y - x));
  near(hf.dollarsPerFlag, hf.dollars / 3);
  assert.equal(b.rows.find((r) => r.cond === 'COPD').dollarsPerFlag, null);
  // the pair drawn: both columns add to 100%, and the table holds both with their counts
  near(b.table.reduce((a, r) => a + r.shareOfFlags, 0), 1); near(b.table.reduce((a, r) => a + r.shareOfDollars, 0), 1);
  assert.equal(b.totalFlags, 4);
  assert.ok(b.takeaway.up && b.takeaway.down === null || b.takeaway.down, 'the takeaway names the condition furthest above and below');
  for (const r of b.rows) near(r.shareOfFlags, r.flags / 4);
  assert.equal(pairedBars([POOL[5]], META).takeaway, null, 'no flags, no figure');
});

test('the paired bars\' words: the condition whose dollars run ahead of its flags, the one behind, and the variants', () => {
  const rows = (list) => ({ takeaway: list });
  const r = (cond, f, d) => ({ cond, shareOfFlags: f, shareOfDollars: d });
  assert.equal(barsTakeaway(rows({ up: r('PN', 0.22, 0.34), down: r('COPD', 0.21, 0.06) }), CONDITIONS), 'Pneumonia is 22% of the flags but 34% of the dollars; COPD, 21% of the flags but 6% of the dollars.');
  assert.equal(barsTakeaway(rows({ up: r('PN', 0.22, 0.34), down: null }), CONDITIONS), 'Pneumonia is 22% of the flags but 34% of the dollars.');
  assert.equal(barsTakeaway(rows({ up: null, down: r('HF', 0.4, 0.3) }), CONDITIONS), 'Heart failure is 40% of the flags but 30% of the dollars.');
  assert.match(barsTakeaway(rows({ up: null, down: null }), CONDITIONS), /matches its share of the flags/);
  assert.equal(barsTakeaway({ takeaway: null }, CONDITIONS), '');
  const mid = barsTakeaway(rows({ up: r('PN', 0.2, 0.3), down: r('THA_TKA', 0.1, 0.05) }), CONDITIONS);
  assert.match(mid, /; hip\/knee replacement, 10% of the flags/);
});

test('the peer groups: a row for each group with its dual range, share cut among the measured, median cut and one dot for each measured hospital', () => {
  const p = peerGroups(POOL, META);
  assert.deepEqual(p.rows.map((g) => g.peer), [1, 2, 3, 4, 5]);
  const g2 = p.rows[1];
  assert.equal(g2.n, 2); assert.equal(g2.nCut, 2); assert.deepEqual([g2.lo, g2.hi], [0.14, 0.18]);
  near(g2.shareCut, 1); near(g2.median, 0.75);
  assert.deepEqual([...g2.reds].sort(), [0.5, 1]);
  near(p.rows[1].median, 0.75);
  // shares are over the measured: peer 3 holds two hospitals, one measured; peer 5 holds one, measured on nothing and drawn as no dot
  assert.equal(p.rows[2].n, 2); assert.equal(p.rows[2].nMeasured, 1); assert.deepEqual(p.rows[2].reds, [0, 0]); assert.equal(p.rows[2].median, 0);
  assert.equal(p.rows[4].n, 1); assert.equal(p.rows[4].nMeasured, 0); assert.equal(p.rows[4].shareCut, null); assert.deepEqual(p.rows[4].reds, [0], 'a hospital measured on nothing is a dot at no cut');
  assert.equal(p.rows[2].nCut, 0);
  assert.equal(p.rows[3].n, 0);
  assert.equal(p.table.length, 5);
  assert.equal(p.rows.reduce((a, g) => a + g.reds.length, 0), POOL.length, 'every hospital is a dot');
  // the takeaway's numbers: the least-cut group, the range over all and over the groups but the first
  assert.equal(p.takeaway.low.peer, 3); near(p.takeaway.min, 0); near(p.takeaway.max, 1);
  assert.equal(p.takeaway.lowestDual, true);
  assert.equal(peerGroups([POOL[0]], META).takeaway, null, 'one group with a share has nothing to compare');
  assert.equal(peerGroups(POOL, { ...META, peerCutoffs: undefined }).rows[0].lo, null);
});

test('the peer figure\'s takeaway: the lowest-dual group cut least against the others, and the variants', () => {
  const row = (peer, shareCut) => ({ peer, shareCut });
  const low = row(1, 0.78);
  assert.equal(peerTakeaway({ takeaway: { low, min: 0.78, max: 0.85, others: { min: 0.84, max: 0.85 }, lowestDual: true } }),
    'Group 1, which serves the fewest dual-eligible patients (group 5 the most), is cut least: 78% of its measured hospitals take a cut, against 84% to 85% in the other groups.');
  assert.match(peerTakeaway({ takeaway: { low, min: 0.78, max: 0.85, others: { min: 0.85, max: 0.85 }, lowestDual: true } }), /against 85% in the other groups\./);
  const other = peerTakeaway({ takeaway: { low: row(3, 0.7), min: 0.7, max: 0.9, others: { min: 0.7, max: 0.9 }, lowestDual: true } });
  assert.match(other, /runs from 70% \(group 3\) to 90%/);
  assert.doesNotMatch(other, /cut least/);
  assert.match(peerTakeaway({ takeaway: null }), /Fewer than two groups/);
  assert.equal(stripShade(0), 0); assert.equal(stripShade(0.1), 1); assert.equal(stripShade(0.25), 2); assert.equal(stripShade(0.99), 3); assert.equal(stripShade(1), 4); assert.equal(stripShade(2), 5); assert.equal(stripShade(3), 5);
});

test('the traits\' ranges: each trait from its lowest to its highest group, widest spread first, one-group traits left out', () => {
  const t = typeSpread(POOL);
  assert.ok(t.traits.length >= 2);
  assert.deepEqual(t.traits.map((x) => x.spread), [...t.traits.map((x) => x.spread)].sort((a, b) => b - a));
  for (const tr of t.traits) {
    assert.ok(tr.groups.length >= 2);
    near(tr.spread, tr.hi.share - tr.lo.share);
    assert.ok(tr.groups.every((g) => g.share >= tr.lo.share && g.share <= tr.hi.share));
  }
  const owner = t.traits.find((x) => x.block === 'ownership');
  assert.equal(owner.lo.key, 'Nonprofit'); near(owner.hi.share, 100); near(owner.spread, 50);
  assert.equal(t.takeaway.widest, t.traits[0]); assert.equal(t.takeaway.narrowest, t.traits[t.traits.length - 1]);
  for (const r of t.table) { const tr = t.traits.find((x) => x.block === r.block); assert.equal(r.label, tr.groups.find((g) => g.key === r.key).label); }
  assert.equal(t.table.length, t.traits.reduce((a, x) => a + x.groups.length, 0));
  near(t.national.share, 75);
  const one = typeSpread([hospital({ id: '990070', own: 'Government', beds: 50, teach: 'none', urban: true, c: { HF: m(40, 1.2, 1) } })]);
  assert.deepEqual(one.traits, []); assert.equal(one.takeaway, null);
});

test('the traits\' words: the widest trait with its lowest and highest group, the narrowest, and the single-trait variant', () => {
  const g = (key, label, share, nMeasured = 10) => ({ key, label, share, nMeasured });
  const trait = (block, lo, hi) => ({ block, lo, hi, spread: hi.share - lo.share });
  const size = trait('beds', g('a', '<100', 67), g('b', '300–499', 92));
  const own = trait('ownership', g('c', 'Government', 80), g('d', 'Nonprofit', 85));
  assert.equal(typeTakeaway({ takeaway: { widest: size, narrowest: own } }), 'Size spreads the share cut widest: 25 points, from <100 beds (67%) to 300–499 beds (92%). Ownership spreads it least, 5 points.');
  assert.equal(typeTakeaway({ takeaway: { widest: size, narrowest: null } }), 'Size spreads the share cut 25 points, from <100 beds (67%) to 300–499 beds (92%).');
  assert.match(typeTakeaway({ takeaway: { widest: trait('setting', g('rural', 'rural', 76), g('urban', 'urban', 85)), narrowest: own } }), /^Location spreads the share cut widest: 9 points, from Rural \(76%\) to Urban \(85%\)/);
  assert.equal(typeTakeaway({ takeaway: null }), '');
});

test('the size of the cuts\' words: the no-cut count, the median, the 1% and cap counts, and the singular and none variants', () => {
  const sw = (k) => ({ takeaway: { median: 0.3, nOnePlus: 244, onePlus: 1, cap: 3, nCut: 2334, zero: 464, nMeasured: 2798, nCap: 10, ...k } });
  assert.equal(cutsTakeaway(sw()), 'Of the 2,798 hospitals measured on at least one condition, 464 take no cut. Of the 2,334 that do, half lose 0.30% or less; 244 lose 1% or more and 10 reach the 3% maximum.');
  assert.match(cutsTakeaway(sw({ nOnePlus: 1, nCap: 1, zero: 1 })), /1 takes no cut.*1 loses 1% or more and 1 reaches the 3% maximum/);
  assert.match(cutsTakeaway(sw({ nCut: 1, median: 2 })), /the one cut is 2\.00% of base payments/);
  assert.equal(cutsTakeaway(sw({ nCut: 0, zero: 2798 })), 'None of the 2,798 hospitals measured on at least one condition takes a cut.');
});

test('the type dots: four blocks, empty groups hidden, each against the national share', () => {
  const d = typeDots(POOL);
  assert.deepEqual(d.blocks.map((b) => b.block), ['teaching', 'beds', 'setting', 'ownership']);
  const beds = d.blocks[1].rows;
  assert.deepEqual(beds.map((x) => x.label), ['<100', '100–299', '300–499', '500+']);
  const all = d.blocks.flatMap((b) => b.rows);
  assert.ok(all.every((x) => x.n > 0));
  const teaching = d.blocks[0].rows;
  assert.deepEqual(teaching.map((x) => x.key), ['none', 'minor', 'major']);
  near(d.national.share, 75);
  const gov = d.blocks[3].rows.find((x) => x.key === 'Government');
  assert.equal(gov.nCut, 1); near(gov.avgCut, 3); near(gov.vsNation, 25);
  assert.deepEqual(d.blocks[3].rows.map((x) => x.key), ['Nonprofit', 'For-profit', 'Government']);
  assert.ok(d.blocks[2].rows.length === 2);
  const np = d.blocks[3].rows.find((x) => x.key === 'Nonprofit');
  assert.equal(np.n, 4); assert.equal(np.nMeasured, 2); near(np.share, 50);
  assert.equal(typeDots([hospital({ own: 'Government' })]).blocks[3].rows.length, 1);
});

test('singular forms: the lede, the table takeaway and the coin-flip words at a count of one', () => {
  const one = ledeText({ lede: { nCut: 1, medianCut: 3, nOnePlus: 1, nCap: 1, onePlus: 1, cap: 3 } });
  assert.match(one, /The one hospital with a cut loses 3\.00%/);
  assert.match(one, /1 hospital loses 1% or more\./);
  assert.match(one, /1 hospital reaches the 3% maximum\./);
  assert.doesNotMatch(one, /1 hospitals|Half of/);
  const many = ledeText({ lede: { nCut: 5, medianCut: 1, nOnePlus: 2, nCap: 0, onePlus: 1, cap: 3 } });
  assert.match(many, /Half of the 5 hospitals/); assert.match(many, /2 hospitals lose/); assert.match(many, /0 hospitals reach/);
  assert.equal(ledeText({ lede: { nCut: 0, medianCut: 0, nOnePlus: 0, nCap: 0, onePlus: 1, cap: 3 } }), 'No hospital takes a cut.');
  const view = programView(areaOf([hospital({ id: '990040', red: 2 })]));
  const html = picturePart(view.picture, { figure: () => 1, edition: view.edition }).text;
  assert.match(html, /The largest cut is 2\.00% of base payments\./);
  assert.doesNotMatch(html, /The one largest|1 largest/);
  assert.match(html, /printout__scroll/);
});

test('the largest penalties: the top ten by cut, then by dollars, with each condition\'s state', () => {
  const many = Array.from({ length: 14 }, (_, i) => hospital({ id: String(990030 + i), red: i < 3 ? 3 : 2, pen: 1000 + i, paf: 0.97 }));
  const rows = largestPenalties(many, META);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.h.id), ['990032', '990031', '990030']);
  assert.equal(rows[3].h.id, '990043');
  assert.deepEqual(rows[0].states, ['below', 'none', 'counted', 'none', 'none', 'none']);
  const short = largestPenalties(POOL, META);
  assert.equal(short.length, 3);
  assert.ok(short.every((r) => r.h.red > 0));
});

test('the hospital CSV columns: 31, units in the headers, and the largest-penalties file built on them', () => {
  assert.equal(HOSPITAL_COLUMNS.length, 31);
  assert.equal(HOSPITAL_COLUMNS[0].name, 'CCN');
  assert.ok(HOSPITAL_COLUMNS.some((c) => c.name === 'Payment reduction (%)'));
  const text = hospitalCsv(POOL.slice(0, 3));
  assert.ok(text.endsWith('\r\n'));
  const rows = parseCsv(text);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].CCN, '990020');
  assert.equal(rows[0]['Payment reduction (%)'], '3');
  assert.equal(rows[0]['HF penalized (Y/N)'], 'Y');
  assert.equal(rows[1]['AMI penalized (Y/N)'], 'N');
  assert.equal(rows[0]['COPD ERR'], '');
  const evil = parseCsv(hospitalCsv([hospital({ name: '=SUM(A1)' })]));
  assert.equal(evil[0].Hospital, "'=SUM(A1)");
});

test('the Part: the lede in words and the table with the six-cell glyph, its key and the CSV link', () => {
  const view = programView(areaOf(POOL));
  const html = picturePart(view.picture, { figure: (() => { let n = 4; return () => ++n; })(), edition: view.edition }).text;
  assert.match(html, /class="part__intro"/);
  assert.equal([...html.matchAll(/<svg [^>]*chart--cards/g)].length, 3);
  assert.match(html, /largest-penalties\.csv"/);
  assert.match(html, /data-figure-csv="hrrp-largest-penalties\.csv"/);
  assert.doesNotMatch(html, /undefined|NaN/);
  const page = programPage({ view, robots: null, assets: ASSETS });
  assert.match(page, /id="picture"/);
  // the Part holds six figures in page order: the cuts, the largest cuts, then the four more
  assert.deepEqual([...html.matchAll(/id="figure-(\d+)"/g)].map((x) => Number(x[1])), [5, 6, 7, 8, 9, 10]);
  assert.match(html, /hrrp-size-of-cuts\.csv/); assert.match(html, /hrrp-flags-and-dollars-by-condition\.csv/);
  assert.equal([...html.matchAll(/class="pic"/g)].length, 5);
  // the cuts' swarm labels its pile with the count of hospitals measured and not cut (one in POOL)
  assert.match(html, />1 not cut</); assert.match(html, />3 cut</);
});

test('the trait table names each group: both Location rows, urban and rural, read as themselves', () => {
  const view = programView(areaOf(POOL));
  const html = picturePart(view.picture, { figure: (() => { let n = 4; return () => ++n; })(), edition: view.edition }).text;
  assert.match(html, /<th scope="row"[^>]*>Location<\/th><td[^>]*>Urban<\/td>/);
  assert.match(html, /<th scope="row"[^>]*>Location<\/th><td[^>]*>Rural<\/td>/);
});

test('a Part with nothing to draw leaves the figures out and numbers the rest in order', () => {
  const view = programView(areaOf([hospital({ id: '990080', red: 0, paf: 1, c: {} })]));
  let n = 4;
  const html = picturePart(view.picture, { figure: () => ++n, edition: view.edition }).text;
  assert.doesNotMatch(html, /<figure/);
  assert.equal(n, 4, 'no figure took a number');
});

test('the whole file: the reference counts and shares', () => {
  const { hospitals, meta } = loadHrrpOnce();
  const l = pictureLede(hospitals);
  assert.equal(l.n, 2912); assert.equal(l.nCut, 2334);
  const c = moreConditions(hospitals);
  assert.deepEqual(c.rows.map((r) => r.n), [154, 95, 533, 601, 714, 701]);
  assert.deepEqual(c.rows.map((r) => Math.round(r.share * 100)), [37, 58, 78, 85, 92, 92]);
  assert.ok(c.rows.every((r) => r.interval[0] < r.share && r.share < r.interval[1]));
  const pct = Object.fromEntries(pairedBars(hospitals, meta).rows.map((r) => [r.cond, Math.round(r.shareOfDollars * 100)]));
  assert.equal(pct.PN, 34); assert.equal(pct.HF, 21); assert.equal(pct.AMI, 13); assert.equal(pct.COPD, 6);
  assert.ok(pct.CABG >= 17 && pct.CABG <= 18); assert.ok(pct.THA_TKA >= 8 && pct.THA_TKA <= 9);
  assert.equal(sizeSwarm(hospitals).items.length, 2912);
  const peers = peerGroups(hospitals, meta);
  assert.equal(peers.rows.length, 5);
  assert.equal(peers.takeaway.low.peer, 1, 'the lowest-dual group is cut least');
  assert.ok(peers.rows.every((g) => g.reds.length === g.n));
  assert.equal(peers.rows.reduce((a, g) => a + g.nMeasured, 0), 2798);
  const bars = pairedBars(hospitals, meta);
  near(bars.rows.reduce((a, r) => a + r.shareOfFlags, 0), 1); near(bars.rows.reduce((a, r) => a + r.shareOfDollars, 0), 1);
  assert.equal(typeSpread(hospitals).traits.length, 4);
  assert.equal(largestPenalties(hospitals, meta).length, 10);
  const { blocks } = typeDots(hospitals);
  assert.deepEqual(blocks.map((b) => b.block), ['teaching', 'beds', 'setting', 'ownership']);
  assert.ok(blocks.every((b) => b.rows.length > 0 && b.rows.every((r) => r.nMeasured > 0 && r.nMeasured <= r.n)));
  assert.equal(pictureData({ hospitals, meta, edition: { conditions: [] } }).lede.nCut, 2334);
});
