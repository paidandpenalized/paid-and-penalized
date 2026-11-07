// Ported from Thirty Day Readmissions (web/test/model.test.mjs and review.test.mjs at 33d1959): the formatters' tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtPct, fmtInt, fmtMoney, fmtDate, roundTo, binIndex, factor4, ratio, points } from '../web/numbers.js';

test('fmtPct: percent units, two decimals by default, a dash for a missing value', () => {
  assert.equal(fmtPct(0.34), '0.34%');
  assert.equal(fmtPct(83.4, 0), '83%');
  assert.equal(fmtPct(3, 1), '3.0%');
  assert.deepEqual([fmtPct(null), fmtPct(undefined), fmtPct(NaN), fmtPct(Infinity)], ['—', '—', '—', '—']);
});

test('fmtInt: thousands separators, rounded, a dash for a missing value', () => {
  assert.equal(fmtInt(2912), '2,912');
  assert.equal(fmtInt(1234.6), '1,235');
  assert.equal(fmtInt(0), '0');
  assert.equal(fmtInt(null), '—');
});

test('fmtMoney: $999, $12K, $1.2M, $120M, $1.2B, and never "$1000K" at a rounding point', () => {
  assert.deepEqual([999, 12000, 1.2e6, 1.2e8, 1.2e9].map(fmtMoney), ['$999', '$12K', '$1.2M', '$120M', '$1.2B']);
  assert.equal(fmtMoney(999.6), '$1K');
  assert.equal(fmtMoney(999600), '$1.0M');
  assert.equal(fmtMoney(99.96e6), '$100M');
  assert.equal(fmtMoney(999.6e6), '$1.0B');
  assert.deepEqual([fmtMoney(null), fmtMoney(NaN)], ['—', '—']);
  // The source printed a negative as "$-12K"; the family writes a true minus.
  assert.equal(fmtMoney(-12000), '−$12K');
});

test('fmtDate: short month by default, long on request, a dash for no date', () => {
  assert.equal(fmtDate('2026-08-13'), 'Aug 13, 2026');
  assert.equal(fmtDate('2025-03-31', 'long'), 'March 31, 2025');
  assert.equal(fmtDate('2026-05-02'), 'May 2, 2026');
  assert.equal(fmtDate(null), '—');
});

test('roundTo: a number rounded to dp decimals, or null', () => {
  assert.equal(roundTo(1.23456, 2), 1.23);
  assert.equal(roundTo(0.9988, 4), 0.9988);
  assert.equal(roundTo(null, 2), null);
  assert.equal(roundTo(NaN, 2), null);
});

test('binIndex puts threshold values in the upper bin despite floating point', () => {
  // The source takes (v, step); here the bins also start at lo, and lo 0 gives the source's cases.
  assert.equal(binIndex(0.25, 0, 0.05), 5);
  assert.equal(binIndex(0.24, 0, 0.05), 4);
  assert.equal(binIndex(1.0, 0, 0.05), 20);
  assert.equal(binIndex(0.29, 0, 0.01), 29);
  assert.equal(binIndex(1.25, 1, 0.05), 5);
});

test('factor4, ratio and points: fixed decimals as CMS and the worksheet print them', () => {
  assert.deepEqual([factor4(0.9988), factor4(1), factor4(null)], ['0.9988', '1.0000', '—']);
  assert.deepEqual([ratio(1.0259), ratio(0.9970, 3), ratio(undefined)], ['1.0259', '0.997', '—']);
  assert.deepEqual([points(0.00342), points(0.0034, 2), points(NaN)], ['0.342', '0.34', '—']);
});

test('fmtShare: a fraction as a percentage, an exact half at the last place shown rounding up (float noise off first)', async () => {
  const { fmtShare } = await import('../web/numbers.js');
  assert.equal(fmtShare(207 / 360), '58%');
  assert.equal(fmtShare(0.574), '57%');
  assert.equal(fmtShare(0.12345, 1), '12.3%');
  assert.equal(fmtShare(null), '—');
});
