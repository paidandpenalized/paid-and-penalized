// Ported from Thirty Day Readmissions (web/test/model.test.mjs, review.test.mjs and hospital.test.mjs at 33d1959):
// the wording helpers' tests, on synthetic records. The expected strings are the source's, except that copy is
// typeset (a straight apostrophe prints curly), so "hospital's" reads "hospital’s" here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../../../engine/js/hrrp/summary.js';
import { COPY } from '../web/copy.js';
import {
  plural, upFirst, ordinal, inSentence, noneMeasured, penalizedOfMeasured, vsLabel, noEstimateNote, rankLine,
  summarySentence, inactiveSentence, deckLead, penalizedNote,
} from '../web/wording.js';

const MEASURED = { HF: { n: 40, err: 1.1 } };
const NAME = 'EXAMPLE GENERAL HOSPITAL';
const meta = { nm: 1, peerMedians: { 1: { AMI: 1, COPD: 1, HF: 1, PN: 1, CABG: 1, THA_TKA: 1 } } };
const edition = {
  label: 'FY2027',
  payLong: 'October 1, 2026',
  conditions: [
    { key: 'AMI', short: 'Heart attack' }, { key: 'COPD', short: 'COPD' }, { key: 'HF', short: 'Heart failure' },
    { key: 'PN', short: 'Pneumonia' }, { key: 'CABG', short: 'Bypass surgery' }, { key: 'THA_TKA', short: 'Hip/knee replacement' },
  ],
};
const hosp = (extra) => ({ id: '990001', name: NAME, peer: 1, st: 'ZZ', ...extra });

// Claim ids are checked against sites/hrrp/CLAIMS.md by pipeline/test/copy-gate.test.js.
test('copy has no digit characters', () => {
  for (const [key, { text }] of Object.entries(COPY)) assert.doesNotMatch(text, /\d/, key);
});

test('plural, upFirst, ordinal', () => {
  assert.equal(plural(1, 'hospital'), '1 hospital');
  assert.equal(plural(2912, 'hospital'), '2,912 hospitals');
  assert.equal(plural(1, 'hospital has', 'hospitals have'), '1 hospital has');
  assert.equal(upFirst('heart failure'), 'Heart failure');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

test('inSentence keeps acronyms and lowercases words', () => {
  assert.equal(inSentence('COPD'), 'COPD');
  assert.equal(inSentence('Heart failure'), 'heart failure');
  assert.equal(inSentence('Hip/knee replacement'), 'hip/knee replacement');
});

test('noneMeasured and penalizedOfMeasured: share of those measured, or the none-measured wording', () => {
  const none = summarize([{ red: 0, c: {} }, { red: 0, c: { HF: { n: 24, err: 1.3 } } }]);
  const one = summarize([{ red: 0, c: {} }]);
  assert.deepEqual([noneMeasured(none), noneMeasured(one)], ['none measured on any condition', 'not measured on any condition']);
  assert.equal(penalizedOfMeasured(none), 'none measured on any condition');
  const list = [{ red: 0.5, c: MEASURED }, { red: 0, c: MEASURED }];
  assert.equal(penalizedOfMeasured(summarize(list)), '50% of 2 measured');
});

test('vsLabel compares after rounding', () => {
  assert.equal(vsLabel(80.4, 80.15, 0, 'pts'), 'same as nation');
  assert.equal(vsLabel(0.164, 0.16, 2, 'pts'), 'same as nation');
  assert.equal(vsLabel(48, 80.15, 0, 'pts'), '−32 pts vs nation');
  assert.equal(vsLabel(0.4, 0.35, 2, 'pts'), '+0.05 pts vs nation');
  assert.equal(vsLabel(5, 3, 0, 'pts', 'state'), '+2 pts vs state');
});

test('noEstimateNote: empty when every hospital has an estimate', () => {
  assert.equal(noEstimateNote([{ pen: 0 }, { pen: 10 }]), '');
  assert.equal(noEstimateNote([{ pen: null }, { pen: 10 }]), '1 hospital has no estimate and is left out of the total');
  assert.equal(noEstimateNote([{ pen: null }, { pen: undefined }]), '2 hospitals have no estimate and are left out of the total');
});

test('area deck lead: a whole sentence whose verb agrees, including a one-hospital area', () => {
  const lead = (list) => deckLead(summarize(list), 'FY2027');
  assert.equal(lead([{ red: 0, c: {} }]), '0 of 1 hospital takes a cut in FY2027: it is not measured on any condition.');
  assert.equal(lead([{ red: 0.2, c: MEASURED }]), '1 of 1 hospital takes a cut in FY2027: 100% of the 1 measured on at least one condition.');
  assert.equal(lead([{ red: 0, c: MEASURED }]), '0 of 1 hospital takes a cut in FY2027: 0% of the 1 measured on at least one condition.');
  assert.equal(lead([{ red: 0, c: {} }, { red: 0, c: {} }]), '0 of 2 hospitals take a cut in FY2027: none measured on any condition.');
  assert.equal(lead([{ red: 0.2, c: MEASURED }, { red: 0, c: MEASURED }]), '1 of 2 hospitals takes a cut in FY2027: 50% of the 2 measured on at least one condition.');
  assert.equal(lead([{ red: 0.2, c: MEASURED }, { red: 0.1, c: MEASURED }]), '2 of 2 hospitals take a cut in FY2027: 100% of the 2 measured on at least one condition.');
});

test('scope KPI: an all-unmeasured area shows no share and skips the comparison with the nation', () => {
  const nation = summarize([{ red: 0.5, c: MEASURED }, { red: 0, c: MEASURED }]);
  assert.equal(penalizedNote(summarize([{ red: 0, c: {} }]), nation), 'of 0 measured');
  assert.equal(penalizedNote(summarize([{ red: 0.2, c: MEASURED }]), nation), 'of 1 measured · +50 pts vs nation');
});

test('rankLine: the share of hospitals with a smaller cut, nationally, in the state and in the peer group', () => {
  const hospitals = Array.from({ length: 10 }, (_, i) => hosp({ id: String(990001 + i), red: i / 10, peer: i % 2 ? 2 : 1, st: i < 5 ? 'ZZ' : 'YY' }));
  const ctx = {
    hospitals,
    sortedRed: hospitals.map((y) => y.red).sort((a, b) => a - b),
    byState: new Map([['ZZ', hospitals.slice(0, 5)], ['YY', hospitals.slice(5)]]),
    states: { ZZ: 'Zedland', YY: 'Yonderland' },
  };
  assert.equal(rankLine(hospitals[4], ctx), 'Larger cut than 40% of hospitals nationally, 80% of the 5 in Zedland, and 40% in peer group 1.');
  assert.equal(rankLine(hospitals[0], ctx), 'No reduction, like 0 other hospitals.');
  const withZeros = (n) => hospitals.map((y, i) => ({ ...y, red: i < n ? 0 : 0.5 }));
  const zeros3 = withZeros(3);
  assert.equal(rankLine(zeros3[0], { ...ctx, hospitals: zeros3 }), 'No reduction, like 2 other hospitals.');
  // The source printed "1 other hospitals"; one reads singular here.
  const zeros2 = withZeros(2);
  assert.equal(rankLine(zeros2[0], { ...ctx, hospitals: zeros2 }), 'No reduction, like 1 other hospital.');
});

test('summary sentence: penalized names the biggest contributor', () => {
  const c = { HF: { n: 100, err: 1.2, flag: 1, ratio: 0.05 }, PN: { n: 100, err: 1.05, flag: 1, ratio: 0.05 }, AMI: { n: 40, err: 0.9, flag: 0, ratio: 0.02 } };
  assert.equal(summarySentence(hosp({ paf: 0.99, red: 1, c }), meta, edition),
    `Medicare will pay ${NAME} 1.00% less on the base payment for every traditional-Medicare inpatient stay from October 1, 2026. `
    + '2 of its 3 measured conditions came in above the peer-group median; heart failure added the most.');
});

test('summary sentence: an inactive hospital is not promised a year of payments', () => {
  const c = { HF: { n: 100, err: 1.2, flag: 1, ratio: 0.05 } };
  assert.equal(summarySentence(hosp({ paf: 0.99, red: 1, c, inactive: { date: null, reason: 'x' } }), meta, edition),
    `CMS set the FY2027 cut for ${NAME} at 1.00%. 1 of its 1 measured conditions came in above the peer-group median; heart failure added the most.`);
});

test('summary sentence: no cut because nothing reached 25 cases', () => {
  const h = hosp({ paf: 1, red: 0, c: { HF: { n: 10, err: 1.3, flag: 0, ratio: 0.05 } } });
  assert.equal(summarySentence(h, meta, edition),
    `${NAME} has no FY2027 cut. None of its six conditions reached 25 cases in the data window, so none could count against it.`);
});

test('summary sentence: no cut because every measured condition was at or below the median', () => {
  const h = hosp({ paf: 1, red: 0, c: { HF: { n: 50, err: 0.95, flag: 0, ratio: 0.05 } } });
  assert.equal(summarySentence(h, meta, edition),
    `${NAME} has no FY2027 cut. All 1 of its measured conditions came in at or below its peer group’s median.`);
});

test('summary sentence: a flagged condition that rounded to a zero cut, one and two conditions', () => {
  const one = hosp({ paf: 1, red: 0, c: { COPD: { n: 200, err: 1.03, flag: 1, ratio: 0.002 }, HF: { n: 300, err: 0.95, flag: 0, ratio: 0.05 } } });
  assert.equal(summarySentence(one, meta, edition),
    `${NAME} has no FY2027 cut. COPD came in above the peer-group median, but its share of the hospital’s Medicare payments is small enough that the reduction rounded to zero.`);
  const two = hosp({ paf: 1, red: 0, c: { HF: { n: 200, err: 1.03, flag: 1, ratio: 0.002 }, PN: { n: 200, err: 1.02, flag: 1, ratio: 0.002 } } });
  assert.equal(summarySentence(two, meta, edition),
    `${NAME} has no FY2027 cut. Heart failure and pneumonia came in above the peer-group median, but their share of the hospital’s Medicare payments is small enough that the reduction rounded to zero.`);
});

test('inactive hospitals get a sentence naming the CCN, end date and reason; the cut is mentioned only when there is one', () => {
  const x = hosp({ red: 0.42, inactive: { date: '2025-03-31', reason: 'voluntary termination' } });
  assert.equal(inactiveSentence(x, edition),
    'CMS lists this hospital’s Medicare agreement under CCN 990001 as ended on March 31, 2025 (voluntary termination). It will not be paid under this ID in FY2027, so its cut is unlikely to be collected.');
  assert.equal(inactiveSentence({ ...x, red: 0 }, edition),
    'CMS lists this hospital’s Medicare agreement under CCN 990001 as ended on March 31, 2025 (voluntary termination). It will not be paid under this ID in FY2027.');
  assert.equal(inactiveSentence({ ...x, inactive: { date: null, reason: 'merger or closure' } }, edition),
    'CMS lists this hospital’s Medicare agreement under CCN 990001 as ended (merger or closure). It will not be paid under this ID in FY2027, so its cut is unlikely to be collected.');
});
