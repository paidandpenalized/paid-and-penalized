// Ported from Thirty Day Readmissions (web/test/model.test.mjs, review.test.mjs and hospital.test.mjs at 33d1959):
// the wording helpers' tests, on synthetic records. The expected strings are the source's, except that copy is
// typeset (a straight apostrophe prints curly), so "hospital's" reads "hospital’s" here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../../../engine/js/hrrp/summary.js';
import { COPY } from '../web/copy.js';
import {
  plural, hospitals, inSentence, noneMeasured, penalizedOfMeasured, vsLabel, noEstimateNote, rankContext, rankLine,
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

test('plural and hospitals', () => {
  assert.equal(plural(1, 'hospital'), '1 hospital');
  assert.equal(plural(2912, 'hospital'), '2,912 hospitals');
  assert.equal(plural(1, 'hospital has', 'hospitals have'), '1 hospital has');
  assert.equal(hospitals(1), '1 hospital');
  assert.equal(hospitals(2912), '2,912 hospitals');
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
  // Thousands take a separator and the share rounds to whole percent: 2,330 of 2,798 is 83%.
  const many = Array.from({ length: 2798 }, (_, i) => ({ red: i < 2330 ? 0.2 : 0, c: MEASURED }));
  assert.equal(penalizedOfMeasured(summarize(many)), '83% of 2,798 measured');
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
  const list = Array.from({ length: 10 }, (_, i) => hosp({ id: String(990001 + i), red: i / 10, peer: i % 2 ? 2 : 1, st: i < 5 ? 'ZZ' : 'YY' }));
  const states = { ZZ: 'Zedland', YY: 'Yonderland' };
  const ctx = rankContext(list, states);
  assert.equal(rankLine(list[4], ctx), 'Larger cut than 40% of hospitals nationally, 80% of the 5 in Zedland, and 40% in peer group 1.');
  assert.equal(rankLine(list[0], ctx), 'No reduction, like 0 other hospitals.');
  const withZeros = (n) => list.map((y, i) => ({ ...y, red: i < n ? 0 : 0.5 }));
  const zeros3 = withZeros(3);
  assert.equal(rankLine(zeros3[0], rankContext(zeros3, states)), 'No reduction, like 2 other hospitals.');
  // The biggest cut in a set is larger than every other hospital's, and the line still says 99%, never 100%.
  const big = Array.from({ length: 300 }, (_, i) => hosp({ id: String(990001 + i), red: (i + 1) / 1000 }));
  assert.match(rankLine(big[299], rankContext(big, states)), /^Larger cut than 99% of hospitals nationally, 99% of the 300 in Zedland, and 99% in peer group 1\.$/);
  // A smallest cut in a place has no smaller one there: "none", never "0%".
  const small = Array.from({ length: 6 }, (_, i) => hosp({ id: String(990001 + i), red: i === 0 ? 0.1 : 0.5 + i / 10, peer: 1, st: i < 3 ? 'ZZ' : 'YY' }));
  assert.equal(rankLine(small[3], rankContext(small, states)), 'Larger cut than 50% of hospitals nationally, none of the 3 in Yonderland, and 50% in peer group 1.');
  assert.doesNotMatch(rankLine(small[3], rankContext(small, states)), /\b0%/);
  // A cut larger than one of 150 is above none: it keeps its floored percent, as the history table prints it, never "none".
  const many = Array.from({ length: 150 }, (_, i) => hosp({ id: String(990001 + i), red: (i + 1) / 1000 }));
  assert.match(rankLine(many[1], rankContext(many, states)), /^Larger cut than 0% of hospitals nationally, 0% of the 150 in Zedland, and 0% in peer group 1\.$/);
  // The source printed "1 other hospitals"; one reads singular here.
  const zeros2 = withZeros(2);
  assert.equal(rankLine(zeros2[0], rankContext(zeros2, states)), 'No reduction, like 1 other hospital.');
});

// This one sentence departs from the source site (Thirty Day Readmissions: "Medicare will pay") on purpose: the payment year
// is running, so it is in the present tense.
test('summary sentence: penalized names the biggest contributor', () => {
  const c = { HF: { n: 100, err: 1.2, flag: 1, ratio: 0.05 }, PN: { n: 100, err: 1.05, flag: 1, ratio: 0.05 }, AMI: { n: 40, err: 0.9, flag: 0, ratio: 0.02 } };
  assert.equal(summarySentence(hosp({ paf: 0.99, red: 1, c }), meta, edition),
    `Medicare is paying ${NAME} 1.00% less on the base payment for every traditional-Medicare inpatient stay from October 1, 2026. `
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
