// The program page's shared state: one object every step reads and redraws from, so the scenario switch, the use-rate
// what-if and the page's hospital move every step together.
//
//   scenario  'low' | 'middle' | 'high' (constants.js SCENARIOS), the case the page shows
//   use       the what-if's use rate, a multiple (0.75 to 1.25; 1 is the default)
//   hospital  the page's hospital: a row of the strips' asset ({ ccn, name, city, state, cls, groups, share }), or null
//   totals    the national totals by case at that use rate (web/program/model.js: the file's own at 1, the engine's
//             roll-up otherwise)
//   stateCode step 3's selected state or territory, a postal code (web/program/states.js; the most exposed state at first)
//
// store.get() gives the state (frozen); store.set(patch) changes some keys and calls each subscriber with
// (state, changed), changed being the Set of keys whose values changed (nothing is called when none did);
// store.subscribe(fn) adds a subscriber and returns the function that removes it.
import { SCENARIOS } from '../web/constants.js';

const KEYS = ['scenario', 'use', 'hospital', 'totals', 'stateCode'];

export function createStore(initial) {
  const check = (patch) => {
    for (const key of Object.keys(patch)) if (!KEYS.includes(key)) throw new RangeError(`page state: no key "${key}"`);
    if ('scenario' in patch && !SCENARIOS.includes(patch.scenario)) throw new RangeError(`page state: no case "${patch.scenario}"`);
  };
  check(initial);
  let state = Object.freeze({ ...initial });
  const subscribers = new Set();
  return {
    get: () => state,
    set(patch) {
      check(patch);
      const changed = new Set(Object.keys(patch).filter((key) => !Object.is(patch[key], state[key])));
      if (!changed.size) return;
      state = Object.freeze({ ...state, ...patch });
      for (const fn of subscribers) fn(state, changed);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

// The keys of server ({ key: value as the server drew it }) whose value state no longer has: what a step mounted after the
// reader moved the page's state redraws at once, as a change it missed.
export const movedFrom = (state, server) => new Set(Object.keys(server).filter((key) => !Object.is(state[key], server[key])));
