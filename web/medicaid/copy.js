// Why a hospital has no Medicaid work-requirement scenario figure, in the words both the work-requirement pages
// (sites/work-requirement/web/program/hospital.js) and the hub's hospital pages (hub/hospital/medicaid.js) give it:
// shared copy, so one hospital's reason reads the same on both. No digit characters: numbers arrive through
// {placeholders}. Which reason a hospital has is the engine's (engine/js/medicaid/hospital.js reasonOf); which of these
// each reason takes, and its placeholders' values, are reasons.js's.
import { copyOf } from '../render/components.js';

export const COPY = {
  // The stamp a reason gets, by its group (reasons.js REASON_STAMP).
  stamp_away: { text: 'Not in this scenario', claim: null },
  stamp_none: { text: 'No scenario', claim: null },
  stamp_notModeled: { text: 'Not modeled', claim: null },
  stamp_noReport: { text: 'No cost report', claim: null },
  stamp_screened: { text: 'Screened out', claim: null },
  stamp_noLoss: { text: 'No loss to draw', claim: null },
  // A share of patient revenue too small to print at the decimals shown (format.js): under the smallest it can print.
  shareUnder: { text: 'under {tiny}', claim: null },
  // The reason's sentence, by reason: its class, or what its cost report shows.
  why_away_inactive: { text: 'CMS’s records list this hospital as closed, merged or changed in status. The scenario covers active acute-care and critical access hospitals, so it has no row here.', claim: null },
  why_away_kind: { text: 'The scenario covers active acute-care and critical access hospitals, and CMS’s records list this one as neither, so it has no row here.', claim: null },
  why_not_expansion: { text: '{state} did not expand Medicaid, and Urban projects the decline in expansion enrollment only, so its hospitals have no scenario.', claim: 'WR-03' },
  why_no_viii_group: { text: '{state}’s Medicaid spending reports show no expansion group, so the method has no expansion share to apply, and its hospitals have no scenario.', claim: null },
  why_all_payer: { text: 'Maryland’s hospitals are paid under an all-payer model, which this scenario does not model.', claim: 'WR-10' },
  why_territory: { text: 'The scenario covers only the states and the District of Columbia.', claim: null },
  why_no_cost_report: { text: 'CMS’s files hold no FY{fy} Medicare cost report for this hospital, so the scenario has nothing to measure.', claim: null },
  why_negative: { text: 'Its FY{fy} cost report shows Medicaid revenue below zero, a filing error the method screens out.', claim: null },
  why_exceeds: { text: 'Its FY{fy} cost report shows more Medicaid revenue than patient revenue, a filing error the method screens out.', claim: null },
  why_no_medicaid: { text: 'Its FY{fy} cost report shows no Medicaid revenue, so the scenario has none to lose.', claim: null },
  why_no_npr: { text: 'Its FY{fy} cost report shows no patient revenue to measure a loss against.', claim: null },
  why_no_share: { text: 'Its expansion share is zero, so none of its Medicaid revenue is lost in the scenario.', claim: null },
  why_unforeseen: { text: 'No scenario figure for this hospital.', claim: null },
  why_tiny: { text: 'Its FY{fy} cost report shows only a few dollars of Medicaid revenue, too little for a loss to draw.', claim: null },
};

export const { fill, t } = copyOf(COPY);
