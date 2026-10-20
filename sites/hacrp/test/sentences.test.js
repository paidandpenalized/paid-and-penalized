import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY, fill } from '../web/copy.js';
import { distanceSentence, largestSentence, measureNote, smallNumber, summary } from '../web/sentences.js';
import { hospitalView } from '../web/view.js';
import { CASES, MODEL, inputs } from './fixtures.js';

const view = (name, overrides) => hospitalView(inputs(CASES[name], overrides));
const all = (name) => {
  const v = view(name);
  return { summary: summary(v, MODEL), distance: distanceSentence(v, MODEL), small: smallNumber(v), largest: largestSentence(v) };
};

const SCORE_IS = 'The Total HAC Score compares hospitals with each other on the infection and patient-safety measures '
  + 'each hospital was scored on.';
const NOT_A_GRADE = 'It is not a grade of the quality of care.';

test('a scored "Yes" hospital', () => {
  assert.deepEqual(all('yes'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of 0.3000 for Example General Hospital and a payment reduction decision of Yes.',
      "CMS cut this hospital's Medicare inpatient payments by 1% for that fiscal year because its score was above CMS's line.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: "This site recomputes the distance to CMS's line: the score is 0.0500 above 0.2500, the highest score CMS marked No.",
    small: null,
    largest: 'Of the measures with a measured result, central line–associated bloodstream infections (CLABSI) added the most '
      + "to the score. This site recomputes its part as +0.1500 (the measure's z-score divided by the number of measures scored).",
  });
});

test('a scored "No" hospital', () => {
  assert.deepEqual(all('no'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of −0.1000 for Example General Hospital and a payment reduction decision of No.',
      "Its score was at or below CMS's line, so this program did not cut its Medicare inpatient payments for that fiscal year.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: "This site recomputes the distance to CMS's line: the score is 0.3507 below 0.2507, the lowest score CMS marked Yes.",
    small: null,
    largest: 'Of the measures with a measured result, Clostridioides difficile (C. diff) infections (CDI) added the most '
      + "to the score. This site recomputes its part as +0.0400 (the measure's z-score divided by the number of measures scored).",
  });
});

test('Maryland: CMS\'s footnote verbatim, no inference, no distance', () => {
  assert.deepEqual(all('maryland'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of 0.4000 for Example General Hospital and a payment reduction decision of N/A.',
      "CMS's note on the payment reduction: Maryland hospitals are waived from receiving payment adjustments under the Program.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: null,
    small: null,
    largest: 'Of the measures with a measured result, patient safety and adverse events composite (PSI 90) added the most '
      + "to the score. This site recomputes its part as +0.1000 (the measure's z-score divided by the number of measures scored).",
  });
});

test('no score, decision No: CMS\'s values and footnote only', () => {
  assert.deepEqual(all('noScore'), {
    summary: [
      'For fiscal year 2026, CMS reports no Total HAC Score for Example General Hospital and a payment reduction decision of No.',
      "CMS's note on the score: Results are not available for this reporting period.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: null,
    small: null,
    largest: null,
  });
});

test('the row reading Yes with no score: CMS\'s values and footnote only, no reason added', () => {
  assert.deepEqual(all('yesNoScore'), {
    summary: [
      'For fiscal year 2026, CMS reports no Total HAC Score for Example General Hospital and a payment reduction decision of Yes.',
      "CMS's note on the score: Results are not available for this reporting period.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: null,
    small: null,
    largest: null,
  });
});

test('a one-measure hospital gets the small-number warning', () => {
  assert.deepEqual(all('oneMeasure'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of 0.3500 for Example General Hospital and a payment reduction decision of Yes.',
      "CMS cut this hospital's Medicare inpatient payments by 1% for that fiscal year because its score was above CMS's line.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: "This site recomputes the distance to CMS's line: the score is 0.1000 above 0.2500, the highest score CMS marked No.",
    small: 'CMS scored this hospital on a single measure, so that measure alone set its Total HAC Score.',
    largest: 'Of the measures with a measured result, patient safety and adverse events composite (PSI 90) added the most '
      + "to the score. This site recomputes its part as +0.3500 (the measure's z-score divided by the number of measures scored).",
  });
});

test('the largest-contribution sentence never names a CMS-assigned measure', () => {
  assert.deepEqual(all('assignedLargest'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of 0.3250 for Example General Hospital and a payment reduction decision of Yes.',
      "CMS cut this hospital's Medicare inpatient payments by 1% for that fiscal year because its score was above CMS's line.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: "This site recomputes the distance to CMS's line: the score is 0.0750 above 0.2500, the highest score CMS marked No.",
    small: null,
    largest: 'Of the measures with a measured result, catheter-associated urinary tract infections (CAUTI) added the most '
      + "to the score. This site recomputes its part as +0.0500 (the measure's z-score divided by the number of measures scored).",
  });
});

test('every scored measure CMS-assigned: no largest-contribution sentence', () => {
  assert.deepEqual(all('allAssigned'), {
    summary: [
      'For fiscal year 2026, CMS reports a Total HAC Score of 2.2091 for Example General Hospital and a payment reduction decision of Yes.',
      "CMS cut this hospital's Medicare inpatient payments by 1% for that fiscal year because its score was above CMS's line.",
      SCORE_IS,
      NOT_A_GRADE,
    ],
    distance: "This site recomputes the distance to CMS's line: the score is 1.9591 above 0.2500, the highest score CMS marked No.",
    small: null,
    largest: null,
  });
});

test('a tagged measure changes no sentence: the whole output equals the untagged case', () => {
  const untagged = Object.fromEntries(Object.keys(inputs(CASES.yes).estimate)
    .map((id) => [id, { tagged: false, maxError: 0 }]));
  const v = view('yes');
  assert.equal(v.measures.find((m) => m.id === 'PSI90').tagged, true);
  assert.deepEqual(summary(v), [
    'For fiscal year 2026, CMS reports a Total HAC Score of 0.3000 for Example General Hospital and a payment reduction decision of Yes.',
    "CMS cut this hospital's Medicare inpatient payments by 1% for that fiscal year because its score was above CMS's line.",
    SCORE_IS,
    NOT_A_GRADE,
  ]);
  assert.deepEqual(summary(v), summary(view('yes', { estimate: untagged })));
});

test("the distance sentence quotes CMS's boundary text when the view has it", () => {
  const v = view('totalFootnote', { boundaryText: { highestNo: '0.2500', lowestYes: '0.25070' } });
  assert.equal(distanceSentence(v, MODEL),
    "This site recomputes the distance to CMS's line: the score is 0.3007 below 0.25070, the lowest score CMS marked Yes.");
  assert.equal(distanceSentence(view('totalFootnote'), MODEL),
    "This site recomputes the distance to CMS's line: the score is 0.3007 below 0.2507, the lowest score CMS marked Yes.");
});

test('a scored hospital\'s total footnote is quoted after the lead', () => {
  const out = all('totalFootnote');
  assert.deepEqual(out.summary, [
    'For fiscal year 2026, CMS reports a Total HAC Score of −0.0500 for Example General Hospital and a payment reduction decision of No.',
    "CMS's note on the score: The data are based on claims that the hospital or facility submitted to CMS. The hospital or facility has reported discrepancies in their claims data.",
    "Its score was at or below CMS's line, so this program did not cut its Medicare inpatient payments for that fiscal year.",
    SCORE_IS,
    NOT_A_GRADE,
  ]);
  assert.equal(out.largest, null);
});

test('an assigned measure gets CMS\'s-rule note; a measured one gets none', () => {
  const v = view('assignedLargest');
  assert.equal(measureNote(v.measures.find((m) => m.id === 'SSI')),
    "CMS assigned this measure its worst possible score under the program's rules; it is not a measured result. "
    + "CMS's footnote gives the reason.");
  assert.equal(measureNote(v.measures.find((m) => m.id === 'PSI90')), null);
});

test('no sentence uses a banned word', () => {
  const banned = /\b(caught|failed|dodged|worst-performing|should|could have avoided)\b/i;
  for (const [key, { text }] of Object.entries(COPY)) assert.doesNotMatch(text, banned, key);
});

test('fill takes formatted strings only and refuses a missing or unused placeholder', () => {
  assert.equal(fill('noteScore', { notes: 'x' }), "CMS's note on the score: x");
  assert.throws(() => fill('noteScore', {}), /notes/);
  assert.throws(() => fill('noteScore', { notes: 'x', extra: 'y' }), /extra/);
  assert.throws(() => fill('noteScore', { notes: 3 }), TypeError);
  assert.throws(() => fill('noSuchKey', {}), RangeError);
});
