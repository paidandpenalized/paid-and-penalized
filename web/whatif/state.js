// The what-if's state and view model. The state holds the reader's values per scored measure (CMS's to begin
// with) and any NHSN predicted counts they type, which stay in the browser and never enter the fragment.
// reduce() only lets through values the engine accepts; viewModel() runs the engine and adds what the
// component draws: slider bounds and text, the ramp, the solver, the count deltas.
import { isAssigned, scoredMeasures } from '../../engine/js/hacrp/hospital.js';
import { solveMeasure } from '../../engine/js/hacrp/solver.js';
import { whatIf } from '../../engine/js/hacrp/whatif.js';
import { fillCopy } from '../render/components.js';
import { decimal } from '../render/format.js';
import { COPY } from '../copy.js';
import { limitOf, toUnit } from './fragment.js';

// Measures reported as an SIR, for which NHSN publishes a predicted infection count. PSI 90 is not one.
const NOT_SIR = new Set(['PSI90']);
const SLIDER_HEADROOM = 1.2;

const isValue = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
// x rounded up to the display unit, float noise snapped first, so the slider's top is a step it can reach.
const ceilToUnit = (x, decimals) => Math.ceil(Number((x * 10 ** decimals).toPrecision(9))) / 10 ** decimals;

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

// Actions: set { id, value } (null restores CMS's value; above the limit is ignored), reset, median, predicted { id, count } (null clears).
// Anything the engine would refuse leaves the state unchanged (the same object).
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
    case 'median': {
      const values = { ...state.values };
      for (const id of state.ids) if (state.cms[id] !== null) values[id] = Math.min(values[id], state.medians[id]);
      return withValues(state, values);
    }
    case 'predicted': {
      const { id, count } = action;
      if (!state.ids.includes(id) || NOT_SIR.has(id)) return state;
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

// The score's reach for this hospital: each measure's z can move between CMS's best and worst z (or stay past
// them, where CMS published a value beyond a bound). Fixed per hospital, so the axis doesn't rescale as the
// reader drags.
function ramp(result, hospital, model) {
  let lo = 0;
  let hi = 0;
  for (const [id, m] of Object.entries(result.measures)) {
    const p = model.params[id];
    lo += Math.min(p.zMin, m.beforeZ) - m.beforeZ;
    hi += Math.max(p.zMax, m.beforeZ) - m.beforeZ;
  }
  const total = hospital.total;
  return {
    min: total + lo / result.n,
    max: total + hi / result.n,
    actual: result.before.score,
    hypothetical: result.after.score,
    highestNo: model.boundary.highestNo,
    lowestYes: model.boundary.lowestYes,
  };
}

function valuetext(value, p) {
  if (value === null) return fillCopy(COPY, 'valueAssigned');
  const text = decimal(value, p.decimals);
  if (value === p.cap) return fillCopy(COPY, 'valueAtCap', { value: text });
  if (value > p.cap) return fillCopy(COPY, 'valueAboveCap', { value: text });
  return text;
}

// estimate: the emitted per-measure { tagged } map.
export function viewModel(state, hospital, model, estimate) {
  const result = whatIf(hospital, model, changesOf(state));
  if (!result.available) return { result, solver: [], ramp: null, inputs: [], counts: {} };

  const inputs = state.ids.map((id) => {
    const p = model.params[id];
    const value = state.values[id];
    return {
      id,
      value,
      min: 0,
      // Follows the current value, so a typed or linked value never sits past the slider's end.
      max: ceilToUnit(Math.max(value ?? 0, p.cap) * SLIDER_HEADROOM, p.decimals),
      step: 1 / 10 ** p.decimals,
      median: state.medians[id],
      cap: p.cap,
      deadZoneFrom: p.cap,
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
    solver: state.ids.map((id) => solveMeasure(hospital, model, id)),
    ramp: ramp(result, hospital, model),
    inputs,
    counts,
  };
}
