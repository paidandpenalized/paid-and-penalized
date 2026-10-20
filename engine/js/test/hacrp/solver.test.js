import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../hacrp/measures.js';
import { scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { whatIf } from '../../hacrp/whatif.js';
import { solveMeasure } from '../../hacrp/solver.js';
import { loadHacrp, submittedPairs as pairsWhere } from './helpers.js';

const { hospitals, model } = loadHacrp();
const submittedPairs = (flag) => pairsWhere(hospitals, (h) => h.paymentReduction === flag);
const unit = (id) => 10 ** -model.params[id].decimals;
const flagAt = (h, id, value) => whatIf(h, model, { [id]: value }).after.flag;

test('"What would it take": every possible answer, as rounded for display, lands on No', () => {
  const pairs = submittedPairs('Yes');
  let checked = 0;
  for (const { h, id } of pairs) {
    const r = solveMeasure(h, model, id);
    assert.equal(r.kind, 'needed');
    if (!r.possible) continue;
    assert.equal(flagAt(h, id, r.value), 'No', `${h.ccn} ${id} ${r.value}`);
    checked++;
  }
  assert.ok(checked > 0);
});

test('"What would it take" is tight: one display unit higher is not No', () => {
  for (const { h, id } of submittedPairs('Yes')) {
    const r = solveMeasure(h, model, id);
    if (!r.possible) continue;
    assert.notEqual(flagAt(h, id, r.value + unit(id)), 'No', `${h.ccn} ${id} ${r.value}`);
  }
});

test('"How much cushion": the answer keeps No, one display unit more does not; unlimited never crosses', () => {
  let limited = 0;
  for (const { h, id } of submittedPairs('No')) {
    const r = solveMeasure(h, model, id);
    assert.equal(r.kind, 'cushion');
    if (r.unlimited) {
      assert.equal(flagAt(h, id, model.params[id].cap * 2), 'No', `${h.ccn} ${id}`);
      continue;
    }
    if (r.note === 'no-cushion') continue;
    limited++;
    assert.equal(flagAt(h, id, r.value), 'No', `${h.ccn} ${id} ${r.value}`);
    assert.notEqual(flagAt(h, id, r.value + unit(id)), 'No', `${h.ccn} ${id} ${r.value}`);
  }
  assert.ok(limited > 0);
});

test('FY2026 has "not possible with this measure alone" answers and unlimited cushions', () => {
  const results = submittedPairs('Yes').map(({ h, id }) => solveMeasure(h, model, id));
  assert.ok(results.some((r) => !r.possible));
  assert.ok(submittedPairs('No').some(({ h, id }) => solveMeasure(h, model, id).unlimited));
  for (const r of results.filter((x) => !x.possible)) assert.equal(r.value, null);
});

test('assigned measures, Maryland and unscored rows get notes, not answers; unknown measures throw', () => {
  const assignedRow = hospitals.find((h) => h.total !== null && h.paymentReduction !== 'N/A' && scoredMeasures(h).some((id) => isAssigned(h.measures[id])));
  const aid = scoredMeasures(assignedRow).find((id) => isAssigned(assignedRow.measures[id]));
  assert.deepEqual(solveMeasure(assignedRow, model, aid), { kind: null, id: aid, possible: false, value: null, unlimited: false, note: 'assigned' });

  const md = hospitals.find((h) => h.total !== null && h.paymentReduction === 'N/A');
  assert.equal(solveMeasure(md, model, scoredMeasures(md)[0]).note, 'not-applicable');

  const unscored = hospitals.find((h) => h.total === null);
  assert.equal(solveMeasure(unscored, model, 'PSI90').note, 'not-applicable');

  const partial = hospitals.find((h) => h.total !== null && h.paymentReduction !== 'N/A' && scoredMeasures(h).length < 6);
  const missing = MEASURE_IDS.find((id) => partial.measures[id].z === null);
  assert.throws(() => solveMeasure(partial, model, missing), RangeError);
});

test('cushion: a No hospital whose measure is already at or above the cap has unlimited room on it', () => {
  const pairs = submittedPairs('No').filter(({ h, id }) => h.measures[id].value >= model.params[id].cap);
  assert.ok(pairs.length > 0);
  for (const { h, id } of pairs) assert.equal(solveMeasure(h, model, id).unlimited, true, `${h.ccn} ${id}`);
});

test('"no-cushion" only when the measure is below the cap and the answer is below the current value', () => {
  for (const { h, id } of submittedPairs('No')) {
    const r = solveMeasure(h, model, id);
    if (r.note !== 'no-cushion') continue;
    assert.ok(h.measures[id].value < model.params[id].cap && r.value < h.measures[id].value, `${h.ccn} ${id}`);
  }
});
