// The counts and names the Methods page states, read from the scenario file (data: loadMedicaid()'s result). Pure.
//   scenario      hospitals in a scenario state (class 'scenario')
//   byClass       hospitals by class: the file's cls values (scenario, not_expansion, no_viii_group, all_payer,
//                 territory, no_cost_report), each a count
//   states        state and territory names by class, in name order (no_cost_report is a hospital's class, not a state's)
//   latest4       the names of the states whose expansion share reads CMS-64's latest four quarters (viii_basis 'latest4')
//   flagged(f)    the scenario hospitals whose flags include f
//   filingErrors  the scenario hospitals screened out as filing errors: Medicaid revenue below zero, or above the
//                 hospital's patient revenue (engine: exposure.py hospital_base, `scored` false)
export function methodsFacts(data) {
  const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  const rows = [...data.hospitals.values()];
  const byClass = {};
  for (const r of rows) byClass[r[col.cls]] = (byClass[r[col.cls]] ?? 0) + 1;
  const states = {};
  for (const st of Object.values(data.states)) (states[st.cls] ??= []).push(st.name);
  for (const list of Object.values(states)) list.sort((a, b) => a.localeCompare(b, 'en-US'));
  const scenario = rows.filter((r) => r[col.cls] === 'scenario');
  const flagged = (flag) => scenario.filter((r) => r[col.flags].includes(flag)).length;
  return {
    scenario: scenario.length,
    byClass,
    states,
    latest4: Object.values(data.states).filter((st) => st.viii_basis === 'latest4').map((st) => st.name).sort((a, b) => a.localeCompare(b, 'en-US')),
    flagged,
    filingErrors: scenario.filter((r) => !r[col.scored]).length,
  };
}
