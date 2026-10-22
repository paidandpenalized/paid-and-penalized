// One program year's self-check (engine/js/hacrp/history.js) on small synthetic years: how close the recomputed
// scores land, which misses are let pass (a part CMS withheld) and which are not, and whether CMS's decisions follow
// its scores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentileInc } from '../../stats.js';
import { ruleFor } from '../../hacrp/eras.js';
import { LINE_PERCENTILE, SCORE_TOLERANCE, partRanges, percentileLine, withheldPart, yearCheck } from '../../hacrp/history.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// A synthetic year: totals 1 to 8, the top quarter (7 and 8) cut, every recomputed score exact.
const row = (n, total, decision, over = {}) => ({ ccn: `99000${n}`, total, recomputed: total, decision, ...over });
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
  assert.equal(c.lineShare, 6 / 8, 'six of the eight decided were not cut');
  assert.equal(c.aboveNotCut, 0, 'every hospital above the percentile was cut');
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

test('a miss explained by a withheld part is counted apart and left out of the error; the same miss unexplained fails the year', () => {
  const rows = eight();
  rows[2] = { ...rows[2], recomputed: rows[2].total + 0.5 };
  const asked = [];
  const withheld = yearCheck(rows, (r) => { asked.push(r.ccn); return r.ccn === '990003' ? 'PSI90' : null; });
  assert.deepEqual(asked, ['990003'], 'only a row that misses is asked about');
  assert.deepEqual(withheld.withheld, ['990003']);
  assert.deepEqual(withheld.unexplained, []);
  assert.equal(withheld.scored, 7, 'the withheld row is not a scored one');
  assert.equal(withheld.diffs.length, 7);
  assert.equal(withheld.maxError, 0);
  assert.equal(withheld.ok, true);

  const unexplained = yearCheck(rows);
  assert.deepEqual(unexplained.unexplained, ['990003'], 'by default no miss is explained');
  assert.deepEqual(unexplained.withheld, []);
  assert.equal(unexplained.scored, 8, 'an unexplained miss stays among the scored, where it counts against the year');
  close(unexplained.maxError, 0.5);
  assert.equal(unexplained.within, 7);
  assert.equal(unexplained.ok, false);
});

test('a row that matches is never asked about: it is scored as any other', () => {
  const c = yearCheck(eight(), () => 'PSI90');
  assert.deepEqual([c.scored, c.within, c.withheld.length, c.unexplained.length], [8, 8, 0, 0]);
  assert.equal(c.ok, true);
});

// ---------- the withheld part ----------

// An equal-weight year's records: z-scores for PSI 90 and CLABSI; notes, the parts CMS footnoted.
const zRec = (psi, clabsi, total, notes = []) => ({ total, z: { PSI90: psi, CLABSI: clabsi }, d1: null, d2: null, notes: new Set(notes) });
const EQUAL = ruleFor(2024);
// The year's published parts: PSI 90 from -1 to 2, CLABSI from -0.5 to 0.5.
const Z_RANGES = partRanges([zRec(-1, -0.5, 0), zRec(2, 0.5, 0), zRec(0.25, null, 0)]);

test('partRanges: each part\'s lowest and highest published value that year, the domains\' too; a part never published has none', () => {
  assert.deepEqual(Z_RANGES, { PSI90: [-1, 2], CLABSI: [-0.5, 0.5] });
  assert.deepEqual(partRanges([{ z: { PSI90: 3 }, d1: 3, d2: 7.5 }, { z: { PSI90: null }, d1: null, d2: 2 }]), { PSI90: [3, 3], D1: [3, 3], D2: [2, 7.5] });
  assert.deepEqual(partRanges([]), {});
});

test('withheldPart, equal weights: a missing, footnoted part whose value the total implies lies in the year\'s range of it', () => {
  // CLABSI 0.2 published; the total 0.6 is the mean of it and a withheld PSI 90 of 1.0, inside PSI 90's range.
  assert.equal(withheldPart(zRec(null, 0.2, 0.6, ['PSI90']), EQUAL, Z_RANGES, 'z'), 'PSI90');
  // The same total with a footnote on the part that was published, not the missing one: no excuse.
  assert.equal(withheldPart(zRec(null, 0.2, 0.6, ['CLABSI']), EQUAL, Z_RANGES, 'z'), null);
  // No footnote at all: no excuse.
  assert.equal(withheldPart(zRec(null, 0.2, 0.6), EQUAL, Z_RANGES, 'z'), null);
  // A total that would need a PSI 90 of 3.0, past the highest CMS published that year: no excuse.
  assert.equal(withheldPart(zRec(null, 0.2, 1.6, ['PSI90']), EQUAL, Z_RANGES, 'z'), null);
  // Nothing missing: nothing withheld, whatever the footnotes.
  assert.equal(withheldPart(zRec(1, 0.2, 0.9, ['PSI90', 'CLABSI']), EQUAL, Z_RANGES, 'z'), null);
  // No total: nothing to solve.
  assert.equal(withheldPart(zRec(null, 0.2, null, ['PSI90']), EQUAL, Z_RANGES, 'z'), null);
  // The total is rounded: an implied part just past the range, by less than the rounding over the part's weight, fits.
  assert.equal(withheldPart(zRec(null, 0.2, 1.1 + SCORE_TOLERANCE / 4, ['PSI90']), EQUAL, Z_RANGES, 'z'), 'PSI90');
});

// A domains year's record in tenths: PSI 90 (Domain 1) and two infections; notes as above.
const tenthsRec = (psi, clabsi, cauti, total, notes = []) => ({ total, z: { PSI90: psi, CLABSI: clabsi, CAUTI: cauti }, d1: psi, d2: clabsi === null ? null : (clabsi + cauti) / 2, notes: new Set(notes) });
const FY2016 = ruleFor(2016);
const TENTHS_RANGES = { PSI90: [1, 10], CLABSI: [1, 10], CAUTI: [1, 10], D1: [1, 10], D2: [1, 10] };

test('withheldPart, domains in tenths: the missing domain solved from the total is a whole score from 1 to 10 in its range', () => {
  // Domain 2 is 8.5; a total of 0.25 x 9 + 0.75 x 8.5 = 8.625 implies Domain 1 = 9.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 8.625, ['D1', 'PSI90']), FY2016, TENTHS_RANGES, 'tenths'), 'D1');
  // A total that implies 9.4 for Domain 1: not a score CMS gives in tenths.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 8.725, ['D1']), FY2016, TENTHS_RANGES, 'tenths'), null);
  // One that implies 11: a whole number past the scale.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 0.25 * 11 + 0.75 * 8.5, ['D1']), FY2016, TENTHS_RANGES, 'tenths'), null);
  // One that implies 3, a whole score, but below the lowest Domain 1 CMS published that year.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 0.25 * 3 + 0.75 * 8.5, ['D1']), FY2016, { ...TENTHS_RANGES, D1: [5, 10] }, 'tenths'), null);
  // Domain 1 missing but only Domain 2 footnoted: no excuse.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 8.625, ['D2']), FY2016, TENTHS_RANGES, 'tenths'), null);
  // The same total in a z-score year: the domain need not be whole, only in its range.
  assert.equal(withheldPart(tenthsRec(null, 8, 9, 8.725, ['D1']), ruleFor(2018), TENTHS_RANGES, 'z'), 'D1');
  // Domain 2 missing, footnoted, the total implying it from Domain 1.
  assert.equal(withheldPart(tenthsRec(4, null, null, 0.25 * 4 + 0.75 * 7, ['D2']), FY2016, TENTHS_RANGES, 'tenths'), 'D2');
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

test('only decisions CMS gave count: N/A (Maryland), a missing decision and a missing score are not decided, and stay out of the percentile', () => {
  const rows = [...eight(), row(9, 0.5, 'N/A'), row(10, 0.25, null)];
  const c = yearCheck(rows);
  assert.equal(c.decided, 8);
  assert.equal(c.yes, 2);
  // linePct counts every published score at or below the highest not cut: the 0.5 and 0.25 as well as 1 to 6.
  assert.equal(c.linePct, 8 / 10);
  // The percentile and the line's share are over the decided alone, as CMS takes its percentile outside Maryland.
  close(c.p75, percentileInc([1, 2, 3, 4, 5, 6, 7, 8], 0.75));
  assert.equal(c.lineShare, 6 / 8);
  assert.equal(c.p75InGap, true);
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
  assert.equal(yearCheck(higher).aboveNotCut, 1, 'the 7 scored above the percentile and was not cut');
  // The gap includes the highest No itself and excludes the lowest Yes.
  const atNo = [0, 1, 1, 1, 2].map((t, k) => row(k + 1, t, t >= 2 ? 'Yes' : 'No'));
  assert.equal(yearCheck(atNo).p75, 1);
  assert.equal(yearCheck(atNo).p75InGap, true, 'the 75th percentile is the highest score not cut');
  const atYes = [0, 1, 2, 2, 2].map((t, k) => row(k + 1, t, t >= 2 ? 'Yes' : 'No'));
  assert.equal(yearCheck(atYes).p75, 2);
  assert.equal(yearCheck(atYes).p75InGap, false, 'the 75th percentile is the lowest score cut');
});

test('percentileLine: the inclusive 75th percentile of the decided scores, null with none', () => {
  assert.equal(percentileLine([]), null);
  assert.equal(percentileLine([row(1, null, 'N/A')]), null);
  assert.equal(percentileLine([row(1, 3, 'N/A')]), null, 'a Maryland score is not in it');
  close(percentileLine(eight()), 6.25);
  close(percentileLine([row(1, 4, 'No'), row(2, null, null), row(3, 2, 'No')]), 3.5);
  close(percentileLine([row(1, 4, 'No'), row(2, 2, 'No'), row(3, 100, 'N/A'), row(4, 50, null)]), 3.5);
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

// Code review, M3: Domain 2 is an average, so a withheld Domain 2 need not be whole in a tenths year; Domain 1 is
// withheld when CMS footnoted PSI 90, its one measure, as well as when it footnoted the domain.
test('withheldPart: a withheld Domain 2 in a tenths year may be fractional; a withheld Domain 1 may be footnoted on PSI 90', () => {
  const rule = { rule: 'domains', weights: [0.25, 0.75] };
  const ranges = { D1: [1, 10], D2: [1, 10] };
  // Domain 1 = 4 (PSI 90), Domain 2 withheld: the total 0.25 * 4 + 0.75 * 5.3333 implies D2 = 5.3333.
  const d2Missing = { total: 0.25 * 4 + 0.75 * 5.3333, z: { PSI90: 4, CLABSI: null, CAUTI: null }, d1: null, d2: null, notes: new Set(['D2']) };
  assert.equal(withheldPart(d2Missing, rule, ranges, 'tenths'), 'D2');
  // Domain 1 withheld, footnoted on PSI 90 only: the total implies D1 = 9, a whole score.
  const psiNoted = { total: 0.25 * 9 + 0.75 * 6, z: { PSI90: null, CLABSI: 6, CAUTI: 6 }, d1: null, d2: null, notes: new Set(['PSI90']) };
  assert.equal(withheldPart(psiNoted, rule, ranges, 'tenths'), 'D1');
  // The same with an implied D1 of 8.5: not a whole score, so not excused.
  assert.equal(withheldPart({ ...psiNoted, total: 0.25 * 8.5 + 0.75 * 6 }, rule, ranges, 'tenths'), null);
});
