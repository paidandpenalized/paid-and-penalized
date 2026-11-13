// The build-time loader's own checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_PINS, HAI_MEASURES, HAI_PINS } from '../pipeline/history.js';
import { baselineShift, changedOn, changelogEntries, checkMasterYear, infectionsByHospital, loadHacrp } from '../web/data.js';
import { DATA } from './pinned.js';
import { decimal } from '../../../web/render/format.js';

test('the master must be built for the same HACRP year as the HACRP file; the message names both years', () => {
  checkMasterYear({ programYears: { hacrp: 2026 } }, 2026);
  assert.throws(() => checkMasterYear({ programYears: { hacrp: 2025 } }, 2026), /FY2026.*HACRP year is 2025/);
  assert.throws(() => checkMasterYear({ programYears: {} }, 2026), /FY2026.*HACRP year is undefined/);
  assert.throws(() => checkMasterYear({}, 2026), RangeError);
});

test('the pinned data loads: the newest master carries the file\'s HACRP year', () => {
  assert.ok(loadHacrp().master.size > 0);
});

test('on the pinned data, a measure cell is blank or "N/A" exactly when the parsed number is null', () => {
  const blank = (text) => text === '' || text === 'N/A';
  for (const h of loadHacrp().hospitals) {
    for (const m of Object.values(h.measures)) {
      assert.equal(m.value === null, blank(m.valueText), `value "${m.valueText}"`);
      assert.equal(m.z === null, blank(m.zText), `z "${m.zText}"`);
    }
  }
});

test('changelogEntries: each dated heading with its items, newest first as written; text outside them is ignored', () => {
  const text = '# What changed\n\nSome words.\n\n## 2026-10-22\n- Second thing.\n- First thing.  \n\n## 2026-10-21\n- Older.\n';
  assert.deepEqual(changelogEntries(text), [{ date: '2026-10-22', items: ['Second thing.', 'First thing.'] }, { date: '2026-10-21', items: ['Older.'] }]);
  assert.deepEqual(changelogEntries(text.replaceAll('\n', '\r\n')), changelogEntries(text), 'Windows line endings');
  assert.deepEqual(changelogEntries('# only a title\n'), []);
  assert.deepEqual(changelogEntries('## 2026-10-22 \n- a\n'), [{ date: '2026-10-22', items: ['a'] }], 'trailing space after the date');
});

test('changelogEntries: an item before the first date, or a date with no item, fails the build', () => {
  assert.throws(() => changelogEntries('- loose item\n## 2026-10-22\n- a\n'), /an item before the first dated heading/);
  assert.throws(() => changelogEntries('## 2026-10-22\n- a\n## 2026-10-21\n\nOnly words.\n'), /a dated heading with no items/);
  assert.throws(() => changelogEntries('## 2026-10-22\n'), /a dated heading with no items/);
});

test('the changelog the pages read: dated entries, newest first, each with items, none repeated', () => {
  const { changes } = loadHacrp();
  assert.ok(changes.length > 0);
  const dates = changes.map((c) => c.date);
  assert.deepEqual([...dates].sort().reverse(), dates);
  assert.equal(new Set(dates).size, dates.length);
  assert.ok(changes.every((c) => c.items.length > 0 && c.items.every((i) => i.length > 0)));
});

test('infectionsByHospital: each hospital\'s SIR by calendar year, none for a result CMS did not publish; years in the order given', () => {
  const sir = (ccn, vals) => Object.fromEntries(HAI_MEASURES.map(([, k]) => [`hai_${k}_sir`, vals[k] ?? 'Not Available']).concat([['ccn', ccn]]));
  const files = [
    { cy: 2021, rows: [sir('990001', { 1: '1.250', 2: '0.000' }), sir('990002', { 1: '0.800' })] },
    { cy: 2022, rows: [sir('990001', { 1: '1.100', 6: '0.9' })] },
  ];
  const out = infectionsByHospital(files);
  assert.deepEqual([...out.keys()], ['990001', '990002']);
  assert.deepEqual(out.get('990001'), [
    { cy: 2021, sir: { CLABSI: 1.25, CAUTI: 0, SSI_COLON: null, SSI_HYST: null, MRSA: null, CDI: null } },
    { cy: 2022, sir: { CLABSI: 1.1, CAUTI: null, SSI_COLON: null, SSI_HYST: null, MRSA: null, CDI: 0.9 } },
  ]);
  assert.deepEqual(out.get('990002').map((r) => r.cy), [2021], 'listed only for the years it appears in');
  assert.equal(infectionsByHospital([]).size, 0);
});

test('on the pinned data, the history loads with the infection results: every year of the history, a hospital\'s SIRs by calendar year', () => {
  const data = loadHacrp();
  assert.ok(data.history, 'the committed history is read');
  assert.equal(data.history.fy, data.fy);
  assert.equal(data.history.years.at(-1).fy, data.fy);
  assert.deepEqual(data.history.infections.map((i) => i.cy), HAI_PINS.map((p) => p.cy));
  assert.ok(data.infections.size > 3000);
  for (const [, list] of data.infections) {
    assert.ok(list.length > 0 && list.length <= HAI_PINS.length);
    assert.deepEqual(list.map((r) => r.cy), [...list.map((r) => r.cy)].sort((a, b) => a - b), 'oldest first');
    for (const r of list) assert.ok(Object.values(r.sir).every((v) => v === null || (Number.isFinite(v) && v >= 0)));
  }
});

test('checkHistoryYear: a history that does not end with the HACRP file\'s year fails the build; none at all is fine', async () => {
  const { checkHistoryYear } = await import('../web/data.js');
  assert.doesNotThrow(() => checkHistoryYear(null, 2027));
  assert.doesNotThrow(() => checkHistoryYear({ fy: 2027 }, 2027));
  assert.throws(() => checkHistoryYear({ fy: 2026 }, 2027), /history ends at FY2026/);
});

test('the day the numbers last changed reads the HACRP file, its history and its dollar estimates: not the hospital master, which another program\'s re-emit also rebuilds', () => {
  const { builtFiles, changedOn: day } = loadHacrp();
  assert.deepEqual(builtFiles.map(([path]) => path.split('/')[2]), ['hacrp', 'hacrp-history', 'dollars']);
  assert.equal(day, changedOn(builtFiles));
});

test('changedOn: the newest built_at date (UTC) among the files given; a file that is absent is skipped; a stamp that is not the schema\'s timestamp stops the build and names the file', () => {
  const at = (built_at, path = 'data/emitted/x/fy2026/x.json') => [path, { built_at }];
  assert.equal(changedOn([at('2026-10-20T16:29:57Z'), at('2026-10-23T14:02:59Z'), at('2026-10-22T12:15:15Z')]), '2026-10-23');
  assert.equal(changedOn([at('2026-10-20T16:29:57Z'), ['data/emitted/absent', null], at('2026-10-19T00:00:00Z')]), '2026-10-20');
  assert.equal(changedOn([at('2026-10-20T16:29:57Z')]), '2026-10-20');
  for (const bad of [at(undefined, 'b.json'), at('', 'b.json'), at('2026-10-20', 'b.json'), at('10/20/2026', 'b.json'),
    at('2026-02-30T00:00:00Z', 'b.json'), at('2026-10-20T16:29:57.5Z', 'b.json'), ['b.json', {}]]) {
    assert.throws(() => changedOn([at('2026-10-20T16:29:57Z'), bad]), /b\.json: built_at/, JSON.stringify(bad));
  }
  assert.throws(() => changedOn([['a.json', null]]), RangeError);
});

// A synthetic extract row for calendar year cy: C. diff's SIR, observed and predicted cells (CMS's text), the other
// measures not available.
const cdiRow = (cy, ccn, sir, observed, predicted) => ({
  ccn, start: `${cy}-01-01`, end: `${cy}-12-31`,
  ...Object.fromEntries(HAI_MEASURES.flatMap(([, k]) => ['sir', 'observed', 'predicted'].map((f) => [`hai_${k}_${f}`, 'Not Available']))),
  hai_6_sir: sir, hai_6_observed: observed, hai_6_predicted: predicted,
});

test('baselineShift: only hospitals with a C. diff SIR in both years; above one, the median and the summed counts on each side', () => {
  const before = { cy: 2024, id: 'hai-a', rows: [cdiRow(2024, '990001', '0.500', '5', '10.000'), cdiRow(2024, '990002', '1.500', '3', '2.000'), cdiRow(2024, '990003', '0.200', '1', '5.000'), cdiRow(2024, '990004', 'Not Available', '0', '0.500')] };
  const after = { cy: 2025, id: 'hai-b', rows: [cdiRow(2025, '990001', '1.000', '4', '4.000'), cdiRow(2025, '990002', '2.000', '2', '1.000'), cdiRow(2025, '990004', '0.800', '4', '5.000'), cdiRow(2025, '990005', '3.000', '3', '1.000')] };
  assert.deepEqual(baselineShift(before, after), {
    hospitals: 2,
    before: { cy: 2024, above: 1, median: 1, observed: 8, predicted: 12 },
    after: { cy: 2025, above: 1, median: 1.5, observed: 6, predicted: 5 },
    sources: ['hai-a', 'hai-b'],
  });
  assert.throws(() => baselineShift(before, { ...after, rows: [cdiRow(2025, '990009', '1.000', '1', '1.000')] }), /no hospital/);
  assert.throws(() => baselineShift(before, { ...after, rows: [cdiRow(2025, '990001', '1.000', 'Not Available', '1.000')] }), /CY2025 has 1 hospitals with a C. diff SIR but not both counts/);
  assert.throws(() => baselineShift(before, { ...after, cy: 2026 }), /HAI CY2026/);
});

// The figures Methods prints, on the pinned files. Hand-checked once against a separate sum over the extracts. The
// paragraph's words (methods/copy.js baselineShift3 and 4: "fewer", "fell", "nearly doubled", "most") were written for
// these figures: when a re-pin or a code change moves them, re-read those sentences before updating the numbers here.
// The checks after the numbers hold the words themselves, so they keep failing when only the numbers are updated.
test('baselineShift on the pinned CY2024 and CY2025 files: C. diff above one, the median and the counts', () => {
  const s = DATA.baselineShift;
  assert.deepEqual([s.before.cy, s.after.cy], [BASELINE_PINS.before.cy, BASELINE_PINS.after.cy]);
  assert.deepEqual(s.sources, [BASELINE_PINS.before.id, BASELINE_PINS.after.id]);
  assert.equal(s.hospitals, 2637);
  assert.deepEqual([s.before.above, s.after.above], [143, 625]);
  assert.deepEqual([s.before.median, s.after.median], [0.328, 0.61]);
  assert.deepEqual([s.before.observed, s.after.observed], [30231, 26658]);
  assert.deepEqual([Math.round(s.before.predicted), Math.round(s.after.predicted)], [81511, 37550]);
  // The words: reported cases fell, the predicted count fell further (so the SIR's rise came through it: "most"), and
  // the medians as printed (to two decimals) nearly doubled.
  assert.ok(s.after.observed < s.before.observed, 'reported cases "fewer"');
  assert.ok(s.after.predicted / s.before.predicted < s.after.observed / s.before.observed, 'the predicted count "fell" further');
  const printed = [s.before.median, s.after.median].map((x) => Number(decimal(x, 2)));
  assert.ok(printed[1] / printed[0] > 1.75 && printed[1] / printed[0] < 2, `"nearly doubled": ${printed.join(' to ')}`);
  assert.equal(s.released, '2026-11-12');
  // The history's lines stay on the old baseline: it ends at the earlier year and leaves out the newer.
  assert.equal(HAI_PINS.at(-1), BASELINE_PINS.before);
  assert.ok(!HAI_PINS.some((p) => p.id === BASELINE_PINS.after.id));
});
