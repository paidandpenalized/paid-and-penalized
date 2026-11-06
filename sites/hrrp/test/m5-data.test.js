// The M5 analyses' data: peer-grouping flips, dollars per 0.01 of ratio, size bands, years cut, the within-0.001 count.
// Synthetic hospitals (CCNs 9900xx) and invariants of the whole file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP, CONDS, PEERS, isMeasured, contrib, peerMedian } from '../../../engine/js/hrrp/formula.js';
import { median } from '../../../engine/js/stats.js';
import { MIN_BAND, SIZE_BANDS, dollarsPerStep, peerFlips, pictureData, sizeBands } from '../web/figures/picture-data.js';
import { perStep, rulersData } from '../web/figures/hospital-data.js';
import { rollCall, yearsCut } from '../web/figures/history-data.js';
import { CLOSE, swarmData } from '../web/figures/how-data.js';
import { META, ctxOf, hospital, loadHrrpOnce } from './fixtures.js';

let seq = 0;
const id = () => String(990100 + seq++);
// A hospital in peer group `peer` with one HF condition.
const hf = (err, extra = {}, c = {}) => hospital({ id: id(), peer: 2, c: { HF: { n: 40, err, flag: 0, ratio: 0.1, ...c } }, ...extra });
const meta = (med, nm = 1) => ({ ...META, nm, peerMedians: Object.fromEntries(PEERS.map((p) => [p, { ...META.peerMedians[p], HF: med }])) });
// Peer 2's HF median is 1.0 in META; peer 3's is set to 1.2 here so the two lines differ.
const META2 = { ...META, peerMedians: { ...META.peerMedians, 3: { ...META.peerMedians[3], HF: 1.2 }, 1: { ...META.peerMedians[1], HF: 0.9 } } };

test('peerFlips: over the peer median but under the national median is added; the reverse is removed; a tie is not over', () => {
  // HF errs: peer 1 (median .9): 1.0 (over now; national median below); peer 3 (median 1.2): 1.1 (under now; over alone).
  const hs = [hf(1.0, { peer: 1 }), hf(1.1, { peer: 3 }), hf(1.05, { peer: 2 }), hf(1.05, { peer: 2 }), hf(1.15, { peer: 2 })];
  const f = peerFlips(hs, META2);
  assert.equal(f.national.HF, 1.05);
  const row = (p) => f.rows.find((r) => r.peer === p);
  assert.deepEqual([row(1).now, row(1).alone, row(1).added, row(1).removed, row(1).net], [1, 0, 1, 0, 1]);
  assert.deepEqual([row(3).now, row(3).alone, row(3).added, row(3).removed, row(3).net], [0, 1, 0, 1, -1]);
  // peer 2 (median 1.0): 1.05 over now, tie with the national median 1.05 so not over alone: added twice; 1.15 over both.
  assert.deepEqual([row(2).measured, row(2).now, row(2).alone, row(2).added], [3, 3, 1, 2]);
  assert.deepEqual(f.totals, { measured: 5, added: 3, removed: 1, flips: 4 });
  const byNet = [...f.rows].sort((a, b) => b.net - a.net);
  assert.equal(byNet[0].peer, 2, 'peer grouping puts the most flags on group 2');
  assert.equal(byNet[byNet.length - 1].peer, 3, 'and takes the most off group 3');
});

test('peerFlips: a tie with the peer median is not over; unmeasured and null-median conditions are skipped; no flips', () => {
  const tie = hf(1.0); // peer 2 median 1
  const few = hospital({ id: id(), peer: 2, c: { HF: { n: 24, err: 1.5, flag: 1, ratio: 0.1 } } });
  const noMed = hospital({ id: id(), peer: 2, c: { HF: { n: 40, err: 1.5, flag: 1, ratio: 0.1 } } });
  const m = { ...META, peerMedians: { ...META.peerMedians, 2: { ...META.peerMedians[2], HF: null } } };
  const f = peerFlips([tie, few, noMed], META);
  assert.equal(f.rows[1].now, 1, 'noMed is over a median of 1; the tie is not; the 24-case one is skipped');
  assert.equal(f.rows[1].measured, 2);
  const g = peerFlips([tie, few, noMed], m);
  assert.equal(g.totals.measured, 0);
  assert.equal(g.totals.flips, 0);
  assert.equal(g.national.HF, 1.25, 'the national median still counts every measured hospital');
});

test('real data: peerFlips nets and totals add up; national medians are the medians of the measured errs', () => {
  const { hospitals, meta: m } = loadHrrpOnce();
  const f = peerFlips(hospitals, m);
  assert.deepEqual(f.rows.map((r) => r.peer), PEERS);
  for (const r of f.rows) assert.equal(r.net, r.now - r.alone);
  for (const r of f.rows) assert.ok(r.added + r.removed <= r.measured);
  assert.equal(f.totals.flips, f.totals.added + f.totals.removed);
  assert.equal(f.totals.added - f.totals.removed, f.rows.reduce((s, r) => s + r.net, 0));
  for (const k of CONDS) assert.equal(f.national[k], median(hospitals.filter((h) => isMeasured(h.c[k])).map((h) => h.c[k].err)));
  assert.equal(f.table.length, 5);
  assert.ok(!JSON.stringify(f).includes('dollar'));
});

test('perStep: null unless measured, weighted and priced; $0 when capped; else base x ratio x NM x 0.01', () => {
  const h = hf(1.1);
  assert.equal(perStep(h, 'HF', META, false), 10000000 * 0.1 * 1 * 0.01);
  assert.equal(perStep(h, 'HF', META, true), 0);
  assert.equal(perStep(h, 'AMI', META, false), null, 'no AMI cases');
  assert.equal(perStep(hf(1.1, {}, { n: 24 }), 'HF', META, false), null);
  assert.equal(perStep(hf(1.1, {}, { ratio: null }), 'HF', META, false), null);
  assert.equal(perStep(hf(1.1, { base: null }), 'HF', META, false), null);
});

test('rulersData per equals perStep for every condition', () => {
  const h = hospital({ id: id() });
  const ctx = ctxOf([h]);
  const capped = contrib(h, ctx.meta).sum > CAP;
  for (const r of rulersData(h, ctx).rows) assert.equal(r.per, perStep(h, r.cond, ctx.meta, capped));
});

test('dollarsPerStep: $0 at the cap is priced and capped; blanks; under-25 excluded; quartiles', () => {
  const m = meta(1, 1);
  // ratio 10 x (err 1.5 - 1) = 5 > CAP: capped.
  const capHosp = hf(1.5, {}, { ratio: 10 });
  const hs = [
    hf(1.0, { base: 1000000 }), hf(1.0, { base: 2000000 }), hf(1.0, { base: 3000000 }), hf(1.0, { base: 4000000 }), // per step 1000..4000
    capHosp,
    hf(1.0, { base: null }), hf(1.0, {}, { ratio: null }), hf(1.0, {}, { n: 10 }),
  ];
  const rows = dollarsPerStep(hs, m).rows;
  const r = rows.find((x) => x.cond === 'HF');
  assert.deepEqual([r.measured, r.priced, r.blank, r.capped], [7, 5, 2, 1]);
  // priced values 0, 1000, 2000, 3000, 4000
  assert.deepEqual([r.p25, r.median, r.p75], [1000, 2000, 3000]);
  assert.equal(rows[0].cond, 'HF');
  assert.deepEqual(rows.filter((x) => x.cond !== 'HF').map((x) => x.cond), CONDS.filter((k) => k !== 'HF'));
  assert.equal(rows[1].median, null);
  assert.equal(dollarsPerStep(hs, m).takeaway, null, 'one row with a median');
});

test('dollarsPerStep: takeaway names the highest and lowest medians', () => {
  const m = meta(1);
  const hs = [hf(1.0, { base: 2000000 }), hospital({ id: id(), c: { AMI: { n: 40, err: 1.0, flag: 0, ratio: 0.1 } }, base: 1000000 })];
  const t = dollarsPerStep(hs, m).takeaway;
  assert.equal(t.hi.cond, 'HF');
  assert.equal(t.lo.cond, 'AMI');
  assert.equal(t.times, 2);
});

test('real data: dollarsPerStep priced + blank = measured; capped within priced; rows sorted', () => {
  const { hospitals, meta: m } = loadHrrpOnce();
  const d = dollarsPerStep(hospitals, m);
  assert.equal(d.rows.length, CONDS.length);
  for (const r of d.rows) {
    assert.equal(r.priced + r.blank, r.measured);
    assert.ok(r.capped <= r.priced);
    if (r.median !== null) assert.ok(r.p25 <= r.median && r.median <= r.p75);
  }
  const meds = d.rows.map((r) => r.median).filter((v) => v !== null);
  assert.deepEqual(meds, [...meds].sort((a, b) => b - a));
});

test('sizeBands: band edges 49/50 and 799/800; bands under MIN_BAND are not shown', () => {
  assert.equal(MIN_BAND, 20);
  assert.equal(SIZE_BANDS.length, 6);
  const mk = (n, err = 1.1) => hf(err, {}, { n });
  const hs = [mk(49), mk(50), mk(799), mk(800)];
  const b = sizeBands(hs, META).conditions.find((r) => r.cond === 'HF').bands;
  assert.deepEqual(b.map((x) => x.n), [1, 1, 0, 0, 1, 1]);
  assert.ok(b.every((x) => !x.shown));
  assert.equal(b[0].label, '25–49');
  assert.equal(b[5].label, '800+');
});

test('sizeBands: share, quartiles, first and last, takeaway lower and higher', () => {
  // 25-49 band: 20 hospitals, 5 over (errs 1.1 -> gap .1) and 15 under (gap -0.1): share .25. 50-99: 20 hospitals, 15 over: share .75.
  const mk = (n, err) => hf(err, {}, { n });
  const small = [...Array.from({ length: 5 }, () => mk(30, 1.1)), ...Array.from({ length: 15 }, () => mk(30, 0.9))];
  const mid = [...Array.from({ length: 15 }, () => mk(60, 1.1)), ...Array.from({ length: 5 }, () => mk(60, 0.9))];
  const res = sizeBands([...small, ...mid], META);
  const hfRow = res.conditions.find((r) => r.cond === 'HF');
  const [a, b] = hfRow.bands;
  assert.deepEqual([a.n, a.over, a.share, a.shown], [20, 5, 0.25, true]);
  const close = (xs, ys) => xs.forEach((x, i) => assert.ok(Math.abs(x - ys[i]) < 1e-9, `${x} vs ${ys[i]}`));
  close([a.p25, a.median, a.p75], [-0.1, -0.1, -0.05]);
  assert.equal(b.share, 0.75);
  close([b.p25, b.median, b.p75], [0.05, 0.1, 0.1]);
  assert.equal(hfRow.first, a);
  assert.equal(hfRow.last, b);
  assert.deepEqual(res.takeaway, { lower: ['HF'], higher: [] });
  const rev = sizeBands([...mid.map((h) => ({ ...h, c: { HF: { ...h.c.HF, n: 30 } } })), ...small.map((h) => ({ ...h, c: { HF: { ...h.c.HF, n: 60 } } }))], META);
  assert.deepEqual(rev.takeaway, { lower: [], higher: ['HF'] });
  assert.equal(sizeBands(small, META).takeaway, null, 'one shown band');
  assert.equal(res.table.length, CONDS.length * SIZE_BANDS.length);
});

test('sizeBands: no field is named ci or interval', () => {
  const { hospitals, meta: m } = loadHrrpOnce();
  const keys = new Set();
  JSON.stringify(sizeBands(hospitals, m), (k, v) => { keys.add(k); return v; });
  assert.ok(![...keys].some((k) => /^(ci|interval)$/i.test(k) || /confidence/i.test(k)));
  const p = pictureData({ hospitals, meta: m, edition: { conditions: [] } });
  assert.equal(typeof p.flips, 'function');
  assert.equal(typeof p.worth, 'function');
  assert.equal(typeof p.bands, 'function');
});

const HISTORY = { years: [2025, 2026], paf: { 990901: [0.99, 0.98], 990902: [null, 0.99], 990903: [1, 1], 990904: [0.99, 0.99], 990905: [0.99, null], 990906: [1, 0.99] }, national: [] };
const ROLL_HS = [
  hospital({ id: '990901', paf: 0.97 }), // C C C
  hospital({ id: '990902', paf: 0.99 }), // blank C C: partial, cut every year in the file
  hospital({ id: '990903', paf: 1 }), // N N N
  hospital({ id: '990904', paf: 1 }), // C C N
  hospital({ id: '990905', paf: 1 }), // C blank N: partial
  hospital({ id: '990906', paf: 1 }), // N C N
];

test('yearsCut: absent years are excluded; partial.everyYear differs from takeaway.every', () => {
  const y = yearsCut(rollCall({ hospitals: ROLL_HS, history: HISTORY, meta: META }));
  assert.equal(y.nYears, 3);
  assert.equal(y.n, 6);
  assert.equal(y.full, 4);
  assert.deepEqual(y.counts, [{ cut: 0, n: 1 }, { cut: 1, n: 1 }, { cut: 2, n: 1 }, { cut: 3, n: 1 }]);
  assert.equal(y.counts.reduce((s, c) => s + c.n, 0), y.full);
  assert.deepEqual(y.partial, { n: 2, everyYear: 1, never: 0 });
  assert.deepEqual(y.takeaway, { every: 1, never: 1, share: 0.25 });
  assert.equal(y.partial.everyYear, 1);
  assert.equal(y.takeaway.every, 1);
  assert.deepEqual(y.table, y.counts);
});

test('yearsCut: every value 0..nYears is listed, zeros too; no full records gives a null share', () => {
  const y = yearsCut({ years: [1, 2], records: [{ id: 'a', marks: ' C' }, { id: 'b', marks: 'N ' }] });
  assert.deepEqual(y.counts, [{ cut: 0, n: 0 }, { cut: 1, n: 0 }, { cut: 2, n: 0 }]);
  assert.equal(y.takeaway.share, null);
  assert.deepEqual(y.partial, { n: 2, everyYear: 1, never: 1 });
});

test('real data: yearsCut counts sum to full; full + partial = n', () => {
  const data = loadHrrpOnce();
  const y = yearsCut(rollCall(data));
  assert.equal(y.counts.reduce((s, c) => s + c.n, 0), y.full);
  assert.equal(y.counts.length, y.nYears + 1);
  assert.equal(y.full + y.partial.n, y.n);
});

test('swarmData close: |gap| <= 0.001 counts (exactly 0.001 in, 0.0011 out)', () => {
  assert.equal(CLOSE, 0.001);
  const hs = [hf(1.001), hf(1.0011), hf(0.999), hf(1.0), hf(0.9989)];
  const s = swarmData(hs, META, 'HF', 'none');
  assert.deepEqual(s.close, { half: 0.001, n: 3 });
});

// ---------- #10's words and drawing ----------
import { flipsTakeaway } from '../web/figures/picture.js';
import { drawFlips } from '../web/figures/picture-draw.js';

const flipRows = (rows) => {
  const r = rows.map(([added, removed], i) => ({ peer: i + 1, added, removed, net: added - removed }));
  return { rows: r, totals: { flips: r.reduce((s, x) => s + x.added + x.removed, 0) } };
};
test('#10 takeaway: from peer grouping\'s side, as drawn, with the bars\' own counts (grey taken off, red put on); "about", to the nearest ten from 20; a run of groups as a run; no dollars', () => {
  const real = flipRows([[49, 0], [59, 9], [34, 0], [22, 18], [2, 168]]);
  assert.equal(flipsTakeaway(real), 'Against one national median, peer grouping takes about 170 flags off group 5 and puts about 160 on groups 1 to 4.');
  assert.equal(flipsTakeaway(flipRows([[3, 0], [0, 0], [0, 2], [0, 0], [0, 0]])), 'Against one national median, peer grouping takes about 2 flags off group 3 and puts about 3 on group 1.');
  assert.match(flipsTakeaway(flipRows([[5, 0], [0, 9], [5, 0], [0, 0], [0, 0]])), /puts about 10 on groups 1 and 3\.$/);
  assert.match(flipsTakeaway(flipRows([[0, 0], [0, 0], [0, 0], [0, 0], [0, 4]])), /takes about 4 flags off group 5\.$/);
  assert.match(flipsTakeaway({ totals: { flips: 0 }, rows: [] }), /changes no flag/);
  assert.doesNotMatch(flipsTakeaway(real), /\$/);
});

test('#10 drawing: the wide rows share the strip plot\'s pitch; each row plots what it puts on and takes off', () => {
  const rows = [1, 2, 3, 4, 5].map((g) => ({ label: `Group ${g}`, sub: '', added: g === 5 ? 2 : 10 * g, removed: g === 5 ? 168 : 0, tip: 't' }));
  const wide = String(drawFlips({ rows, width: 457, labels: { off: 'off', on: 'on' } }));
  assert.match(wide, /viewBox="0 0 457 290"/, 'the strip plot\'s height: 26 + 5 × 46 + 34');
  assert.match(wide, /data-value="2 168"/);
  const narrow = String(drawFlips({ rows, width: 300, labels: { off: 'off', on: 'on' } }));
  assert.match(narrow, /viewBox="0 0 300 /);
});

// ---------- #4's words and drawing ----------
import { bandsTakeaway } from '../web/figures/picture.js';
import { drawSizeBands } from '../web/figures/picture-draw.js';
import { CONDITIONS } from './fixtures.js';

test('#4 takeaway: the conditions on which the fewest-case band is flagged less and more often than the largest; never an interval', () => {
  assert.equal(bandsTakeaway({ takeaway: { lower: ['COPD', 'HF'], higher: ['CABG'] } }, CONDITIONS), 'Hospitals with the fewest cases are flagged less often than the largest on COPD and heart failure, and more often on bypass surgery.');
  assert.match(bandsTakeaway({ takeaway: { lower: [], higher: ['AMI'] } }, CONDITIONS), /more often than the largest on heart attack\.$/);
  assert.match(bandsTakeaway({ takeaway: null }, CONDITIONS), /the same/);
});

test('#4 drawing: six panels in a row on the wide drawing, two to a row on a phone; a band too small to show draws nothing; each shown band plots its share and middle half', () => {
  const band = (shown, share) => ({ shown, share, p25: -0.02, median: 0, p75: 0.03, tip: 't' });
  const panels = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ name, bands: [band(true, 0.4), band(true, 0.6), band(false, 0.9)] }));
  const labels = { flagged: 'f', half: 'h', middle: 'm', median: 'pm', cases: 'c', headTop: 'top', headBottom: 'bottom' };
  const wide = String(drawSizeBands({ panels, width: 1120, labels, format: (v) => `${Math.round(v * 100)}%`, signed: String }));
  assert.equal((wide.match(/data-value="/g) ?? []).length, 12, 'two shown bands in each of six panels');
  assert.match(wide, /data-value="0\.6 -0\.02 0\.03"/);
  assert.doesNotMatch(wide, /0\.9/, 'the band too small to show draws nothing');
  assert.match(wide, /chart-share__dot chart-share__dot--pen/, 'over half: penalty ink');
  const narrow = String(drawSizeBands({ panels, width: 300, labels, format: (v) => `${v}`, signed: String }));
  assert.match(narrow, />top</);
  assert.match(narrow, /viewBox="0 0 300 646"/, 'a two-line header and three rows of two');
});

test('real data: the Picture Part draws #10 beside the peer strips and #4 after the traits; Methods names #4\'s trap', async () => {
  const { areaContext, programView, methodsView } = await import('../web/view.js');
  const { buildPlaces } = await import('../web/places.js');
  const { picturePart } = await import('../web/figures/picture.js');
  const data = loadHrrpOnce();
  const ctx = areaContext({ ...data, places: buildPlaces(data.hospitals, data.meta) });
  const view = programView(ctx);
  const html = picturePart(view.picture, { figure: (() => { let n = 4; return () => ++n; })(), edition: view.edition }).text;
  const order = [...html.matchAll(/data-figure-csv="(hrrp-[a-z-]+)\.csv"/g)].map((x) => x[1]);
  assert.ok(order.indexOf('hrrp-flags-without-peer-groups') === order.indexOf('hrrp-cuts-by-peer-group') + 1);
  assert.ok(order.indexOf('hrrp-flagged-by-cases') === order.indexOf('hrrp-share-cut-by-trait') + 1);
  assert.match(methodsView(ctx).figures.join(' '), /Flagged by number of cases: .* not an interval; a band of fewer than 20 hospitals is left out\./);
});

// ---------- #2's words and drawing ----------
import { worthTakeaway } from '../web/figures/picture.js';
import { drawWorth } from '../web/figures/picture-draw.js';

test('#2 takeaway: the dearest and cheapest condition by the typical hospital, to the nearest hundred dollars', () => {
  const w = { takeaway: { hi: { cond: 'CABG', median: 9759.4 }, lo: { cond: 'COPD', median: 2487 } } };
  assert.equal(worthTakeaway(w, CONDITIONS), 'Each 0.01 of excess readmission ratio costs a typical hospital about $9,800 on bypass surgery but $2,500 on COPD.');
  assert.match(worthTakeaway({ takeaway: null }, CONDITIONS), /No condition/);
});

test('#2 drawing: each priced row plots its median and middle half; a row with no value draws its track and a dash only', () => {
  const rows = [{ label: 'A', median: 9000, p25: 5000, p75: 17000, valueText: '$9,000', tip: 't' }, { label: 'B', median: null, p25: null, p75: null, valueText: '—', tip: 't' }];
  const svg = String(drawWorth({ rows, width: 640, labels: { dot: 'typical', bar: 'middle half', barShort: 'mid' }, format: (v) => '$' + v / 1000 + 'K' }));
  assert.match(svg, />typical</, 'the first row names its dot in place');
  assert.match(svg, /data-value="9000 5000 17000"/);
  assert.equal((svg.match(/data-value=/g) ?? []).length, 1);
  assert.match(svg, />—</);
});
