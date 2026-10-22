// What the history pages draw from (web/history-data.js, year-classes.js): each emitted year read as rows with
// recomputed scores, and historyData's counts, checks, chance, gaps, coverage, kinds, states and records. First on a
// small synthetic history whose every hospital's record is written out (history-fixtures.js), then on the committed
// file: every year's self-check must pass, with the withheld rows only in the two years whose files withhold a part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../../../engine/js/csv.js';
import { fileShape, normalRow, partNotes, recomputeTotal, ruleFor, toRecord } from '../../../engine/js/hacrp/eras.js';
import { partRanges, withheldPart, yearCheck } from '../../../engine/js/hacrp/history.js';
import { REPO_ROOT, readJson, readPinned } from '../../../pipeline/files.js';
import { historyFilesFrom, historyPath } from '../pipeline/history.js';
import { historyData, yearRows } from '../web/history-data.js';
import { YEAR_CLASSES, yearClass } from '../web/year-classes.js';
import { DATA } from './pinned.js';
import { NO_SCORE_AT, SYNTH_CCNS, SYNTH_DECIDED, SYNTH_FYS, WITHHELD, synthHistory, synthMaster } from './history-fixtures.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

const history = synthHistory();
const master = synthMaster();
const hd = historyData({ history, master });

// ---------- yearRows ----------

test('yearRows, a z-score year: each hospital with its numbers, its recomputed score, and whether CMS footnoted it', () => {
  const rows = yearRows(history.years[0]);
  assert.equal(rows.length, 21 + 1, 'the hospitals in the year\'s file (the Maryland-style one among them)');
  const one = rows.find((r) => r.ccn === '990101');
  assert.deepEqual([one.state, one.total, one.totalText, one.decision, one.notes.size], ['AL', 1.01, '1.0100', 'Yes', 0]);
  assert.deepEqual(one.z, { PSI90: 1.01, CLABSI: 1.01 });
  assert.equal(one.recomputed, 1.01);
  assert.deepEqual([one.d1, one.d2], [null, null]);
  // A hospital scored on one measure only: the withheld part is null and footnoted, and the mean is the other's. The
  // emitted file keeps footnotes by row, so every part of the row reads as footnoted.
  const single = rows.find((r) => r.ccn === '990105');
  assert.deepEqual(single.z, { PSI90: null, CLABSI: -0.95 });
  assert.deepEqual([...single.notes], ['PSI90', 'CLABSI']);
  assert.equal(single.recomputed, -0.95);
  // A Maryland-style row has a score and no decision.
  const md = rows.find((r) => r.ccn === '990301');
  assert.deepEqual([md.decision, typeof md.total], ['N/A', 'number']);
});

test('yearRows: a year CMS scored no one reads every total as none, although CMS published 0.0000 for each', () => {
  const rows = yearRows(history.years[NO_SCORE_AT]);
  assert.equal(rows.length, SYNTH_CCNS.length);
  assert.ok(rows.every((r) => r.total === null && r.totalText === '' && r.recomputed === null));
  // The raw file does say 0.0000.
  assert.ok(history.years[NO_SCORE_AT].hospitals.every((h) => h[2] === '0.0000'));
});

test('yearRows, a footnoted miss: the parts CMS left out make the recomputed score differ from its total, and the row is noted', () => {
  const rows = yearRows(history.years[WITHHELD.at]);
  const row = rows.find((r) => r.ccn === WITHHELD.ccn);
  assert.ok(row.notes.has('PSI90'));
  assert.ok(Math.abs(row.recomputed - row.total) > 0.3);
});

test('yearRows, tenths and domains: the 15/85, 25/75 and 35/65 years from the parts, and the domain scores for a row with no parts', () => {
  const emitted = (fy, hospitals, footnoted = []) => ({
    fy, rule: ruleFor(fy).rule, measures: ['PSI90', 'CLABSI', 'CAUTI'], scale: 'tenths', domains: true, decisions: 'cut-list', periods: { psi90: null, hai: null }, footnoted, hospitals,
  });
  // PSI 90 scores 2 (tenths); CLABSI 10 and CAUTI 4 average 7. Total by the year's weights.
  const parts = ['2', '10', '4', '2.0000', '7.0000'];
  const at = (fy) => yearRows(emitted(fy, [['990001', 'AL', '0', 'No', ...parts]]))[0].recomputed;
  close(at(2015), 0.35 * 2 + 0.65 * 7);
  close(at(2016), 0.25 * 2 + 0.75 * 7);
  close(at(2017), 0.15 * 2 + 0.85 * 7);
  // A row CMS published no parts for takes its two domain scores; a row with only one domain takes it whole.
  const rows = yearRows(emitted(2016, [['990002', 'AL', '3.5000', 'Yes', '', '', '', '2.0000', '4.0000'], ['990003', 'AL', '9.0000', '', '', '', '', '', '9.0000'], ['990004', 'AL', '', '', '', '', '', '', '']], ['990004']));
  close(rows[0].recomputed, 0.25 * 2 + 0.75 * 4);
  assert.equal(rows[1].recomputed, 9);
  assert.equal(rows[1].decision, null, 'a row with no decision text reads as none');
  assert.equal(rows[2].recomputed, null);
  assert.deepEqual([...rows[2].notes], ['PSI90', 'CLABSI', 'CAUTI', 'D1', 'D2'], 'a footnoted domain year\'s row: its parts and its domains');
  assert.equal(rows[0].notes.size, 0);
  assert.deepEqual([rows[0].d1, rows[0].d2], [2, 4]);
  // A row withheld from the year's totals altogether does not make it a year CMS scored no one.
  assert.ok(rows.some((r) => r.total !== null));
});

test('yearRows: an asterisk on a number (FY2015) is dropped, and anything that is not a number stops the build', () => {
  const year = { fy: 2015, rule: 'domains', measures: ['PSI90'], scale: 'tenths', domains: true, decisions: 'cut-list', periods: { psi90: null, hai: null }, footnoted: [], hospitals: [['990001', 'AL', '5.5000*', 'No', '1', '1.0000', '8.0000*']] };
  const [row] = yearRows(year);
  assert.deepEqual([row.total, row.totalText, row.d2], [5.5, '5.5000*', 8]);
  assert.throws(() => yearRows({ ...year, hospitals: [['990001', 'AL', 'abc', 'No', '1', '1.0000', '8.0000']] }), /not a number/);
});

// ---------- historyData on the synthetic history ----------

test('records: one character a year for each hospital with a decision somewhere; the Maryland-style hospital has none', () => {
  assert.equal(hd.recs.size, SYNTH_DECIDED.length);
  for (const [ccn, rec] of SYNTH_DECIDED) assert.equal(hd.recs.get(ccn), rec, ccn);
  assert.ok(!hd.recs.has('990301'));
  assert.deepEqual(hd.fys, SYNTH_FYS);
});

test('counts: hospitals decided, cut, cut for the first time, and ever cut, each year (FY2023 decides no one)', () => {
  assert.deepEqual(hd.counts, [
    { decided: 21, cut: 6, first: 6, ever: 6, share: 6 / 21 },
    { decided: 22, cut: 4, first: 2, ever: 8, share: 4 / 22 },
    { decided: 0, cut: 0, first: 0, ever: 8, share: null },
    { decided: 22, cut: 5, first: 3, ever: 11, share: 5 / 22 },
    { decided: 21, cut: 4, first: 1, ever: 12, share: 4 / 21 },
  ]);
  assert.equal(hd.cutYears, 4, 'every year but the one CMS cut no one');
});

test('checks: every year\'s self-check passes; the one footnoted miss is withheld, in FY2022 only; FY2023 scores no one', () => {
  assert.deepEqual(hd.checks.map((c) => c.fy), SYNTH_FYS);
  assert.ok(hd.checks.every((c) => c.check.ok));
  assert.ok(hd.checks.every((c) => c.check.unexplained.length === 0 && c.check.wrongSide.length === 0));
  assert.deepEqual(hd.checks.map((c) => c.check.withheld), [[], [WITHHELD.ccn], [], [], []]);
  const none = hd.checks[NO_SCORE_AT].check;
  assert.deepEqual([none.scored, none.decided, none.yes, none.highestNo, none.lowestYes], [0, 0, 0, null, null]);
  assert.ok(hd.checks.every((c) => c.rule === ruleFor(c.fy)));
  assert.ok(hd.checks.every((c) => c.scale === 'z' && c.ruleKey === 'ruleEqual'));
  // Years CMS cut anyone: the highest score not cut is below the lowest cut.
  for (const c of hd.checks.filter((x) => x.check.yes)) assert.ok(c.check.highestNo < c.check.lowestYes, `FY${c.fy}`);
});

test('panelChance: the hospitals with a decision in every year CMS cut anyone, by times cut, against what chance gives', () => {
  const p = hd.panelChance;
  assert.equal(p.years, 4, 'FY2021, 2022, 2024 and 2025');
  assert.equal(p.hospitals, 20, 'the two Maryland hospitals that miss a cut year are not in the panel');
  // Counts run to the number of years in the history (a hospital cannot be cut in FY2023), so the last is always empty here.
  assert.deepEqual(p.observed.slice(0, p.years + 1), [10, 6, 2, 1, 1]);
  assert.ok(p.observed.slice(p.years + 1).every((n) => n === 0));
  close(sum(p.chance), 20);
  // The mean number of cuts chance gives is the cut years\' shares summed, for every hospital in the panel.
  close(sum(p.chance.map((q, k) => q * k)), 20 * (6 / 21 + 4 / 22 + 5 / 22 + 4 / 21));
  // The hospital-years cut in the panel: all 19 cuts but 990303's (FY2021) and 990302's (FY2024), who are not in it.
  assert.equal(sum(p.observed.map((n, k) => n * k)), 6 + 4 + 5 + 4 - 2);
});

test('chance over every hospital with a decision: all 22, observed by times cut', () => {
  assert.equal(hd.chance.hospitals, 22);
  assert.equal(sum(hd.chance.observed), 22);
  close(sum(hd.chance.chance), 22);
  assert.equal(sum(hd.chance.observed.map((n, k) => n * k)), 6 + 4 + 5 + 4, 'the hospital-years cut');
});

test('gaps: how often a cut repeats k years on, with a year of no decisions never forming a pair', () => {
  assert.deepEqual(hd.gaps[0], { k: 1, cutBefore: 11, cutAgain: 4, notBefore: 31, cutNew: 4 });
  assert.deepEqual(hd.gaps.map((g) => g.k), [1, 2, 3, 4]);
  // Each hospital-year pair at a gap is counted once: the gaps of 1 to 4 years pool every pair of scoring years.
  const pairs = hd.gaps.map((g) => g.cutBefore + g.notBefore);
  assert.ok(pairs.every((n) => n > 0));
});

test('coverage: the share cut by what CMS scored a hospital on, pooled over the z-score years', () => {
  const { groups, first, last } = hd.coverage;
  assert.deepEqual([first, last], [2021, 2025]);
  assert.deepEqual(groups.every, { decided: 86, cut: 19 });
  // Scored on PSI 90 alone (CLABSI withheld): 990103, 990108, 990203, 990208 and 990303.
  assert.deepEqual(groups.psiOnly, { decided: 19, cut: 3 });
  // Scored on infections alone: 990105, 990110, 990205, 990210 every year, and 990107 in the year it was footnoted.
  assert.deepEqual(groups.noPsi, { decided: 17, cut: 3 });
  assert.deepEqual(groups.all, { decided: 50, cut: 13 });
});

test('byType and byState: the cut and decided each year by kind of hospital (the master\'s facts) and by state (each year\'s file)', () => {
  const group = (kind, key) => hd.byType.find((k) => k.kind === kind).groups.find((g) => g.key === key).years;
  assert.deepEqual(group('urban', 'true'), [{ decided: 10, cut: 3 }, { decided: 10, cut: 2 }, { decided: 0, cut: 0 }, { decided: 10, cut: 3 }, { decided: 10, cut: 3 }]);
  // Georgia (ten) and the one Maryland hospital the master knows with a decision.
  assert.deepEqual(group('urban', 'false'), [{ decided: 10, cut: 2 }, { decided: 11, cut: 2 }, { decided: 0, cut: 0 }, { decided: 11, cut: 2 }, { decided: 11, cut: 1 }]);
  // A hospital the master does not list (the closed one) is in no group of any kind.
  const total = (kind) => hd.byType.find((k) => k.kind === kind).groups.reduce((n, g) => n + g.years[0].decided, 0);
  assert.equal(total('urban'), 20, 'the closed hospital, with a decision in FY2021, is in neither group');
  assert.equal(total('own'), 20);
  // By state: every hospital with a record, by the state its file gave.
  assert.deepEqual([...hd.byState.keys()], ['AL', 'GA', 'MD']);
  assert.deepEqual(hd.byState.get('AL'), { years: [{ decided: 10, cut: 3 }, { decided: 10, cut: 2 }, { decided: 0, cut: 0 }, { decided: 10, cut: 3 }, { decided: 10, cut: 3 }] });
  assert.deepEqual(hd.byState.get('GA').years.map((y) => y.cut), [2, 2, 0, 1, 1]);
  assert.deepEqual(hd.byState.get('MD').years.map((y) => y.decided), [1, 2, 0, 2, 1], 'the Maryland-style hospital with no decision is not counted');
  assert.equal(hd.stateOf.get('990303'), 'MD', 'a hospital the master lacks keeps its state');
});

test('place: a hospital\'s place in line each year is the share of the year\'s other published scores below its own (the lowest 0, the highest 1)', () => {
  const y = hd.place[0];
  assert.equal(y.size, 22, 'every row with a score, decided or not');
  assert.equal(Math.max(...y.values()), 1);
  assert.equal(Math.min(...y.values()), 0);
  close(y.get('990101'), 16 / 21);
  assert.equal(hd.place[NO_SCORE_AT].size, 0, 'no scores, no place');
});

test('recordOf: a hospital\'s record, its cuts, years decided and longest run, and per year its decision, score text and place in line', () => {
  const r = hd.recordOf('990101');
  assert.deepEqual([r.rec, r.cut, r.decided, r.run], ['YY.YY', 4, 4, 2]);
  assert.deepEqual(r.years.map((y) => [y.fy, y.c]), [[2021, 'Y'], [2022, 'Y'], [2023, '.'], [2024, 'Y'], [2025, 'Y']]);
  assert.equal(r.years[0].totalText, '1.0100');
  close(r.years[0].share, 16 / 21);
  // The year CMS scored no one: the hospital is in the file, with no score and no place.
  assert.deepEqual([r.years[2].totalText, r.years[2].share], ['', null]);
  // A hospital not in a year's file has no score text at all.
  const late = hd.recordOf('990302');
  assert.deepEqual([late.years[0].c, late.years[0].totalText, late.years[0].share], ['.', null, null]);
  assert.equal(late.rec, '.N.YN');
  assert.equal(hd.recordOf('990301'), null, 'no decision in any year: no record');
  assert.equal(hd.recordOf('000000'), null);
});

test('the roll call order puts the hospitals cut first at the top and year by year splits them', () => {
  assert.deepEqual(hd.order.slice(0, 6).map(([ccn]) => ccn), ['990101', '990201', '990102', '990106', '990206', '990303']);
  assert.equal(hd.order.length, hd.recs.size);
});

test('years carries each year\'s rule, scale, measures, periods and where its decisions came from; infections pass through', () => {
  assert.deepEqual(hd.years.map((y) => y.fy), SYNTH_FYS);
  for (const y of hd.years) {
    assert.deepEqual([y.rule, y.scale, y.decisions, y.measures], ['equal', 'z', 'file', ['PSI90', 'CLABSI']]);
    assert.deepEqual(y.periods.psi90, { start: '07/01/2019', end: '06/30/2021' });
  }
  assert.deepEqual(hd.infections.map((i) => i.cy), [2021, 2022, 2024]);
  assert.deepEqual(historyData({ history: { ...history, infections: undefined }, master }).infections, []);
});

// ---------- the year map's inks ----------

test('yearClass: red the year it was cut, pale red after, gray for one not cut so far, and no dot before a first decision', () => {
  assert.deepEqual(YEAR_CLASSES, { clear: 'chart-dots--years-clear', scar: 'chart-dots--years-scar', now: 'chart-dots--pen' });
  const ink = (rec) => [...rec].map((_, i) => yearClass(rec, i));
  assert.deepEqual(ink('NYN.N'), ['clear', 'now', 'scar', 'scar', 'scar']);
  assert.deepEqual(ink('..NY.'), [null, null, 'clear', 'now', 'scar']);
  assert.deepEqual(ink('N.N'), ['clear', 'clear', 'clear'], 'a year with no decision after a not-cut year is still gray');
  assert.deepEqual(ink('...'), [null, null, null]);
  assert.deepEqual(ink('YYY'), ['now', 'now', 'now']);
  // Only the three keys YEAR_CLASSES has are ever returned.
  for (const rec of ['NYN.N', '..NY.', 'N.N', 'YNY']) for (const k of ink(rec)) assert.ok(k === null || k in YEAR_CLASSES);
});

// ---------- the committed history ----------

const committed = readJson(REPO_ROOT + historyPath(DATA.fy));
const real = historyData({ history: committed, master: DATA.master });

test('the committed history: FY2015 to the current year, one entry each, oldest first', () => {
  assert.deepEqual(real.fys, Array.from({ length: DATA.fy - 2015 + 1 }, (_, i) => 2015 + i));
  assert.equal(real.fys.at(-1), DATA.fy);
  assert.equal(real.years.length, real.fys.length);
});

test('the committed history: every year\'s self-check passes (scores within a thousandth, decisions in order), with no unexplained miss', () => {
  for (const { fy, check } of real.checks) {
    assert.equal(check.ok, true, `FY${fy}`);
    assert.deepEqual(check.unexplained, [], `FY${fy}: unexplained misses`);
    assert.deepEqual(check.wrongSide, [], `FY${fy}: decisions out of order`);
    assert.ok(check.maxError < 0.001, `FY${fy}: largest miss ${check.maxError}`);
    assert.equal(check.within, check.scored, `FY${fy}: every scored row within the tolerance`);
  }
});

test('the committed history: rows are withheld only in FY2016 (one) and FY2017 (44), and FY2023 scores no one', () => {
  assert.deepEqual(real.checks.filter((c) => c.check.withheld.length).map((c) => [c.fy, c.check.withheld.length]), [[2016, 1], [2017, 44]]);
  const y2023 = real.checks.find((c) => c.fy === 2023).check;
  assert.deepEqual([y2023.scored, y2023.decided, y2023.yes], [0, 0, 0]);
  assert.equal(real.counts[real.fys.indexOf(2023)].cut, 0);
  // Every other year has scored hospitals and cuts about a quarter of those it decided.
  for (const { fy, check } of real.checks.filter((c) => c.fy !== 2023)) {
    assert.ok(check.scored > 2000 && check.decided > 2000, `FY${fy}: a year of hospitals`);
    assert.ok(check.yes / check.decided > 0.2 && check.yes / check.decided < 0.3, `FY${fy}: about a quarter cut`);
    assert.ok(check.highestNo < check.lowestYes, `FY${fy}: the highest score not cut is below the lowest cut`);
  }
});

// The emitted file keeps CMS's footnotes by row; the pinned files have each part's own footnote column. The self-check
// from the pinned files, with each part's own footnotes (eras.js partNotes), lets the same rows through as the pages'.
test('the pinned files: with each part\'s own footnote, the self-check withholds exactly the rows the pages do, and explains every miss', () => {
  for (const { fy, rows } of historyFilesFrom(readPinned, parseCsv)) {
    const shape = fileShape(Object.keys(rows[0]));
    const rule = ruleFor(fy);
    const recs = rows.map(normalRow).map((r) => {
      const rec = { ...toRecord(r, shape), notes: partNotes(r, shape) };
      return { ...rec, recomputed: recomputeTotal(rec, rule) };
    });
    const ranges = partRanges(recs);
    const check = yearCheck(recs, (r) => withheldPart(r, rule, ranges, shape.scale));
    const page = real.checks.find((c) => c.fy === fy).check;
    assert.deepEqual(check.withheld, page.withheld, `FY${fy}: the rows withheld`);
    assert.deepEqual(check.unexplained, [], `FY${fy}: no unexplained miss`);
    // Every row withheld has the part it implies footnoted on that part itself.
    for (const ccn of check.withheld) {
      const r = recs.find((x) => x.ccn === ccn);
      assert.ok(r.notes.has(withheldPart(r, rule, ranges, shape.scale)), `FY${fy} ${ccn}`);
    }
  }
});

test('the committed history: the newest year\'s counts are the current year\'s emitted file\'s', () => {
  const last = real.counts.at(-1);
  const yes = DATA.hospitals.filter((h) => h.total !== null && h.paymentReduction === 'Yes').length;
  const decided = DATA.hospitals.filter((h) => h.total !== null && (h.paymentReduction === 'Yes' || h.paymentReduction === 'No')).length;
  assert.deepEqual([last.cut, last.decided], [yes, decided]);
  assert.equal(real.checks.at(-1).check.highestNo, DATA.model.boundary.highestNo);
  assert.equal(real.checks.at(-1).check.lowestYes, DATA.model.boundary.lowestYes);
});

test('the committed history: counts are consistent (ever cut grows by the first-time cuts; no year cuts more than it decided)', () => {
  real.counts.forEach((c, i) => {
    assert.ok(c.cut <= c.decided && c.first <= c.cut, `FY${real.fys[i]}`);
    assert.equal(c.ever, (i ? real.counts[i - 1].ever : 0) + c.first, `FY${real.fys[i]}`);
  });
  assert.equal(real.counts.at(-1).ever, [...real.recs.values()].filter((r) => r.includes('Y')).length);
  assert.ok(real.recs.size > real.counts.at(-1).ever);
  assert.ok([...real.recs.values()].every((r) => r.length === real.fys.length));
  assert.equal(real.panelChance.years, real.counts.filter((c) => c.cut).length);
});
