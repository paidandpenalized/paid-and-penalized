// Roll-up of per-hospital scenario results: the browser twin of engine/py/pp_engine/medicaid/rollup.py (`roll_up`).
// Dollars add up; margins and percent changes are recomputed from the sums. Pure: imports only its sibling.
//
// Input: [base, result] pairs (base: emitted-column names, as in scenario.js; result: scenario()'s). Output names are
// Python's keys in camelCase: at_risk atRisk, lost, lost_cost lostCost, added_uncompensated addedUncompensated,
// care_avoided careAvoided, other_coverage otherCoverage, income_change incomeChange, hospitals, exposed,
// medicaid_revenue medicaidRevenue, uncompensated_cost uncompensatedCost, uc_added_where_reported
// ucAddedWhereReported, margin_hospitals marginHospitals, into_red intoRed, falls_1pp falls1pp, operating_margin
// operatingMargin, operating_margin_after operatingMarginAfter, total_margin totalMargin, total_margin_after
// totalMarginAfter, net_patient_revenue netPatientRevenue, lost_share_of_medicaid lostShareOfMedicaid,
// lost_share_of_at_risk lostShareOfAtRisk, uncompensated_change uncompensatedChange.
import { marginChange } from './scenario.js';

const DOLLARS = ['atRisk', 'lost', 'lostCost', 'addedUncompensated', 'careAvoided', 'otherCoverage', 'incomeChange'];

/** Whether the scenario turns a non-negative total margin negative. */
export function intoRed(result) {
  const before = result.totalMargin;
  const after = result.totalMarginAfter;
  return before !== null && after !== null && before >= 0 && after < 0;
}

const ratio = (num, den) => (den > 0 ? num / den : null);

export function rollUp(pairs, { line2_5 = false } = {}) {
  const revenueKey = line2_5 ? 'revenue_line2_5' : 'medicaid_net_revenue';
  const scoredKey = line2_5 ? 'scored_line2_5' : 'scored';
  const out = Object.fromEntries(DOLLARS.map((k) => [k, 0]));
  Object.assign(out, {
    hospitals: 0, exposed: 0, medicaidRevenue: 0, uncompensatedCost: 0, ucAddedWhereReported: 0,
    marginHospitals: 0, intoRed: 0, falls1pp: 0,
  });
  let npr = 0;
  let rev = 0; let inc = 0; let revAfter = 0; let incAfter = 0;
  let nprT = 0; let ni = 0; let oth = 0; let nprTAfter = 0; let niAfter = 0;
  for (const [base, res] of pairs) {
    out.hospitals += 1;
    out.exposed += res.lost > 0 ? 1 : 0;
    if (base[scoredKey]) out.medicaidRevenue += base[revenueKey] || 0;
    for (const k of DOLLARS) out[k] += res[k] || 0;
    if ((base.uncompensated_cost || 0) > 0) {
      out.uncompensatedCost += base.uncompensated_cost;
      out.ucAddedWhereReported += res.addedUncompensated;
    }
    if (base[scoredKey] && base.has_margin && !base.margin_outlier) {
      out.marginHospitals += 1;
      npr += base.net_patient_revenue;
      rev += res.operatingRevenue;
      inc += res.operatingIncome;
      revAfter += res.operatingRevenueAfter;
      incAfter += res.operatingIncomeAfter;
      const change = marginChange(res);
      if (change !== null && change <= -1) out.falls1pp += 1;
      if (base.net_income !== null && base.net_income !== undefined) {
        nprT += base.net_patient_revenue;
        nprTAfter += res.netPatientRevenueAfter;
        ni += base.net_income;
        niAfter += res.netIncomeAfter;
        oth += base.other_income || 0;
        out.intoRed += intoRed(res) ? 1 : 0;
      }
    }
  }
  out.operatingMargin = ratio(inc, rev);
  out.operatingMarginAfter = ratio(incAfter, revAfter);
  out.totalMargin = ratio(ni, nprT + oth);
  out.totalMarginAfter = ratio(niAfter, nprTAfter + oth);
  out.netPatientRevenue = npr;
  out.lostShareOfMedicaid = ratio(out.lost, out.medicaidRevenue);
  out.lostShareOfAtRisk = ratio(out.lost, out.atRisk);
  out.uncompensatedChange = ratio(out.ucAddedWhereReported, out.uncompensatedCost);
  return out;
}
