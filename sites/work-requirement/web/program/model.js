// The page's dollars and counts by case, the numbers every step prints, at the default use rate and under the what-if.
// Shared by the build and the browser. Pure: no DOM, file or clock.
//
// Totals: by case (constants.js SCENARIOS), an object with the emitted file's roll-up keys (TOTAL_KEYS): the dollars
// and counts are `national`'s; medicaid_revenue (the worksheet's first line) is `groups.expansion_states`'s, the
// Medicaid revenue of the hospitals the scenario reaches. The two roll-ups' dollars and counts are the same (no
// hospital outside a scenario state loses anything), so the engine's roll-up of the scenario hospitals alone gives
// every total at another use rate (totalsAt). At the default use rate the page prints the file's own (serverTotals).
import { rollUp } from '../../../../engine/js/medicaid/rollup.js';
import { scenario } from '../../../../engine/js/medicaid/scenario.js';
import { SCENARIOS } from '../constants.js';

export const TOTAL_KEYS = Object.freeze(['at_risk', 'lost', 'lost_cost', 'added_uncompensated', 'care_avoided', 'other_coverage', 'income_change', 'falls_1pp', 'into_red', 'medicaid_revenue']);

const byCase = (fn) => Object.fromEntries(SCENARIOS.map((s) => [s, fn(s)]));
const pick = (roll) => Object.fromEntries(TOTAL_KEYS.map((k) => [k, roll[k]]));

// The file's totals. data: loadMedicaid()'s result.
export const serverTotals = (data) => byCase((s) => ({ ...pick(data.national[s]), medicaid_revenue: data.groups.expansion_states[s].medicaid_revenue }));

// The low and high ends of the states' enrollment declines in each case, among the states with a scenario.
export function declineRange(states) {
  const scen = Object.values(states).filter((st) => st.cls === 'scenario');
  return byCase((s) => {
    const d = scen.map((st) => st.declines[s]);
    return [Math.min(...d), Math.max(...d)];
  });
}

// ---------- the what-if's base ----------

// What the engine reads of each scenario hospital (engine/js/medicaid/scenario.js and rollup.js), plus its state, whose
// declines the asset carries once.
export const BASE_COLS = Object.freeze(['state', 'share', 'medicaid_net_revenue', 'scored', 'cost_ratio', 'has_margin', 'net_patient_revenue',
  'net_income_patients', 'other_operating_income', 'net_income', 'other_income', 'uncompensated_cost', 'margin_outlier']);

// The browser's copy of the scenario hospitals, for the what-if: { cols: BASE_COLS, declines: { state: { case: decline } },
// rows: each hospital's BASE_COLS values }. Only hospitals in a scenario state (class 'scenario'): the rest lose nothing.
export function baseAsset(data) {
  const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  const rows = [...data.hospitals.values()].filter((row) => row[col.cls] === 'scenario');
  const states = [...new Set(rows.map((row) => row[col.state]))].sort();
  return {
    cols: BASE_COLS,
    declines: Object.fromEntries(states.map((st) => [st, data.states[st].declines])),
    rows: rows.map((row) => BASE_COLS.map((name) => row[col[name]])),
  };
}

// The asset back as engine bases: { bases: [{ ...BASE_COLS }], declines }. Throws on anything the build did not write.
export function decodeBase(asset) {
  if (!asset || asset.cols?.join() !== BASE_COLS.join() || !Array.isArray(asset.rows) || !asset.declines || typeof asset.declines !== 'object') {
    throw new TypeError('what-if asset: not what the build wrote');
  }
  const bases = asset.rows.map((row) => Object.fromEntries(BASE_COLS.map((name, i) => [name, row[i]])));
  if (!bases.every((b) => asset.declines[b.state])) throw new TypeError('what-if asset: a hospital\'s state has no declines');
  return { bases, declines: asset.declines };
}

// The engine's roll-up of a roll-up's camelCase keys back to the file's (falls1pp is falls_1pp).
const SNAKE = { atRisk: 'at_risk', lost: 'lost', lostCost: 'lost_cost', addedUncompensated: 'added_uncompensated', careAvoided: 'care_avoided',
  otherCoverage: 'other_coverage', incomeChange: 'income_change', falls1pp: 'falls_1pp', intoRed: 'into_red', medicaidRevenue: 'medicaid_revenue' };

// The totals at a use rate, by case, through the engine (every scenario hospital, then the roll-up). base: decodeBase's.
export function totalsAt({ bases, declines }, use) {
  return byCase((s) => {
    const roll = rollUp(bases.map((b) => [b, scenario(b, b.share, declines[b.state][s], { use })]));
    return Object.fromEntries(Object.entries(SNAKE).map(([camel, key]) => [key, roll[camel]]));
  });
}
