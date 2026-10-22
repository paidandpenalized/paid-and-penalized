// The hospital page's plain words (sentences.js) on synthetic hospitals: what CMS reports, what the decision means,
// CMS's notes verbatim, this site's distance to the line, and the small-number and assigned-measure notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY, fill } from '../web/copy.js';
import { distanceSentence, leadSentence, measureNote, noteSentences, smallNumber, whySentences } from '../web/sentences.js';
import { hospitalView } from '../web/view.js';
import { CASES, inputs } from './fixtures.js';

const view = (name, overrides) => hospitalView(inputs(CASES[name], overrides));
const all = (name) => {
  const v = view(name);
  return { lead: leadSentence(v), why: whySentences(v), notes: noteSentences(v), distance: distanceSentence(v), small: smallNumber(v) };
};
const LEAD = (total, decision) => `For fiscal year 2026, CMS reports a Total HAC Score of ${total} for Example General Hospital and a payment reduction decision of ${decision}.`;
const LEAD_NONE = (decision) => `For fiscal year 2026, CMS reports no Total HAC Score for Example General Hospital and a payment reduction decision of ${decision}.`;
const YES = 'Its score was above CMS’s line, so CMS cut its traditional Medicare inpatient payments by 1% for the year.';
const NO = 'Its score was at or below CMS’s line, so this program did not cut its Medicare payments for the year.';
const ABOVE = (d) => `This hospital’s score is ${d} above 0.2500, the highest score CMS marked No. (This site recomputes.)`;
const BELOW = (d, line = '0.2507') => `This hospital’s score is ${d} below ${line}, the lowest score CMS marked Yes. (This site recomputes.)`;
const NOT_AVAILABLE = 'CMS’s note on the score: Results are not available for this reporting period.';

test('a scored "Yes" hospital', () => {
  assert.deepEqual(all('yes'), { lead: LEAD('0.3000', 'Yes'), why: [YES], notes: [], distance: ABOVE('0.0500'), small: null });
});

test('a scored "No" hospital', () => {
  assert.deepEqual(all('no'), { lead: LEAD('−0.1000', 'No'), why: [NO], notes: [], distance: BELOW('0.3507'), small: null });
});

test('Maryland: CMS\'s footnote verbatim, no inference, no distance', () => {
  assert.deepEqual(all('maryland'), {
    lead: LEAD('0.4000', 'N/A'), why: [],
    notes: ['CMS’s note on the payment reduction: Maryland hospitals are waived from receiving payment adjustments under the Program.'],
    distance: null, small: null,
  });
});

test('no score, decision No or Yes: CMS\'s values and footnote only, no reason added', () => {
  assert.deepEqual(all('noScore'), { lead: LEAD_NONE('No'), why: [], notes: [NOT_AVAILABLE], distance: null, small: null });
  assert.deepEqual(all('yesNoScore'), { lead: LEAD_NONE('Yes'), why: [], notes: [NOT_AVAILABLE], distance: null, small: null });
});

test('a one-measure hospital gets the small-number warning', () => {
  assert.equal(all('oneMeasure').small, 'CMS scored this hospital on a single measure, so that measure alone set its Total HAC Score.');
  assert.equal(all('yes').small, null);
});

test('the lead can set apart CMS\'s decision: a page passes a marker for it', () => {
  assert.equal(leadSentence(view('yes'), '\u0001'), LEAD('0.3000', '\u0001'));
});

test('a tagged measure changes no sentence: the whole output equals the untagged case', () => {
  const untagged = Object.fromEntries(Object.keys(inputs(CASES.yes).estimate).map((id) => [id, { tagged: false, maxError: 0 }]));
  const words = (v) => [leadSentence(v), ...whySentences(v), ...noteSentences(v), distanceSentence(v)];
  assert.equal(view('yes').measures.find((m) => m.id === 'PSI90').tagged, true);
  assert.deepEqual(words(view('yes')), words(view('yes', { estimate: untagged })));
});

test("the distance sentence quotes the view's boundary text (CMS's), whatever its decimals", () => {
  assert.equal(distanceSentence(view('totalFootnote', { boundaryText: { highestNo: '0.2500', lowestYes: '0.25070' } })), BELOW('0.3007', '0.25070'));
  assert.equal(distanceSentence(view('totalFootnote')), BELOW('0.3007'));
});

test('a scored hospital\'s total footnote is quoted as a note', () => {
  assert.deepEqual(all('totalFootnote').notes, [
    'CMS’s note on the score: The data are based on claims that the hospital or facility submitted to CMS. The hospital or facility has reported discrepancies in their claims data.',
  ]);
});

test('an assigned measure gets CMS\'s-rule note; a measured one gets none', () => {
  const v = view('assignedLargest');
  assert.equal(measureNote(v.measures.find((m) => m.id === 'SSI')),
    "CMS assigned this measure its worst possible score under the program’s rules; it is not a measured result. CMS’s footnote gives the reason.");
  assert.equal(measureNote(v.measures.find((m) => m.id === 'PSI90')), null);
});

test('no sentence uses a banned word', () => {
  const banned = /\b(caught|failed|dodged|worst-performing|should|could have avoided)\b/i;
  for (const [key, { text }] of Object.entries(COPY)) assert.doesNotMatch(text, banned, key);
});

test('fill takes formatted strings only and refuses a missing or unused placeholder', () => {
  assert.equal(fill('noteScore', { notes: 'x' }), 'CMS’s note on the score: x');
  assert.throws(() => fill('noteScore', {}), /notes/);
  assert.throws(() => fill('noteScore', { notes: 'x', extra: 'y' }), /extra/);
  assert.throws(() => fill('noteScore', { notes: 3 }), TypeError);
  assert.throws(() => fill('noSuchKey', {}), RangeError);
});
