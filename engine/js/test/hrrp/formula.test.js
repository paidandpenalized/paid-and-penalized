// Ported from Thirty Day Readmissions (web/test/model.test.mjs at 33d1959).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDS, contrib, isMeasured, weightPublished, cutPct, condState, verdict, peerMedian } from '../../hrrp/formula.js';
import { REPO_ROOT, readJson } from '../../../../pipeline/files.js';

// CMS methodology infographic, Hospital A (peer group 4, NM 0.9458): CMS's published worked example.
const META_A = { nm: 0.9458, peerMedians: { 4: { AMI: 0.9970, COPD: 0.9954, HF: 1.0077, PN: 1.0021, CABG: 1.0093, THA_TKA: 1.0073 } } };
const HOSP_A = {
  peer: 4, paf: 0.9966,
  c: {
    AMI: { n: 42, err: 1.0259, flag: 1, ratio: 0.0648 },
    COPD: { n: 38, err: 1.0476, flag: 1, ratio: 0.0331 },
    HF: { n: 22, err: 1.0783, flag: 0, ratio: 0.05 },
    PN: { n: 23, err: 1.0007, flag: 0, ratio: 0.07 },
    CABG: { n: 25, err: 0.9439, flag: 0, ratio: 0.02 },
  },
};

test('reproduces the CMS worked example (0.34%)', () => {
  const r = contrib(HOSP_A, META_A);
  assert.equal(r.paf, 0.9966);
  assert.ok(Math.abs(r.byCond.AMI - 0.9458 * 0.0648 * (1.0259 - 0.997)) < 1e-12);
  assert.equal(r.byCond.HF, 0, 'fewer than 25 discharges never contributes');
  assert.equal(r.byCond.THA_TKA, 0, 'missing condition contributes 0');
});

test('bringing COPD to the peer median removes its contribution', () => {
  const base = contrib(HOSP_A, META_A);
  const r = contrib(HOSP_A, META_A, { COPD: 0.9954 });
  assert.equal(r.byCond.COPD, 0);
  assert.ok(r.reduction < base.reduction);
});

test('reduction is capped at 3%', () => {
  const h = { peer: 4, c: Object.fromEntries(CONDS.map((k) => [k, { n: 500, err: 1.6, flag: 1, ratio: 0.2 }])) };
  const r = contrib(h, META_A);
  assert.equal(r.reduction, 0.03);
  assert.equal(r.paf, 0.97);
});

test('isMeasured needs 25 cases and a published ratio; weightPublished needs a payment weight', () => {
  assert.equal(isMeasured({ n: 25, err: 1 }), true);
  assert.equal(isMeasured({ n: 24, err: 1 }), false);
  assert.equal(isMeasured({ n: 80, err: null }), false);
  assert.equal(isMeasured(undefined), false);
  assert.equal(weightPublished({ ratio: 0 }), true);
  assert.equal(weightPublished({}), false);
  assert.equal(weightPublished(undefined), false);
});

test('cutPct turns a factor into a percent cut at 2 places', () => {
  assert.equal(cutPct(0.9966), 0.34);
  assert.equal(cutPct(1), 0);
});

test('a flagged condition without a payment weight contributes nothing', () => {
  const h = { peer: 4, c: { AMI: { n: 42, err: 1.0259, flag: 1 } } };
  assert.equal(contrib(h, META_A).byCond.AMI, 0);
  assert.equal(peerMedian(META_A, 9, 'AMI'), null);
});

test('condState and verdict classify conditions and hospitals', () => {
  assert.equal(condState(HOSP_A, 'AMI', META_A), 'counted');
  assert.equal(condState(HOSP_A, 'CABG', META_A), 'below');
  assert.equal(condState(HOSP_A, 'HF', META_A), 'few');
  assert.equal(condState(HOSP_A, 'THA_TKA', META_A), 'none');
  const v = verdict(HOSP_A, META_A);
  assert.equal(v.status, 'penalized');
  assert.equal(v.top, 'AMI');
  assert.deepEqual(v.above, ['AMI', 'COPD']);
  assert.deepEqual(v.measured, ['AMI', 'COPD', 'CABG']);
  assert.equal(verdict({ peer: 4, paf: 1, c: {} }, META_A).status, 'none-measured');
  assert.equal(verdict({ peer: 4, paf: 1, c: { CABG: HOSP_A.c.CABG } }, META_A).status, 'none-below');
  assert.equal(verdict({ peer: 4, paf: 1, c: { AMI: HOSP_A.c.AMI } }, META_A).status, 'none-rounded');
});

test('a measured condition CMS flagged whose payment weight is not published is counted, and contributes 0', () => {
  const h = { peer: 4, c: { AMI: { n: 42, err: 1.0259, flag: 1 } } };
  assert.equal(condState(h, 'AMI', META_A), 'counted');
  assert.equal(contrib(h, META_A).byCond.AMI, 0);
});

test('CONDS are the emitted file\'s conditions, in order', () => {
  const d = readJson(REPO_ROOT + 'data/emitted/hrrp/fy2027/hrrp.json');
  assert.deepEqual(CONDS, d.conditions.map((c) => c.key));
});

for (const [label, path] of [['TDR pin', 'data/pinned/tdr/hrrp.json'], ['emitted FY2027', 'data/emitted/hrrp/fy2027/hrrp.json']]) {
  test(`the formula reproduces CMS's factor for every hospital (${label})`, () => {
    const d = readJson(REPO_ROOT + path);
    assert.ok(d.hospitals.length > 0);
    assert.ok(d.hospitals.every((h) => Number.isFinite(h.paf)), 'every paf is a finite number');
    const bad = d.hospitals.filter((h) => Math.abs(contrib(h, d.meta).paf - h.paf) > 1e-4 + 1e-12);
    assert.deepEqual(bad.map((h) => h.id), [], `${bad.length} of ${d.hospitals.length}`);
  });
}
