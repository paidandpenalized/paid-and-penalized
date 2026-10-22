// What the years add up to (engine/js/hacrp/trends.js), on small synthetic records: a hospital's record is one
// character a year (Y cut, N not cut, . no decision), oldest first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUT, NONE, NOT_CUT, longestRun, panel, poissonBinomial, records, repeats, repeatsByGap, rollCallOrder, timesCut, timesCutVsChance, yearly, yearsDecided,
} from '../../hacrp/trends.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const rec = (ccn, total, decision) => ({ ccn, total, decision });

test('records: one character a year for each hospital with a decision in some year; a hospital that never had one is left out', () => {
  const years = [
    { fy: 2020, rows: [rec('990001', 1, 'Yes'), rec('990002', 0.5, 'No'), rec('990003', 0.7, 'N/A'), rec('990004', null, 'Yes')] },
    { fy: 2021, rows: [rec('990001', 0.1, 'No'), rec('990002', null, 'No'), rec('990005', 2, 'Yes')] },
    { fy: 2022, rows: [rec('990001', 1, 'Yes'), rec('990004', 3, 'No'), rec('990003', 0.2, null)] },
  ];
  const recs = records(years);
  assert.deepEqual([...recs], [['990001', 'YNY'], ['990002', 'N..'], ['990005', '.Y.'], ['990004', '..N']]);
  assert.ok(![...recs.keys()].includes('990003'), 'N/A and no decision are no decision, in every year');
  assert.ok([...recs.values()].every((r) => r.length === years.length));
  assert.deepEqual([CUT, NOT_CUT, NONE], ['Y', 'N', '.']);
  assert.deepEqual([...records([])], []);
});

test('timesCut and yearsDecided count the characters', () => {
  assert.equal(timesCut('YNY.'), 2);
  assert.equal(timesCut('....'), 0);
  assert.equal(yearsDecided('YNY.'), 3);
  assert.equal(yearsDecided('....'), 0);
});

test('yearly: hospitals with a decision, those cut, those cut for the first time, and the running count ever cut', () => {
  const recs = new Map([['a', 'YYN.'], ['b', 'NYY.'], ['c', '.NYY'], ['d', 'NNNN']]);
  assert.deepEqual(yearly(recs, 4), [
    { decided: 3, cut: 1, first: 1, ever: 1 },
    { decided: 4, cut: 2, first: 1, ever: 2 },
    { decided: 4, cut: 2, first: 1, ever: 3 },
    { decided: 2, cut: 1, first: 0, ever: 3 },
  ]);
  // A year with no decisions at all adds nothing and keeps the running count.
  assert.deepEqual(yearly(new Map([['a', 'Y.N'], ['b', 'N.N']]), 3), [
    { decided: 2, cut: 1, first: 1, ever: 1 }, { decided: 0, cut: 0, first: 0, ever: 1 }, { decided: 2, cut: 0, first: 0, ever: 1 },
  ]);
});

test('poissonBinomial: the chance of each count of cuts among independent years', () => {
  assert.deepEqual(poissonBinomial([]), [1]);
  assert.deepEqual(poissonBinomial([0.5, 0.5]), [0.25, 0.5, 0.25]);
  assert.deepEqual(poissonBinomial([1, 0, 1]), [0, 0, 1, 0]);
  const ps = [0.25, 0.4, 0.1, 0.9];
  const dist = poissonBinomial(ps);
  assert.equal(dist.length, ps.length + 1);
  close(sum(dist), 1);
  close(sum(dist.map((q, k) => q * k)), sum(ps), 1e-12);
  // Unequal chances, by hand: P(0) = 0.75 x 0.6 and P(2) = 0.25 x 0.4.
  const two = poissonBinomial([0.25, 0.4]);
  close(two[0], 0.45);
  close(two[1], 0.25 * 0.6 + 0.75 * 0.4);
  close(two[2], 0.1);
});

test('timesCutVsChance: observed hospitals by times cut, and the chance count where each year\'s cut falls at that year\'s share', () => {
  const recs = new Map([['a', 'YN.'], ['b', 'NNN'], ['c', '..Y']]);
  const shares = [0.5, 0.25, 0.5];
  const r = timesCutVsChance(recs, shares);
  assert.equal(r.hospitals, 3);
  assert.deepEqual(r.observed, [1, 2, 0, 0]);
  assert.equal(r.chance.length, 4);
  // Never cut: a 0.5 x 0.75, b 0.5 x 0.75 x 0.5, c 0.5.
  close(r.chance[0], 0.375 + 0.1875 + 0.5);
  // The chance counts add up to the hospitals, and their mean number of cuts to the shares at the years each had a decision.
  close(sum(r.chance), 3);
  close(sum(r.chance.map((q, k) => q * k)), (0.5 + 0.25) + (0.5 + 0.25 + 0.5) + 0.5);
});

test('timesCutVsChance: minYears leaves out hospitals with fewer years of decisions', () => {
  const recs = new Map([['a', 'YN.'], ['b', 'NNN'], ['c', '..Y']]);
  const shares = [0.5, 0.25, 0.5];
  const two = timesCutVsChance(recs, shares, { minYears: 2 });
  assert.equal(two.hospitals, 2);
  assert.deepEqual(two.observed, [1, 1, 0, 0]);
  close(sum(two.chance), 2);
  const all = timesCutVsChance(recs, shares, { minYears: 3 });
  assert.equal(all.hospitals, 1);
  assert.deepEqual(all.observed, [1, 0, 0, 0]);
  const none = timesCutVsChance(recs, shares, { minYears: 4 });
  assert.deepEqual([none.hospitals, none.observed, none.chance], [0, [0, 0, 0, 0], [0, 0, 0, 0]]);
});

test('timesCutVsChance: a hospital cut in every year it was decided is as rare as the shares say (two years at one half is a quarter)', () => {
  const r = timesCutVsChance(new Map([['a', 'YY'], ['b', 'NN'], ['c', 'YN'], ['d', 'NY']]), [0.5, 0.5]);
  assert.deepEqual(r.observed, [1, 2, 1]);
  assert.deepEqual(r.chance, [1, 2, 1]);
});

test('repeats: year to year, of those with a decision in both years, how many cut before were cut again and how many not cut before were cut', () => {
  const recs = new Map([['a', 'YYN'], ['b', 'YNY'], ['c', 'NY.'], ['d', 'N.Y'], ['e', '.YY']]);
  assert.deepEqual(repeats(recs, 3), [
    // 2020 to 2021: a Y->Y, b Y->N, c N->Y; d and e have no decision in both.
    { from: 0, to: 1, cutBefore: 2, cutAgain: 1, notBefore: 1, cutNew: 1 },
    // 2021 to 2022: a Y->N, b N->Y, e Y->Y; c and d have no decision in both.
    { from: 1, to: 2, cutBefore: 2, cutAgain: 1, notBefore: 1, cutNew: 1 },
  ]);
  assert.deepEqual(repeats(recs, 1), []);
});

test('repeatsByGap: each gap of k years pools every pair of years k apart, and a year with no decisions never forms a pair', () => {
  const recs = new Map([['a', 'YNY'], ['b', 'NYN']]);
  assert.deepEqual(repeatsByGap(recs, 3), [
    { k: 1, cutBefore: 2, cutAgain: 0, notBefore: 2, cutNew: 2 },
    { k: 2, cutBefore: 1, cutAgain: 1, notBefore: 1, cutNew: 0 },
  ]);
  // The middle year is a year CMS cut no one and scored no one (as FY2023): no pair has it as an end.
  const gap = repeatsByGap(new Map([['a', 'Y.Y'], ['b', 'N.N'], ['c', 'Y.N']]), 3);
  assert.deepEqual(gap, [{ k: 2, cutBefore: 2, cutAgain: 1, notBefore: 1, cutNew: 0 }]);
  // A gap with nobody cut before, or nobody not cut before, is left out rather than drawn at zero.
  assert.deepEqual(repeatsByGap(new Map([['a', 'NNN'], ['b', 'NNN']]), 3), []);
  assert.deepEqual(repeatsByGap(new Map([['a', 'YYY']]), 3), []);
});

test('repeatsByGap and repeats agree at a gap of one year', () => {
  const recs = new Map([['a', 'YYNY.'], ['b', 'NYYN.'], ['c', '.NYYY'], ['d', 'YNNNY']]);
  const byYear = repeats(recs, 5);
  const one = repeatsByGap(recs, 5)[0];
  assert.equal(one.k, 1);
  for (const key of ['cutBefore', 'cutAgain', 'notBefore', 'cutNew']) assert.equal(one[key], sum(byYear.map((r) => r[key])), key);
});

test('longestRun: the most years cut in a row, a year with no decision breaking the run', () => {
  assert.equal(longestRun('YYNYYY'), 3);
  assert.equal(longestRun('YNYN'), 1);
  assert.equal(longestRun('Y.Y'), 1);
  assert.equal(longestRun('NNN'), 0);
  assert.equal(longestRun('YYYY'), 4);
  assert.equal(longestRun(''), 0);
});

test('rollCallOrder: cut before not cut before no decision, year by year from the oldest, ties by CCN', () => {
  const recs = new Map([['990004', 'NY'], ['990001', '..'], ['990002', 'YN'], ['990005', 'Y.'], ['990003', 'YY'], ['990007', 'NY'], ['990006', 'NY']]);
  assert.deepEqual(rollCallOrder(recs).map(([ccn]) => ccn), ['990003', '990002', '990005', '990004', '990006', '990007', '990001']);
  assert.deepEqual(rollCallOrder(recs)[0], ['990003', 'YY'], 'each entry keeps its record');
  assert.deepEqual(rollCallOrder(new Map()), []);
  // The input is not reordered.
  assert.deepEqual([...recs.keys()][0], '990004');
});

test('panel: the hospitals with a decision in every one of the given years', () => {
  const recs = new Map([['a', 'YNY'], ['b', 'Y.Y'], ['c', '.NY'], ['d', 'NNN']]);
  assert.deepEqual([...panel(recs, [0, 2]).keys()], ['a', 'b', 'd']);
  assert.deepEqual([...panel(recs, [0, 1, 2]).keys()], ['a', 'd']);
  assert.deepEqual([...panel(recs, []).keys()], ['a', 'b', 'c', 'd'], 'no years asked: nobody is left out');
  assert.equal(panel(recs, [0, 2]).get('a'), 'YNY');
});
