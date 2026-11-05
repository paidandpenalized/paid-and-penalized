// Ported from Thirty Day Readmissions (web/src/js/views/home.js and views/methods.js at 33d1959).
// The Readmissions program page's words: the hero, the At-a-glance card and the Parts' headings. No digit characters: every number arrives through a
// {placeholder}. A sentence that states a program rule carries the claim id of its row in sites/hrrp/CLAIMS.md.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';

export const COPY = {
  // The page's head.
  pageTitle: { text: 'Readmissions: the Hospital Readmissions Reduction Program, {edition}', claim: null },
  pageDescription: {
    text: 'Every hospital in the {edition} Hospital Readmissions Reduction Program: who takes a cut, how big it is and how CMS works it out.',
    claim: null,
  },

  // The hero.
  kicker: { text: '{edition} edition · Year {n} of Medicare readmission penalties', claim: null },
  deckLead: {
    text: 'When too many patients land back in the hospital within {days} days of going home, Medicare pays that hospital less for a full year. Starting {pay}, ',
    claim: ['HRRP-04', 'HRRP-06'],
  },
  deckCount: { text: '{nPen} of the {n} hospitals', claim: null },
  deckMid: { text: ' CMS evaluated take a cut. ', claim: null },
  deckShare: { text: 'That is {pct} of the {nMeasured} hospitals measured on at least one condition.', claim: null },
  heroTry: { text: 'Try {state}, {metro}, or {every}. New to this? Start with {how}.', claim: null },
  heroTryNoMetro: { text: 'Try {state}, or {every}. New to this? Start with {how}.', claim: null },
  heroEvery: { text: 'browse every hospital', claim: null },
  heroHow: { text: 'how the penalty works', claim: null },

  // The At-a-glance card, the record form with eight numbered fields.
  glanceTitle: { text: '{edition} at a glance', claim: null },
  glanceSource: { text: 'All figures from CMS unless marked', claim: null },
  glanceEvaluated: { text: 'Hospitals evaluated', claim: null },
  glancePenalized: { text: 'Hospitals penalized', claim: null },
  glancePenalizedNote: { text: '{pct} of the {nMeasured} measured on at least one condition', claim: null },
  glanceMean: { text: 'Average cut, all hospitals', claim: null },
  glanceMeanPen: { text: 'Average cut, penalized only', claim: null },
  glanceMax: { text: 'At the {cap}% maximum', claim: 'HRRP-09' },
  glanceMaxNote: { text: 'hospitals', claim: null },
  glanceDollars: { text: 'Estimated dollars', claim: null },
  glanceDollarsValue: { text: '≈ {money}', claim: null },
  glanceDollarsNote: { text: "Modeled here. CMS's rule-time estimate, from preliminary data: {cms}.{missing}", claim: null },
  glanceWindow: { text: 'Data window', claim: null },
  glanceWindowValue: { text: '{start} – {end}', claim: null },
  glancePay: { text: 'Payment year', claim: null },
  glanceStamp: { text: 'Final · posted {date}', claim: null },

  // The Parts the section menu opens (their figures come with the batches that draw them).
  partTag: { text: 'Part {n}', claim: null },

  // Part 1, how it works: its line, the two callouts above the steps, then Steps 1 to 4 and their figures.
  howIntro: { text: 'CMS runs the same arithmetic for every hospital. Here it is step by step, using the real {edition} numbers.', claim: null },
  stepLabel: { text: 'Step {n}', claim: null },
  newForTitle: { text: 'New for {edition}', claim: null },
  newForSource: { text: "The note on Medicare Advantage is from CMS's {edition} payment methodology sheet.", claim: 'HRRP-14' },
  whoTitle: { text: 'Who is in the program', claim: null },
  whoText: {
    text: "About {n} hospitals paid under Medicare's inpatient prospective payment system. Not included: critical access hospitals, and children's, cancer, psychiatric, rehabilitation and long-term care hospitals. Hospitals in Puerto Rico are out too, since the program covers hospitals in the fifty states and the District of Columbia, and so are Maryland's hospitals.",
    claim: ['HRRP-01', 'HRRP-11', 'HRRP-12', 'HRRP-13', 'HRRP-16'],
  },

  // Step 1: the conditions, and the punch card of which each hospital is measured on.
  step1Title: { text: '{words} kinds of stays are tracked', claim: ['HRRP-02', 'HRRP-03'] },
  step1Text: {
    text: 'CMS tracks readmissions for {words} conditions and procedures. A hospital counts for one of them only if it had at least {minCases} eligible discharges for it in the data window.',
    claim: ['HRRP-01', 'HRRP-02', 'HRRP-03'],
  },
  fig1Takeaway: { text: '{top} is measured at {nTop} hospitals, {bottom} at only {nBottom}. Of the {n} hospitals, {measured} are measured on at least one condition and {none} on none.', claim: null },
  fig1Alt: { text: 'Punch card: a column for each set of conditions hospitals are measured on, the largest first, with the number of hospitals in it and how many of them take a cut.', claim: null },
  fig1Source: { text: 'CMS {edition} Hospital Readmissions Reduction Program supplemental data file (eligible discharges and payment adjustment factors).', claim: null },
  fig1Key: { text: 'A hole in a row means the set includes that condition ({abbrs}). The red part of a bar is the hospitals in the set that take a cut.', claim: null },
  fig1Other: { text: 'Other sets', claim: null },
  fig1None: { text: 'None measured', claim: null },
  fig1Totals: { text: 'Measured at', claim: null },
  fig1Share: { text: 'Cut', claim: null },
  fig1Tip: { text: '{set}: {n} hospitals, {yes} with a cut', claim: null },
  fig1TipOther: { text: '{k} rarer sets: {n} hospitals, {yes} with a cut', claim: null },
  fig1TipNone: { text: 'Not measured on any condition: {n} hospitals', claim: null },
  fig1ColSet: { text: 'Conditions measured', claim: null },
  fig1ColN: { text: 'Hospitals', claim: null },
  fig1ColYes: { text: 'With a cut', claim: null },

  // Step 2: the excess readmission ratio (its figure, the swarm, is not drawn yet).
  step2Title: { text: 'Each hospital gets a ratio', claim: null },
  step2Text: {
    text: 'The excess readmission ratio is the readmission rate predicted for a hospital divided by the rate expected at an average hospital with a similar mix of patients. A ratio above {one} means more readmissions than expected.',
    claim: 'HRRP-15',
  },
  step2Medians: {
    text: "CMS then compares each ratio with the median ratio of the hospital's peer group for the same condition. Across the five groups and the six conditions those medians run from {lo} to {hi}.",
    claim: 'HRRP-04',
  },

  // Step 3: the five peer groups, and the columns of the dual share.
  step3Title: { text: 'Hospitals are compared with peers', claim: 'HRRP-05' },
  step3Text: {
    text: 'CMS sorts hospitals into five peer groups by the share of their stays that are for patients eligible for both Medicare and full Medicaid, a common marker of low income. Each hospital is compared only with the others in its group.',
    claim: 'HRRP-05',
  },
  fig2Takeaway: { text: 'Group one has the lowest share of such patients and group five the highest. The groups hold from {min} to {max} of the {n} hospitals each.', claim: 'HRRP-05' },
  fig2Band: { text: 'Group {n}', claim: null },
  fig2BandShort: { text: '{n}', claim: null },
  fig2Alt: { text: "Columns: how many hospitals have each share of dual-eligible stays, in one-point steps, with the cutoffs between the five peer groups marked on the axis.", claim: null },
  fig2Source: { text: 'CMS {edition} Hospital Readmissions Reduction Program supplemental data file (dual proportion and peer group).', claim: null },
  fig2Note: { text: "The marks on the axis are CMS's cutoffs between the groups: {cutoffs}.", claim: null },
  fig2Tip: { text: '{from} to {to} dual-eligible: {n} hospitals', claim: null },
  fig2ColShare: { text: 'Dual-eligible share of stays', claim: null },
  fig2ColN: { text: 'Hospitals', claim: null },
  dualRange: { text: '{from} to {to}', claim: null },

  // Step 4: the median each group's hospitals must stay under.
  step4Title: { text: 'The bar to clear is the group median', claim: 'HRRP-04' },
  step4Text: {
    text: "A condition adds to a hospital's cut only if its ratio is above its peer group's median for that condition. The medians are set over the hospitals in the group, so about half of those measured on a condition land above it.",
    claim: 'HRRP-04',
  },
  medsSummary: { text: 'Peer-group medians for {edition}', claim: null },
  medsGroup: { text: 'Peer group', claim: null },
  medsRow: { text: 'Group {n} · {from}–{to} dual', claim: null },
  medsMissing: { text: 'none', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE);
