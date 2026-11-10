// Medicaid work-requirement scenario, steps 1 to 4 for one hospital: the browser twin of
// engine/py/pp_engine/medicaid/exposure.py (`scenario`) and params.py. Pure: no imports, DOM, fs or clock.
// Conformance: schemas/conformance/medicaid.vectors.json, built by the Python engine, must match within 1e-6.
//
// Input base: an object with the field names of the emitted file's `columns`
// (data/emitted/medicaid/fy2023/medicaid.json), which are Python's own base keys (snake_case). `rowToBase(columns, row)`
// zips one decoded hospital row into such an object. Fields read: medicaid_net_revenue, revenue_line2_5, scored,
// scored_line2_5, cost_ratio, cost_ratio_line2_5, has_margin, net_patient_revenue, net_income_patients,
// other_operating_income, net_income, other_income, uncompensated_cost.
//
// Output names: Python's result keys in camelCase (underscore dropped, next character capitalized):
//   at_risk atRisk · lost · lost_cost lostCost · added_uncompensated addedUncompensated · care_avoided careAvoided ·
//   other_coverage otherCoverage · income_change incomeChange · operating_revenue operatingRevenue ·
//   operating_income operatingIncome · operating_revenue_after operatingRevenueAfter ·
//   operating_income_after operatingIncomeAfter · net_patient_revenue_after netPatientRevenueAfter ·
//   net_income_after netIncomeAfter · operating_margin operatingMargin · operating_margin_after operatingMarginAfter ·
//   total_margin totalMargin · total_margin_after totalMarginAfter · uncompensated_change uncompensatedChange.
// Margin and "after" fields are null when the base has no usable patient revenue (has_margin false).

// params.py's method constants the arithmetic uses (a change there is a methods change; conformance catches drift).
export const PARAMS = Object.freeze({
  uninsuredShare: 0.93,
  careStillUsed: 0.56,
  useMin: 0.75,
  useDefault: 1.0,
  useMax: 1.25,
});

/** Zips one hospital row (array, in `columns` order) into a base object keyed by the column names. */
export function rowToBase(columns, row) {
  if (columns.length !== row.length) throw new RangeError(`row has ${row.length} cells for ${columns.length} columns`);
  const base = {};
  columns.forEach((name, i) => { base[name] = row[i]; });
  return base;
}

const isNone = (v) => v === null || v === undefined;

function margin(income, revenue) {
  return isNone(income) || isNone(revenue) || revenue <= 0 ? null : income / revenue;
}

/** Step 1: the Medicaid revenue base times the expansion share; 0 when the base is missing or not positive. */
function revenueAtRisk(base, share, line2_5) {
  const revenue = line2_5 ? base.revenue_line2_5 : base.medicaid_net_revenue;
  const scored = line2_5 ? base.scored_line2_5 : base.scored;
  if (isNone(share) || !scored || isNone(revenue) || revenue <= 0) return 0;
  if (!(share >= 0 && share <= 1)) throw new RangeError(`VIII share ${share} outside 0..1`);
  return revenue * share;
}

/**
 * Steps 1 to 4. `share`: the hospital's expansion share (null: no expansion group); `decline`: the state's
 * expansion-enrollment decline for the scenario, a fraction; `use`: the reader's use multiple.
 */
export function scenario(base, share, decline, { use = PARAMS.useDefault, line2_5 = false } = {}) {
  if (!(use >= PARAMS.useMin && use <= PARAMS.useMax)) {
    throw new RangeError(`use multiple ${use} outside ${PARAMS.useMin}..${PARAMS.useMax}`);
  }
  if (!(decline >= 0 && decline <= 1)) throw new RangeError(`enrollment decline ${decline} outside 0..1`);
  const atRisk = revenueAtRisk(base, share, line2_5);
  const lost = atRisk * decline * use;
  const ratio = (line2_5 ? base.cost_ratio_line2_5 : base.cost_ratio) || 0;
  const lostCost = lost * ratio;
  const uninsured = lostCost * PARAMS.uninsuredShare;
  const addedUc = uninsured * PARAMS.careStillUsed;
  const avoided = uninsured - addedUc;
  const replaced = lostCost - uninsured;
  const incomeChange = -lost + replaced + avoided;
  const out = {
    atRisk, lost, lostCost, addedUncompensated: addedUc, careAvoided: avoided, otherCoverage: replaced, incomeChange,
  };
  const npr = base.net_patient_revenue;
  const oth = base.other_income || 0;
  const oo = base.other_operating_income || 0;
  if (base.has_margin) {
    const nprAfter = npr - lost + replaced;
    const ni = base.net_income;
    const niAfter = isNone(ni) ? null : ni + incomeChange;
    const rev = npr + oo;
    const inc = base.net_income_patients + oo;
    const revAfter = nprAfter + oo;
    const incAfter = inc + incomeChange;
    Object.assign(out, {
      operatingRevenue: rev, operatingIncome: inc, operatingRevenueAfter: revAfter, operatingIncomeAfter: incAfter,
      netPatientRevenueAfter: nprAfter, netIncomeAfter: niAfter,
      operatingMargin: margin(inc, rev), operatingMarginAfter: margin(incAfter, revAfter),
      totalMargin: margin(ni, npr + oth), totalMarginAfter: isNone(ni) ? null : margin(niAfter, nprAfter + oth),
    });
  } else {
    for (const k of ['operatingRevenue', 'operatingIncome', 'operatingRevenueAfter', 'operatingIncomeAfter',
      'netPatientRevenueAfter', 'netIncomeAfter', 'operatingMargin', 'operatingMarginAfter', 'totalMargin',
      'totalMarginAfter']) out[k] = null;
  }
  const uc = base.uncompensated_cost;
  out.uncompensatedChange = uc && uc > 0 ? addedUc / uc : null;
  return out;
}

/** The scenario's change in operating margin, in percentage points; null without one. */
export function marginChange(result) {
  const before = result.operatingMargin;
  const after = result.operatingMarginAfter;
  return isNone(before) || isNone(after) ? null : (after - before) * 100;
}
