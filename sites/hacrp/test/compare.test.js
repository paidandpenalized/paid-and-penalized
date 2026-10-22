// The hospital page's comparisons (compare.js) on the pinned data, rows picked by property: ranks, distributions,
// groups, nearest hospitals and the lever, each checked against a count or the engine's own what-if.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { isAssigned } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { GROUP_KINDS, bedBand, biggestLever, countBins, edgesAround } from '../web/compare.js';
import { miles } from '../../../web/charts/geo.js';
import { BED_BANDS, FEW_IN_GROUP, NEAREST } from '../web/constants.js';
import { CASES } from './fixtures.js';
import { DATA, NAT } from './pinned.js';

const scored = DATA.hospitals.filter((h) => h.total !== null);
const pick = (pred, what) => {
  const h = scored.find(pred);
  assert.ok(h, `no pinned row: ${what}`);
  return h;
};

test('miles: a degree of latitude is about 69 miles; a point is no distance from itself', () => {
  assert.ok(Math.abs(miles([-90, 40], [-90, 41]) - 69.09) < 0.01);
  assert.equal(miles([-90, 40], [-90, 40]), 0);
  assert.ok(Math.abs(miles([-90, 40], [-89, 40]) - miles([-89, 40], [-90, 40])) < 1e-9, 'symmetric');
});

test('edgesAround spans the values with the line as an edge; countBins counts each value once, the outer bins catching the rest', () => {
  const edges = edgesAround(-1.47, 2.31, 0.3799, 36);
  assert.ok(edges[0] <= -1.47 && edges.at(-1) >= 2.31);
  assert.ok(edges.some((e) => Math.abs(e - 0.3799) < 1e-9), 'the line is an edge');
  const values = [-5, -1.47, 0, 0.3799, 0.38, 2.31, 9];
  const counts = countBins(values, edges);
  assert.equal(counts.reduce((a, b) => a + b, 0), values.length);
  assert.equal(counts[0] >= 2 && counts.at(-1) >= 2, true, 'past either end counts in the end bin');
  const at = edges.findIndex((e) => Math.abs(e - 0.3799) < 1e-9);
  assert.ok(counts[at] >= 2, 'a value on an edge counts in the bin it starts');
});

test('bedBand: under the first edge, between each pair, the last and up; null with no count', () => {
  assert.deepEqual([BED_BANDS[0] - 1, BED_BANDS[0], BED_BANDS.at(-1), BED_BANDS.at(-1) + 1].map(bedBand), [0, 1, BED_BANDS.length, BED_BANDS.length]);
  assert.equal(bedBand(null), null);
});

test('rankOf and measureRank: below, at and above add to the count, for every scored hospital', () => {
  for (const h of scored) {
    const r = NAT.rankOf(h.total);
    assert.equal(r.n, scored.length);
    const at = scored.filter((x) => x.total === h.total).length;
    assert.equal(r.below + r.above + at, r.n, h.ccn);
  }
  const id = 'CLABSI';
  const values = DATA.hospitals.map((h) => h.measures[id].value).filter((v) => v !== null);
  const r = NAT.measureRank(id, values[0]);
  assert.equal(r.below + r.above + values.filter((v) => v === values[0]).length, values.length);
});

test('groupsOf: the nation first, every kind in order, each group counting its decided members; the nation matches acceptance A1', () => {
  const a1 = checkA1(DATA.hospitals, DATA.model);
  const h = pick((x) => x.paymentReduction === 'Yes' && DATA.master.get(x.ccn).teach && DATA.master.get(x.ccn).cbsa, 'a cut hospital with a teaching status and a metro');
  const groups = NAT.groupsOf(h.ccn);
  assert.equal(groups[0].kind, 'nation');
  assert.equal(groups[0].decided, a1.b.n);
  assert.equal(groups[0].yes, a1.b.yes);
  assert.equal(groups[0].bins.reduce((a, b) => a + b, 0), a1.b.n, 'the columns count every decided hospital');
  const order = groups.map((g) => GROUP_KINDS.indexOf(g.kind));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const g of groups) {
    assert.ok(g.decided >= FEW_IN_GROUP, `${g.kind}: at least ${FEW_IN_GROUP} decided`);
    assert.ok(g.below + g.above < g.scored, `${g.kind}: the hospital is among the group's scores`);
  }
  const state = groups.find((g) => g.kind === 'state');
  const inState = DATA.hospitals.filter((x) => x.total !== null && DATA.master.get(x.ccn).state === DATA.master.get(h.ccn).state);
  assert.equal(state.scored, inState.length);
  assert.equal(state.yes, inState.filter((x) => x.paymentReduction === 'Yes').length);
  assert.deepEqual(NAT.groupsOf('990001'), [], 'a hospital not in the file belongs to no group');
});

test('nearest: the closest other hospitals with a score and a place, nearest first, never the hospital itself', () => {
  const h = pick((x) => Number.isFinite(DATA.master.get(x.ccn).lat), 'a scored hospital with a place');
  const r = DATA.master.get(h.ccn);
  const near = NAT.nearest(h.ccn, [r.lon, r.lat]);
  assert.equal(near.length, NEAREST);
  assert.ok(near.every((x) => x.ccn !== h.ccn));
  for (let i = 1; i < near.length; i++) assert.ok(near[i].miles >= near[i - 1].miles);
  assert.deepEqual(NAT.nearest(h.ccn, null), []);
  // The k kept in one pass are the first k of every other placed hospital sorted by distance (then CCN).
  const all = DATA.hospitals.filter((x) => x.total !== null && x.ccn !== h.ccn && Number.isFinite(DATA.master.get(x.ccn).lat))
    .map((x) => ({ ccn: x.ccn, d: miles([r.lon, r.lat], [DATA.master.get(x.ccn).lon, DATA.master.get(x.ccn).lat]) }))
    .sort((a, b) => a.d - b.d || (a.ccn < b.ccn ? -1 : 1));
  assert.deepEqual(near.map((x) => x.ccn), all.slice(0, NEAREST).map((x) => x.ccn));
});

test('biggestLever: the measured measure above its median whose median lowers the score most, as the engine\'s what-if computes it', () => {
  let checked = 0;
  for (const h of scored.slice(0, 400)) {
    const lever = biggestLever(h, DATA.model);
    const candidates = MEASURE_IDS.filter((id) => {
      const m = h.measures[id];
      return m.z !== null && m.value !== null && !isAssigned(m) && m.value > medianAt(DATA.model.params[id]);
    }).map((id) => ({ id, drop: h.total - whatIf(h, DATA.model, { [id]: medianAt(DATA.model.params[id]) }).after.score })).filter((c) => c.drop > 0);
    if (!candidates.length) {
      assert.equal(lever, null, h.ccn);
      continue;
    }
    const best = Math.max(...candidates.map((c) => c.drop));
    assert.equal(lever.drop, best, h.ccn);
    assert.equal(lever.after, h.total - lever.drop);
    checked++;
  }
  assert.ok(checked > 100, `${checked} levers checked`);
  assert.equal(biggestLever(CASES.noScore, DATA.model), null);
});
