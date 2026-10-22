// HACRP's what-if rules (sites/hacrp/web/whatif-state.js): the state, its actions and the view model. Synthetic
// hospitals (CCNs 990011-990016) on the FY2026 model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAssigned, scoredMeasures } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { solveMeasure } from '../../../engine/js/hacrp/solver.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { loadHacrp } from '../../../engine/js/test/hacrp/helpers.js';
import { SYNTH_PERIODS, SYNTH_VALUES, modelHospital } from '../../../engine/js/test/hacrp/synthetic.js';
import { MAX_FACTOR, decode, encode } from '../../../web/whatif/fragment.js';
import { changesOf, initialState, reduce, solverOf, viewModel, whatIfRules } from '../web/whatif-state.js';

const { hospitals, model } = loadHacrp();
const { params } = model;
const ESTIMATE = Object.fromEntries(MEASURE_IDS.map((id) => [id, { tagged: id === 'PSI90' || id === 'CDI', maxError: 0.001 }]));
const NO = modelHospital(model, '990011', { values: SYNTH_VALUES.no });
const ASSIGNED = modelHospital(model, '990016', { values: SYNTH_VALUES.assigned });
const CAPPED = modelHospital(model, '990013', { values: SYNTH_VALUES.capped });
const set = (id, value) => ({ type: 'set', id, value });
const apply = (h, ...actions) => actions.reduce(reduce, initialState(h, model));

test('the fixtures sit where the tests need them', () => {
  assert.equal(NO.paymentReduction, 'No');
  assert.equal(ASSIGNED.paymentReduction, 'Yes');
  assert.ok(isAssigned(ASSIGNED.measures.SSI));
  assert.ok(CAPPED.measures.MRSA.value > params.MRSA.cap);
});

test('the initial state is CMS: no changes, and the view model equals the plain what-if', () => {
  const s = initialState(NO, model);
  assert.deepEqual(changesOf(s), {});
  const vm = viewModel(s, NO, model, ESTIMATE);
  assert.deepEqual(vm.result, whatIf(NO, model));
  assert.deepEqual(vm.counts, {});
});

test('set: rounds to the display unit; CMS\'s own value, junk and negatives are no change', () => {
  assert.deepEqual(changesOf(apply(NO, set('CLABSI', 0.61249))), { CLABSI: 0.612 });
  assert.deepEqual(changesOf(apply(NO, set('PSI90', 0.912349))), { PSI90: 0.9123 });
  assert.deepEqual(changesOf(apply(NO, set('CLABSI', 0.6), set('CLABSI', 0.8))), {});
  assert.deepEqual(changesOf(apply(NO, set('CLABSI', 0.8004))), {});
  const s = initialState(NO, model);
  for (const bad of [-0.1, NaN, Infinity, -Infinity, '0.5', undefined, {}, true]) {
    assert.equal(reduce(s, set('CLABSI', bad)), s, String(bad));
  }
  assert.equal(reduce(s, set('NOPE', 1)), s);
  // Past MAX_FACTOR x cap, the same range decode accepts: no change.
  assert.equal(reduce(s, set('MRSA', 1e25)), s);
  assert.equal(reduce(s, set('MRSA', MAX_FACTOR * params.MRSA.cap + 0.001)), s);
  assert.deepEqual(changesOf(reduce(s, set('MRSA', MAX_FACTOR * params.MRSA.cap))), { MRSA: 17.62 });
  assert.equal(reduce(s, { type: 'nope' }), s);
});

test('set null restores CMS\'s value; for an assigned measure, back to no value', () => {
  assert.deepEqual(changesOf(apply(NO, set('CLABSI', 0.6), set('CLABSI', null))), {});
  const s = apply(ASSIGNED, set('SSI', 0.8));
  assert.deepEqual(changesOf(s), { SSI: 0.8 });
  assert.deepEqual(changesOf(reduce(s, set('SSI', null))), {});
});

test('set never lets through a change the engine would refuse: a measure the hospital lacks is ignored', () => {
  const partial = hospitals.find((h) => h.total !== null && scoredMeasures(h).length < 6);
  const missing = MEASURE_IDS.find((id) => partial.measures[id].z === null);
  const s = initialState(partial, model);
  assert.equal(reduce(s, set(missing, 0.5)), s);
});

test('reset returns to CMS\'s values and keeps the reader\'s predicted counts', () => {
  const s = apply(NO, set('CLABSI', 0.6), set('MRSA', 1.4), { type: 'predicted', id: 'CLABSI', count: 4 }, { type: 'reset' });
  assert.deepEqual(changesOf(s), {});
  assert.deepEqual(s.predicted, { CLABSI: 4 });
});

test('median: each submitted measure to min(value, median) at the display unit; never worse; assigned untouched', () => {
  for (const h of [NO, ASSIGNED, CAPPED]) {
    const s = apply(h, { type: 'median' });
    const changes = changesOf(s);
    for (const id of scoredMeasures(h)) {
      const m = h.measures[id];
      if (isAssigned(m)) {
        assert.equal(s.values[id], null, `${h.ccn} ${id}`);
        assert.ok(!(id in changes));
        continue;
      }
      assert.ok(s.values[id] <= m.value, `${h.ccn} ${id} worse`);
      assert.equal(s.values[id], Math.min(m.value, s.medians[id]), `${h.ccn} ${id}`);
    }
    assert.ok(whatIf(h, model, changes).after.score <= h.total);
  }
  // The median hospital is already there: no change.
  const mh = medianHospital(model, { fiscalYear: '2026', periods: SYNTH_PERIODS });
  assert.deepEqual(changesOf(apply(mh, { type: 'median' })), {});
});

test('median never worsens a measure the reader already lowered, nor touches an assigned one they filled', () => {
  const s = apply(ASSIGNED, set('CLABSI', 0.1), set('SSI', 1.5), { type: 'median' });
  assert.equal(s.values.CLABSI, 0.1);
  assert.equal(s.values.SSI, 1.5);
});

test('median, across every scored row in the file: never worse, assigned measures left alone', () => {
  for (const h of hospitals.filter((x) => x.total !== null)) {
    const s = apply(h, { type: 'median' });
    for (const id of scoredMeasures(h)) {
      const m = h.measures[id];
      if (isAssigned(m)) assert.equal(s.values[id], null);
      else assert.ok(s.values[id] <= m.value, `${h.ccn} ${id}`);
    }
    // And the engine accepts the result.
    whatIf(h, model, changesOf(s));
  }
});

test('predicted counts: SIRs only, finite and not negative; null clears; deltas are (after - before) x count', () => {
  let s = apply(NO, set('CLABSI', 0.6), set('MRSA', 1.4));
  s = reduce(s, { type: 'predicted', id: 'CLABSI', count: 5 });
  s = reduce(s, { type: 'predicted', id: 'MRSA', count: 2 });
  s = reduce(s, { type: 'predicted', id: 'CDI', count: 10 });
  for (const bad of [-1, NaN, Infinity, '3', undefined]) assert.equal(reduce(s, { type: 'predicted', id: 'CDI', count: bad }), s);
  assert.equal(reduce(s, { type: 'predicted', id: 'PSI90', count: 3 }), s);
  assert.equal(reduce(s, { type: 'predicted', id: 'NOPE', count: 3 }), s);
  const { counts } = viewModel(s, NO, model, ESTIMATE);
  assert.deepEqual(Object.keys(counts), ['CLABSI', 'CDI', 'MRSA']);
  assert.ok(Math.abs(counts.CLABSI.delta - (0.6 - 0.8) * 5) < 1e-12);
  assert.ok(Math.abs(counts.MRSA.delta - (1.4 - 0.9) * 2) < 1e-12);
  assert.equal(counts.CDI.delta, 0);
  assert.deepEqual(reduce(s, { type: 'predicted', id: 'CDI', count: null }).predicted, { CLABSI: 5, MRSA: 2 });
});

test('predicted counts give no delta for an assigned measure, which has no value of CMS\'s to start from', () => {
  let s = apply(ASSIGNED, { type: 'predicted', id: 'SSI', count: 3 });
  assert.deepEqual(viewModel(s, ASSIGNED, model, ESTIMATE).counts, {});
  s = reduce(s, set('SSI', 0.8));
  assert.deepEqual(viewModel(s, ASSIGNED, model, ESTIMATE).counts, {});
});

test('view model inputs: one per scored measure, with slider bounds, step, marks and valuetext', () => {
  const vm = viewModel(apply(CAPPED, set('CLABSI', 0.2)), CAPPED, model, ESTIMATE);
  assert.deepEqual(vm.inputs.map((i) => i.id), scoredMeasures(CAPPED));
  const clabsi = vm.inputs.find((i) => i.id === 'CLABSI');
  assert.deepEqual(clabsi, {
    id: 'CLABSI', value: 0.2, max: 1.887, step: 0.001, decimals: 3, median: 0.559, floor: 0, cap: 1.572, limit: 15.72,
    valuetext: '0.200', assigned: false, tagged: false,
  });
  const mrsa = vm.inputs.find((i) => i.id === 'MRSA');
  assert.equal(mrsa.max, 2.28); // max(1.9, cap) x 1.2
  assert.equal(mrsa.valuetext, '1.900, above the cap');
  const psi = vm.inputs.find((i) => i.id === 'PSI90');
  assert.equal(psi.step, 0.0001);
  assert.equal(psi.median, 0.9623);
  assert.equal(psi.tagged, true);
  assert.equal(psi.max, 1.6179); // cap 1.3482 x 1.2, rounded up to the unit

  // The slider's top follows the current value, so a typed or decoded value never sits above it.
  const typed = viewModel(apply(CAPPED, set('MRSA', 5)), CAPPED, model, ESTIMATE).inputs.find((i) => i.id === 'MRSA');
  assert.equal(typed.max, 6);
  const decoded = decode('#whatif&CLABSI=15.5', { ids: scoredMeasures(CAPPED), params }).changes;
  const fromLink = viewModel(apply(CAPPED, set('CLABSI', decoded.CLABSI)), CAPPED, model, ESTIMATE).inputs.find((i) => i.id === 'CLABSI');
  assert.equal(fromLink.max, 15.72, 'never past the limit: 15.5 x 1.2 is 18.6');
  assert.ok(fromLink.value <= fromLink.max);

  const atCap = viewModel(apply(NO, set('MRSA', params.MRSA.cap)), NO, model, ESTIMATE);
  assert.equal(atCap.inputs.find((i) => i.id === 'MRSA').valuetext, '1.762, at the cap');
});

test('view model input for an assigned measure: blank value, cap x 1.2, its own valuetext; a reader value fills it', () => {
  const vm = viewModel(initialState(ASSIGNED, model), ASSIGNED, model, ESTIMATE);
  const ssi = vm.inputs.find((i) => i.id === 'SSI');
  assert.equal(ssi.value, null);
  assert.equal(ssi.assigned, true);
  assert.equal(ssi.max, 2.542); // 2.118 x 1.2
  assert.equal(ssi.valuetext, 'no value: CMS assigned the worst score');
  const filled = viewModel(apply(ASSIGNED, set('SSI', 0.8)), ASSIGNED, model, ESTIMATE).inputs.find((i) => i.id === 'SSI');
  assert.equal(filled.value, 0.8);
  assert.equal(filled.valuetext, '0.800');
  assert.equal(filled.assigned, true);
  assert.equal(filled.max, 2.542);
  const high = viewModel(apply(ASSIGNED, set('SSI', 3)), ASSIGNED, model, ESTIMATE).inputs.find((i) => i.id === 'SSI');
  assert.equal(high.max, 3.6);
});

test('view model ramp: CMS\'s score, the hypothetical and the line', () => {
  const vm = viewModel(apply(NO, set('MRSA', 1.4)), NO, model, ESTIMATE);
  assert.deepEqual(vm.ramp, {
    actual: NO.total, hypothetical: vm.result.after.score, highestNo: model.boundary.highestNo, lowestYes: model.boundary.lowestYes,
  });
});

test('view model bars and estimate: one fixed scale per hospital; estimated once a tagged measure changed', () => {
  const base = viewModel(initialState(NO, model), NO, model, ESTIMATE);
  assert.ok(base.extent > 0);
  assert.equal(viewModel(apply(NO, set('MRSA', 3)), NO, model, ESTIMATE).extent, base.extent);
  assert.equal(base.estimated, false);
  assert.equal(viewModel(apply(NO, set('CLABSI', 0.6)), NO, model, ESTIMATE).estimated, false);
  assert.equal(viewModel(apply(NO, set('CDI', 0.3)), NO, model, ESTIMATE).estimated, true);
});

test('solver answers: solveMeasure for each scored measure, from CMS\'s values; none for Maryland or no score', () => {
  assert.deepEqual(solverOf(ASSIGNED, model), scoredMeasures(ASSIGNED).map((id) => solveMeasure(ASSIGNED, model, id)));
  assert.equal(solverOf(ASSIGNED, model).find((r) => r.id === 'SSI').note, 'assigned');
  const maryland = modelHospital(model, '990017', { values: SYNTH_VALUES.no, decision: 'N/A', state: 'MD' });
  assert.equal(solverOf(maryland, model), null);
  assert.equal(solverOf(hospitals.find((x) => x.total === null), model), null);
});

test('load: a link\'s changes on CMS\'s values, each through set; refused values dropped; predicted counts kept', () => {
  const s = apply(NO, set('CLABSI', 0.6), { type: 'predicted', id: 'CLABSI', count: 4 });
  const loaded = reduce(s, { type: 'load', changes: { MRSA: 1.4, PSI90: 1e9, NOPE: 1 } });
  assert.deepEqual(changesOf(loaded), { MRSA: 1.4 });
  assert.deepEqual(loaded.predicted, { CLABSI: 4 });
  assert.deepEqual(changesOf(reduce(s, { type: 'load', changes: {} })), {});
});

test('the rules dom.js runs: the starting state, the params a link decodes with, and the view model', () => {
  const rules = whatIfRules(NO, model, ESTIMATE);
  assert.deepEqual(rules.start, initialState(NO, model));
  assert.equal(rules.params, params);
  assert.deepEqual(rules.viewModel(rules.start), viewModel(rules.start, NO, model, ESTIMATE));
  assert.equal(rules.reduce, reduce);
  assert.equal(rules.changesOf, changesOf);
});

test('a hospital with no score: an empty view model, no inputs, no throw', () => {
  const h = hospitals.find((x) => x.total === null);
  const s = initialState(h, model);
  assert.equal(reduce(s, set('PSI90', 1)), s);
  const vm = viewModel(s, h, model, ESTIMATE);
  assert.equal(vm.result.available, false);
  assert.deepEqual([vm.inputs, vm.ramp, vm.counts], [[], null, {}]);
});

test('a tampered link opens on CMS\'s values, ignoring the bad parts, with no error', () => {
  const ids = scoredMeasures(ASSIGNED);
  const hash = '#whatif&CLABSI=abc&MRSA=-1&CDI=1e9&CAUTI=0.4&CAUTI=0.5&BOGUS=1&PSI90=0.9';
  const { changes, rejected } = decode(hash, { ids, params });
  assert.deepEqual(changes, { PSI90: 0.9 });
  assert.deepEqual(rejected.sort(), ['BOGUS', 'CAUTI', 'CDI', 'CLABSI', 'MRSA']);
  let s = initialState(ASSIGNED, model);
  for (const [id, value] of Object.entries(changes)) s = reduce(s, set(id, value));
  const vm = viewModel(s, ASSIGNED, model, ESTIMATE);
  assert.equal(vm.result.measures.CLABSI.afterValue, ASSIGNED.measures.CLABSI.value);
  assert.equal(vm.result.measures.PSI90.afterValue, 0.9);

  // Entirely bad: exactly CMS.
  const none = decode('#whatif&CLABSI=abc&SSI=-3', { ids, params });
  assert.deepEqual(none.changes, {});
  assert.deepEqual(viewModel(initialState(ASSIGNED, model), ASSIGNED, model, ESTIMATE).result, whatIf(ASSIGNED, model));
});

test('the NHSN predicted count never appears in the fragment', () => {
  let s = initialState(NO, model);
  s = reduce(s, { type: 'set', id: 'CLABSI', value: 0.6 });
  s = reduce(s, { type: 'predicted', id: 'CLABSI', count: 7.25 });
  s = reduce(s, { type: 'predicted', id: 'MRSA', count: 3.5 });
  const hash = encode(changesOf(s), s.ids);
  assert.equal(hash, '#whatif&CLABSI=0.6');
  assert.deepEqual(decode(hash, { ids: s.ids, params }).changes, changesOf(s));
  assert.doesNotMatch(hash, /7\.25|3\.5/);
});

test('reduce and decode accept the same range: whatever set keeps, a link carries', () => {
  for (const v of [0, 0.4, 1.762, 17.62, 17.621, 18, 1e25]) {
    const s = reduce(initialState(NO, model), { type: 'set', id: 'MRSA', value: v });
    assert.deepEqual(decode(encode(changesOf(s), s.ids), { ids: s.ids, params }).changes, changesOf(s), String(v));
  }
});

test('the slider never runs past the highest value a reader may set, which it can reach', () => {
  for (const id of scoredMeasures(NO)) {
    const p = params[id];
    const limit = initialState(NO, model).limits[id];
    for (const value of [0, p.cap, limit / 1.2 + 10 ** -p.decimals, limit]) {
      const input = viewModel(apply(NO, set(id, value)), NO, model, ESTIMATE).inputs.find((i) => i.id === id);
      assert.ok(input.max <= limit, `${id} ${value}: max ${input.max} > limit ${limit}`);
      assert.ok(input.value <= input.max, `${id} ${value}`);
    }
    const top = viewModel(apply(NO, set(id, limit)), NO, model, ESTIMATE).inputs.find((i) => i.id === id);
    assert.equal(top.max, limit, id);
  }
});
