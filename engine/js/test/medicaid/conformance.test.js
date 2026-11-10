// The JS port against the Python engine: every case in schemas/conformance/medicaid.vectors.json (built by
// pp_pipeline.medicaid.conformance from the real FY2023 records) within 1e-6 relative, plus the full-file checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario, rowToBase, marginChange, PARAMS } from '../../medicaid/scenario.js';
import { rollUp } from '../../medicaid/rollup.js';
import { REPO_ROOT, readJson } from '../../../../pipeline/files.js';

const vectors = readJson(`${REPO_ROOT}schemas/conformance/medicaid.vectors.json`);
const emitted = readJson(`${REPO_ROOT}data/emitted/medicaid/fy2023/medicaid.json`);
const TOL = 1e-6;
const camel = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const byId = new Map(vectors.hospitals.map((h) => [h.id, h]));
let worst = 0;
let emittedWorst = 0;

/** Asserts `actual` equals Python's `expected` (snake_case keys): same keys, null exact, numbers within TOL. */
function assertMatches(actual, expected, label, tol = TOL) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).map(camel).sort(), `${label}: keys`);
  for (const [pk, want] of Object.entries(expected)) {
    const got = actual[camel(pk)];
    if (want === null) { assert.equal(got, null, `${label}.${pk} should be null`); continue; }
    assert.equal(typeof got, 'number', `${label}.${pk} should be a number, got ${got}`);
    const diff = Math.abs(got - want);
    const rel = want === 0 ? diff : diff / Math.abs(want);
    worst = Math.max(worst, tol === TOL ? rel : 0);
    assert.ok(rel <= tol, `${label}.${pk}: ${got} vs ${want} (relative ${rel})`);
  }
}

const run = (h, c) => scenario(h.base, h.share, h.declines[c.scenario], { use: c.use, line2_5: c.line2_5 });

test('vectors: every hospital and class is present, with the case counts', () => {
  assert.ok(vectors.hospitals.length >= 60);
  assert.equal(vectors.cases.length, vectors.hospitals.length * 12);
  assert.equal(vectors.rollups.length, 12);
  assert.deepEqual(new Set(vectors.hospitals.map((h) => h.cls)), new Set(['scenario', 'not_expansion', 'no_viii_group', 'all_payer', 'territory']));
});

test('scenario() matches Python for every hospital, scenario, use rate and revenue base', () => {
  for (const c of vectors.cases) {
    assertMatches(run(byId.get(c.hospital), c), c.expected, `${c.hospital} ${c.scenario} use ${c.use}${c.line2_5 ? ' 2+5' : ''}`);
  }
});

test('rollUp() matches Python for every scenario, use rate and revenue base', () => {
  for (const c of vectors.rollups) {
    const pairs = vectors.hospitals.map((h) => [h.base, run(h, c)]);
    assertMatches(rollUp(pairs, { line2_5: c.line2_5 }), c.expected, `roll-up ${c.scenario} use ${c.use}${c.line2_5 ? ' 2+5' : ''}`);
  }
});

test('the exact-zero and null cases are exact (no share, unscored, no margin)', () => {
  const none = vectors.cases.find((c) => byId.get(c.hospital).share === null);
  assert.equal(run(byId.get(none.hospital), none).lost, 0);
  const noMargin = vectors.hospitals.find((h) => !h.base.has_margin);
  const r = scenario(noMargin.base, noMargin.share, 0.2);
  assert.equal(r.operatingMargin, null);
  assert.equal(r.totalMarginAfter, null);
});

test('the national roll-up is monotonic: low < middle < high for lost, at each use rate', () => {
  const mono = (totals, label) => {
    for (const use of [PARAMS.useMin, PARAMS.useDefault, PARAMS.useMax]) {
      const t = (sid) => totals(sid, use);
      assert.ok(t('low') < t('middle') && t('middle') < t('high'), `${label}, use ${use}: ${t('low')} < ${t('middle')} < ${t('high')}`);
    }
  };
  mono((sid, use) => rollUp(vectors.hospitals.map((h) => [h.base, scenario(h.base, h.share, h.declines[sid], { use })])).lost, 'vector hospitals');
  const rows = emitted.hospitals.map((r) => rowToBase(emitted.columns, r));
  const states = emitted.states;
  mono((sid, use) => nationalFromEmitted(rows, states, sid, use).lost, 'emitted national');
});

/** The emitted file's own national roll-up, recomputed in the browser's way: rows decoded, scenario() per scenario hospital. */
function nationalFromEmitted(rows, states, sid, use, line2_5 = false) {
  const pairs = [];
  for (const b of rows) {
    if (b.cls === 'all_payer' || b.status === null) continue; // Maryland is out of the national; no base without a report
    const decline = b.cls === 'scenario' ? states[b.state].declines[sid] : 0;
    pairs.push([b, scenario(b, b.cls === 'scenario' ? b.share : null, decline, { use, line2_5 })]);
  }
  return rollUp(pairs, { line2_5 });
}

test('rowToBase on a real emitted row, and the page-side national equals the emitted one', () => {
  const row = emitted.hospitals.find((r) => r[emitted.columns.indexOf('cls')] === 'scenario');
  const base = rowToBase(emitted.columns, row);
  assert.equal(Object.keys(base).length, emitted.columns.length);
  assert.equal(base.cls, 'scenario');
  assert.equal(base.medicaid_net_revenue, row[emitted.columns.indexOf('medicaid_net_revenue')]);
  assert.throws(() => rowToBase(emitted.columns, row.slice(1)), RangeError);
  const rows = emitted.hospitals.map((r) => rowToBase(emitted.columns, r));
  for (const sid of ['low', 'middle', 'high']) {
    const got = nationalFromEmitted(rows, emitted.states, sid, 1);
    const want = emitted.national[sid];
    // Inputs in the file are rounded to whole dollars and 6 places, so this is looser than the conformance bound.
    assertMatches(got, want, `emitted national ${sid}`, 1e-4);
    // Counts are integers of the same hospitals: exact, not within a tolerance.
    for (const k of ['hospitals', 'exposed', 'margin_hospitals', 'into_red', 'falls_1pp']) {
      assert.equal(got[camel(k)], want[k], `emitted national ${sid}.${k}`);
    }
    for (const k of Object.keys(want)) if (want[k]) emittedWorst = Math.max(emittedWorst, Math.abs(got[camel(k)] - want[k]) / Math.abs(want[k]));
  }
});

test('the emitted params block equals the JS constants', () => {
  assert.equal(PARAMS.uninsuredShare, emitted.params.uninsured_share);
  assert.equal(PARAMS.careStillUsed, emitted.params.care_still_used);
  assert.equal(PARAMS.useMin, emitted.params.use_min);
  assert.equal(PARAMS.useDefault, emitted.params.use_default);
  assert.equal(PARAMS.useMax, emitted.params.use_max);
});

test('inputs outside the method are refused', () => {
  const b = vectors.hospitals.find((h) => h.base.scored && h.share !== null).base;
  assert.throws(() => scenario(b, 0.5, 0.2, { use: 0.74 }), RangeError);
  assert.throws(() => scenario(b, 0.5, 0.2, { use: 1.26 }), RangeError);
  assert.throws(() => scenario(b, 0.5, 1.1), RangeError);
  assert.throws(() => scenario(b, 0.5, -0.1), RangeError);
  assert.throws(() => scenario(b, 1.5, 0.2), RangeError);
  assert.throws(() => scenario(b, 0.5, Number.NaN), RangeError);
});

test('marginChange is in percentage points and null without a margin', () => {
  assert.equal(marginChange({ operatingMargin: 0.05, operatingMarginAfter: 0.04 }) < 0, true);
  assert.ok(Math.abs(marginChange({ operatingMargin: 0.05, operatingMarginAfter: 0.04 }) + 1) < 1e-12);
  assert.equal(marginChange({ operatingMargin: null, operatingMarginAfter: null }), null);
});

test('report the largest relative difference', () => {
  console.log(`max relative difference vs Python: ${worst}; emitted-file national (rounded inputs): ${emittedWorst}`);
  assert.ok(worst <= TOL);
});

test('a share of exactly 1 and of 0 are accepted (the real file has neither at 1)', () => {
  const b = vectors.hospitals.find((h) => h.base.scored && h.share !== null).base;
  assert.equal(scenario(b, 1, 0.2).atRisk, b.medicaid_net_revenue);
  assert.equal(scenario(b, 0, 0.2).lost, 0);
});
