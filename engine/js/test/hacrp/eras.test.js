// CMS's HACRP files across the years (engine/js/hacrp/eras.js): column names in one normal form, the shape of each
// year's file, a row as a record, CMS's asterisk marks, and the Total HAC Score recomputed by each year's rule. All
// rows are synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { EQUAL_FROM, PREFIX, RULES, TENTHS, Z_FROM, domainsOf, fileShape, normalName, normalRow, noted as notedRow, numberOf, partColumn, partNotes as partNotesRow, recomputeTotal, ruleFor, toRecord as toRecordRow } from '../../hacrp/eras.js';

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
// The row readers take a row in its normal form (normalRow), read once by the caller.
const noted = (row) => notedRow(normalRow(row));
const toRecord = (row, shape) => toRecordRow(normalRow(row), shape);
const partNotes = (row, shape) => partNotesRow(normalRow(row), shape);

// The header of a z-score year (FY2018 on, in the words of FY2021's file) and of a tenths year (FY2016's).
const Z_HEADER = [
  'Facility Name', 'Facility ID', 'State', 'Fiscal Year', 'PSI 90 W Z Score', 'PSI 90 Start Date', 'PSI 90 End Date', 'CLABSI W Z Score', 'CAUTI W Z Score',
  'SSI W Z Score', 'CDI W Z Score', 'MRSA W Z Score', 'HAI Measures Start Date', 'HAI Measures End Date', 'Total HAC Score', 'Payment Reduction',
];
const TENTHS_HEADER = [
  'Hospital_Name', 'PROVIDER ID', 'State', 'Fiscal Year', 'Domain_1_Score', 'Domain_1_Start_Date', 'Domain_1_End_Date', 'AHRQ_PSI_90_Score', 'Domain_2_Score',
  'CLABSI_Score', 'CAUTI_Score', 'SSI_Score', 'Domain_2_Start_Date', 'Domain_2_End_Date', 'TOTAL_HAC_SCORE',
];

test('normalName: upper case, every run of other characters one underscore, none at the ends', () => {
  assert.equal(normalName('PSI 90 W Z Score'), 'PSI_90_W_Z_SCORE');
  assert.equal(normalName('PSI_90_W_Z_SCORE'), 'PSI_90_W_Z_SCORE');
  assert.equal(normalName('Provider ID'), 'PROVIDER_ID');
  assert.equal(normalName('Total HAC Score*'), 'TOTAL_HAC_SCORE');
  assert.equal(normalName('  Domain 1 -- Score (tenths) '), 'DOMAIN_1_SCORE_TENTHS');
  assert.equal(normalName('Payment_Reduction_Footnote'), 'PAYMENT_REDUCTION_FOOTNOTE');
});

test('the measures: one prefix for the z-score column and one for the tenths column, for each of the engine\'s measures', () => {
  assert.deepEqual(Object.keys(PREFIX), [...MEASURE_IDS]);
  assert.deepEqual(Object.keys(TENTHS), [...MEASURE_IDS]);
  assert.equal(partColumn({ scale: 'z' }, 'PSI90'), 'PSI_90_W_Z_SCORE');
  assert.equal(partColumn({ scale: 'z' }, 'MRSA'), 'MRSA_W_Z_SCORE');
  assert.equal(partColumn({ scale: 'tenths' }, 'PSI90'), 'AHRQ_PSI_90_SCORE');
  assert.equal(partColumn({ scale: 'tenths' }, 'CDI'), 'CDI_SCORE');
  // Every normal name a z-year header gives is the measure's z-score column.
  for (const id of MEASURE_IDS) assert.ok(Z_HEADER.map(normalName).includes(partColumn({ scale: 'z' }, id)), id);
});

test('numberOf: CMS\'s decimal text, its trailing asterisks dropped, no value for blank, N/A or Not Available; anything else throws', () => {
  assert.equal(numberOf('5.5000', 'x'), 5.5);
  assert.equal(numberOf('-0.2500', 'x'), -0.25);
  assert.equal(numberOf('7', 'x'), 7);
  assert.equal(numberOf('5.5000*', 'x'), 5.5);
  assert.equal(numberOf('5.5000**', 'x'), 5.5);
  for (const none of ['', 'N/A', 'Not Available', 'N/A*', '*', undefined, null]) assert.equal(numberOf(none, 'x'), null, String(none));
  for (const bad of ['abc', '1,000', '+1.5', '.5', '1.', '1.5.2', '5*5', ' 3', '--1']) {
    assert.throws(() => numberOf(bad, 'THE_COLUMN'), (e) => e instanceof RangeError && e.message.includes('THE_COLUMN') && e.message.includes(`"${bad}"`), bad);
  }
});

test('fileShape: a z-score year\'s columns, whatever the case and spelling of its header', () => {
  const shape = fileShape(Z_HEADER);
  assert.equal(shape.ccn, 'FACILITY_ID');
  assert.equal(shape.scale, 'z');
  assert.deepEqual(shape.z, [...MEASURE_IDS], 'all six measures, in the engine\'s order');
  assert.equal(shape.domains, false);
  assert.equal(shape.decision, 'PAYMENT_REDUCTION');
  assert.deepEqual(shape.psi, ['PSI_90_START_DATE', 'PSI_90_END_DATE']);
  assert.deepEqual(shape.hai, ['HAI_MEASURES_START_DATE', 'HAI_MEASURES_END_DATE']);
  assert.equal(shape.fy, 'FISCAL_YEAR');
  // The same header in FY2018's words (upper case, underscores) is the same shape except for its date columns.
  const old = fileShape(['PROVIDER_ID', 'STATE', 'TOTAL_HAC_SCORE', 'PSI_90_W_Z_SCORE', 'CLABSI_W_Z_SCORE', 'DOMAIN_1_SCORE', 'DOMAIN_2_SCORE', 'DOMAIN_1_START_DATE', 'DOMAIN_1_END_DATE', 'DOMAIN_2_START_DATE', 'DOMAIN_2_END_DATE']);
  assert.deepEqual([old.ccn, old.scale, old.z, old.domains, old.decision, old.fy], ['PROVIDER_ID', 'z', ['PSI90', 'CLABSI'], true, null, null]);
  assert.deepEqual([old.psi, old.hai], [['DOMAIN_1_START_DATE', 'DOMAIN_1_END_DATE'], ['DOMAIN_2_START_DATE', 'DOMAIN_2_END_DATE']]);
});

test('fileShape: a year with no z-score columns carries its measure scores in tenths, with domain scores', () => {
  const shape = fileShape(TENTHS_HEADER);
  assert.equal(shape.ccn, 'PROVIDER_ID');
  assert.equal(shape.scale, 'tenths');
  assert.deepEqual(shape.z, ['PSI90', 'CLABSI', 'CAUTI', 'SSI'], 'the measures that file has');
  assert.equal(shape.domains, true);
  assert.equal(shape.decision, null, 'no payment column: the cut list decides');
  assert.deepEqual([shape.psi, shape.hai], [['DOMAIN_1_START_DATE', 'DOMAIN_1_END_DATE'], ['DOMAIN_2_START_DATE', 'DOMAIN_2_END_DATE']]);
  // One domain score alone is no domains.
  assert.equal(fileShape(['Provider ID', 'State', 'Total HAC Score', 'Domain 1 Score']).domains, false);
});

test('fileShape: the CCN column is Facility ID, else Provider ID, else Provider Number; a header without a CCN, state or total throws', () => {
  const base = ['State', 'Total HAC Score'];
  assert.equal(fileShape(['Provider Number', ...base]).ccn, 'PROVIDER_NUMBER');
  assert.equal(fileShape(['Provider ID', 'Provider Number', ...base]).ccn, 'PROVIDER_ID');
  assert.equal(fileShape(['Provider ID', 'Facility ID', ...base]).ccn, 'FACILITY_ID');
  assert.throws(() => fileShape(base), /no CCN column/);
  assert.throws(() => fileShape(['Facility ID', 'Total HAC Score']), /no STATE column/);
  assert.throws(() => fileShape(['Facility ID', 'State']), /no TOTAL_HAC_SCORE column/);
  assert.deepEqual(fileShape(['Facility ID', 'State', 'Total HAC Score']).z, [], 'a header with no part columns has no parts');
});

test('noted: a footnote on the total, a domain or a measure part, or an asterisk on a score; never the payment decision\'s own footnote', () => {
  const clean = { 'Facility ID': '990001', 'Total HAC Score': '1.0000', 'Total HAC Footnote': '', 'PSI 90 W Z Score': '0.5', 'PSI 90 W Z Footnote': '', 'Payment Reduction': 'No', 'Payment Reduction Footnote': '' };
  assert.equal(noted(clean), false);
  assert.equal(noted({ ...clean, 'Total HAC Footnote': '5' }), true);
  assert.equal(noted({ ...clean, 'PSI 90 W Z Footnote': '5' }), true);
  assert.equal(noted({ ...clean, 'PSI 90 W Z Footnote': '   ' }), false, 'blank is not a footnote');
  assert.equal(noted({ ...clean, 'Payment Reduction Footnote': 'a' }), false, 'Maryland-style payment footnote is about the decision');
  assert.equal(noted({ ...clean, Payment_Reduction_Footnote: 'a' }), false);
  assert.equal(noted({ ...clean, 'PSI 90 W Z Score': '0.5*' }), true, 'FY2015 marks scores with asterisks');
  assert.equal(noted({ ...clean, 'Total HAC Score': '3.5**' }), true);
  assert.equal(noted({ ...clean, 'Facility Name': 'EXAMPLE*' }), false, 'only scores carry marks');
  assert.equal(noted({ ...clean, Domain_1_Score_Footnote: '7' }), true, 'the older underscore spelling');
  assert.equal(noted({ ...clean, 'Payment Reduction': 'Yes*' }), false, 'the decision is not a score');
});

test('normalRow: each column by its normal name, its text trimmed', () => {
  assert.deepEqual(normalRow({ 'Facility ID': ' 990001 ', 'PSI 90 W Z Score': '0.5', Extra: 3 }), { FACILITY_ID: '990001', PSI_90_W_Z_SCORE: '0.5', EXTRA: 3 });
});

test('partNotes: the parts whose own footnote column CMS filled, or whose score carries its asterisks; never the total\'s or the decision\'s', () => {
  const z = fileShape([...Z_HEADER, 'PSI 90 W Z Footnote', 'CLABSI Footnote', 'Total HAC Footnote', 'Payment Reduction Footnote']);
  const row = { 'Facility ID': '990001', 'PSI 90 W Z Score': 'N/A', 'PSI 90 W Z Footnote': '', 'CLABSI W Z Score': '0.5', 'CLABSI Footnote': '', 'Total HAC Footnote': '5', 'Payment Reduction Footnote': 'a' };
  assert.deepEqual([...partNotes(row, z)], [], 'a footnote on the total or the decision is no part\'s');
  assert.deepEqual([...partNotes({ ...row, 'PSI 90 W Z Footnote': '5' }, z)], ['PSI90'], 'FY2023 on: the z-score\'s own footnote');
  assert.deepEqual([...partNotes({ ...row, 'CLABSI Footnote': '13' }, z)], ['CLABSI'], 'earlier z years: the plain footnote');
  assert.deepEqual([...partNotes({ ...row, 'PSI 90 W Z Footnote': '  ' }, z)], [], 'blank is not a footnote');
  // A tenths year: the measure's footnote in either spelling, the domains' own, and FY2015's asterisks on a score.
  const tenths = fileShape([...TENTHS_HEADER, 'AHRQ_PSI_90_Score_Footnote', 'Domain_1_Score_Footnote', 'Domain_2_Score_Footnote', 'MRSA_Footnote']);
  const t = { 'PROVIDER ID': '990002', AHRQ_PSI_90_Score: 'N/A', Domain_1_Score: 'N/A', AHRQ_PSI_90_Score_Footnote: '4', Domain_1_Score_Footnote: '4', CLABSI_Score: '9*' };
  assert.deepEqual([...partNotes(t, tenths)].sort(), ['CLABSI', 'D1', 'PSI90']);
  assert.deepEqual([...partNotes({ 'PROVIDER ID': '990003', Domain_2_Score: '8.0000*' }, tenths)], ['D2']);
  assert.deepEqual([...partNotes({ 'PROVIDER ID': '990004', MRSA_Footnote: '5' }, fileShape([...TENTHS_HEADER, 'MRSA_Score', 'MRSA_Footnote']))], ['MRSA']);
});

test('toRecord on a z-score row: CCN, state, the total as number and as CMS wrote it, the decision, one z per measure; blanks are null', () => {
  const shape = fileShape(Z_HEADER);
  const row = {
    'Facility ID': '990001', State: 'AL', 'Total HAC Score': ' 0.2182 ', 'Payment Reduction': 'No', 'PSI 90 W Z Score': '-1.2795', 'CLABSI W Z Score': '1.6280',
    'CAUTI W Z Score': 'N/A', 'SSI W Z Score': '', 'CDI W Z Score': '0.0000', 'MRSA W Z Score': 'Not Available',
  };
  assert.deepEqual(toRecord(row, shape), {
    ccn: '990001', state: 'AL', total: 0.2182, totalText: '0.2182', decision: 'No',
    z: { PSI90: -1.2795, CLABSI: 1.628, CAUTI: null, SSI: null, CDI: 0, MRSA: null }, d1: null, d2: null,
  });
  // No total: null as a number, empty as text.
  const none = toRecord({ ...row, 'Total HAC Score': 'N/A' }, shape);
  assert.deepEqual([none.total, none.totalText], [null, 'N/A']);
  assert.equal(toRecord({ 'Facility ID': '990002', State: 'MD', 'Payment Reduction': 'N/A' }, shape).totalText, '', 'a row without a total reads empty');
});

test('toRecord: the decision is Yes, No or N/A (FY2019\'s "Not Available" is N/A); anything else throws; no payment column, no decision', () => {
  const shape = fileShape(Z_HEADER);
  const row = { 'Facility ID': '990001', State: 'AL', 'Total HAC Score': '1' };
  for (const d of ['Yes', 'No', 'N/A']) assert.equal(toRecord({ ...row, 'Payment Reduction': d }, shape).decision, d);
  assert.equal(toRecord({ ...row, 'Payment Reduction': 'Not Available' }, shape).decision, 'N/A');
  assert.throws(() => toRecord({ ...row, 'Payment Reduction': 'Maybe' }, shape), /unexpected payment reduction "Maybe"/);
  assert.throws(() => toRecord({ ...row, 'Payment Reduction': '' }, shape), /unexpected payment reduction ""/);
  assert.equal(toRecord(row, fileShape(TENTHS_HEADER)).decision, null);
});

test('toRecord on a tenths row: the measure scores in tenths, the two domain scores, and the asterisks dropped from the numbers', () => {
  const shape = fileShape(TENTHS_HEADER);
  const row = {
    'PROVIDER ID': '990003', State: 'GA', TOTAL_HAC_SCORE: '5.5000*', AHRQ_PSI_90_Score: '1', Domain_1_Score: '1.0000', Domain_2_Score: '8.0000*',
    CLABSI_Score: '9', CAUTI_Score: 'N/A', SSI_Score: '', Hospital_Name: 'ignored',
  };
  const rec = toRecord(row, shape);
  assert.equal(rec.ccn, '990003');
  assert.deepEqual(rec.z, { PSI90: 1, CLABSI: 9, CAUTI: null, SSI: null });
  assert.deepEqual([rec.total, rec.totalText, rec.d1, rec.d2], [5.5, '5.5000*', 1, 8]);
  assert.throws(() => toRecord({ ...row, Domain_1_Score: 'x' }, shape), /DOMAIN_1_SCORE/);
});

test('the era years: equal weights from the first equal rule, z-scores from FY2018', () => {
  assert.equal(EQUAL_FROM, ruleFor(EQUAL_FROM).from);
  assert.equal(ruleFor(EQUAL_FROM).rule, 'equal');
  assert.equal(ruleFor(EQUAL_FROM - 1).rule, 'domains');
  assert.ok(Z_FROM < EQUAL_FROM);
});

test('domainsOf: Domain 1 is PSI 90\'s part and Domain 2 the infections\' average; the published domains only for a row with no parts', () => {
  assert.deepEqual(domainsOf({ z: { PSI90: 4, CLABSI: 1, CAUTI: 3 }, d1: 9, d2: 9 }), [4, 2]);
  assert.deepEqual(domainsOf({ z: { PSI90: null, CLABSI: 1, CAUTI: null }, d1: 9, d2: 9 }), [null, 1]);
  assert.deepEqual(domainsOf({ z: { PSI90: null, CLABSI: null }, d1: 2, d2: 4 }), [2, 4]);
  assert.deepEqual(domainsOf({ z: {} }), [null, null]);
});

test('ruleFor: the rule in force each fiscal year; equal weights from FY2020, and before FY2015 there is none', () => {
  assert.deepEqual(RULES.map((r) => r.from), [2020, 2017, 2016, 2015], 'newest first, the order ruleFor reads');
  for (const fy of [2020, 2021, 2023, 2026, 2031]) assert.equal(ruleFor(fy).rule, 'equal', `FY${fy}`);
  for (const fy of [2017, 2018, 2019]) assert.deepEqual([ruleFor(fy).rule, ruleFor(fy).weights], ['domains', [0.15, 0.85]], `FY${fy}`);
  assert.deepEqual(ruleFor(2016).weights, [0.25, 0.75]);
  assert.deepEqual(ruleFor(2015).weights, [0.35, 0.65]);
  for (const r of RULES.filter((x) => x.rule === 'domains')) close(r.weights[0] + r.weights[1], 1);
  assert.throws(() => ruleFor(2014), (e) => e instanceof RangeError && /no scoring rule for FY2014/.test(e.message));
});

test('recomputeTotal, equal weights: the mean of the measures that have a score; none, no total', () => {
  const rule = ruleFor(2024);
  assert.equal(recomputeTotal({ z: { PSI90: 1, CLABSI: 0, CAUTI: -1, SSI: 2 } }, rule), 0.5);
  assert.equal(recomputeTotal({ z: { PSI90: null, CLABSI: 0.3, CAUTI: null } }, rule), 0.3);
  assert.equal(recomputeTotal({ z: { PSI90: null, CLABSI: null } }, rule), null);
  assert.equal(recomputeTotal({ z: {} }, rule), null);
  // The domain scores are not looked at by this rule.
  assert.equal(recomputeTotal({ z: { PSI90: 2 }, d1: 9, d2: 9 }, rule), 2);
});

test('recomputeTotal, domains: Domain 1 is PSI 90, Domain 2 the mean of the infections, weighted by the year (15/85, 25/75, 35/65)', () => {
  const rec = { z: { PSI90: 4, CLABSI: 1, CAUTI: 3, SSI: null, CDI: undefined }, d1: null, d2: null };
  // Domain 2 is (1 + 3) / 2 = 2.
  close(recomputeTotal(rec, ruleFor(2018)), 0.15 * 4 + 0.85 * 2);
  close(recomputeTotal(rec, ruleFor(2017)), 0.15 * 4 + 0.85 * 2);
  close(recomputeTotal(rec, ruleFor(2016)), 0.25 * 4 + 0.75 * 2);
  close(recomputeTotal(rec, ruleFor(2015)), 0.35 * 4 + 0.65 * 2);
  // The weights differ, so the totals do.
  assert.notEqual(recomputeTotal(rec, ruleFor(2016)), recomputeTotal(rec, ruleFor(2015)));
  // A hospital with one domain takes it whole, at any weight.
  assert.equal(recomputeTotal({ z: { PSI90: 4, CLABSI: null } }, ruleFor(2016)), 4);
  assert.equal(recomputeTotal({ z: { PSI90: null, CLABSI: 1, CAUTI: 3 } }, ruleFor(2016)), 2);
  assert.equal(recomputeTotal({ z: { PSI90: -1.5 } }, ruleFor(2018)), -1.5);
});

test('recomputeTotal, domains: CMS\'s published domain scores stand in only for a hospital with no parts; with neither, no total', () => {
  const rule = ruleFor(2017);
  close(recomputeTotal({ z: { PSI90: null, CLABSI: null }, d1: 2, d2: 4 }, rule), 0.15 * 2 + 0.85 * 4);
  assert.equal(recomputeTotal({ z: {}, d1: 2, d2: null }, rule), 2);
  assert.equal(recomputeTotal({ z: {}, d1: null, d2: 4 }, rule), 4);
  assert.equal(recomputeTotal({ z: {}, d1: null, d2: null }, rule), null);
  // With parts, the published domain scores are ignored.
  close(recomputeTotal({ z: { PSI90: 4, CLABSI: 2 }, d1: 100, d2: 100 }, rule), 0.15 * 4 + 0.85 * 2);
});
