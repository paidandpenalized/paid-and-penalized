// HACRP's rules for the shared what-if component (web/whatif/): its state, the actions reduce() takes, and the
// view model render.js and dom.js draw. The state holds the reader's values per scored measure (CMS's to begin
// with) and any NHSN predicted counts they type, which stay in the browser and never enter the fragment.
// reduce() only lets through values the engine accepts; viewModel() runs the engine and adds what the component
// draws: slider bounds and text, the ramp's scores, the bars' scale, the count deltas.
import { isAssigned, scoredMeasures } from '../../../engine/js/hacrp/hospital.js';
import { isSir } from '../../../engine/js/hacrp/measures.js';
import { solveMeasure } from '../../../engine/js/hacrp/solver.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { ceilToUnit, toUnit } from '../../../engine/js/stats.js';
import { decimal } from '../../../web/render/format.js';
import { limitOf } from '../../../web/whatif/fragment.js';
import { fill } from './copy.js';

const SLIDER_HEADROOM = 1.2;

const isValue = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;

// cms: CMS's value per scored measure (null where CMS assigned the score). medians: each measure's median at its
// display unit (the slider mark and the "bring all to the median" target). limits: the highest value a reader
// may set, the same range a link's fragment may carry.
export function initialState(hospital, model) {
  const ids = hospital.total === null ? [] : scoredMeasures(hospital);
  const cms = Object.fromEntries(ids.map((id) => [id, hospital.measures[id].value]));
  const pick = (f) => Object.fromEntries(ids.map((id) => [id, f(model.params[id])]));
  return {
    ids,
    cms,
    values: { ...cms },
    decimals: pick((p) => p.decimals),
    medians: pick((p) => toUnit(p.median, p.decimals)),
    limits: pick(limitOf),
    predicted: {},
  };
}

// The values that differ from CMS's: what the engine and the fragment take.
export function changesOf(state) {
  const out = {};
  for (const id of state.ids) {
    const v = state.values[id];
    if (v !== null && v !== state.cms[id]) out[id] = v;
  }
  return out;
}

const withValues = (state, values) => ({ ...state, values });

// Actions: set { id, value } (null restores CMS's value; above the limit is ignored), reset, median, predicted
// { id, count } (null clears), load { changes } (a link's values, each as a set, on CMS's values; predicted counts
// are kept). Anything the engine would refuse leaves the state unchanged (the same object).
export function reduce(state, action) {
  switch (action?.type) {
    case 'set': {
      const { id, value } = action;
      if (!state.ids.includes(id)) return state;
      if (value === null) return withValues(state, { ...state.values, [id]: state.cms[id] });
      if (!isValue(value)) return state;
      const v = toUnit(value, state.decimals[id]);
      if (v > state.limits[id]) return state;
      return withValues(state, { ...state.values, [id]: v });
    }
    case 'reset':
      return withValues(state, { ...state.cms });
    case 'load':
      return Object.entries(action.changes)
        .reduce((s, [id, value]) => reduce(s, { type: 'set', id, value }), withValues(state, { ...state.cms }));
    case 'median': {
      const values = { ...state.values };
      for (const id of state.ids) if (state.cms[id] !== null) values[id] = Math.min(values[id], state.medians[id]);
      return withValues(state, values);
    }
    case 'predicted': {
      const { id, count } = action;
      // NHSN publishes a predicted count for an SIR only.
      if (!state.ids.includes(id) || !isSir(id)) return state;
      if (count === null) {
        const { [id]: _, ...rest } = state.predicted;
        return { ...state, predicted: rest };
      }
      if (!isValue(count)) return state;
      return { ...state, predicted: { ...state.predicted, [id]: count } };
    }
    default:
      return state;
  }
}

function valuetext(value, p) {
  if (value === null) return fill('valueAssigned');
  const text = decimal(value, p.decimals);
  if (value === p.cap) return fill('valueAtCap', { value: text });
  if (value > p.cap) return fill('valueAboveCap', { value: text });
  return text;
}

// The widest part any measure could add or take away for this hospital (its z-score over n, at CMS's bounds or
// at the value CMS published), so the bars keep one scale while the reader changes values.
function barExtent(result, model) {
  let extent = 0;
  for (const [id, m] of Object.entries(result.measures)) {
    const p = model.params[id];
    extent = Math.max(extent, Math.abs(p.zMin), Math.abs(p.zMax), Math.abs(m.beforeZ));
  }
  return extent / result.n || 1;
}

// The view model (its shape is listed in web/whatif/render.js). estimate: the emitted per-measure { tagged } map.
export function viewModel(state, hospital, model, estimate) {
  const result = whatIf(hospital, model, changesOf(state));
  if (!result.available) return { result, ramp: null, inputs: [], counts: {} };

  const inputs = state.ids.map((id) => {
    const p = model.params[id];
    const value = state.values[id];
    return {
      id,
      value,
      // Follows the current value, so a typed or linked value never sits past the slider's end; rounded up to the
      // display unit, so the slider's top is a step it can reach; never past the highest value a reader may set.
      max: Math.min(state.limits[id], ceilToUnit(Math.max(value ?? 0, p.cap) * SLIDER_HEADROOM, p.decimals)),
      step: 1 / 10 ** p.decimals,
      decimals: p.decimals,
      median: state.medians[id],
      floor: p.floor,
      cap: p.cap,
      limit: state.limits[id],
      valuetext: valuetext(value, p),
      assigned: isAssigned(hospital.measures[id]),
      tagged: estimate[id].tagged,
    };
  });

  // Infections, from the reader's NHSN predicted count: SIR x predicted = observed. A measure CMS assigned has no
  // value of CMS's to count from.
  const counts = {};
  for (const id of state.ids) {
    if (!Object.hasOwn(state.predicted, id) || state.cms[id] === null) continue;
    counts[id] = { delta: (state.values[id] - state.cms[id]) * state.predicted[id] };
  }

  return {
    result,
    ramp: {
      actual: result.before.score,
      hypothetical: result.after.score,
      highestNo: model.boundary.highestNo,
      lowestYes: model.boundary.lowestYes,
    },
    inputs,
    counts,
    extent: barExtent(result, model),
    // A recomputed (estimate-tagged) measure changed: the result carries the estimate note.
    estimated: inputs.some((i) => i.tagged && result.measures[i.id].changed),
  };
}

// What web/whatif/dom.js runs for one hospital: the starting state, each measure's { decimals, cap } for decoding a
// link, and the state's functions.
export function whatIfRules(hospital, model, estimate) {
  return {
    start: initialState(hospital, model),
    params: model.params,
    reduce,
    changesOf,
    viewModel: (state) => viewModel(state, hospital, model, estimate),
  };
}

// The solver's answers (engine/js/hacrp/solver.js), one per scored measure, from the starting values: they never
// follow the reader's edits. null where there is nothing to solve for: no score, or Maryland, which is not subject
// to the reduction. Build time only; the browser never needs them.
export function solverOf(hospital, model) {
  const ids = hospital.total === null ? [] : scoredMeasures(hospital);
  const rows = ids.map((id) => solveMeasure(hospital, model, id));
  return rows.some((r) => r.note !== 'not-applicable') ? rows : null;
}
