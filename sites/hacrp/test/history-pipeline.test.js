// The history's emitter (sites/hacrp/pipeline/history.js) on synthetic files, and its pins: CMS's dates in the forms
// each year uses, the cut lists that stand in for a payment column in FY2015 and FY2016, one year's file as one
// emitted year (and every way a file can be wrong), the nation's infection results, and the whole build. Every CCN is
// invented (990001 and on); no hospital is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../../engine/js/schema.js';
import { REPO_ROOT, loadSchemas, readJson, readManifest } from '../../../pipeline/files.js';
import {
  HAI_MEASURES, HAI_PINS, HISTORY_METHODS_VERSION, HISTORY_PINS, HISTORY_SCHEMA_VERSION, buildHistory, cmsDate, cutListFlags, historyFilesFrom, historyPath,
  historyYear, infectionFilesFrom, infectionYear,
} from '../pipeline/history.js';

// ---------- CMS's dates ----------

test('cmsDate: MM/DD/YYYY as it is, MMDDYYYY (FY2016, FY2017) and DD-MON-YY (FY2015) as MM/DD/YYYY; blank and N/A are none', () => {
  assert.equal(cmsDate('07/01/2021'), '07/01/2021');
  assert.equal(cmsDate('07012013'), '07/01/2013');
  assert.equal(cmsDate('12312015'), '12/31/2015');
  assert.equal(cmsDate('01-JUL-11'), '07/01/2011');
  assert.equal(cmsDate('31-DEC-13'), '12/31/2013');
  assert.equal(cmsDate('15-JAN-12'), '01/15/2012');
  assert.equal(cmsDate('  06/30/2023 '), '06/30/2023', 'CMS pads some cells');
  for (const none of ['', '   ', 'N/A', null, undefined]) assert.equal(cmsDate(none), null, String(none));
});

test('cmsDate: any other form throws, naming the text', () => {
  for (const bad of ['2021-07-01', '7/1/2021', '01-XXX-12', '01-jul-11', '1-JUL-11', '07/01/21', '0701201', 'not a date', 'n/a']) {
    assert.throws(() => cmsDate(bad), (e) => e instanceof RangeError && e.message.includes(`"${bad.trim()}"`), bad);
  }
});

// ---------- CMS's cut lists ----------

const LIST_2015 = [
  'TABLE 17. FY 2015 HOSPITAL ACQUIRED CONDITIONS (HAC) REDUCTION PROGRAM\t\t',
  'CMS Certification Number (CCN)\tTop 25th Percentile\tTotal HAC Score*',
  '990001\tN    \t6.9',
  '990002\tY\t8.35',
  '990003\tN/A\t',
  '99T004\tN\t1.65',
  '* A note about the scores. 12345',
  '',
].join('\r\n');
const LIST_2016 = [
  'FY 2016 HOSPITAL ACQUIRED CONDITIONS (HAC) REDUCTION PROGRAM\t\t\t',
  'CMS Certification Number (CCN)\tState\tTop 25th Percentile\tTotal HAC Score*',
  '990001\tAL\tN\t6.2500',
  '990005\tGA\tY\t8.0000',
].join('\n');

test('cutListFlags: each CCN\'s flag as Yes, No or N/A, and CMS\'s text for its total (and its state, when the list has one)', () => {
  const flags = cutListFlags(LIST_2015);
  assert.deepEqual([...flags], [
    ['990001', { flag: 'No', total: '6.9', state: '' }],
    ['990002', { flag: 'Yes', total: '8.35', state: '' }],
    ['990003', { flag: 'N/A', total: '', state: '' }],
    ['99T004', { flag: 'No', total: '1.65', state: '' }],
  ]);
  assert.deepEqual([...cutListFlags(LIST_2016)], [
    ['990001', { flag: 'No', total: '6.2500', state: 'AL' }],
    ['990005', { flag: 'Yes', total: '8.0000', state: 'GA' }],
  ]);
});

test('cutListFlags: a title, notes and blank lines are skipped; a list with no header, or without its columns, throws', () => {
  assert.equal(cutListFlags('title\nCMS Certification Number (CCN)\tTop 25th Percentile\tTotal HAC Score\n').size, 0);
  assert.throws(() => cutListFlags('990001\tN\t6.9\n'), /no header row/);
  assert.throws(() => cutListFlags(''), /no header row/);
  assert.throws(() => cutListFlags('CMS Certification Number (CCN)\tTotal HAC Score\n990001\t6.9'), /no "Top 25th Percentile" or "Total HAC Score" column/);
  assert.throws(() => cutListFlags('CMS Certification Number (CCN)\tTop 25th Percentile\n990001\tN'), /no "Top 25th Percentile" or "Total HAC Score" column/);
});

test('cutListFlags: an unknown flag, a row too short to have one, or a CCN listed twice throws, naming the CCN', () => {
  const head = 'CMS Certification Number (CCN)\tTop 25th Percentile\tTotal HAC Score\n';
  assert.throws(() => cutListFlags(`${head}990001\tX\t1`), /CCN 990001 has flag "X"/);
  assert.throws(() => cutListFlags(`${head}990001\tn\t1`), /CCN 990001 has flag "n"/, 'case matters');
  assert.throws(() => cutListFlags(`${head}990001`), /CCN 990001 has flag "undefined"/);
  assert.throws(() => cutListFlags(`${head}990001\tN\t1\n990002\tY\t2\n990001\tY\t3`), /CCN 990001 appears twice/);
});

// ---------- one year's file ----------

// A z-score year's file (FY2024's words): two measures, the periods, one footnoted row.
const zRow = (ccn, over = {}) => ({
  'Facility ID': ccn, State: 'AL', 'Fiscal Year': '2024', 'PSI 90 W Z Score': '1.0000', 'PSI 90 Start Date': '07/01/2021', 'PSI 90 End Date': '06/30/2023',
  'CLABSI W Z Score': '0.5000', 'HAI Measures Start Date': '01/01/2022', 'HAI Measures End Date': '12/31/2023', 'Total HAC Score': '0.7500',
  'Total HAC Footnote': '', 'Payment Reduction': 'No', 'Payment Reduction Footnote': '', ...over,
});

test('historyYear: a z-score year in one shape: the rule, the measures, the periods, and each hospital as CMS\'s text', () => {
  const rows = [zRow('990001'), zRow('990002', { State: 'GA', 'Total HAC Score': '-0.1200', 'Payment Reduction': 'Yes', 'CLABSI W Z Score': 'N/A', 'Total HAC Footnote': '5' }), zRow('990003', { 'Payment Reduction': 'Not Available', 'Total HAC Score': 'N/A' })];
  const y = historyYear(2024, rows);
  assert.deepEqual(y, {
    fy: 2024,
    rule: 'equal',
    measures: ['PSI90', 'CLABSI'],
    scale: 'z',
    domains: false,
    decisions: 'file',
    periods: { psi90: { start: '07/01/2021', end: '06/30/2023' }, hai: { start: '01/01/2022', end: '12/31/2023' } },
    footnoted: ['990002'],
    hospitals: [
      ['990001', 'AL', '0.7500', 'No', '1.0000', '0.5000'],
      ['990002', 'GA', '-0.1200', 'Yes', '1.0000', 'N/A'],
      ['990003', 'AL', 'N/A', 'N/A', '1.0000', '0.5000'],
    ],
  });
  assert.equal(y.hospitals[2][3], 'N/A', 'FY2019\'s "Not Available" is written N/A');
});

test('historyYear: a domains year with decisions from a cut list: tenths, the domain scores, MMDDYYYY dates, and the list\'s own hospitals added', () => {
  const row = (ccn, over = {}) => ({
    Hospital_Name: 'EXAMPLE', 'PROVIDER ID': ccn, State: 'AL', 'Fiscal Year': '2016', Domain_1_Score: '1.0000', Domain_1_Score_Footnote: '', Domain_1_Start_Date: '07012012',
    Domain_1_End_Date: '06302014', AHRQ_PSI_90_Score: '1.0000', Domain_2_Score: '8.0000', Domain_2_Score_Footnote: '', CLABSI_Score: '10', CAUTI_Score: '10', SSI_Score: '4',
    Domain_2_Start_Date: '01012013', Domain_2_End_Date: '12312014', TOTAL_HAC_SCORE: '6.2500', Total_HAC_Score_Footnote: '', ...over,
  });
  const flags = cutListFlags(['CMS Certification Number (CCN)\tState\tTop 25th Percentile\tTotal HAC Score*', '990001\tAL\tN\t6.2500', '990009\tGA\tY\t9.0000', '990008\tMD\tN/A\t', '990003\tAL\tY\t7.0000'].join('\n'));
  const y = historyYear(2016, [row('990001'), row('990002', { Domain_2_Score_Footnote: '7' }), row('990003', { TOTAL_HAC_SCORE: '7.0000' })], flags);
  assert.deepEqual([y.rule, y.scale, y.domains, y.decisions], ['domains', 'tenths', true, 'cut-list']);
  assert.deepEqual(y.measures, ['PSI90', 'CLABSI', 'CAUTI', 'SSI']);
  assert.deepEqual(y.periods, { psi90: { start: '07/01/2012', end: '06/30/2014' }, hai: { start: '01/01/2013', end: '12/31/2014' } });
  assert.deepEqual(y.footnoted, ['990002']);
  assert.deepEqual(y.hospitals, [
    // CCN, state, total, decision, PSI 90, CLABSI, CAUTI, SSI (tenths), then Domain 1 and Domain 2.
    ['990001', 'AL', '6.2500', 'No', '1.0000', '10', '10', '4', '1.0000', '8.0000'],
    // In the file, not on the list: no decision.
    ['990002', 'AL', '6.2500', '', '1.0000', '10', '10', '4', '1.0000', '8.0000'],
    ['990003', 'AL', '7.0000', 'Yes', '1.0000', '10', '10', '4', '1.0000', '8.0000'],
    // On the list, not in the file: the list's state, total and decision, no parts; CCN order.
    ['990008', 'MD', '', 'N/A', '', '', '', '', '', ''],
    ['990009', 'GA', '9.0000', 'Yes', '', '', '', '', '', ''],
  ]);
});

test('historyYear: a year whose file has a payment column takes its decisions from the file, not from a cut list', () => {
  const flags = new Map([['990001', { flag: 'Yes', total: '1', state: 'AL' }], ['990099', { flag: 'Yes', total: '1', state: 'AL' }]]);
  const y = historyYear(2024, [zRow('990001')], flags);
  assert.equal(y.decisions, 'file');
  assert.equal(y.hospitals[0][3], 'No', 'the file\'s own decision stands');
});

test('historyYear: periods come out null when the file gives none, and when only one end of one is there', () => {
  const none = historyYear(2024, [zRow('990001', { 'PSI 90 Start Date': 'N/A', 'PSI 90 End Date': 'N/A' }), zRow('990002', { 'PSI 90 Start Date': '', 'PSI 90 End Date': 'N/A' })]);
  assert.equal(none.periods.psi90, null);
  assert.deepEqual(none.periods.hai, { start: '01/01/2022', end: '12/31/2023' });
  const half = historyYear(2024, [zRow('990001', { 'HAI Measures End Date': 'N/A' })]);
  assert.equal(half.periods.hai, null);
  // A row with N/A beside rows with dates does not make the year's period differ.
  const mixed = historyYear(2024, [zRow('990001'), zRow('990002', { 'PSI 90 Start Date': 'N/A', 'PSI 90 End Date': 'N/A' })]);
  assert.deepEqual(mixed.periods.psi90, { start: '07/01/2021', end: '06/30/2023' });
});

test('historyYear fails on a file that is not what the year says: no rows, the wrong fiscal year, a bad or repeated CCN, periods that differ, no decisions', () => {
  assert.throws(() => historyYear(2024, []), /FY2024: no rows/);
  assert.throws(() => historyYear(2024, [zRow('990001', { 'Fiscal Year': '2023' })]), /FY2024: the file's fiscal year is 2023/);
  assert.throws(() => historyYear(2024, [zRow('990001'), zRow('990002', { 'Fiscal Year': '2025' })]), /fiscal year is 2024, 2025/);
  assert.throws(() => historyYear(2024, [zRow('99001')]), /CCN "99001" is not six digits or capital letters/);
  assert.throws(() => historyYear(2024, [zRow('99000a')]), /CCN "99000a" is not six digits or capital letters/);
  assert.throws(() => historyYear(2024, [zRow('990001'), zRow('990002'), zRow('990001')]), /CCN 990001 appears twice/);
  assert.throws(() => historyYear(2024, [zRow('990001'), zRow('990002', { 'PSI 90 End Date': '06/30/2024' })]), /PSI_90_END_DATE differs between rows \(06\/30\/2023, 06\/30\/2024\)/);
  assert.throws(() => historyYear(2024, [zRow('990001', { 'HAI Measures Start Date': '2022-01-01' })]), /not a date in a form CMS uses/);
  const noPayment = zRow('990001');
  delete noPayment['Payment Reduction'];
  delete noPayment['Payment Reduction Footnote'];
  assert.throws(() => historyYear(2024, [noPayment]), /no payment column and no cut list/);
  assert.throws(() => historyYear(2014, [zRow('990001', { 'Fiscal Year': '2014' })]), /no scoring rule for FY2014/);
  // A file without the columns every year has.
  assert.throws(() => historyYear(2024, [{ State: 'AL', 'Total HAC Score': '1' }]), /no CCN column/);
});

test('historyYear lets a CCN with a capital letter through (some CCNs have one) and a file without a Fiscal Year column through', () => {
  const row = zRow('99T001');
  delete row['Fiscal Year'];
  const y = historyYear(2024, [row]);
  assert.equal(y.hospitals[0][0], '99T001');
});

// ---------- the nation's infections ----------

// One extract row: a CCN, the calendar year's dates, and each measure's SIR, observed and predicted as CMS wrote them.
const haiRow = (ccn, cy, per = {}) => {
  const r = { ccn, start: `${cy}-01-01`, end: `${cy}-12-31` };
  for (let k = 1; k <= 6; k++) Object.assign(r, { [`hai_${k}_sir`]: 'Not Available', [`hai_${k}_observed`]: 'Not Available', [`hai_${k}_predicted`]: 'Not Available' }, per[k] ?? {});
  return r;
};

test('infectionYear: per measure, the hospitals with an SIR and their median, and over those with both counts the sums of observed and predicted', () => {
  const rows = [
    haiRow('990001', 2022, { 1: { hai_1_sir: '1.000', hai_1_observed: '10', hai_1_predicted: '10.000' } }),
    haiRow('990002', 2022, { 1: { hai_1_sir: '0.500', hai_1_observed: '2', hai_1_predicted: '4.000' } }),
    haiRow('990003', 2022, { 1: { hai_1_sir: '2.000', hai_1_observed: '6', hai_1_predicted: '3.000' } }),
    // An SIR with no counts, and counts with no SIR (CMS's SIR is blank when predicted is under one).
    haiRow('990004', 2022, { 1: { hai_1_sir: '0.100' } }),
    haiRow('990005', 2022, { 1: { hai_1_observed: '1', hai_1_predicted: '0.200' } }),
    haiRow('990006', 2022, { 2: { hai_2_sir: '1.5', hai_2_observed: '3', hai_2_predicted: '2.1' } }),
  ];
  const y = infectionYear(2022, rows);
  assert.equal(y.cy, 2022);
  assert.deepEqual(Object.keys(y.measures), HAI_MEASURES.map(([id]) => id));
  // Four hospitals have an SIR (0.1, 0.5, 1, 2): the median is the mean of the middle two, 0.75. Four have both counts.
  assert.deepEqual(y.measures.CLABSI, { hospitals: 4, median: 0.75, counted: 4, observed: 10 + 2 + 6 + 1, predicted: 17.2 });
  assert.deepEqual(y.measures.CAUTI, { hospitals: 1, median: 1.5, counted: 1, observed: 3, predicted: 2.1 });
  assert.deepEqual(y.measures.MRSA, { hospitals: 0, median: null, counted: 0, observed: 0, predicted: 0 });
});

test('infectionYear: an odd count has the middle SIR for its median; the predicted sum is rounded to a thousandth, never float noise', () => {
  const rows = [3, 1, 2].map((s, i) => haiRow(`99000${i + 1}`, 2019, { 3: { hai_3_sir: String(s), hai_3_observed: '1', hai_3_predicted: '0.1' } }));
  const y = infectionYear(2019, rows);
  assert.equal(y.measures.SSI_COLON.median, 2);
  assert.equal(y.measures.SSI_COLON.predicted, 0.3, '0.1 + 0.1 + 0.1 is 0.30000000000000004');
  // Text that is neither a number nor Not Available stops the build (the extract holds only those; hai_extract.py).
  assert.throws(() => infectionYear(2019, [haiRow('990001', 2019, { 4: { hai_4_sir: '1.0', hai_4_observed: '1e3', hai_4_predicted: '2' } })]), /"hai_4_observed" is not a number: "1e3"/);
});

test('infectionYear: the extract must be exactly the calendar year asked for', () => {
  assert.throws(() => infectionYear(2022, [haiRow('990001', 2021)]), /HAI CY2022: the extract's period is 2021-01-01 2021-12-31/);
  assert.throws(() => infectionYear(2022, [haiRow('990001', 2022), { ...haiRow('990002', 2022), end: '2022-06-30' }]), /extract's period is 2022-01-01 2022-12-31, 2022-01-01 2022-06-30/);
  assert.throws(() => infectionYear(2022, []), /extract's period is/);
  assert.equal(infectionYear(2022, [haiRow('990001', 2022)]).cy, 2022);
});

// ---------- the build ----------

// A manifest with an entry for each id a synthetic build names.
const manifestOf = (ids) => ids.map((id, i) => ({ id, sha256: String(i).repeat(64).slice(0, 64) }));

test('buildHistory: the years oldest first, the sources in order (each cut list after its file), the newest year as fy, and the infections by calendar year', () => {
  const newer = { fy: 2024, id: 'file-2024', rows: [zRow('990001')] };
  const older = { fy: 2023, id: 'file-2023', rows: [zRow('990001', { 'Fiscal Year': '2023' })] };
  const infections = [{ cy: 2022, id: 'hai-b', rows: [haiRow('990001', 2022)] }, { cy: 2021, id: 'hai-a', rows: [haiRow('990001', 2021)] }];
  const manifest = manifestOf(['file-2023', 'file-2024', 'hai-a', 'hai-b']);
  const out = buildHistory({ files: [newer, older], infections, manifest, builtAt: '2099-01-01T00:00:00Z' });
  assert.equal(out.schema_version, HISTORY_SCHEMA_VERSION);
  assert.equal(out.methods_version, HISTORY_METHODS_VERSION);
  assert.equal(out.fy, 2024);
  assert.equal(out.built_at, '2099-01-01T00:00:00Z');
  assert.deepEqual(out.sources, ['file-2023', 'file-2024', 'hai-a', 'hai-b']);
  assert.deepEqual(out.years.map((y) => y.fy), [2023, 2024]);
  assert.deepEqual(out.infections.map((y) => y.cy), [2021, 2022]);
  assert.match(out.source_manifest, /^[0-9a-f]{64}$/);
  // Inputs are not reordered.
  assert.deepEqual([newer.fy, older.fy], [2024, 2023]);
  // A cut list's id follows its year's file; infections are optional.
  const withList = buildHistory({
    files: [{ fy: 2016, id: 'f16', cutList: 'f16-list', rows: [{ ...zRow('990001', { 'Fiscal Year': '2016' }) }], flags: new Map() }, newer],
    manifest: manifestOf(['f16', 'f16-list', 'file-2024']), builtAt: '2099-01-01T00:00:00Z',
  });
  assert.deepEqual(withList.sources, ['f16', 'f16-list', 'file-2024']);
  assert.deepEqual(withList.infections, []);
  assert.equal(withList.years[0].decisions, 'file', 'the year\'s own column wins over its list');
});

test('buildHistory: a source with no manifest entry, a year that is wrong or an infection extract for another year stops the build', () => {
  const file = { fy: 2024, id: 'file-2024', rows: [zRow('990001')] };
  assert.throws(() => buildHistory({ files: [file], manifest: [], builtAt: 'x' }), /no manifest entry "file-2024"/);
  assert.throws(() => buildHistory({ files: [{ ...file, fy: 2025 }], manifest: manifestOf(['file-2024']), builtAt: 'x' }), /FY2025: the file's fiscal year is 2024/);
  assert.throws(() => buildHistory({ files: [file], infections: [{ cy: 2022, id: 'hai', rows: [haiRow('990001', 2021)] }], manifest: manifestOf(['file-2024', 'hai']), builtAt: 'x' }), /HAI CY2022/);
});

test('buildHistory output passes the schema; the schema refuses an unknown rule, a bad date and a short hospital row', () => {
  const schemas = loadSchemas();
  const schema = schemas['hacrp-history.schema.json'];
  const out = buildHistory({ files: [{ fy: 2024, id: 'file-2024', rows: [zRow('990001'), zRow('990002')] }], infections: [{ cy: 2022, id: 'hai', rows: [haiRow('990001', 2022)] }], manifest: manifestOf(['file-2024', 'hai']), builtAt: '2099-01-01T00:00:00Z' });
  const copy = () => JSON.parse(JSON.stringify(out));
  assert.deepEqual(validate(schema, copy(), { schemas }), []);
  const bad = (mutate) => { const c = copy(); mutate(c); return validate(schema, c, { schemas }); };
  assert.notEqual(bad((c) => { c.years[0].rule = 'weights'; }).length, 0);
  assert.notEqual(bad((c) => { c.years[0].periods.psi90.start = '2021-07-01'; }).length, 0);
  assert.notEqual(bad((c) => { c.years[0].hospitals[0] = ['990001', 'AL']; }).length, 0);
  assert.notEqual(bad((c) => { c.years[0].measures.push('ZZZ'); }).length, 0);
  assert.notEqual(bad((c) => { delete c.years[0].footnoted; }).length, 0);
  assert.notEqual(bad((c) => { c.extra = 1; }).length, 0);
});

// ---------- the pins ----------

test('the pins: one hospital file for each program year FY2015 to the newest, the cut lists for the two years without a payment column, and the infection extracts', () => {
  assert.deepEqual(HISTORY_PINS.map((p) => p.fy), Array.from({ length: 12 }, (_, i) => 2015 + i));
  assert.deepEqual(HISTORY_PINS.filter((p) => p.cutList).map((p) => p.fy), [2015, 2016]);
  const manifest = readManifest();
  const ids = [...HISTORY_PINS.flatMap((p) => (p.cutList ? [p.id, p.cutList] : [p.id])), ...HAI_PINS.map((p) => p.id)];
  for (const id of ids) assert.ok(manifest.some((e) => e.id === id), `${id} is pinned`);
  assert.equal(new Set(ids).size, ids.length, 'no pin is used twice');
  // The newest year is the file the program page is built from.
  assert.equal(HISTORY_PINS[HISTORY_PINS.length - 1].id, 'yq43-i98g');
  assert.deepEqual(HAI_PINS.map((p) => p.cy), [2017, 2018, 2019, 2021, 2022, 2023, 2024], 'CMS excused the first half of 2020: no full-year file');
  assert.equal(historyPath(2026), 'data/emitted/hacrp-history/fy2026/hacrp_history.json');
});

test('historyFilesFrom and infectionFilesFrom read each pin once, a cut list as Windows text (latin1) and a hospital file as UTF-8', () => {
  const reads = [];
  const readPinned = (id, encoding = 'utf8') => {
    reads.push([id, encoding]);
    return /cut-list$/.test(id) ? LIST_2015 : `text of ${id}`;
  };
  const files = historyFilesFrom(readPinned, (text) => [{ text }]);
  assert.equal(files.length, HISTORY_PINS.length);
  assert.deepEqual(files[0].rows, [{ text: 'text of hacrp-fy2015' }]);
  assert.deepEqual([files[0].fy, files[0].id, files[0].cutList], [2015, 'hacrp-fy2015', 'hacrp-fy2015-cut-list']);
  assert.equal(files[0].flags.get('990002').flag, 'Yes');
  assert.ok(!('cutList' in files[2]) && !('flags' in files[2]), 'FY2017 has no cut list');
  assert.deepEqual(reads.filter(([id]) => id.endsWith('cut-list')), [['hacrp-fy2015-cut-list', 'latin1'], ['hacrp-fy2016-cut-list', 'latin1']]);
  assert.ok(reads.filter(([id]) => !id.endsWith('cut-list')).every(([, enc]) => enc === 'utf8'));
  const inf = infectionFilesFrom(readPinned, (text) => [{ text }]);
  assert.deepEqual(inf.map((f) => [f.cy, f.id]), HAI_PINS.map((p) => [p.cy, p.id]));
});

// ---------- the committed file ----------

// (A fresh build from the pins equals the committed file: golden.test.js.)
test('the committed history agrees with the current year\'s emitted file: FY2026\'s rows are the same hospitals with the same scores and decisions', () => {
  const history = readJson(REPO_ROOT + historyPath(2026));
  const current = readJson(REPO_ROOT + 'data/emitted/hacrp/fy2026/hacrp.json');
  const year = history.years.find((y) => y.fy === 2026);
  assert.equal(year.hospitals.length, current.hospitals.length);
  const byCcn = new Map(year.hospitals.map((h) => [h[0], h]));
  for (const h of current.hospitals) {
    const row = byCcn.get(h.ccn);
    assert.ok(row, `${h.ccn} is in the history`);
    assert.equal(row[2], h.totalText, `${h.ccn}: Total HAC Score as CMS wrote it`);
    assert.equal(row[3], h.paymentReduction, `${h.ccn}: decision`);
  }
});
