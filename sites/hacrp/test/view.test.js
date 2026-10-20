import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { SHORT_NAMES } from '../web/constants.js';
import { boundaryText, hospitalView } from '../web/view.js';
import { CASES, FOOTNOTES, MODEL, PERIODS, inputs } from './fixtures.js';

const view = (name, overrides) => hospitalView(inputs(CASES[name], overrides));
const fn = (code) => ({ code, text: FOOTNOTES.get(code) });
const byId = (v, id) => v.measures.find((m) => m.id === id);

test('a scored "Yes" hospital: the whole view', () => {
  assert.deepEqual(view('yes'), {
    ccn: '990001',
    name: 'Example General Hospital',
    city: 'Exampleton',
    state: 'AL',
    county: 'Example County',
    path: '/hacrp/hospital/990001/',
    fy: 2026,
    periods: PERIODS,
    status: 'yes',
    scored: true,
    score: { text: '0.3000', footnotes: [] },
    decision: { text: 'Yes', footnotes: [] },
    distance: { to: 'highestNo', value: 0.05, text: '0.0500' },
    boundaryText: { highestNo: '0.2500', lowestYes: '0.2507' },
    n: 6,
    oneMeasure: false,
    measures: [
      { id: 'PSI90', label: 'Patient safety and adverse events composite', short: 'PSI 90', valueText: '1.0600',
        zText: '0.5000', hasValue: true, hasZ: true, assigned: false, tagged: true, maxErrorText: '0.0021', contribution: 0.5 / 6,
        contributionText: '+0.0833', footnotes: [] },
      { id: 'CLABSI', label: 'Central line–associated bloodstream infections', short: 'CLABSI', valueText: '0.990',
        zText: '0.9000', hasValue: true, hasZ: true, assigned: false, tagged: false, maxErrorText: '0.0007', contribution: 0.9 / 6,
        contributionText: '+0.1500', footnotes: [] },
      { id: 'CAUTI', label: 'Catheter-associated urinary tract infections', short: 'CAUTI', valueText: '0.464',
        zText: '−0.2000', hasValue: true, hasZ: true, assigned: false, tagged: false, maxErrorText: '0.0008', contribution: -0.2 / 6,
        contributionText: '−0.0333', footnotes: [] },
      { id: 'SSI', label: 'Surgical site infections after colon surgery or abdominal hysterectomy', short: 'SSI',
        valueText: '0.909', zText: '0.1000', hasValue: true, hasZ: true, assigned: false, tagged: false, maxErrorText: '0.0001',
        contribution: 0.1 / 6, contributionText: '+0.0167', footnotes: [] },
      { id: 'CDI', label: 'Clostridioides difficile (C. diff) infections', short: 'CDI', valueText: '0.481',
        zText: '0.4000', hasValue: true, hasZ: true, assigned: false, tagged: true, maxErrorText: '0.0021', contribution: 0.4 / 6,
        contributionText: '+0.0667', footnotes: [] },
      { id: 'MRSA', label: 'MRSA bloodstream infections', short: 'MRSA', valueText: '0.745', zText: '0.1000',
        hasValue: true, hasZ: true, assigned: false, tagged: false, maxErrorText: '0.0001', contribution: 0.1 / 6, contributionText: '+0.0167',
        footnotes: [] },
    ],
    largest: { id: 'CLABSI', contributionText: '+0.1500' },
  });
});

test('a scored "No" hospital: distance to the lowest Yes; an unscored measure kept, in order, with its footnotes', () => {
  const v = view('no');
  assert.equal(v.status, 'no');
  assert.equal(v.score.text, '−0.1000');
  assert.deepEqual(v.distance, { to: 'lowestYes', value: 0.3507, text: '0.3507' });
  assert.equal(v.n, 5);
  assert.deepEqual(v.measures.map((m) => m.id), MEASURE_IDS);
  const ssi = byId(v, 'SSI');
  assert.deepEqual([ssi.valueText, ssi.zText, ssi.assigned, ssi.contribution, ssi.contributionText],
    ['N/A', 'N/A', false, null, null]);
  assert.deepEqual(ssi.footnotes, [fn('12'), fn('5')]);
  assert.equal(byId(v, 'CDI').contribution, 0.2 / 5);
  assert.deepEqual(v.largest, { id: 'CDI', contributionText: '+0.0400' });
  assert.equal(v.scored, true);
});

test('hasValue and hasZ come from the parsed numbers: false for N/A, also for a CMS-assigned measure', () => {
  const ssi = byId(view('noScore'), 'SSI');
  assert.deepEqual([ssi.valueText, ssi.hasValue, ssi.zText, ssi.hasZ], ['N/A', false, 'N/A', false]);
  const assigned = byId(view('assignedLargest'), 'SSI');
  assert.equal(assigned.assigned, true);
  assert.deepEqual([assigned.hasValue, assigned.hasZ], [false, true]);
  assert.deepEqual([byId(view('yes'), 'PSI90').hasValue, byId(view('yes'), 'PSI90').hasZ], [true, true]);
});

test('Maryland: CMS\'s N/A decision and footnote a, no distance, what-if on the score', () => {
  const v = view('maryland');
  assert.equal(v.status, 'maryland');
  assert.equal(v.state, 'MD');
  assert.deepEqual(v.decision, { text: 'N/A', footnotes: [fn('a')] });
  assert.equal(v.score.text, '0.4000');
  assert.equal(v.distance, null);
  assert.equal(v.scored, true);
});

test('no score, decision No: not scored (no what-if, never indexed), no distance, CMS\'s score footnote kept', () => {
  const v = view('noScore');
  assert.equal(v.status, 'no-score');
  assert.equal(v.scored, false);
  assert.deepEqual(v.score, { text: 'N/A', footnotes: [fn('5')] });
  assert.deepEqual(v.decision, { text: 'No', footnotes: [] });
  assert.deepEqual([v.distance, v.n, v.oneMeasure, v.largest], [null, 0, false, null]);
  assert.ok(v.measures.every((m) => m.contribution === null && m.footnotes.length === 2));
});

test('the row reading Yes with no score: status yes-no-score, CMS\'s values only', () => {
  const v = view('yesNoScore');
  assert.equal(v.status, 'yes-no-score');
  assert.equal(v.scored, false);
  assert.deepEqual(v.score, { text: 'N/A', footnotes: [fn('5')] });
  assert.deepEqual(v.decision, { text: 'Yes', footnotes: [] });
  assert.deepEqual([v.distance, v.largest], [null, null]);
});

test('a one-measure hospital is flagged oneMeasure; its measure carries the whole score', () => {
  const v = view('oneMeasure');
  assert.equal(v.n, 1);
  assert.equal(v.oneMeasure, true);
  assert.deepEqual(v.largest, { id: 'PSI90', contributionText: '+0.3500' });
});

test('largest skips a CMS-assigned measure even when its z is the biggest', () => {
  const v = view('assignedLargest');
  const ssi = byId(v, 'SSI');
  assert.equal(ssi.assigned, true);
  assert.deepEqual(ssi.footnotes, [fn('18')]);
  assert.equal(ssi.contributionText, '+0.3620');
  assert.deepEqual(v.largest, { id: 'CAUTI', contributionText: '+0.0500' });
});

test('largest is null when every scored measure is CMS-assigned', () => {
  const v = view('allAssigned');
  assert.equal(v.n, 2);
  assert.ok(byId(v, 'CDI').assigned && byId(v, 'MRSA').assigned);
  assert.deepEqual(byId(v, 'CDI').footnotes, [fn('11')]);
  assert.equal(v.largest, null);
});

test('largest is null when no measure adds above zero; a scored hospital\'s total footnote is shown', () => {
  const v = view('totalFootnote');
  assert.deepEqual(v.score, { text: '−0.0500', footnotes: [fn('23')] });
  assert.equal(v.scored, true);
  assert.deepEqual(byId(v, 'PSI90').footnotes, [fn('23')]);
  assert.equal(v.largest, null);
});

test('a tagged measure carries the estimate tag and its maximum error, rounded up', () => {
  const v = view('yes');
  assert.deepEqual([byId(v, 'PSI90').tagged, byId(v, 'PSI90').maxErrorText], [true, '0.0021']);
  assert.deepEqual([byId(v, 'MRSA').tagged, byId(v, 'MRSA').maxErrorText], [false, '0.0001']);
});

test("boundaryText reads CMS's published text for the boundary scores; the view carries it", () => {
  const hospitals = Object.values(CASES);
  const bt = boundaryText(hospitals, { highestNo: -0.05, lowestYes: 0.3 });
  assert.deepEqual(bt, { highestNo: '−0.0500', lowestYes: '0.3000' });
  assert.deepEqual(view('yes', { boundaryText: bt }).boundaryText, bt);
  assert.throws(() => boundaryText(hospitals, MODEL.boundary), RangeError);
});

test('boundaryText is a required view input', () => {
  assert.throws(() => view('no', { boundaryText: undefined }), TypeError);
});

test("short names are CMS's, read from its column names", () => {
  assert.deepEqual(SHORT_NAMES, { PSI90: 'PSI 90', CLABSI: 'CLABSI', CAUTI: 'CAUTI', SSI: 'SSI', CDI: 'CDI', MRSA: 'MRSA' });
});

test('display fields come from the master record; a missing county stays null', () => {
  const v = view('yes', { master: { ccn: '990001', name: 'Example & Sons <Hospital>', city: 'Exampleton', state: 'AL',
    county: null, programs: { hacrp: { inProgram: true, reason: null } } } });
  assert.equal(v.name, 'Example & Sons <Hospital>');
  assert.equal(v.county, null);
});

test('a master record for another CCN is refused', () => {
  assert.throws(() => view('yes', { master: { ...inputs(CASES.no).master } }), RangeError);
});
