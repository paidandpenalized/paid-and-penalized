// The Readmissions site's derived values (derive.js), on synthetic records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capMarks, edition, exampleHospital, meanCutByYear, pafByYear, withDerived } from '../web/derive.js';
import { summarize } from '../../../engine/js/hrrp/summary.js';
import { ALL, CUT, HISTORY, META, hospital, loadHrrpOnce } from './fixtures.js';

test('edition: every phrase comes from the fiscal year and the history', () => {
  const e = edition(META, { ...HISTORY, years: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] });
  assert.equal(e.label, 'FY2027');
  assert.equal(e.nYears, 15);
  assert.equal(e.yearsWord, 'Fifteen');
  assert.equal(e.payShort, 'Oct 1, 2026 – Sep 30, 2027');
  assert.equal(e.payLong, 'October 1, 2026 through September 30, 2027');
  assert.equal(e.payStart, 'October 1, 2026');
  assert.equal(e.span, 'FY2013–FY2027');
  assert.equal(e.perfLong, 'July 1, 2023 through June 30, 2025');
});

test('edition: a count of years past twenty stays in digits', () => {
  const years = Array.from({ length: 21 }, (_, i) => 2006 + i);
  assert.equal(edition(META, { ...HISTORY, years }).yearsWord, '22');
});

test('withDerived adds each condition\'s part of the cut, the flagged conditions and the place', () => {
  const d = withDerived(CUT, META);
  assert.deepEqual(d.flags, ['HF']);
  assert.equal(d.place, 'Exampleton, ZZ');
  assert.ok(Math.abs(d.cx.HF - 0.01) < 1e-9);
  assert.equal(d.cx.AMI, 0);
  assert.equal(CUT.cx, undefined, 'the row itself is not changed');
  assert.equal(withDerived(hospital({ city: '' }), META).place, 'ZZ');
});

test('capMarks: a mark where the cap changed, the short form on all but the last', () => {
  const marks = capMarks([{ fy: 2013, cap: 1 }, { fy: 2014, cap: 2 }, { fy: 2015, cap: 3 }, { fy: 2016, cap: 3 }, { fy: 2017 }]);
  assert.deepEqual(marks, [
    { fy: 2013, label: '1% cap', short: '1%' }, { fy: 2014, label: '2% cap', short: '2%' }, { fy: 2015, label: '3% cap', short: '3% cap' },
  ]);
});

test('meanCutByYear: each year over the hospitals in that year\'s file', () => {
  const history = { years: [2025, 2026], paf: { 990001: [0.98, null], 990006: [null, 0.99] } };
  const pick = ALL.filter((h) => ['990001', '990006'].includes(h.id));
  const years = [2025, 2026, 2027];
  const trend = meanCutByYear(pick, years, pafByYear({ history, meta: META }));
  assert.deepEqual(trend, [2, 1, (1 + 0.5) / 2]);
  assert.deepEqual(meanCutByYear(pick, [2024], () => undefined), [null]);
});

test('exampleHospital: the median cut of the penalized, mid-size, several-condition hospitals, else the first', () => {
  const flags = ['AMI', 'COPD', 'HF'];
  const mk = (id, red, extra = {}) => ({ ...hospital({ id, red, paf: 0.99 }), flags, ...extra });
  const list = [mk('990011', 3), mk('990012', 1), mk('990013', 2), mk('990014', 5, { beds: 100 }), mk('990015', 0.5, { flags: ['HF'] }), mk('990016', 4, { paf: 1 })];
  assert.equal(exampleHospital(list).id, '990013');
  const none = [{ ...hospital({ id: '990021' }), flags: [] }, { ...hospital({ id: '990022' }), flags: [] }];
  assert.equal(exampleHospital(none).id, '990021');
});

test('real data: a hospital with a cut (red above zero) is one whose payment factor is below 1, so the share card\'s red dots match the penalized count', () => {
  const { hospitals } = loadHrrpOnce();
  assert.equal(summarize(hospitals).nPen, hospitals.filter((h) => h.paf < 1).length);
  assert.ok(hospitals.every((h) => (h.red > 0) === (h.paf < 1)));
});
