// The words of the interim Readmissions pages (hub/hrrp/page.js): /hrrp/ and a page per hospital in the pinned Thirty Day
// Readmissions file, until that site folds in. No digit characters: numbers arrive through {placeholders}, the one
// comparison point (a ratio against one) through a named constant in page.js.
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // The kicker over both pages' headings.
  kicker: 'HRRP · Interim page',

  // ---------- /hrrp/ ----------
  // The masthead: the program's name, its last word in the penalty ink. <title> and description; {cut} of {n} hospitals.
  titleLead: 'Hospital',
  titlePen: 'Readmissions',
  title: 'Hospital Readmissions Reduction Program, FY{fy}',
  description: "CMS's FY{fy} Hospital Readmissions Reduction Program results: {cut} of {n} hospitals have a payment cut. This page is a summary; the full explorer is on Thirty Day Readmissions.",
  // The summary card: what CMS's file for the year says across all its hospitals.
  summaryTitle: 'Readmissions · FY{fy}',
  summarySource: 'CMS final data',
  summaryCut: 'Hospitals with a cut',
  summaryCutNote: 'of {n} in the file',
  summaryShare: 'Share of hospitals cut',
  summaryShareNote: 'Payment adjustment factor below one.',
  summaryFy: 'Fiscal year',
  summaryFyValue: 'FY{fy}',
  summaryFyNote: 'The cut applies to payments for discharges in this fiscal year.',
  // The search over the hub's hospitals (hub/client/search.js mounts it; hidden without the script).
  findLabel: 'Find a hospital',
  findWord: 'Find',
  findRest: 'a hospital',
  findPlaceholder: 'Hospital or city',
  // The link out, large, on both pages; the hospital's own page links to that hospital's page there.
  explorer: 'Full explorer on Thirty Day Readmissions',
  explorerNote: 'Every condition, the peer groups, the history behind these numbers and a what-if, until Readmissions joins this site.',
  // Which fiscal year this page shows, against the net the rest of the site shows.
  fyNote: "This page shows CMS's FY{fy} values. The estimated dollars across all three programs, on the front page and each hospital's page, use FY{hubFy}, the latest year all three programs share.",

  // ---------- /hrrp/hospital/<ccn>/ ----------
  // <title> and description, with the hospital's place ("City, ST") when the master has one.
  titleAt: '{name} ({place}): Hospital Readmissions Reduction Program, FY{fy}',
  titleBare: '{name}: Hospital Readmissions Reduction Program, FY{fy}',
  descriptionAt: "CMS's FY{fy} Readmissions Reduction Program values for {name} in {place}: its payment adjustment factor, its reduction and the conditions CMS measured, with this site's estimate of the FY{hubFy} dollars.",
  descriptionBare: "CMS's FY{fy} Readmissions Reduction Program values for {name}: its payment adjustment factor, its reduction and the conditions CMS measured, with this site's estimate of the FY{hubFy} dollars.",
  // The record card's title bar, and the two fields CMS decides.
  recordTitle: 'Readmissions · FY{fy}',
  factorLabel: 'Payment adjustment factor, FY{fy}',
  factorNote: "CMS's value. A factor below one is a cut.",
  reductionLabel: 'Reduction',
  reductionNote: 'One minus the factor, as a percent.',
  wordCut: 'cut',
  wordNoCut: 'no cut',

  // The conditions CMS measured for this hospital.
  conditionsHeading: 'What CMS measured',
  conditionsCaption: "The conditions CMS measured for this hospital in FY{fy}, with the excess readmission ratio as CMS published it.",
  colCondition: 'Condition',
  colDischarges: 'Eligible discharges',
  colRatio: 'Excess readmission ratio',
  colCounted: 'Counted toward the cut',
  above: 'above {par}',
  atOrBelow: 'at or below {par}',
  counted: 'Yes',
  notCounted: 'No',
  conditionsNote: "A ratio above {par} means more readmissions than expected for the hospital's patients. CMS counts a condition toward the cut only when it has enough eligible discharges and its ratio is above the median of the hospital's peer group.",

  // The estimate the front page's net uses, from a different fiscal year.
  estimateHeading: 'The estimate the net uses',
  estimateLabel: 'Readmissions, estimated FY{fy}',
  estimateTag: 'Estimate',
  estimateTagLabel: 'Estimate: how this site estimates the dollars',
  estimateNote: "The net across all three programs adds each program's estimated dollars for FY{fy}, the latest year they share. Readmissions' part can differ from the FY{pinFy} values on this page.",
  estimateOut: "Not in CMS's FY{fy} Readmissions file, so the net has no Readmissions dollars for this hospital.",
  estimateNone: 'No estimate',
  estimateNoneWhy: "This site's estimated FY{fy} dollars have no usable row for this hospital.",
  hubLink: 'This hospital across the programs',

  // The source and fairness lines, as the hospital pages end.
  source: "Source: CMS's FY{fy} Hospital Readmissions Reduction Program files, as pinned by Thirty Day Readmissions. CMS's values appear as CMS published them; dollars are this site's estimates.",
  fairness: "A cut is a program's formula at work, not a verdict on a hospital's care. Nothing on this page ranks hospitals.",
});
