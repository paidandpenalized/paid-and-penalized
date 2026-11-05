// The program page's "The FY2027 picture" Part: the lede and the largest-penalties table (drawn), and the five figures'
// data (the size-of-the-cuts swarm, the coin-flip, the paired bars, the ridges, the type dots; undrawn), on synthetic
// hospitals and on the whole file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS } from '../../../engine/js/hrrp/formula.js';
import { parseCsv } from '../../../engine/js/csv.js';
import { HOSPITAL_COLUMNS, hospitalCsv } from '../web/csv.js';
import { COIN_WORDS, coinFlip, coinMeasured, largestPenalties, pairedBars, pictureData, pictureLede, ridges, sizeSwarm, typeDots } from '../web/figures/picture-data.js';
import { ledeText, picturePart } from '../web/figures/picture.js';
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

test('the coin-flip: the observed share by number measured against 1 minus one half to the k, and against the group\'s own rates', () => {
  const c = coinFlip(POOL);
  assert.deepEqual(c.rows.map((r) => r.k), [1, 2, 3, 4, 5, 6]);
  const one = c.rows[0]; const two = c.rows[1];
  assert.equal(one.n, 1); assert.equal(one.nCut, 1);
  near(one.observed, 1); near(one.coin, 0.5);
  assert.equal(two.n, 3); assert.equal(two.nCut, 2);
  near(two.observed, 2 / 3); near(two.coin, 0.75);
  // own rates among the one-condition hospitals: heart failure flagged 1 of 1
  near(one.own, 1);
  // two-condition hospitals: HF flagged 2/3, AMI flagged 1/3; each hospital's chance 1 - (1/3)(2/3)
  near(two.own, 1 - (1 / 3) * (2 / 3));
  assert.equal(c.rows.reduce((a, r) => a + r.n, 0), 4, 'hospitals measured on nothing are in no row');
  assert.equal(c.sixFlags.length, 7);
  assert.equal(c.sixFlags.reduce((a, r) => a + r.n, 0), 0);
});

test('the coin-flip\'s words claim no independence and do not put the whole gap on conditions moving together', () => {
  for (const [key, text] of Object.entries(COIN_WORDS)) {
    assert.doesNotMatch(text, /independen|move together|moving together|correlat|move as one/i, key);
    assert.doesNotMatch(text, /\d/, `${key} carries no digits`);
  }
  assert.ok(Object.keys(COIN_WORDS).length >= 2);
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
});

test('the ridges: a row for each peer group with its bins, share penalized and median cut', () => {
  const r = ridges(POOL);
  assert.deepEqual(r.rows.map((g) => g.peer), [1, 2, 3, 4, 5]);
  const g2 = r.rows[1];
  assert.equal(g2.n, 2); assert.equal(g2.nCut, 2);
  near(g2.shareCut, 1); near(g2.median, 0.75);
  assert.equal(g2.bins.reduce((a, b) => a + b.n, 0), 2);
  // shares are over the measured: peer 3 holds two hospitals, one measured; peer 5 holds one, measured on nothing
  assert.equal(r.rows[2].n, 2); assert.equal(r.rows[2].nMeasured, 1);
  assert.equal(r.rows[4].n, 1); assert.equal(r.rows[4].nMeasured, 0); assert.equal(r.rows[4].shareCut, null);
  assert.equal(r.rows[2].nCut, 0); assert.equal(r.rows[2].median, null);
  assert.equal(r.rows[3].n, 0);
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
  assert.equal(coinMeasured(1), '1 condition'); assert.equal(coinMeasured(2), '2 conditions');
  assert.ok(!COIN_WORDS.coinLow.includes('{k}'));
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
});

test('the whole file: the reference counts and shares', () => {
  const { hospitals, meta } = loadHrrpOnce();
  const l = pictureLede(hospitals);
  assert.equal(l.n, 2912); assert.equal(l.nCut, 2334);
  const c = coinFlip(hospitals);
  assert.deepEqual(c.rows.map((r) => r.n), [154, 95, 533, 601, 714, 701]);
  assert.deepEqual(c.rows.map((r) => Math.round(r.observed * 100)), [37, 58, 78, 85, 92, 92]);
  const pct = Object.fromEntries(pairedBars(hospitals, meta).rows.map((r) => [r.cond, Math.round(r.shareOfDollars * 100)]));
  assert.equal(pct.PN, 34); assert.equal(pct.HF, 21); assert.equal(pct.AMI, 13); assert.equal(pct.COPD, 6);
  assert.ok(pct.CABG >= 17 && pct.CABG <= 18); assert.ok(pct.THA_TKA >= 8 && pct.THA_TKA <= 9);
  assert.equal(sizeSwarm(hospitals).items.length, 2912);
  assert.equal(ridges(hospitals).rows.length, 5);
  assert.equal(largestPenalties(hospitals, meta).length, 10);
  const { blocks } = typeDots(hospitals);
  assert.deepEqual(blocks.map((b) => b.block), ['teaching', 'beds', 'setting', 'ownership']);
  assert.ok(blocks.every((b) => b.rows.length > 0 && b.rows.every((r) => r.nMeasured > 0 && r.nMeasured <= r.n)));
  assert.equal(pictureData({ hospitals, meta, edition: { conditions: [] } }).lede.nCut, 2334);
});
