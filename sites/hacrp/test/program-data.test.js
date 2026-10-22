// What the program page and the place pages draw (web/program-data.js), on the pinned data and on tiny synthetic
// lists. Checks counts and structure against acceptance A1 and against each other, never a hospital by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { COL, STATUS_BITS, TYPE_KINDS, exploreAsset, inGroup, measureSummary, patternKey, programData, spearman } from '../web/program-data.js';
import { CASES, MODEL, master } from './fixtures.js';
import { DATA, PD } from './pinned.js';

const { model, hospitals } = DATA;
const A1 = checkA1(hospitals, model);
const sum = (xs, key) => xs.reduce((s, x) => s + x[key], 0);

test('counts: the file, the scored and the decided are acceptance A1\'s, and every hospital is counted once', () => {
  assert.ok(A1.ok);
  assert.deepEqual(PD.counts, { file: hospitals.length, scored: A1.a.n, decided: A1.b.n, yes: A1.b.yes });
  assert.equal(PD.rows.length, PD.counts.scored);
  assert.equal(PD.decidedRows.length, PD.counts.decided);
  assert.equal(PD.decidedRows.filter((r) => r.yes).length, PD.counts.yes);
  assert.ok(PD.counts.yes <= PD.counts.decided && PD.counts.decided <= PD.counts.scored && PD.counts.scored <= PD.counts.file);
  // A row's decision is CMS's own text: Yes, No, or neither (Maryland: scored, not subject).
  const byCcn = new Map(hospitals.map((h) => [h.ccn, h]));
  for (const row of PD.rows) {
    const h = byCcn.get(row.ccn);
    assert.equal(row.total, h.total);
    assert.equal(row.yes, row.decided ? h.paymentReduction === 'Yes' : null, `${row.ccn}: yes is null exactly when not decided`);
  }
  assert.equal(new Set(PD.rows.map((r) => r.ccn)).size, PD.rows.length, 'one row per hospital');
});

test('coverage: one pattern per distinct set of measures; the counts add up to the file, the decided and the cut', () => {
  assert.equal(sum(PD.coverage, 'n'), hospitals.length, 'every row of CMS\'s file is in one pattern');
  assert.equal(sum(PD.coverage, 'decided'), PD.counts.decided);
  assert.equal(sum(PD.coverage, 'yes'), PD.counts.yes);
  assert.equal(new Set(PD.coverage.map((c) => c.key)).size, PD.coverage.length, 'keys are distinct');
  for (const c of PD.coverage) {
    assert.equal(c.key, patternKey(c.ids));
    assert.deepEqual(c.ids, MEASURE_IDS.filter((id) => c.ids.includes(id)), `${c.key}: in MEASURE_IDS order`);
    assert.ok(c.yes <= c.decided && c.decided <= c.n && c.assigned <= c.n, c.key);
  }
  // Largest first, ties by key.
  for (let i = 1; i < PD.coverage.length; i++) {
    const [a, b] = [PD.coverage[i - 1], PD.coverage[i]];
    assert.ok(a.n > b.n || (a.n === b.n && a.key < b.key), `${a.key} before ${b.key}`);
  }
  // The empty pattern is the hospitals with no score at all, and none of them has a decision.
  const none = PD.coverage.find((c) => c.ids.length === 0);
  assert.equal(none.n, hospitals.filter((h) => h.total === null).length);
  assert.equal(none.decided, 0);
  // A pattern's patterns agree with the rows: scored hospitals are in a non-empty one.
  assert.equal(PD.coverage.filter((c) => c.ids.length > 0).reduce((s, c) => s + c.n, 0), PD.counts.scored);
});

test('measures: each measure\'s published values, sorted, summarized the way the browser summarizes them', () => {
  assert.deepEqual(Object.keys(PD.measures), MEASURE_IDS);
  for (const id of MEASURE_IDS) {
    const m = PD.measures[id];
    const published = hospitals.map((h) => h.measures[id].value).filter((v) => v !== null);
    assert.equal(m.n, published.length, id);
    assert.deepEqual(m.values, [...published].sort((a, b) => a - b), `${id}: sorted`);
    assert.ok(m.zero <= m.atFloor, `${id}: a zero is at or under the floor`);
    // The browser rebuilds this from the explore asset: the same function over the same values gives the same summary.
    assert.deepEqual(measureSummary(id, m.values, model.params[id], m.assigned), m);
    assert.equal(m.median, medianAt(model.params[id]));
  }
});

test('measureSummary on a synthetic list: counts at zero, at the floor and at the cap, the assigned count passed through', () => {
  const params = { floor: 0.2, cap: 1.5, median: 0.5123, decimals: 3 };
  const values = [0, 0, 0.2, 0.4, 0.5, 1, 1.5, 2.5];
  const s = measureSummary('X', values, params, 4);
  assert.equal(s.id, 'X');
  assert.deepEqual(s.values, values);
  assert.equal(s.n, 8);
  assert.equal(s.zero, 2);
  assert.equal(s.atFloor, 3, 'zeros are under the floor, and the floor itself counts');
  assert.equal(s.atCap, 2, 'the cap itself counts');
  assert.equal(s.assigned, 4);
  assert.equal(s.median, medianAt(params));
  assert.equal(s.median, 0.512, 'the median at CMS\'s decimals');
  assert.deepEqual(s.params, params);
  assert.deepEqual(
    [measureSummary('X', [], params, 0).n, measureSummary('X', [], params, 0).zero, measureSummary('X', [], params, 0).atCap],
    [0, 0, 0],
    'an empty list is all zeros',
  );
});

test('funnel: one entry per number of measures; the decided and the cut add up to the national counts', () => {
  assert.deepEqual(PD.funnel.map((f) => f.k), MEASURE_IDS.map((_, i) => i + 1));
  assert.equal(sum(PD.funnel, 'decided'), PD.counts.decided, 'every decided hospital is scored on 1 to 6 measures');
  assert.equal(sum(PD.funnel, 'yes'), PD.counts.yes);
  for (const f of PD.funnel) {
    assert.ok(f.yes <= f.decided, `k=${f.k}`);
    if (f.decided > 0) assert.ok(f.sd >= 0 && Number.isFinite(f.median), `k=${f.k}: a spread and a middle`);
    else assert.deepEqual([f.median, f.sd], [null, null]);
    assert.equal(f.decided, PD.decidedRows.filter((r) => r.ids.length === f.k).length, `k=${f.k}`);
  }
  // The one-measure patterns are the coverage patterns with a single measure and a decision.
  assert.deepEqual(PD.single.map((s) => s.id).sort(), PD.coverage.filter((c) => c.ids.length === 1 && c.decided > 0).map((c) => c.ids[0]).sort());
  assert.equal(sum(PD.single, 'decided'), PD.funnel[0].decided);
  assert.equal(sum(PD.single, 'yes'), PD.funnel[0].yes);
});

test('types: every group is a subset of the decided, and the cut a subset of the group', () => {
  assert.deepEqual(PD.types.map((k) => k.kind), TYPE_KINDS.map(([kind]) => kind));
  for (const k of PD.types) {
    assert.ok(k.groups.length > 0, `${k.kind}: some group has hospitals`);
    for (const g of k.groups) {
      assert.ok(g.decided > 0, `${k.kind}:${g.key}: an empty group is left out`);
      assert.ok(g.decided <= PD.counts.decided, `${k.kind}:${g.key}: decided`);
      assert.ok(g.yes <= g.decided, `${k.kind}:${g.key}: yes`);
    }
  }
  // Kinds whose groups cannot overlap (a hospital is in one of each) never add past the decided; special statuses may.
  for (const kind of ['teach', 'beds', 'own', 'urban']) {
    assert.ok(sum(PD.types.find((k) => k.kind === kind).groups, 'decided') <= PD.counts.decided, kind);
  }
  // Each group is the decided hospitals whose master record passes the group's test.
  for (const [kind, groups] of TYPE_KINDS) {
    for (const [key, test] of groups) {
      const members = PD.decidedRows.filter((r) => test(r.master));
      const group = PD.types.find((k) => k.kind === kind).groups.find((g) => g.key === key);
      assert.equal(group?.decided ?? 0, members.length, `${kind}:${key}`);
      assert.equal(group?.yes ?? 0, members.filter((r) => r.yes).length, `${kind}:${key}: cut`);
    }
  }
});

test('escapes: one entry per cut hospital; an escaped one would have been at or under CMS\'s highest No', () => {
  assert.equal(PD.escapes.length, PD.counts.yes);
  const cut = new Set(PD.decidedRows.filter((r) => r.yes).map((r) => r.ccn));
  assert.deepEqual(new Set(PD.escapes.map((e) => e.ccn)), cut);
  const { highestNo } = model.boundary;
  let escaped = 0;
  for (const e of PD.escapes) {
    if (e.after === null) {
      assert.deepEqual([e.id, e.escaped], [null, false], `${e.ccn}: no lever, no escape`);
      continue;
    }
    assert.ok(MEASURE_IDS.includes(e.id), `${e.ccn}: the measure that moved`);
    assert.ok(e.after < e.total, `${e.ccn}: the median lowers the score`);
    assert.equal(e.escaped, e.after <= highestNo, `${e.ccn}: escaped exactly when at or under the highest No`);
    if (e.escaped) escaped += 1;
  }
  assert.ok(escaped > 0 && escaped < PD.escapes.length, 'the pinned data has hospitals on both sides');
});

test('agree: Spearman\'s rank correlation for every pair of measures, in [-1, 1], over the hospitals with both', () => {
  const pairs = (MEASURE_IDS.length * (MEASURE_IDS.length - 1)) / 2;
  assert.equal(PD.agree.length, pairs);
  assert.equal(PD.agree.length, 15);
  const seen = new Set();
  for (const p of PD.agree) {
    assert.ok(MEASURE_IDS.indexOf(p.a) < MEASURE_IDS.indexOf(p.b), `${p.a}, ${p.b}: in measure order`);
    seen.add(`${p.a}|${p.b}`);
    assert.ok(Number.isFinite(p.rho) && p.rho >= -1 && p.rho <= 1, `${p.a}, ${p.b}: rho ${p.rho}`);
    const both = hospitals.filter((h) => h.measures[p.a].value !== null && h.measures[p.b].value !== null).length;
    assert.equal(p.n, both, `${p.a}, ${p.b}: hospitals with both`);
  }
  assert.equal(seen.size, pairs, 'each pair once');
});

test('spearman: identical order is 1, reversed is -1, ties take their average rank', () => {
  assert.equal(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1);
  assert.equal(spearman([1, 2, 3, 4, 5], [9, 7, 5, 3, 1]), -1);
  assert.equal(spearman([3, 1, 2], [30, 10, 20]), 1, 'any order, as long as it is the same');
  // Ranks [0, 1.5, 1.5, 3] against [0, 1, 2, 3]: 4.5 / sqrt(4.5 * 5) = 3 / sqrt(10).
  assert.ok(Math.abs(spearman([1, 2, 2, 3], [1, 2, 3, 4]) - 3 / Math.sqrt(10)) < 1e-12);
  // Only the order counts, not the size of the gaps: a huge outlier changes nothing.
  assert.equal(spearman([1, 2, 3, 4], [1, 2, 3, 1e9]), 1);
  assert.ok(Math.abs(spearman([1, 2, 3, 4], [2, 1, 4, 3]) - 0.6) < 1e-12);
  // Two lists of one length, at least three.
  assert.throws(() => spearman([1, 2, 3], [1, 2]), RangeError);
  assert.throws(() => spearman([1, 2], [1, 2]), RangeError);
});

test('assigned: the decided hospitals CMS gave its worst score on a measure', () => {
  const ids = new Set(PD.assigned.map((a) => a.ccn));
  assert.equal(ids.size, PD.assigned.length);
  const decided = new Map(PD.decidedRows.map((r) => [r.ccn, r]));
  for (const a of PD.assigned) {
    const row = decided.get(a.ccn);
    assert.ok(row, `${a.ccn}: a decided hospital`);
    assert.ok(a.assigned.length > 0 && a.assigned.every((id) => a.ids.includes(id)), `${a.ccn}: assigned measures are among those scored`);
    assert.equal(a.yes, row.yes);
    assert.equal(a.measuredNone, a.assigned.length === a.ids.length);
  }
  assert.equal(PD.assigned.length, PD.decidedRows.filter((r) => r.assigned.length).length);
});

test('maryland: scored hospitals CMS gave no decision, and how many sit at or above the lowest score it cut', () => {
  const notSubject = hospitals.filter((h) => h.total !== null && h.paymentReduction === 'N/A');
  assert.deepEqual(PD.maryland, { scored: notSubject.length, above: notSubject.filter((h) => h.total >= model.boundary.lowestYes).length });
  assert.ok(PD.maryland.scored > 0 && PD.maryland.above > 0, 'the pinned data makes the point');
});

test('drivers: each cut hospital is counted once, under the measure with its largest z-score', () => {
  assert.deepEqual(Object.keys(PD.drivers), MEASURE_IDS);
  assert.equal(Object.values(PD.drivers).reduce((s, n) => s + n, 0), PD.counts.yes);
  assert.ok(Object.values(PD.drivers).every((n) => Number.isInteger(n) && n >= 0));
});

test('programData on synthetic hospitals: a few rows are counted by their own properties', () => {
  // Every pair of measures needs a value on at least three of them (spearman), so four of these carry all six.
  const list = [CASES.yes, CASES.no, CASES.maryland, CASES.totalFootnote, CASES.noScore, CASES.yesNoScore];
  const masters = new Map(list.map((h) => [h.ccn, master(h.ccn, { state: h.state })]));
  // The real fitted measures, with the fixtures' made-up line (0.2500 / 0.2507): the Maryland row's 0.4000 is above it.
  const pd = programData({ hospitals: list, master: masters, model: { ...model, boundary: MODEL.boundary } });
  assert.deepEqual(pd.counts, { file: 6, scored: 4, decided: 3, yes: 1 });
  assert.deepEqual(pd.maryland, { scored: 1, above: 1 });
  assert.equal(sum(pd.coverage, 'n'), 6);
  assert.equal(pd.coverage.find((c) => c.ids.length === 0).n, 2, 'the two rows with no score');
  assert.equal(pd.escapes.length, 1);
});

test('exploreAsset: one row per scored hospital, its columns where COL says', () => {
  const asset = exploreAsset(PD, model);
  assert.deepEqual(asset.ids, MEASURE_IDS);
  assert.deepEqual(asset.boundary, model.boundary);
  assert.deepEqual(asset.params, model.params);
  assert.equal(asset.rows.length, PD.counts.scored);
  // COL names every column once, from 0 with no gaps, and each row is exactly that wide.
  const cols = Object.values(COL).sort((a, b) => a - b);
  assert.deepEqual(cols, cols.map((_, i) => i));
  const width = cols.length;
  const escapes = new Map(PD.escapes.map((e) => [e.ccn, e.after]));
  asset.rows.forEach((row, i) => {
    const r = PD.rows[i];
    assert.equal(row.length, width, `${r.ccn}: ${width} columns`);
    assert.equal(row[COL.ccn], r.ccn);
    assert.equal(row[COL.total], r.total);
    assert.equal(row[COL.yes], r.yes === null ? null : r.yes ? 1 : 0);
    assert.deepEqual(row[COL.values], r.values);
    assert.deepEqual(row[COL.z], r.z);
    assert.equal(row[COL.values].length, MEASURE_IDS.length);
    assert.equal(row[COL.state], r.master.state ?? null);
    assert.equal(row[COL.region], r.master.region ?? null);
    assert.equal(row[COL.cbsa], r.master.cbsa ?? null);
    assert.equal(row[COL.own], r.master.own ?? null);
    assert.equal(row[COL.teach], r.master.teach ?? null);
    const bits = MEASURE_IDS.reduce((b, id, k) => b | (r.assigned.includes(id) ? 1 << k : 0), 0);
    assert.equal(row[COL.assigned], bits, `${r.ccn}: assigned bits`);
    // Only a cut hospital with a lever has a score-after.
    assert.equal(row[COL.after], escapes.get(r.ccn) ?? null);
    if (r.yes !== true) assert.equal(row[COL.after], null);
  });
  // Special statuses are bits SCH 1, MDH 2, RRC 4.
  assert.deepEqual(STATUS_BITS, { SCH: 1, MDH: 2, RRC: 4 });
  asset.rows.forEach((row, i) => {
    const types = PD.rows[i].master.types ?? [];
    for (const [code, bit] of Object.entries(STATUS_BITS)) assert.equal((row[COL.status] & bit) !== 0, types.includes(code), `${row[COL.ccn]}: ${code}`);
  });
});

test('inGroup: the browser\'s test on an asset row finds the same hospitals as the build\'s test on the master', () => {
  const asset = exploreAsset(PD, model);
  const decided = asset.rows.filter((row) => row[COL.yes] !== null);
  for (const [kind, groups] of TYPE_KINDS) {
    for (const [key] of groups) {
      const built = PD.types.find((k) => k.kind === kind).groups.find((g) => g.key === key);
      const inBrowser = decided.filter((row) => inGroup(row, kind, key));
      assert.equal(inBrowser.length, built?.decided ?? 0, `${kind}:${key}`);
      assert.equal(inBrowser.filter((row) => row[COL.yes] === 1).length, built?.yes ?? 0, `${kind}:${key}: cut`);
    }
  }
  // Regions partition the scored hospitals the master places.
  const regions = [...new Set(asset.rows.map((row) => row[COL.region]).filter(Boolean))];
  assert.equal(regions.length, 4);
  assert.equal(regions.reduce((n, key) => n + asset.rows.filter((row) => inGroup(row, 'region', key)).length, 0), asset.rows.filter((row) => row[COL.region]).length);
  assert.throws(() => inGroup(asset.rows[0], 'nope', 'x'), TypeError);
});
