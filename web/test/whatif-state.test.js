import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAssigned, scoredMeasures } from '../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../engine/js/hacrp/measures.js';
import { medianHospital } from '../../engine/js/hacrp/median.js';
import { solveMeasure } from '../../engine/js/hacrp/solver.js';
import { whatIf } from '../../engine/js/hacrp/whatif.js';
import { loadHacrp } from '../../engine/js/test/hacrp/helpers.js';
import { modelHospital } from '../../engine/js/test/hacrp/synthetic.js';
import { decode } from '../whatif/fragment.js';
import { changesOf, initialState, reduce, viewModel } from '../whatif/state.js';

const { hospitals, model } = loadHacrp();
const { params } = model;
const ESTIMATE = Object.fromEntries(MEASURE_IDS.map((id) => [id, { tagged: id === 'PSI90' || id === 'CDI', maxError: 0.001 }]));
const VALUES = { PSI90: 1.0, CLABSI: 0.8, CAUTI: 0.6, SSI: 0.9, CDI: 0.5, MRSA: 0.9 };
const NO = modelHospital(model, '990011', { values: VALUES });
const ASSIGNED = modelHospital(model, '990016', { values: { ...VALUES, SSI: 'assigned' } });
const CAPPED = modelHospital(model, '990013', { values: { PSI90: 0.75, CLABSI: 0.3, CAUTI: 0.2, SSI: 0.5, CDI: 0.2, MRSA: 1.9 } });
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
  const mh = medianHospital(model);
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
    id: 'CLABSI', value: 0.2, min: 0, max: 1.887, step: 0.001, median: 0.559, cap: 1.572, deadZoneFrom: 1.572,
    valuetext: '0.200', assigned: false, tagged: false,
  });
  const mrsa = vm.inputs.find((i) => i.id === 'MRSA');
  assert.equal(mrsa.max, 2.28); // max(1.9, cap) x 1.2
  assert.equal(mrsa.valuetext, '1.900, above CMS\'s cap');
  const psi = vm.inputs.find((i) => i.id === 'PSI90');
  assert.equal(psi.step, 0.0001);
  assert.equal(psi.median, 0.9623);
  assert.equal(psi.tagged, true);
  assert.equal(psi.max, 1.6179); // cap 1.3482 x 1.2, rounded up to the unit

  const atCap = viewModel(apply(NO, set('MRSA', params.MRSA.cap)), NO, model, ESTIMATE);
  assert.equal(atCap.inputs.find((i) => i.id === 'MRSA').valuetext, '1.762, at CMS\'s cap');
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
});

test('view model ramp: CMS\'s score, the hypothetical, the line, inside a fixed axis for the hospital', () => {
  const base = viewModel(initialState(NO, model), NO, model, ESTIMATE).ramp;
  const vm = viewModel(apply(NO, set('MRSA', 1.4)), NO, model, ESTIMATE);
  assert.equal(vm.ramp.actual, NO.total);
  assert.equal(vm.ramp.hypothetical, vm.result.after.score);
  assert.equal(vm.ramp.highestNo, model.boundary.highestNo);
  assert.equal(vm.ramp.lowestYes, model.boundary.lowestYes);
  assert.equal(vm.ramp.min, base.min);
  assert.equal(vm.ramp.max, base.max);
  // The axis spans every score the inputs can reach.
  const best = whatIf(NO, model, Object.fromEntries(scoredMeasures(NO).map((id) => [id, 0])));
  const worst = whatIf(NO, model, Object.fromEntries(scoredMeasures(NO).map((id) => [id, params[id].cap * 2])));
  assert.ok(Math.abs(vm.ramp.min - best.after.score) < 1e-12);
  assert.ok(Math.abs(vm.ramp.max - worst.after.score) < 1e-12);
  for (const x of [vm.ramp.actual, vm.ramp.hypothetical, vm.ramp.highestNo, vm.ramp.lowestYes]) {
    assert.ok(x >= vm.ramp.min && x <= vm.ramp.max);
  }
});

test('view model solver: solveMeasure for each scored measure, from CMS\'s values whatever the reader changed', () => {
  const vm = viewModel(apply(ASSIGNED, set('CLABSI', 0.1)), ASSIGNED, model, ESTIMATE);
  assert.deepEqual(vm.solver, scoredMeasures(ASSIGNED).map((id) => solveMeasure(ASSIGNED, model, id)));
  assert.equal(vm.solver.find((r) => r.id === 'SSI').note, 'assigned');
});

test('a hospital with no score: an empty view model, no inputs, no throw', () => {
  const h = hospitals.find((x) => x.total === null);
  const s = initialState(h, model);
  assert.equal(reduce(s, set('PSI90', 1)), s);
  const vm = viewModel(s, h, model, ESTIMATE);
  assert.equal(vm.result.available, false);
  assert.deepEqual([vm.inputs, vm.solver, vm.ramp, vm.counts], [[], [], null, {}]);
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
