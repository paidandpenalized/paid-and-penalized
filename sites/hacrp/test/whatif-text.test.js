// What-if words, as snapshots: synthetic hospitals (CCNs 990011-990017) that agree with the real FY2026 model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { loadHacrp } from '../../../engine/js/test/hacrp/helpers.js';
import { SYNTH_PERIODS, modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { hospitalView } from '../web/view.js';
import { initialState, reduce, solverOf, viewModel } from '../web/whatif-state.js';
import { cutText, flagText, scenarioSentence, slideText, solverRows, whatIfTexts } from '../web/whatif-text.js';
import { inputs } from './fixtures.js';

const { model } = loadHacrp();
const ESTIMATE = Object.fromEntries(MEASURE_IDS.map((id) => [id, { tagged: false, maxError: 0.0001 }]));
const SOURCE = { id: 'yq43-i98g', landingPage: 'https://data.cms.gov/provider-data/dataset/yq43-i98g', pdcReleased: '2026-08-13' };
const V = { PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 };

const H = {
  no: modelHospital(model, '990011', { values: V }),
  yes: modelHospital(model, '990012', { values: { PSI90: 1.05, CLABSI: 1.2, CAUTI: 0.8, SSI: 1.0, CDI: 0.6, MRSA: 1.2 } }),
  capped: modelHospital(model, '990013', { values: { PSI90: 0.75, CLABSI: 0.3, CAUTI: 0.2, SSI: 0.5, CDI: 0.2, MRSA: 1.9 } }),
  noCushion: modelHospital(model, '990014', { values: { ...V, CLABSI: 1.073 } }),
  assigned: modelHospital(model, '990016', { values: { ...V, SSI: 'assigned' } }),
  maryland: modelHospital(model, '990017', { values: V, decision: 'N/A', state: 'MD' }),
};

const vmOf = (h, changes = {}) => {
  let s = initialState(h, model);
  for (const [id, value] of Object.entries(changes)) s = reduce(s, { type: 'set', id, value });
  return viewModel(s, h, model, ESTIMATE);
};
const sentence = (name, changes) => scenarioSentence(vmOf(H[name], changes), H[name], model);
// The solver's rows for a hospital (none where solverOf has no answers).
const rowsOf = (h) => solverRows(solverOf(h, model) ?? [], model);
const rows = (name) => rowsOf(H[name]);

const NO_CUT = "That would be at or below CMS's line, so the payment reduction decision would be No: no cut.";
const CUT = "That would be above CMS's line, so the payment reduction decision would be Yes: a 1% cut.";
const STANDING = "A what-if shows the formula's arithmetic, not what a hospital could realistically change or how. "
  + "CMS's real result also depends on other hospitals.";

test('the fixtures sit where the snapshots need them', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(H).map(([k, h]) => [k, [h.totalText, h.paymentReduction]])), {
    no: ['0.2734', 'No'], yes: ['0.7642', 'Yes'], capped: ['-0.3488', 'No'], noCushion: ['0.3789', 'No'],
    assigned: ['0.6211', 'Yes'], maryland: ['0.2734', 'N/A'],
  });
});

test('flag and cut text: too close to call reads both cuts; Maryland reads N/A, no cut', () => {
  assert.deepEqual(['Yes', 'No', 'too-close', 'N/A'].map(flagText),
    ['Yes', 'No', 'too close to call', 'N/A (not subject to the reduction)']);
  assert.deepEqual(['Yes', 'No', 'too-close', 'N/A'].map(cutText), ['1%', '0%', '0% or 1%', null]);
  assert.throws(() => flagText('Maybe'), RangeError);
});

test('sentence: no change', () => {
  assert.equal(sentence('no'), "CMS reports a Total HAC Score of 0.2734 and a payment reduction decision of No.");
  assert.equal(sentence('capped'), "CMS reports a Total HAC Score of −0.3488 and a payment reduction decision of No.");
});

test('sentence: one better change, below the line', () => {
  assert.equal(sentence('no', { CLABSI: 0.6 }),
    `With CLABSI at 0.600 instead of 0.800, the Total HAC Score would fall from 0.2734 to 0.1961. ${NO_CUT}`);
});

test('sentence: one worse change, crossing the line', () => {
  assert.equal(sentence('no', { MRSA: 1.4 }),
    `With MRSA at 1.400 instead of 0.900, the Total HAC Score would rise from 0.2734 to 0.4476. ${CUT} CMS reports a payment reduction decision of No.`);
});

test('sentence: a change in the dead zone names CMS\'s cap (or floor)', () => {
  assert.equal(sentence('capped', { MRSA: 1.8 }), 'Lowering MRSA to 1.800 would not change the score: CMS caps MRSA at 1.762.');
  assert.equal(sentence('capped', { MRSA: 2.2 }), 'Raising MRSA to 2.200 would not change the score: CMS caps MRSA at 1.762.');
  assert.equal(sentence('capped', { PSI90: 0.7 }),
    'Lowering PSI 90 to 0.7000 would not change the score: CMS gives every PSI 90 value at or below 0.7760 the same score.');
  assert.equal(sentence('assigned', { SSI: 2.5 }),
    'SSI at 2.500 (had it been submitted) would not change the score: CMS caps SSI at 2.118.');
});

test('sentence: an assigned measure, "had it been submitted"', () => {
  assert.equal(sentence('assigned', { SSI: 0.8 }),
    'With SSI at 0.800 (had it been submitted), the Total HAC Score would fall from 0.6211 to 0.2448. '
    + `${NO_CUT} CMS reports a payment reduction decision of Yes.`);
});

test('sentence: two changes', () => {
  assert.equal(sentence('no', { CLABSI: 0.6, CDI: 0.7 }),
    `With CLABSI at 0.600 instead of 0.800 and CDI at 0.700 instead of 0.500, the Total HAC Score would rise from 0.2734 to 0.3251. ${NO_CUT}`);
  // One of them in the dead zone: the score moves, and the sentence says which change did not.
  assert.equal(sentence('capped', { CLABSI: 0.5, MRSA: 1.8 }),
    'With CLABSI at 0.500 instead of 0.300 and MRSA at 1.800 instead of 1.900, the Total HAC Score would rise from −0.3488 to −0.2715. '
    + `${NO_CUT} CMS caps MRSA at 1.762, so the change to MRSA does not move the score.`);
  // Three: a list.
  assert.equal(sentence('no', { CLABSI: 0.6, CDI: 0.4, PSI90: 0.95 }).split(',').slice(0, 3).join(','),
    'With PSI 90 at 0.9500 instead of 1.0000, CLABSI at 0.600 instead of 0.800, and CDI at 0.400 instead of 0.500');
});

test('sentence: too close to call, never Yes or No', () => {
  const vm = vmOf(H.no, { CLABSI: 1.074 });
  assert.equal(vm.result.after.flag, 'too-close');
  assert.equal(scenarioSentence(vm, H.no, model),
    'With CLABSI at 1.074 instead of 0.800, the Total HAC Score would rise from 0.2734 to 0.3793. That would be too close to call: '
    + "this site's recompute cannot place it on either side of CMS's line, so the cut would be 0% or 1%. CMS reports a payment reduction decision of No.");
});

test('sentence: Maryland moves the score only', () => {
  assert.equal(sentence('maryland'),
    "CMS reports a Total HAC Score of 0.2734 and a payment reduction decision of N/A (not subject to the reduction).");
  assert.equal(sentence('maryland', { CLABSI: 0.6 }),
    'With CLABSI at 0.600 instead of 0.800, the Total HAC Score would fall from 0.2734 to 0.1961. '
    + 'The payment reduction decision would stay N/A (not subject to the reduction).');
});

test('solver rows, flagged hospital: the value needed, or not possible with this measure alone', () => {
  assert.deepEqual(rows('yes'), [
    { id: 'PSI90', label: 'PSI 90', answer: 'not possible with this measure alone', note: null },
    { id: 'CLABSI', label: 'CLABSI', answer: '0.204 or lower', note: null },
    { id: 'CAUTI', label: 'CAUTI', answer: 'not possible with this measure alone', note: null },
    { id: 'SSI', label: 'SSI', answer: 'not possible with this measure alone', note: null },
    { id: 'CDI', label: 'CDI', answer: '0.003 or lower', note: null },
    { id: 'MRSA', label: 'MRSA', answer: '0.094 or lower', note: null },
  ]);
});

test('solver rows, unflagged hospitals: the cushion, any value at CMS\'s cap, and no cushion', () => {
  assert.deepEqual(rows('no'), [
    { id: 'PSI90', label: 'PSI 90', answer: 'up to 1.0908', note: null },
    { id: 'CLABSI', label: 'CLABSI', answer: 'up to 1.073', note: null },
    { id: 'CAUTI', label: 'CAUTI', answer: 'up to 0.863', note: null },
    { id: 'SSI', label: 'SSI', answer: 'up to 1.270', note: null },
    { id: 'CDI', label: 'CDI', answer: 'up to 0.663', note: null },
    { id: 'MRSA', label: 'MRSA', answer: 'up to 1.203', note: null },
  ]);
  assert.deepEqual(rows('capped').map((r) => r.answer), [
    'any value: CMS caps PSI 90 at 1.3482', 'any value: CMS caps CLABSI at 1.572', 'any value: CMS caps CAUTI at 1.537',
    'any value: CMS caps SSI at 2.118', 'any value: CMS caps CDI at 0.944', 'any value: CMS caps MRSA at 1.762',
  ]);
  assert.deepEqual(rows('noCushion').find((r) => r.id === 'CLABSI'),
    { id: 'CLABSI', label: 'CLABSI', answer: 'no cushion', note: 'The current value is already the highest that keeps the decision at No.' });
});

test('solver rows, an assigned measure: a note, no answer; Maryland: no solver at all', () => {
  assert.deepEqual(rows('assigned').find((r) => r.id === 'SSI'),
    { id: 'SSI', label: 'SSI', answer: null, note: "CMS assigned this measure's score, so there is no submitted value to solve for." });
  assert.equal(solverOf(H.maryland, model), null);
});

test('the solver\'s answer, entered as the reader\'s value, reads No; one unit higher does not', () => {
  for (const name of ['yes', 'assigned', 'no']) {
    const h = H[name];
    for (const r of solverOf(h, model)) {
      if (!r.possible || r.unlimited) continue;
      const unit = 10 ** -model.params[r.id].decimals;
      const at = vmOf(h, { [r.id]: r.value });
      assert.equal(at.result.after.flag, 'No', `${name} ${r.id}`);
      assert.match(scenarioSentence(at, h, model), /payment reduction decision would be No: no cut\./);
      const above = vmOf(h, { [r.id]: r.value + unit });
      assert.notEqual(above.result.after.flag, 'No', `${name} ${r.id}`);
      assert.doesNotMatch(scenarioSentence(above, h, model), /decision would be No/);
    }
  }
});

test('the solver and the sentences never point at an assigned score, even when it is all CMS scored', () => {
  const allAssigned = modelHospital(model, '990018', { values: { CDI: 'assigned', MRSA: 'assigned' } });
  assert.equal(allAssigned.paymentReduction, 'Yes');
  assert.deepEqual(rowsOf(allAssigned), [
    { id: 'CDI', label: 'CDI', answer: null, note: "CMS assigned this measure's score, so there is no submitted value to solve for." },
    { id: 'MRSA', label: 'MRSA', answer: null, note: "CMS assigned this measure's score, so there is no submitted value to solve for." },
  ]);
  assert.equal(scenarioSentence(vmOf(allAssigned), allAssigned, model),
    "CMS reports a Total HAC Score of 2.2091 and a payment reduction decision of Yes.");
});

test('a hospital with no score: no sentence, no solver rows, no slide', () => {
  const none = modelHospital(model, '990019', { values: {}, decision: 'No' });
  const vm = vmOf(none);
  assert.equal(scenarioSentence(vm, none, model), null);
  assert.equal(solverOf(none, model), null);
  assert.equal(slideText(vm, none, model, { name: 'X', fy: 2026, source: SOURCE }), null);
});

test('slide text: name, before -> after, Hypothetical, the sentence, the source line and the what-if standing line', () => {
  const h = H.no;
  const view = { ...hospitalView(inputs(h, { model })), source: SOURCE };
  assert.equal(slideText(vmOf(h, { MRSA: 1.4 }), h, model, view), [
    'Example General Hospital',
    'Total HAC Score: 0.2734 → 0.4476 (Hypothetical)',
    'Payment reduction decision: No → Yes (Hypothetical)',
    `With MRSA at 1.400 instead of 0.900, the Total HAC Score would rise from 0.2734 to 0.4476. ${CUT} CMS reports a payment reduction decision of No.`,
    'Source: CMS Provider Data Catalog, HACRP FY2026 (yq43-i98g), released August 13, 2026.',
    STANDING,
  ].join('\n'));
});

test('slide text: Maryland shows its decision once; the median hospital has no name line', () => {
  const md = H.maryland;
  const text = slideText(vmOf(md, { CLABSI: 0.6 }), md, model, { name: 'Example Hospital', fy: 2026, source: SOURCE });
  assert.equal(text.split('\n')[2], 'Payment reduction decision: N/A (not subject to the reduction)');
  const mh = medianHospital(model, { fiscalYear: '2026', periods: SYNTH_PERIODS });
  const lines = slideText(vmOf(mh), mh, model, { name: null, fy: 2026, source: SOURCE }).split('\n');
  assert.equal(lines[0], `Total HAC Score: ${mh.totalText.replace('-', '−')} → ${mh.totalText.replace('-', '−')} (Hypothetical)`);
  assert.equal(lines.at(-1), STANDING);
  assert.throws(() => slideText(vmOf(md), md, model, { name: 'X', fy: 2026 }), TypeError);
});

test('the what-if words never say should, failed, caught, dodged, worst-performing or could have avoided', () => {
  const banned = /\b(should|failed|caught|dodged|worst-performing|could have avoided|did not submit)\b/i;
  const scenarios = [
    ['no', {}], ['no', { CLABSI: 0.6 }], ['no', { MRSA: 1.4 }], ['no', { CLABSI: 1.074 }], ['capped', { MRSA: 1.8 }],
    ['capped', { PSI90: 0.7 }], ['assigned', { SSI: 0.8 }], ['assigned', { SSI: 2.5 }], ['maryland', { CLABSI: 0.6 }],
    ['yes', {}], ['noCushion', {}],
  ];
  for (const [name, changes] of scenarios) {
    const vm = vmOf(H[name], changes);
    const words = [scenarioSentence(vm, H[name], model), slideText(vm, H[name], model, { name: null, fy: 2026, source: SOURCE }),
      ...rowsOf(H[name]).flatMap((r) => [r.answer, r.note])].filter(Boolean);
    for (const w of words) assert.doesNotMatch(w, banned, w);
  }
});

test('a change that moves the score into the dead zone names the bound, without saying the score stood still', () => {
  const capNote = 'CMS caps MRSA at 1.762, so any value above it scores the same.';
  for (const v of [2, 3]) {
    const text = sentence('no', { MRSA: v });
    assert.equal(text, `With MRSA at ${v.toFixed(3)} instead of 0.900, the Total HAC Score would rise from 0.2734 to 0.5737. `
      + `${CUT} CMS reports a payment reduction decision of No. ${capNote}`);
  }
  // Exactly at the cap: named too.
  assert.match(sentence('no', { MRSA: 1.762 }), /CMS caps MRSA at 1\.762, so any value above it scores the same\.$/);
  assert.equal(sentence('no', { PSI90: 0.7 }),
    `With PSI 90 at 0.7000 instead of 1.0000, the Total HAC Score would fall from 0.2734 to 0.0127. ${NO_CUT} `
    + 'CMS gives every PSI 90 value at or below 0.7760 the same score.');
  // A floor of zero is no dead zone worth naming: SIRs can't go below it.
  assert.doesNotMatch(sentence('no', { CLABSI: 0 }), /the same score/);
  assert.doesNotMatch(sentence('no', { CLABSI: 0.6 }), /caps|the same score/);
});

test('the median hospital: this site\'s hypothetical, never described as CMS\'s values or decision', () => {
  const mh = medianHospital(model, { fiscalYear: '2026', periods: SYNTH_PERIODS });
  assert.equal(scenarioSentence(vmOf(mh), mh, model),
    'This site recomputes a Total HAC Score of −0.1278 and a payment reduction decision of No for its hypothetical hospital '
    + 'at the national median on every measure.');
  assert.equal(scenarioSentence(vmOf(mh, { CLABSI: 1.2, MRSA: 1.4 }), mh, model),
    'With CLABSI at 1.200 instead of 0.559 and MRSA at 1.400 instead of 0.641, the Total HAC Score would rise from −0.1278 to 0.3844. '
    + `${CUT} Before these changes, this site recomputes its decision as No.`);
  const claimsCms = /CMS's values|CMS reports|CMS's decision|CMS's value|CMS assigned/;
  for (const changes of [{}, { CLABSI: 1.2, MRSA: 1.4 }, { MRSA: 2 }, { CLABSI: 0.4 }, { PSI90: 0.7 }]) {
    const vm = vmOf(mh, changes);
    const words = [scenarioSentence(vm, mh, model), slideText(vm, mh, model, { name: null, fy: 2026, source: SOURCE }),
      ...rowsOf(mh).flatMap((r) => [r.answer, r.note])].filter(Boolean);
    for (const w of words) assert.doesNotMatch(w, claimsCms, w);
  }
  assert.equal(slideText(vmOf(mh, { CLABSI: 1.2, MRSA: 1.4 }), mh, model, { name: null, fy: 2026, source: SOURCE }), [
    'Total HAC Score: −0.1278 → 0.3844 (Hypothetical)',
    'Payment reduction decision: No → Yes (Hypothetical)',
    'With CLABSI at 1.200 instead of 0.559 and MRSA at 1.400 instead of 0.641, the Total HAC Score would rise from −0.1278 to 0.3844. '
      + `${CUT} Before these changes, this site recomputes its decision as No.`,
    'Source: CMS Provider Data Catalog, HACRP FY2026 (yq43-i98g), released August 13, 2026.',
    STANDING,
  ].join('\n'));
});

test('component texts: NHSN fields only for a real hospital with an HAI period; each field names its range', () => {
  const make = (hospital) => whatIfTexts({ hospital, model, name: null, fy: 2026, path: '/hacrp/', source: SOURCE, boundaryText: { highestNo: '0.3792', lowestYes: '0.3799' } });
  const periods = { psi90: { start: '07/01/2022', end: '06/30/2024' }, hai: { start: '01/01/2023', end: '12/31/2024' } };
  assert.equal(make(medianHospital(model, { fiscalYear: '2026', periods })).predicted, null, 'median hospital, even with periods');
  const t = make(H.no);
  assert.match(t.predicted.label('CLABSI'), /January 1, 2023 to December 31, 2024/);
  assert.equal(t.predicted.label('PSI90'), null);
  const vm = vmOf(H.no);
  const mrsa = vm.inputs.find((i) => i.id === 'MRSA');
  assert.equal(t.measure(mrsa, vm.result.measures.MRSA).invalid, 'Enter a number from 0.000 to 17.620.');
  assert.equal(t.measure(mrsa, vm.result.measures.MRSA).slider, 'MRSA value');
});
