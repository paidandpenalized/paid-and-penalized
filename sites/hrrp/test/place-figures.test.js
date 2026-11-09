// A place page's figures (figures/place-data.js, place.js): the map (a metro's other in-state hospitals faint), the size of the cuts
// against all hospitals as shares, the conditions with the national tick, the peer groups ("none" for an empty group) and the average
// cut over time. First on synthetic hospitals, then on the data by property.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS } from '../../../engine/js/hrrp/formula.js';
import { buildPlaces } from '../web/places.js';
import { cutCounts, cutEdges, nationalSide, shadeOf } from '../web/figures/place-data.js';
import { placePage } from '../web/pages/place.js';
import { areaContext, placeView } from '../web/view.js';
import { ASSETS, CONDITIONS, HISTORY, META, areaOf, hospital, loadHrrpOnce } from './fixtures.js';

const placeOf = (ctx, kind, key) => ctx.places.list.find((p) => p.kind === kind && p.key === key);
const pageOf = (ctx, place) => placePage({ view: placeView(place, ctx), robots: null, assets: ASSETS, shared: ctx });
const figureOf = (text, n) => new RegExp(`<figure class="fig" id="figure-${n}"[\\s\\S]*?</figure>`).exec(text)?.[0] ?? '';
const JUNK = /NaN|undefined|null|\[object Object\]/;
const noJunk = (text) => {
  const m = JUNK.exec(text.slice(text.indexOf('<main'), text.indexOf('</main>')));
  assert.ok(!m, m && `junk: ${m[0]}`);
};

test('cut bins: the no-cut pile first, then 0.1-point bins to the cap, the cap in the last', () => {
  const edges = cutEdges();
  assert.equal(edges.length, 32);
  const c = cutCounts([0, 0, 0.05, 0.1, 2.99, 3]);
  assert.equal(c.length, 31);
  assert.deepEqual([c[0], c[1], c[2], c[30]], [2, 1, 1, 2]);
  assert.equal(shadeOf(0), 0);
  assert.deepEqual([0.1, 0.25, 0.5, 1, 2, 3].map(shadeOf), [1, 2, 3, 4, 5, 5]);
});

test('a place with figures: size, conditions, peer groups and trend, numbered in order, no junk text', () => {
  const ctx = areaOf();
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zz'));
  noJunk(text);
  for (const n of [1, 2, 3, 4]) assert.ok(figureOf(text, n), `figure ${n}`);
  assert.ok(!figureOf(text, 5), 'no map without outlines, so four figures');
  assert.match(text, /Size of the cuts/);
  assert.match(text, /Which conditions drive the penalties here/);
  assert.match(text, /Bars: Zedland\. Outline: all hospitals\. Both as shares/);
  assert.match(text, /tick: all hospitals, about half/);
  assert.match(text, /about half of the hospitals measured on it by design/);
  assert.match(text, /avg cut 0\.00%|avg cut \d/);
  assert.match(text, /none/, 'an empty peer group says none');
  assert.match(text, /Dashed: every hospital in the FY2027 program, nationwide\. Each year averages those in that year’s file/);
});

test('conditions: left share penalized with the national tick, right share of dollars, from measured counts', () => {
  const ctx = areaOf();
  const view = placeView(placeOf(ctx, 'state', 'zz'), ctx);
  const cd = view.figures.conditions;
  assert.ok(cd.measuredAny);
  const hf = cd.rows.find((r) => r.cond === 'HF');
  assert.equal(hf.share, hf.flags / hf.measured);
  assert.equal(hf.nationShare, ctx.side.conditionShares.get('HF'));
  assert.ok(Math.abs(cd.byDollars.reduce((s, r) => s + r.shareOfDollars, 0) - 1) < 1e-9);
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zz'));
  assert.match(text, /class="chart-bartick"/);
});

test('a place where none is measured: no conditions figure, its words instead; the others still draw', () => {
  const none = [hospital({ id: '990101', st: 'ZY', red: 0, paf: 1, pen: 0, c: { HF: { n: 10, err: 1.2, flag: 0, ratio: 0.1 } } })];
  const ctx = areaContext({ hospitals: none, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(none, META) });
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zy'));
  noJunk(text);
  assert.match(text, /No hospital here is measured on a condition/);
  assert.match(text, /The one hospital here takes no cut/);
  assert.ok(!text.includes('chart-bartick'));
  assert.match(text, /none/);
});

test('a place with no estimated dollars says so beside the left panel', () => {
  const hs = [hospital({ id: '990111', st: 'ZY', pen: null, base: null })];
  const ctx = areaContext({ hospitals: hs, meta: META, history: HISTORY, conditions: CONDITIONS, places: buildPlaces(hs, META) });
  const text = pageOf(ctx, placeOf(ctx, 'state', 'zy'));
  noJunk(text);
  assert.match(text, /No estimated dollars to split by condition here/);
});

test('peer groups: counts for each of the five, average cut, "none" where empty', () => {
  const ctx = areaOf();
  const pd = placeView(placeOf(ctx, 'state', 'zz'), ctx).figures.peers;
  assert.equal(pd.rows.length, 5);
  assert.equal(pd.rows.reduce((s, r) => s + r.n, 0), placeOf(ctx, 'state', 'zz').hospitals.length);
  assert.ok(pd.rows.some((r) => r.n === 0 && r.avg === null));
});

test('the data: every place draws, the map keeps a metro\'s other in-state hospitals faint, the figures hold every plotted value', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const ctx = areaContext({ ...data, places });
  const metro = places.list.find((p) => p.kind === 'metro' && p.states.length > 1 && p.hospitals.length > 20);
  const text = pageOf(ctx, metro);
  noJunk(text);
  assert.match(text, /chart-place__dot--faint|chart-dots--faint/, 'other hospitals faint');
  assert.match(text, /Gray dots are other hospitals in the states it reaches/);
  assert.match(text, /data-href="\/hrrp\/hospital\//, 'a dot opens its hospital');
  // the largest region is dense: one path per shade and size, no tooltips
  const region = places.list.filter((p) => p.kind === 'region').sort((a, b) => b.hospitals.length - a.hospitals.length)[0];
  const rtext = pageOf(ctx, region);
  noJunk(rtext);
  assert.ok(/chart-dots chart-dots--cut-\d pt-\d/.test(rtext));
  assert.match(rtext, /lists and links each one/);
  // a few places of each kind and a single-hospital metro render with every figure
  const one = places.list.find((p) => p.kind === 'metro' && p.hospitals.length === 1);
  const otext = pageOf(ctx, one);
  noJunk(otext);
  assert.match(otext, /The one hospital here (takes a cut of|takes no cut)/);
  for (const p of [...places.list.filter((q) => q.kind !== 'metro'), ...places.list.filter((q) => q.kind === 'metro').slice(0, 40)]) noJunk(pageOf(ctx, p));
});

test('the map takeaway ends in one period when the top hospital\'s name ends in one', () => {
  const data = loadHrrpOnce();
  const places = buildPlaces(data.hospitals, data.meta);
  const ctx = areaContext({ ...data, places });
  const topOf = (p) => p.hospitals.reduce((a, h) => (h.red > a.red ? h : a), p.hospitals[0]);
  const dotted = places.list.filter((p) => p.kind === 'metro' && p.hospitals.length > 1 && topOf(p).red > 0 && topOf(p).name.endsWith('.'));
  assert.ok(dotted.length > 0, 'the data has a metro whose largest cut is at a name ending in a period');
  for (const p of dotted) {
    const text = pageOf(ctx, p);
    assert.doesNotMatch(text, /\.\.(<|\s)/, p.key);
    assert.match(text, /is at [^<]*\.<\/|, at [^<]*\.<\//, p.key);
  }
});

test('the nation\'s side: the same hospitals as the place line, once for the build', () => {
  const data = loadHrrpOnce();
  const side = nationalSide(data);
  assert.equal(side.avgCut.length, data.history.years.length + 1);
  assert.equal(side.cuts.reduce((a, b) => a + b, 0), data.hospitals.length);
  assert.equal(side.conditionShares.size, CONDS.length);
});

test('kit: barRows draws a tick and a second line only when asked; compareHist names an average only when given one', async () => {
  const { barRows } = await import('../../../web/charts/barRows.js');
  const { compareHist } = await import('../../../web/charts/compareHist.js');
  const plain = barRows({ rows: [{ label: 'A', value: 1, valueText: '1', tip: 't' }], max: 2, width: 300 }).text;
  assert.ok(!plain.includes('chart-bartick'));
  const ticked = barRows({ rows: [{ label: 'A', sub: 'sub words', tick: 1.5, value: 1, valueText: '1', tip: 't' }], max: 2, width: 300 }).text;
  assert.ok(ticked.includes('chart-bartick') && ticked.includes('sub words'));
  const base = { edges: [-1, 0, 1], place: [1, 2], nation: [2, 1], line: 0, labels: { line: 'x' }, tip: () => 't', width: 300, format: String };
  assert.ok(!compareHist(base).text.includes('chart-ref'));
  const withAvg = compareHist({ ...base, avg: { at: 0.5, label: 'avg words' }, first: 'none words' }).text;
  assert.ok(withAvg.includes('chart-ref') && withAvg.includes('avg words') && withAvg.includes('none words'));
});
