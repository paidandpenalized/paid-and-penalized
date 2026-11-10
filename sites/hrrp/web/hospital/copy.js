// Ported from Thirty Day Readmissions (web/src/js/views/hospital.js and views/columns.js at 33d1959).
// The words of a hospital's page. No digit characters: every number arrives through a {placeholder}. The verdict
// and rank sentences are in ../copy.js (wording.js builds them); these are the record card's labels and values.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';

export const COPY = {
  // The page's head.
  pageTitle: { text: '{name}, {place}: Hospital Readmissions Reduction Program, {edition}', claim: null },
  // A neutral sentence for a link's preview: no cut and no dollar figure in it.
  pageDescription: {
    text: '{name}, {place}: its record in the {edition} Hospital Readmissions Reduction Program, with the payment adjustment CMS set and how it ranks.',
    claim: null,
  },

  // The record card.
  recordTitle: { text: 'Hospital record · {edition}', claim: null },
  recordCcn: { text: 'CCN {ccn}', claim: null },
  fieldHospital: { text: 'Hospital', claim: null },
  fieldLocation: { text: 'Location', claim: null },
  fieldMetro: { text: 'Metro area', claim: null },
  fieldType: { text: 'Type', claim: null },
  fieldPeer: { text: 'Peer group', claim: null },
  fieldStars: { text: 'Care Compare stars', claim: null },
  alias: { text: 'Also listed by CMS as {alias}', claim: null },
  outsideMetro: { text: 'Outside metro areas', claim: null },
  seeMetro: { text: 'See this metro', claim: null },
  seeState: { text: 'See {state}', claim: null },
  peerValue: { text: '{peer} of {n}', claim: null },
  peerNote: { text: '{pct} of stays dual-eligible', claim: null },
  starsNone: { text: 'Not rated', claim: null },
  starsSpoken: { text: '{n} of {max} stars', claim: null },
  starsLink: { text: 'Open on Medicare.gov', claim: null },

  // The Type field: what the hospital is, from the hospital master and CMS's special-status codes.
  typeNone: { text: '—', claim: null },
  typeBeds: { text: '{beds} beds', claim: null },
  typeBedsCostReport: { text: '{beds} beds (cost report)', claim: null },
  typeUrban: { text: 'Urban', claim: null },
  typeRural: { text: 'Rural', claim: null },
  typeSCH: { text: 'Sole community hospital', claim: null },
  typeMDH: { text: 'Medicare-dependent hospital', claim: null },
  typeRRC: { text: 'Rural referral center', claim: null },
  typeIHS: { text: 'Indian Health Service', claim: null },
  typeEACH: { text: 'Essential access community hospital', claim: null },

  // The stamp.
  stampCut: { text: 'Cut {pct}', claim: null },
  stampNone: { text: 'No cut', claim: null },
  stampInactive: { text: 'Inactive', claim: null },

  // The verdict's two numbers.
  verdictLabel: { text: 'Verdict', claim: null },
  fieldFactor: { text: 'Payment adjustment factor', claim: null },
  factorNote: { text: 'CMS, final', claim: null },
  fieldDollars: { text: 'Estimated dollars', claim: null },
  dollarsNote: { text: 'on ≈ {base} of base payments', claim: null },
  dollarsNoVolume: { text: 'no volume data', claim: null },
  dollarsNone: { text: '—', claim: null },

  // Figure: where the penalty came from [RU-02]. Gaps and dollars are filled from the data.
  rulersNone: { text: 'No condition has {minCases} or more cases, so none is counted and none can add to a cut.', claim: null },
  rulersBelowOne: { text: '{short}, the one counted condition, sits at or under its peer median, so it adds nothing to a cut.', claim: null },
  rulersBelowMany: { text: 'All {n} counted conditions sit at or under their peer medians, so none adds to a cut.', claim: null },
  // Two facts, not a cause: {cut} is the hospital's share of dollars after the factor is rounded, {per} the slope before it, so on
  // a hospital whose cut rounds a long way, gap x per does not give {cut}.
  rulersOver: { text: '{short} costs the most: {gap} over its peer median and {cut} of the modeled cut. Each {step} of its ratio is worth {per} before the cut is rounded.', claim: null },
  rulersOverCapped: { text: '{short} adds the most: {gap} over its peer median, {cut} of the modeled cut. The cut is at its maximum, so more ratio would add nothing.', claim: 'HRRP-09' },
  rulersOverNoDollars: { text: '{short} adds the most: {gap} over its peer median.', claim: null },
  rulersNoParts: { text: 'A condition sits over its peer median, but none adds enough to show in the payment factor.', claim: null },
  rulersCapNote: { text: 'These add to {points} points before the {cap}% cap.', claim: 'HRRP-09' },
  rulersNote: {
    text: 'Each row is one condition, drawn on its own peer group’s range: the gray columns are the hospitals in the group with enough cases, so a triangle halfway across means a different ratio on each row. Triangle: this hospital, red when over the median. Line: the peer median.',
    claim: null,
  },
  rulersSource: { text: 'CMS {edition} Hospital Readmissions Reduction Program Supplemental Data File. Dollars are modeled on this site from the hospital’s base payments and CMS’s payment weights.', claim: null },
  rulerMedian: { text: 'Median {median}', claim: null },
  rulerThis: { text: 'This hospital', claim: null },
  rulerSame: { text: 'Past the axis', claim: null },
  rulerFew: { text: '{n} cases, under {min}: not counted', claim: null },
  rulerFewOne: { text: '{n} case, under {min}: not counted', claim: null },
  rulerNoCases: { text: 'No cases: not counted', claim: null },
  rowCases: { text: '{n} cases', claim: null },
  rowCasesOne: { text: '{n} case', claim: null },
  rowNoCases: { text: 'No cases', claim: null },
  rowNotCounted: { text: 'not counted', claim: null },
  rowOver: { text: '{gap} over', claim: null },
  rowUnder: { text: '{gap} under', claim: null },
  rowAt: { text: 'at the median', claim: null },
  rowNoWeight: { text: 'payment weight not published', claim: null },
  colCondition: { text: 'Condition', claim: null },
  colCases: { text: 'Cases', claim: null },
  colRatio: { text: 'Ratio', claim: null },
  colMedian: { text: 'Peer median', claim: null },
  colGap: { text: 'Over or under the median', claim: null },
  colPer: { text: 'Worth per {step} over the median', claim: null },
  colCut: { text: 'Modeled cut', claim: null },
  // The ledger's own short headings (the figure's table keeps the long ones above).
  headMedian: { text: 'Median', claim: null },
  headGap: { text: 'Gap', claim: null },
  headPer: { text: 'Per {step}', claim: null },
  cellNone: { text: '—', claim: null },
  cellNa: { text: 'n/a', claim: null },

  // Figure: penalty history.
  histHospOne: { text: 'Penalized in the one year with data.', claim: null },
  histHospOneNone: { text: 'Not penalized in the one year with data.', claim: null },
  histHospNever: { text: 'Not penalized in any of the {n} years with data.', claim: null },
  histHospAll: { text: 'Penalized in all {n} years with data.', claim: null },
  histHospSome: { text: 'Penalized in {pen} of the {n} years with data.', claim: null },
  histHospNote: {
    text: 'Bars: this hospital’s cut. Dashed line: the average across every hospital in the {edition} program. “n/a”: the hospital was not in that year’s file. The cap on the cut changed over the years, so a cut in one year is not the same size of penalty in another.',
    claim: null,
  },
  histHospBarsTitle: { text: 'The cut each year', claim: null },
  histHospRankTitle: { text: 'Where the cut fell among hospitals', claim: null },
  histHospRankNote: {
    text: 'Each dot is where this hospital’s cut fell, in each year, among today’s hospitals (those in the {edition} program), from the smallest cut at the bottom to the largest at the top; the shaded part is the hospitals that were cut. A place among hospitals compares across years where the cap and the measure changed, which the cut itself does not.',
    claim: null,
  },
  histHospMeasure: { text: 'Measure changed', claim: 'HRRP-14' },
  histHospTop: { text: 'Most', claim: null },
  histHospMid: { text: 'Mid', claim: null },
  histHospBottom: { text: 'Least', claim: null },
  histHospBarsAlt: { text: 'Bars of this hospital’s cut in each fiscal year it is in a file, with a dashed line for the average across all hospitals and the pandemic years shaded.', claim: null },
  histHospRankAlt: { text: 'A line through the places this hospital’s cut took among the hospitals of each fiscal year, with the years it was cut as filled dots.', claim: null },
  histHospTipBar: { text: '{fy}: cut {cut}; average across the program’s hospitals {avg}', claim: null },
  histHospTipNone: { text: '{fy}: no cut; average across the program’s hospitals {avg}', claim: null },
  histHospTipAbsent: { text: '{fy}: not in that year’s file', claim: null },
  histHospTipRankCut: { text: '{fy}: cut {cut}, larger than {share} of today’s hospitals in that year’s file', claim: null },
  histHospTipRankNone: { text: '{fy}: no cut, like {share} of today’s hospitals in that year’s file', claim: null },
  histHospColFy: { text: 'Fiscal year', claim: null },
  histHospColCut: { text: 'Cut', claim: null },
  histHospColAvg: { text: 'Average cut, all hospitals in the program', claim: null },
  histHospColRank: { text: 'Larger cut than, of today’s hospitals', claim: null },
  histHospSource: { text: 'CMS Hospital Readmissions Reduction Program supplemental data files, {span}.', claim: null },

  // The full worksheet.
  worksheetButton: { text: 'Show the full worksheet', claim: null },

  // Figure: the what-if. Every number is filled from the data or computed in the browser by the same function.
  wiTakeaway: {
    text: 'Drag a ratio to see how the cut would change. This is an approximation: peer medians, payment weights and the neutrality modifier stay at their {edition} values.',
    claim: null,
  },
  wiNone: { text: 'No condition had {minCases} or more cases, so there is nothing to simulate.', claim: null },
  wiSource: { text: 'The CMS formula, approximated on this site. Dollars are modeled from the hospital’s base payments.', claim: null },
  wiNoScript: { text: 'The sliders need JavaScript. Without it this shows the actual ratios.', claim: null },
  wiSlidersLabel: { text: 'Ratios to try', claim: null },
  wiSliderMedian: { text: 'median {median}', claim: null },
  wiSliderHint: { text: 'Ratio for {short}', claim: null },
  wiReset: { text: 'Reset', claim: null },
  wiToMedian: { text: 'Bring all to median', claim: null },
  wiToMedianHelp: { text: 'Sets every ratio over its peer median down to the median. A ratio already under it stays where it is.', claim: null },
  wiResultsLabel: { text: 'The cut at these ratios', claim: null },
  wiFieldCut: { text: 'Hypothetical cut', claim: null },
  wiFieldFactor: { text: 'Payment adjustment factor', claim: null },
  wiFieldDollars: { text: 'Estimated dollars', claim: null },
  wiActual: { text: 'Actual: {value}', claim: null },
  wiActualDollars: { text: 'Current estimate: {value}', claim: null },
  wiNoEstimate: { text: 'no estimate for this hospital', claim: null },
  wiLive: { text: 'At these ratios: cut {cut}, factor {factor}, estimated dollars {dollars}.', claim: null },
  wiLiveNoDollars: { text: 'At these ratios: cut {cut}, factor {factor}, no dollar estimate.', claim: null },
  wiWfAlt: { text: 'Waterfall of this hospital’s six conditions at the ratios set above, each part starting where the one before ends and each zero saying why, then the sum against the cap on the cap’s own scale.', claim: null },
  wiPartsTitle: { text: 'The parts of the hypothetical cut', claim: null },
  wiEscapeAlready: { text: 'At or under the median already.', claim: null },
  wiEscape: { text: 'Down to {median}, it adds nothing: the cut shrinks by {cut} of base payments, about {dollars}.', claim: null },
  wiEscapeNoDollars: { text: 'Down to {median}, it adds nothing: the cut shrinks by {cut} of base payments.', claim: null },
  wiEscapeNoWeight: { text: 'CMS counted this one, but its payment weight is not published, so what reaching {median} would save cannot be worked out here.', claim: null },
  wiEscapeNothing: { text: 'Down to {median}, it adds nothing, but the cut does not change.', claim: null },
  wiEscapeNothingCap: { text: 'Down to {median}, it adds nothing, but the other conditions still keep the cut at its maximum.', claim: null },
  wiColEscape: { text: 'Ratio that reaches the median', claim: null },
  wiColSaveCut: { text: 'Cut saved (percent of base payments)', claim: null },
  wiColSaveDollars: { text: 'Dollars saved (estimate)', claim: null },

  // Figure: the other hospitals in the area.
  nbAreaMetro: { text: 'the {name} metro area', claim: null },
  nbAreaOutside: { text: 'the part of {state} outside metro areas', claim: null },
  nbTakeaway: { text: '{n} hospitals in {area}, largest cut first. {cut} have a cut; this one is marked.', claim: null },
  nbTakeawayOne: { text: '{n} hospitals in {area}, largest cut first. One has a cut; this one is marked.', claim: null },
  nbTakeawayAll: { text: '{n} hospitals in {area}, largest cut first. All have a cut; this one is marked.', claim: null },
  nbTakeawayNone: { text: '{n} hospitals in {area}, none with a cut. This one is marked.', claim: null },
  nbSource: { text: 'CMS {edition} Hospital Readmissions Reduction Program Supplemental Data File. Dollars are modeled on this site.', claim: null },
  nbNote: { text: 'The triangle is this hospital; each dot is another hospital in the area, red where it has a cut. Hover or focus a dot for its name.', claim: null },
  nbColRank: { text: '#', claim: null },
  nbColHospital: { text: 'Hospital', claim: null },
  nbColCut: { text: 'Cut', claim: null },
  nbColDollars: { text: 'Estimated dollars', claim: null },
  nbColPeer: { text: 'Peer group', claim: null },
  nbColConds: { text: 'Conditions', claim: null },
  nbCurrent: { text: 'This hospital', claim: null },
  nbCaption: { text: 'Hospitals in the area, largest cut first', claim: null },
  nbPager: { text: 'Pages of hospitals', claim: null },
  nbCsv: { text: 'Download these hospitals as CSV', claim: null },
  nbMapAlt: { text: 'A map of the area with this hospital marked by a triangle and the other hospitals in the area as dots, those with a cut in red.', claim: null },
  nbMapThis: { text: 'This hospital: {name}', claim: null },
  nbTip: { text: '{name}, {place}: {cut}', claim: null },
  nbTipCut: { text: 'cut {cut}', claim: null },
  nbTipNoCut: { text: 'no cut', claim: null },

  // The foot.
  report: { text: "Report a problem with this hospital's data", claim: null },
  source: {
    text: 'Source: CMS {edition} Hospital Readmissions Reduction Program Supplemental Data File, posted {date}. Dollar figures marked estimate are modeled on this site.',
    claim: null,
  },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE);
