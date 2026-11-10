// The work-requirement site's words. No digit characters: every number arrives through a {placeholder}, formatted
// before it is filled. A sentence that states a fact about the law carries the claim id (or ids) of its row in
// sites/work-requirement/CLAIMS.md; the rest are null. The page's dek is the family's (web/copy.js dekWorkRequirement,
// through web/programs.js programDek), so the directory and the page say one thing.
import { copyOf } from '../../../web/render/components.js';

export const COPY = {
  // The program page: the line above its title, its title (the family's pages name the site by web/site.js's shorter
  // title), and its description for search results and link previews.
  kicker: { text: 'Medicaid · a scenario, not a payment', claim: null },
  title: { text: 'The Medicaid work requirement, hospital by hospital', claim: null },
  description: {
    text: 'A scenario, not a payment: how much Medicaid revenue each hospital could lose under the Medicaid work requirement, from the low case to the high.',
    claim: null,
  },

  // The five steps (constants.js SECTIONS), each a heading and its label in the section menu.
  navFinding: { text: 'What hospitals could lose', claim: null },
  navHow: { text: 'How the scenario works', claim: null },
  navStates: { text: 'State by state', claim: null },
  navHospital: { text: 'One hospital', claim: null },
  navBoth: { text: 'Exposed on both', claim: null },

  // The masthead's Find on the program page (web/render/shell.js searchForm; client/find.js mounts it): a hospital found
  // becomes the page's hospital (its thread through the strips) instead of opening a page.
  searchHeading: { text: 'Find a hospital on this page', claim: null },
  searchFind: { text: 'Find', claim: null },
  searchFindRest: { text: 'a hospital to follow down this page', claim: null },
  searchPlaceholder: { text: 'Hospital, city or CCN', claim: null },
  searchKindHospital: { text: 'Hospital', claim: null },
  searchEmpty: { text: "No matches. Try a city or the hospital's CCN.", claim: null },
  searchCount: { text: '{n} matches', claim: null },
  searchCountOne: { text: 'One match', claim: null },
  searchFailed: { text: "The hospital list didn't load. Leave the box and come back to try again.", claim: null },

  // Step 1, the finding (web/program/finding.js): the three ranges, low case to high, and the counts under them.
  scenLow: { text: 'Low', claim: null },
  scenMiddle: { text: 'Middle', claim: null },
  scenHigh: { text: 'High', claim: null },
  rangesSub: { text: 'All hospitals in the scenario states, a year, low case to high', claim: null },
  rangeLost: { text: 'Medicaid revenue hospitals could lose, a year', claim: null },
  rangeAdded: { text: 'Care still given, now uncompensated', claim: null },
  rangeIncome: { text: 'Operating income falls by', claim: null },
  rangeMid: { text: '{scenario} case: {value}', claim: null },
  rangeAlt: { text: 'Low {low}, middle {middle}, high {high}.', claim: null },
  counts: {
    text: '{fallsLow} to {fallsHigh} hospitals lose a point or more of operating margin ({falls} in the middle case), and {redLow} to {redHigh} go from a positive to a negative total margin ({red}).',
    claim: null,
  },

  // Step 1's group chips (client/chips.js shows them; without a script they stay hidden).
  chipsHeading: { text: 'Light up a group', claim: null },
  chipsClear: { text: 'Clear', claim: null },
  chip_critical_access: { text: 'Critical access', claim: null },
  chip_rural: { text: 'Rural', claim: null },
  chip_safety_net: { text: 'Safety-net (our flag)', claim: null },
  chip_public: { text: 'Public', claim: null },
  chip_nonprofit: { text: 'Nonprofit', claim: null },
  chip_forprofit: { text: 'For-profit', claim: null },
  chip_beds_lt50: { text: 'Under {n} beds', claim: null },
  chip_beds_300plus: { text: '{n}+ beds', claim: null },
  // Each group as the readout and the strips' median label name it (a chip's own label may be shorter or carry a gloss).
  group_critical_access: { text: 'Critical access hospitals', claim: null },
  group_rural: { text: 'Rural hospitals', claim: null },
  group_safety_net: { text: 'Safety-net hospitals, by our flag', claim: null },
  group_public: { text: 'Public hospitals', claim: null },
  group_nonprofit: { text: 'Nonprofit hospitals', claim: null },
  group_forprofit: { text: 'For-profit hospitals', claim: null },
  group_beds_lt50: { text: 'Hospitals under {n} beds', claim: null },
  group_beds_300plus: { text: 'Hospitals with {n} beds or more', claim: null },
  chipState: { text: 'A state…', claim: null },
  chipStateLabel: { text: 'Light up a state', claim: null },
  chipHint: { text: 'Pick one: only its hospitals stay in the strips, over a gray outline of all of them.', claim: null },
  chipReadout: { text: '{group}: {n} drawn, median loss {median} of patient revenue, against {all} for all; {big} at {line} or more ({scenario} case).', claim: null },
  chipReadoutOne: { text: '{group}: one drawn, a loss of {median} of patient revenue, against a median of {all} for all ({scenario} case).', claim: null },

  // Figure 1: the three strips (web/program/strips.js).
  figTakeaway: { text: '{placed} of the {n} hospitals in scenario states, each a dot at the share of its patient revenue it could lose, in all three cases.', claim: null },
  figAlt: {
    text: 'Three strips of dots, the low, middle and high cases, on one square-root scale of the share of patient revenue lost. Median losses: {low}, {middle} and {high}.',
    claim: null,
  },
  figNotPlaced: { text: '{n} more have no loss to draw: no Medicaid revenue on their cost report (or a few dollars of it), no patient revenue to measure against, or a cost report screened out as a filing error.', claim: null },
  figSource: { text: 'Urban Institute and RWJF state enrollment declines, applied to each hospital’s FY{fy} Medicare cost report (CMS HCRIS)', claim: null },
  stripEnrollees: { text: '{n} million fewer enrollees', claim: 'WR-03' },
  // The low strip's small note: CMS's own projection of the enrollment decline (about the low case's, WR-03) sits there.
  stripOfficial: { text: '◂ CMS’s count sits here', claim: ['WR-03', 'WR-04'] },
  stripMit_low: { text: 'high state mitigation', claim: null },
  stripMit_middle: { text: 'medium mitigation', claim: null },
  stripMit_high: { text: 'low mitigation', claim: null },
  stripLost: { text: 'lost a year', claim: null },
  stripMedian: { text: 'median {share}', claim: null },
  stripMedianAll: { text: 'all, median {share}', claim: null },
  stripMedianGroup: { text: '{group}, median {share}', claim: null },
  stripAxis: { text: 'Share of the hospital’s FY{fy} patient revenue lost', claim: null },
  stripScale: { text: 'Square-root scale · dashed: {line} of patient revenue', claim: null },
  tableShare: { text: 'Share of patient revenue lost', claim: null },
  tableBin: { text: '{from} to {to}', claim: null },
  tableMedian: { text: 'Median', claim: null },

  // The Methods page.
  methodsKicker: { text: 'Methods', claim: null },
  methodsHeading: { text: 'How the work-requirement scenario is built', claim: null },
  methodsDescription: { text: 'How this site models what the Medicaid work requirement could cost each hospital: its sources, its steps and what it can’t tell you.', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY);
