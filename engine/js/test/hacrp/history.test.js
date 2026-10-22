// One program year's self-check (engine/js/hacrp/history.js) on small synthetic years: how close the recomputed
// scores land, which misses are let pass (footnoted) and which are not, and whether CMS's decisions follow its scores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentileInc } from '../../stats.js';
import { LINE_PERCENTILE, SCORE_TOLERANCE, percentileLine, yearCheck } from '../../hacrp/history.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// A synthetic year: totals 1 to 8, the top quarter (7 and 8) cut, every recomputed score exact.
const row = (n, total, decision, over = {}) => ({ ccn: `99000${n}`, total, recomputed: total, decision, noted: false, ...over });
const eight = () => [1, 2, 3, 4, 5, 6, 7, 8].map((t) => row(t, t, t >= 7 ? 'Yes' : 'No'));

test('constants: scores must land within a thousandth, the line is the 75th percentile', () => {
  assert.equal(SCORE_TOLERANCE, 0.001);
  assert.equal(LINE_PERCENTILE, 0.75);
});

test('a perfect year: every score recomputed, every decision in order, the line in CMS\'s gap and at the 75th percentile', () => {
  const c = yearCheck(eight());
  assert.equal(c.scored, 8);
  assert.equal(c.within, 8);
  assert.equal(c.maxError, 0);
  assert.deepEqual([c.withheld, c.unexplained, c.wrongSide], [[], [], []]);
  assert.deepEqual([c.decided, c.yes, c.highestNo, c.lowestYes, c.atLine], [8, 2, 6, 7, 1]);
  // percentileInc over 1..8 at 0.75 is 6.25, between the highest No (6) and the lowest Yes (7).
  close(c.p75, 6.25);
  assert.equal(c.p75InGap, true);
  assert.equal(c.linePct, 6 / 8, 'six of the eight scores are at or below the highest No');
  assert.deepEqual(c.sorted.scores, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(c.sorted.yes, [false, false, false, false, false, false, true, true]);
  assert.equal(c.ok, true);
});

test('the decided are sorted lowest score first with ties by CCN, whatever order the records came in', () => {
  const rows = [row(3, 5, 'Yes'), row(1, 5, 'No'), row(2, 1, 'No'), row(4, 9, 'Yes')];
  const c = yearCheck(rows);
  assert.deepEqual(c.sorted.scores, [1, 5, 5, 9]);
  assert.deepEqual(c.sorted.yes, [false, false, true, true], 'the tie at 5: the No (CCN 990001) before the Yes (990003)');
  // And the tie across the line is out of order: both ends are named.
  assert.deepEqual([...c.wrongSide].sort(), ['990001', '990003']);
  assert.equal(c.ok, false);
});

test('a miss on a footnoted row is withheld, counted apart and left out of the error; the same miss unexplained fails the year', () => {
  const rows = eight();
  rows[2] = { ...rows[2], recomputed: rows[2].total + 0.5, noted: true };
  const withheld = yearCheck(rows);
  assert.deepEqual(withheld.withheld, ['990003']);
  assert.deepEqual(withheld.unexplained, []);
  assert.equal(withheld.scored, 7, 'the withheld row is not a scored one');
  assert.equal(withheld.diffs.length, 7);
  assert.equal(withheld.maxError, 0);
  assert.equal(withheld.ok, true);

  rows[2] = { ...rows[2], noted: false };
  const unexplained = yearCheck(rows);
  assert.deepEqual(unexplained.unexplained, ['990003']);
  assert.deepEqual(unexplained.withheld, []);
  assert.equal(unexplained.scored, 8, 'an unexplained miss stays among the scored, where it counts against the year');
  close(unexplained.maxError, 0.5);
  assert.equal(unexplained.within, 7);
  assert.equal(unexplained.ok, false);
});

test('a footnote on a row that matches is no excuse and no mark: it is scored as any other', () => {
  const rows = eight().map((r) => ({ ...r, noted: true }));
  const c = yearCheck(rows);
  assert.deepEqual([c.scored, c.within, c.withheld.length, c.unexplained.length], [8, 8, 0, 0]);
  assert.equal(c.ok, true);
});

test('the tolerance: a miss under a thousandth is rounding, a miss of a thousandth or more is not', () => {
  const near = eight();
  near[0] = { ...near[0], recomputed: near[0].total + 0.0009 };
  assert.equal(yearCheck(near).ok, true);
  assert.equal(yearCheck(near).within, 8);
  const far = eight();
  far[0] = { ...far[0], recomputed: far[0].total - 0.0011 };
  const c = yearCheck(far);
  assert.equal(c.ok, false);
  assert.deepEqual(c.unexplained, ['990001']);
  assert.equal(c.within, 7);
  close(c.diffs[0], -0.0011);
  close(c.maxError, 0.0011, 1e-12);
});

test('a score or a recomputed score that is missing is not checked, and a row with only one of them is not scored', () => {
  const rows = [...eight(), row(9, null, 'N/A', { recomputed: 3 }), row(10, 2, 'No', { recomputed: null })];
  const c = yearCheck(rows);
  assert.equal(c.scored, 8);
  assert.deepEqual([c.unexplained, c.withheld], [[], []]);
  // The row with CMS's score and no recomputed score is still decided; the one with no score is not.
  assert.equal(c.decided, 9);
});

test('ties at the line: every hospital CMS did not cut at the highest score not cut is counted, and ties inside the not-cut are fine', () => {
  const rows = [1, 2, 3, 3, 3, 4, 4].map((t, i) => row(i + 1, t, t >= 4 ? 'Yes' : 'No'));
  const c = yearCheck(rows);
  assert.equal(c.highestNo, 3);
  assert.equal(c.lowestYes, 4);
  assert.equal(c.atLine, 3);
  assert.equal(c.wrongSide.length, 0);
  assert.equal(c.ok, true);
});

test('decisions out of order: a hospital not cut scoring at or above one that was cut, and the cut ones at or below it, both are named', () => {
  const rows = eight();
  rows[7] = { ...rows[7], decision: 'No' }; // the highest score not cut
  rows[0] = { ...rows[0], decision: 'Yes' }; // the lowest score cut
  const c = yearCheck(rows);
  assert.equal(c.highestNo, 8);
  assert.equal(c.lowestYes, 1);
  // Every hospital sits on the wrong side of one end: Nos at or above the lowest Yes, Yeses at or below the highest No.
  assert.equal(c.wrongSide.length, 8);
  assert.equal(c.ok, false);
  // A single swap shows as two.
  const swap = eight();
  swap[5] = { ...swap[5], decision: 'Yes' }; // 6 cut
  swap[6] = { ...swap[6], decision: 'No' }; // 7 not cut
  const s = yearCheck(swap);
  assert.deepEqual([...s.wrongSide].sort(), ['990006', '990007']);
});

test('a tie between the highest not cut and the lowest cut is an order failure, and the year is not ok', () => {
  const rows = [row(1, 1, 'No'), row(2, 5, 'No'), row(3, 5, 'Yes'), row(4, 9, 'Yes')];
  const c = yearCheck(rows);
  assert.deepEqual([...c.wrongSide].sort(), ['990002', '990003']);
  assert.equal(c.ok, false);
  assert.equal(c.p75InGap, false, 'no gap when the two ends meet');
});

test('only decisions CMS gave count: N/A (Maryland), a missing decision and a missing score are not decided; they still stand in the percentile', () => {
  const rows = [...eight(), row(9, 0.5, 'N/A'), row(10, 0.25, null)];
  const c = yearCheck(rows);
  assert.equal(c.decided, 8);
  assert.equal(c.yes, 2);
  // linePct counts every published score at or below the highest not cut: the 0.5 and 0.25 as well as 1 to 6.
  assert.equal(c.linePct, 8 / 10);
  close(c.p75, percentileInc([0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8], 0.75));
});

test('the 75th percentile line sits in CMS\'s gap, or does not', () => {
  // 1..8: p75 = 6.25, in the gap [6, 7). Move the line down to 5/6: p75 is above the highest No, so it is not in the gap...
  const lower = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => row(t, t, t >= 6 ? 'Yes' : 'No'));
  const a = yearCheck(lower);
  assert.deepEqual([a.highestNo, a.lowestYes], [5, 6]);
  assert.equal(a.p75InGap, false, '6.25 is not below the lowest Yes (6)');
  // ...and a line moved up (only the top hospital cut) leaves it below the highest No.
  const higher = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => row(t, t, t >= 8 ? 'Yes' : 'No'));
  assert.equal(yearCheck(higher).p75InGap, false);
  // The gap includes the highest No itself and excludes the lowest Yes.
  const atNo = [0, 1, 1, 1, 2].map((t, k) => row(k + 1, t, t >= 2 ? 'Yes' : 'No'));
  assert.equal(yearCheck(atNo).p75, 1);
  assert.equal(yearCheck(atNo).p75InGap, true, 'the 75th percentile is the highest score not cut');
  const atYes = [0, 1, 2, 2, 2].map((t, k) => row(k + 1, t, t >= 2 ? 'Yes' : 'No'));
  assert.equal(yearCheck(atYes).p75, 2);
  assert.equal(yearCheck(atYes).p75InGap, false, 'the 75th percentile is the lowest score cut');
});

test('percentileLine: the inclusive 75th percentile of the published scores, null with none', () => {
  assert.equal(percentileLine([]), null);
  assert.equal(percentileLine([row(1, null, 'N/A')]), null);
  close(percentileLine(eight()), 6.25);
  close(percentileLine([row(1, 4, 'No'), row(2, null, null), row(3, 2, 'No')]), 3.5);
});

test('a year CMS scored no one (FY2023): nothing is checked and the year passes', () => {
  const rows = [1, 2, 3].map((n) => row(n, null, 'N/A', { recomputed: null }));
  const c = yearCheck(rows);
  assert.deepEqual([c.scored, c.within, c.maxError, c.decided, c.yes, c.wrongSide.length, c.atLine], [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([c.highestNo, c.lowestYes, c.p75, c.linePct], [null, null, null, null]);
  assert.equal(c.p75InGap, false);
  assert.deepEqual(c.sorted, { scores: [], yes: [] });
  assert.equal(c.ok, true);
});

test('a year with decisions of one kind only has no line and no order to check', () => {
  const onlyNo = yearCheck([row(1, 1, 'No'), row(2, 2, 'No')]);
  assert.deepEqual([onlyNo.highestNo, onlyNo.lowestYes, onlyNo.linePct, onlyNo.wrongSide.length, onlyNo.p75InGap, onlyNo.ok], [2, null, null, 0, false, true]);
  const onlyYes = yearCheck([row(1, 1, 'Yes'), row(2, 2, 'Yes')]);
  assert.deepEqual([onlyYes.highestNo, onlyYes.lowestYes, onlyYes.linePct, onlyYes.wrongSide.length, onlyYes.p75InGap, onlyYes.atLine, onlyYes.ok], [null, 1, null, 0, false, 0, true]);
});
