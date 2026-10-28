// The hospital page's factor what-if as pure state: what a reader may set, the actions that change it, the dollars that
// follow (engine/js/dollars/whatif.js programDollars), and the URL fragment a shared link carries (web/whatif/fragment.js's
// form, #whatif&hrrp=0.9978&hac=1&hvbp=1.0022). No DOM: hub/client/hospital/whatif.js draws it.
//
// The state is { hrrp, hvbp, hac }: the Readmissions and value-based purchasing payment factors and whether the
// hospital-acquired conditions cut applies. A factor the reader sets keeps four decimals (CMS prints Readmissions' to
// four); one that reads the same as the hospital's actual factor to four decimals is the actual factor, so stepping back
// or typing the factor shown leaves the page unchanged. A program the hospital is not in cannot be adjusted.
import { programDollars } from '../../../engine/js/dollars/whatif.js';
import { has } from '../../../engine/js/has.js';
import { median } from '../../../engine/js/peers.js';
import { toUnit } from '../../../engine/js/stats.js';
import { decode, encode, isScenarioHash } from '../../../web/whatif/fragment.js';
import { HRRP_CAP_PCT, VBP_WITHHOLD_PCT } from '../../../web/programs.js';
import { inProgram } from '../../hospital/peers.js';

// The fragment's ids, in the page's order (and the state's keys).
export const IDS = Object.freeze(['hrrp', 'hac', 'hvbp']);
// A factor's decimals, and the arrow keys' steps (Shift for the bigger one).
const DP = 4;
export const STEP = 0.0005;
export const BIG_STEP = 0.005;
// Each factor: its key in a dollar row, and the page row (program) that lists it.
const FACTOR = Object.freeze({ hrrp: { key: 'hrrpFactor', row: 'hrrp' }, hvbp: { key: 'vbpFactor', row: 'hvbp' } });
// What decode() reads for each id: a factor to four decimals; the cut as 0 or 1 (checked again below, as written).
const PARAMS = Object.freeze({ hrrp: { decimals: DP, cap: 1 }, hvbp: { decimals: DP, cap: 1 }, hac: { decimals: 0, cap: 0.1 } });
// Two factors this close are the same factor (the dollar file prints ten decimals).
const SAME = 1e-9;

const round4 = (x) => toUnit(x, DP);
const floor4 = (x) => Math.floor(x * 10 ** DP + SAME) / 10 ** DP;
const clamp = (x, [lo, hi]) => (x < lo ? lo : x > hi ? hi : x);
const same = (a, b) => Math.abs(a.hrrp - b.hrrp) < SAME && Math.abs(a.hvbp - b.hvbp) < SAME && a.hac === b.hac;

// What a reader may set for h: { hrrp: [0.97, 1], hvbp: [0.98, vbpMax] }, each null when h is not in the program.
// Readmissions reaches its cap (HRRP_CAP_PCT); value-based purchasing runs from the whole withhold kept
// (VBP_WITHHOLD_PCT) to vbpMax, the highest factor of any hospital in the data, floored to the four decimals a set factor
// keeps.
export function ranges(h, { vbpMax }) {
  const { est } = h;
  const vbpLo = round4(1 - VBP_WITHHOLD_PCT / 100);
  return {
    hrrp: inProgram(est, 'hrrp') ? [round4(1 - HRRP_CAP_PCT / 100), 1] : null,
    hvbp: inProgram(est, 'hvbp') && Number.isFinite(vbpMax) ? [vbpLo, Math.max(vbpLo, floor4(vbpMax))] : null,
  };
}

// The actual state: h's own factors and cut, as CMS's files have them.
export const initial = (h) => ({ hrrp: h.est.hrrpFactor, hvbp: h.est.vbpFactor, hac: h.est.cut });

// A factor to four decimals, or the actual factor when it reads the same.
const settle = (x, actual) => (round4(x) === round4(actual) ? actual : round4(x));

// A value for id that h may take, normalized (a factor in its range, settled; the cut as true or false), or null.
function accept(id, value, h, rng) {
  if (id === 'hac') return value === 1 || value === true ? true : value === 0 || value === false ? false : null;
  const r = has(FACTOR, id) ? rng[id] : null;
  if (!r || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const actual = initial(h)[id];
  if (round4(value) === round4(actual)) return actual;
  return value >= r[0] && value <= r[1] ? settle(value, actual) : null;
}

// The peers' median for id, as a patch of the state, or null when there is none: a factor among the peers the program
// lists (h among them), clamped to h's range; the cut when most peers are cut.
function medianPatch(id, h, rng, peers) {
  if (id === 'hac') return peers.length ? { hac: peers.filter((p) => p.est.cut).length > peers.length / 2 } : null;
  const f = has(FACTOR, id) ? FACTOR[id] : null;
  if (!f || !rng[id]) return null;
  const m = median(peers.filter((p) => inProgram(p.est, f.row)).map((p) => p.est[f.key]));
  return m === null ? null : { [id]: settle(clamp(m, rng[id]), initial(h)[id]) };
}

// The next state after action, given ctx { h, vbpMax, peers } (peers: h's group, for the medians). Actions:
//   { type: 'set', id, value }   a factor, clamped to the range
//   { type: 'step', id, dir, big } a step of STEP (BIG_STEP when big) down (dir < 0) or up, clamped
//   { type: 'hac', cut }         the cut on (true) or off
//   { type: 'median', id }       the peers' median for id ('hrrp', 'hvbp' or 'hac'); { type: 'medianAll' } all three
//   { type: 'reset' }            the actual state
//   { type: 'load', changes }    { hrrp?, hvbp?, hac? } from a link: each valid value loads, the rest are dropped
// An action that changes nothing, or that h cannot take (a program it is not in, a value that is not a number), returns
// the same state object.
export function reduce(state, action, ctx) {
  const { h, peers = [] } = ctx;
  const rng = ranges(h, ctx);
  const put = (patch) => {
    const next = { ...state, ...patch };
    return same(next, state) ? state : next;
  };
  const id = action?.id;
  const r = has(FACTOR, id) ? rng[id] : null;
  switch (action?.type) {
    case 'set':
      return r && Number.isFinite(action.value) ? put({ [id]: settle(clamp(action.value, r), initial(h)[id]) }) : state;
    case 'step': {
      const dir = Math.sign(action.dir);
      if (!r || !dir) return state;
      const next = settle(clamp(state[id] + dir * (action.big ? BIG_STEP : STEP), r), initial(h)[id]);
      // Never a step the wrong way (an actual factor past the range's four-decimal end).
      return (next - state[id]) * dir > 0 ? put({ [id]: next }) : state;
    }
    case 'hac':
      return typeof action.cut === 'boolean' ? put({ hac: action.cut }) : state;
    case 'median':
      return put(medianPatch(id, h, rng, peers) ?? {});
    case 'medianAll':
      return put(Object.assign({}, ...IDS.map((k) => medianPatch(k, h, rng, peers) ?? {})));
    case 'reset':
      return put(initial(h));
    case 'load': {
      const patch = {};
      for (const k of IDS) {
        const v = has(action.changes ?? {}, k) ? accept(k, action.changes[k], h, rng) : null;
        if (v !== null) patch[k] = v;
      }
      return put(patch);
    }
    default:
      return state;
  }
}

// Whether state differs from h's actual factors and cut.
export const changed = (state, h) => !same(state, initial(h));

// The fragment for state: only the changed values, in the page's order ('#whatif&hrrp=0.9978&hac=1&hvbp=1.0022'), or ''.
export function toHash(state, h) {
  const actual = initial(h);
  const changes = {};
  if (Math.abs(state.hrrp - actual.hrrp) >= SAME) changes.hrrp = state.hrrp;
  if (state.hac !== actual.hac) changes.hac = state.hac ? 1 : 0;
  if (Math.abs(state.hvbp - actual.hvbp) >= SAME) changes.hvbp = state.hvbp;
  return encode(changes, IDS);
}

// A link's fragment read for h: { state, rejected }. Each part is read on its own (decode), and the first valid value of
// each id loads: a factor in h's range for a program it is in, the cut written exactly 0 or 1. rejected names every id
// (or other key) with a part that was dropped, once. Never throws; anything else is h's actual state.
export function fromHash(hash, h, ctx) {
  const start = initial(h);
  if (!isScenarioHash(hash)) return { state: start, rejected: [] };
  const rng = ranges(h, ctx);
  const changes = {};
  const rejected = new Set();
  for (const part of hash.slice(1).split('&').slice(1)) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const read = decode(`#whatif&${part}`, { ids: IDS, params: PARAMS }).changes;
    const exact = key !== 'hac' || /^[01]$/.test(part.slice(eq + 1));
    const value = exact && has(read, key) && !has(changes, key) ? accept(key, read[key], h, rng) : null;
    if (value === null) rejected.add(key);
    else changes[key] = value;
  }
  return { state: reduce(start, { type: 'load', changes }, { ...ctx, h }), rejected: [...rejected] };
}

// The scenario's dollars for h (programDollars): { hrrp, hvbp, hac, net, after, atStake }. The actual state gives the
// dollar file's own figures.
export const outcome = (state, h) => programDollars(h.est, { hrrpFactor: state.hrrp, vbpFactor: state.hvbp, cut: state.hac });
