// The work-requirement Methods page's words (pages/methods.js, methods/sens.js), built into the page and never shipped to
// a browser. Same rules as the site's copy.js: no digit characters, every number through a {placeholder}; `claim` names
// a row of sites/work-requirement/CLAIMS.md, or a list of them (null for this site's own framing or arithmetic). fill,
// fillKeep and t read here, then the site's copy.js.
import { copyOf, copyText } from '../../../../web/render/components.js';
import { FORM_NAMES } from '../constants.js';
import { COPY as SHARED } from '../copy.js';

export const COPY = {
  // The top.
  methodsLede: {
    text: 'A scenario, not a payment: how much Medicaid revenue each hospital could lose under the Medicaid work requirement, in FY{fy} dollars. Below: the four steps and every number they use, what the method can’t tell you, how far the totals move under other choices, who has no scenario and why, and every file the build reads.',
    claim: null,
  },
  contentsHeading: { text: 'On this page', claim: null },

  // The steps and their numbers.
  stepsHeading: { text: 'The steps and their numbers', claim: null },
  stepsText: {
    text: 'Each active acute-care or critical access hospital in a scenario state with an FY{fy} Medicare cost report, {n} hospitals, goes through the four steps; the rest show why they have no scenario, below. Every number here is the scenario file’s own, as the build reads it.',
    claim: null,
  },
  step1Head: { text: 'Revenue at risk.', claim: null },
  step1: {
    text: 'The hospital’s Medicaid net revenue (cost report {revSheet}, line {line}) times its expansion share: the share of its state’s Medicaid spending in federal FY{fy} that went to the new adult group, the expansion group ({spendForm}), scaled by how much of the hospital’s own Medicaid inpatient care is outside maternity against its state’s, and never more than all of it. A hospital with fewer than {days} Medicaid inpatient days keeps its state’s share unchanged.',
    claim: 'WR-16',
  },
  step2Head: { text: 'Revenue lost.', claim: null },
  step2: {
    text: 'Revenue at risk times the decline in expansion enrollment Urban Institute and RWJF project for the hospital’s state in the case, times the use rate: {useDefault} unless you move it, from {useMin} to {useMax}.',
    claim: 'WR-18',
  },
  step3Head: { text: 'Their care, split three ways.', claim: null },
  step3: {
    text: 'The lost patients’ care is costed at the hospital’s own Medicaid cost per dollar of Medicaid revenue (line {cost} over line {line}, held to at most {cap} dollars of cost a dollar). Of the people who lose coverage, {uninsured} become uninsured; of their care, {still} is still given and becomes uncompensated care, and the other {notUsed} is not given, so its cost goes away. The rest find other coverage, which is taken to pay the care’s cost.',
    claim: null,
  },
  step4Head: { text: 'Margins after.', claim: null },
  step4: {
    text: 'Operating margin (operating income over operating revenue, {marginSheet}) and total margin, before and after: revenue loses step two and gains what other coverage pays, costs lose the care not given, and uncompensated care stays a cost. Dollars are the cost report’s, in FY{fy} dollars: nothing is projected forward or stretched to a full year.',
    claim: null,
  },
  sharesSub: { text: 'Where the two shares in step three come from', claim: null },
  sharesUninsured: {
    text: '{uninsured} become uninsured: the Congressional Budget Office’s estimate of how many more people the requirement leaves uninsured, over its count of the people who lose Medicaid coverage under it, both in the last year of CBO’s ten-year window. The ratio is this site’s.',
    claim: 'WR-11',
  },
  sharesStill: {
    text: '{still} of their care is still given: one less the drop in hospital use, about {drop}, that Dobson DaVanzo’s technical appendix for the Commonwealth Fund assumes for a newly uninsured population, a figure its authors worked back from earlier studies rather than measured.',
    claim: 'WR-12',
  },
  sharesUse: {
    text: 'The use rate is this site’s what-if: at {useDefault}, the people losing coverage used as much hospital care as the average expansion adult. Nothing measures it for them, so the page lets you move it.',
    claim: null,
  },
  paramsCaption: { text: 'The scenario file’s parameters', claim: null },
  paramsColName: { text: 'Parameter', claim: null },
  paramsColValue: { text: 'Value', claim: null },
  paramsColFrom: { text: 'Where it comes from', claim: null },
  pBase: { text: 'Base year: cost reports and {spendForm} spending', claim: null },
  pBaseV: { text: 'FY{fy}', claim: null },
  pBaseFrom: { text: 'This site’s choice: re-based when a newer year’s reports are mostly settled', claim: null },
  pUninsured: { text: 'Become uninsured', claim: null },
  pUninsuredFrom: { text: 'The Congressional Budget Office’s estimate for the requirement', claim: 'WR-11' },
  pStill: { text: 'Care still given, uninsured', claim: null },
  pStillFrom: { text: 'Dobson DaVanzo for the Commonwealth Fund: one less the drop in use', claim: 'WR-12' },
  pUse: { text: 'Use rate', claim: null },
  pUseV: { text: '{min} to {max}, default {def}', claim: null },
  pUseFrom: { text: 'This site’s what-if', claim: null },
  pCap: { text: 'Most Medicaid cost a dollar of Medicaid revenue', claim: null },
  pCapV: { text: '{n} dollars', claim: null },
  pCapFrom: { text: 'This site’s data screen', claim: null },
  pDays: { text: 'Fewest Medicaid days for a hospital’s own share', claim: null },
  pDaysV: { text: '{n} days', claim: null },
  pDaysFrom: { text: 'This site’s floor', claim: null },
  pPart: { text: 'Shortest report counted as a full year', claim: null },
  pPartV: { text: '{n} days', claim: null },
  pPartFrom: { text: 'This site’s flag; the dollars stay as filed', claim: null },
  pFence: { text: 'Margin outlier fence', claim: null },
  pFenceV: { text: '{n} interquartile ranges past the quartiles', claim: null },
  pFenceFrom: { text: 'This site’s screen', claim: null },
  pMiur: { text: 'Safety-net flag: Medicaid day share', claim: null },
  pMiurV: { text: 'state mean + {n} standard deviation', claim: null },
  pRev: { text: 'Safety-net flag: Medicaid revenue', claim: null },
  pRevV: { text: 'over {share} of patient revenue', claim: null },
  pFlagFrom: { text: 'This site’s flag', claim: null },

  // The three cases.
  casesHeading: { text: 'The three cases', claim: null },
  casesText: {
    text: 'Low, middle and high are Urban Institute and RWJF’s high, medium and low state mitigation: their projections of how much the work requirement alone reduces average monthly expansion enrollment, state by state (Appendix Table {table}). Nationally that is {low}, {middle} and {high} million fewer enrollees.',
    claim: ['WR-03', 'WR-18'],
  },
  casesMap: {
    text: 'Mitigation is the choices a state makes to keep covered the people who meet the requirement or are exempt from it, so Urban’s high mitigation is this page’s low case.',
    claim: ['WR-03', 'WR-05'],
  },
  casesSame: { text: 'Within a case every state makes the same choices; states differ only in who their expansion enrollees are.', claim: 'WR-09' },
  casesOfficial: {
    text: 'CMS’s rule projects an enrollment decline about the size of the low case’s in each year after the first, so the page marks it on the low case as a small note. Middle is the page’s default, not a forecast of what is most likely.',
    claim: ['WR-03', 'WR-04'],
  },

  // What the method can't tell you.
  limitsHeading: { text: 'What the method can’t tell you', claim: null },
  limWhenHead: { text: 'When, or how much in later years.', claim: null },
  limWhen: { text: 'It applies a projected decline to the base year’s cost reports, in FY{fy} dollars: no growth, no inflation, and no change in how hospitals or states respond.', claim: null },
  limStatesHead: { text: 'What each state will do.', claim: null },
  limStates: { text: 'Urban gives every state the same choices within a case; a state that does more or less to keep people covered will see a smaller or larger decline.', claim: 'WR-09' },
  limWhoHead: { text: 'Who loses coverage.', claim: null },
  limWho: { text: 'A state’s decline is an average. The people who lose coverage may use more or less hospital care than the average expansion adult; the use rate lets you test that, and nothing here measures it.', claim: null },
  limServiceHead: { text: 'How the share splits by service.', claim: null },
  limService: {
    text: '{spendForm} gives the expansion group’s spending as a summary, not by service, so a hospital’s share comes from all the state’s Medicaid spending, scaled by its inpatient days, though much of its Medicaid revenue is outpatient.',
    claim: 'WR-16',
  },
  limMaternityHead: { text: 'Maternity care.', claim: null },
  limMaternity: { text: 'The adjustment counts only the nursery and labor-and-delivery days the cost report lists apart; other maternity days sit among adult days, so it moves few hospitals and may move an obstetric hospital too little.', claim: null },
  limIncomeHead: { text: 'What hospitals will do.', claim: null },
  limIncome: { text: 'Revenue lost is not income lost: care no longer given takes its cost with it, and care given unpaid stays a cost. The margins after are this arithmetic, not a forecast of hospitals’ budgets.', claim: null },
  limStayHead: { text: 'Hospital stays.', claim: null },
  limStay: {
    text: 'The law lets a state’s plan count a month in which a person receives inpatient hospital care as meeting the requirement, when the person asks. The scenario doesn’t model this choice, so it can’t tell how many patients a state that makes it would keep covered.',
    claim: 'WR-22',
  },
  limEarlyHead: { text: 'Early cost reports.', claim: null },
  limEarly: { text: '{settled} of the FY{fy} reports were settled when the file was built; the rest are as filed and may change when settled. Each hospital’s record says which.', claim: null },

  // Lines 2 + 5.
  linesHeading: { text: 'Counting supplemental payments: lines {a} + {b}', claim: null },
  linesText: {
    text: 'The scenario takes its loss from Medicaid net revenue, {revSheet} line {a}. Adding the hospital’s Medicaid supplemental payments on line {b} raises revenue at risk, and the revenue lost with it; the hospital’s own share scales line {b} as it does line {a}.',
    claim: null,
  },
  linesNumbers: {
    text: 'With lines {a} + {b}, revenue lost runs {low} to {high} a year, {middle} in the middle case, against {baseLow} to {baseHigh} ({baseMiddle}) on line {a} alone. Added uncompensated care barely moves, {added} against {baseAdded} in the middle case: it is the same patients’ care. {falls} hospitals lose a point or more of operating margin in the middle case, against {baseFalls}.',
    claim: null,
  },
  linesWhy: {
    text: 'This site keeps line {a} alone as the decided method because it can’t tell how much of a hospital’s supplemental payments would leave with the patients who lose coverage; this version shows the totals if they left in the same share.',
    claim: null,
  },

  // The sensitivities.
  sensHeading: { text: 'Other choices, and how far the totals move', claim: null },
  sensText: { text: 'Each row reruns every hospital with one choice changed and the rest as decided.', claim: null },
  sensDsh: {
    text: 'The net-of-DSH row takes disproportionate share hospital payments out of each state’s Medicaid spending before the expansion share is worked out, from CMS’s Financial Management Report, which gives each state’s spending by program.',
    claim: 'WR-17',
  },
  sensTakeaway: { text: 'Revenue lost a year, low case to high, under the decided method and each alternative. Of the method’s own choices, the one that moves the middle case most: {most}. The use rate rows are the what-if’s two ends.', claim: null },
  sensTakeawayTie: { text: 'Revenue lost a year, low case to high, under the decided method and each alternative. Of the method’s own choices, two move the middle case about equally, more than the rest: {a} and {b}. The use rate rows are the what-if’s two ends.', claim: null },
  sensAlt: { text: 'Bands of revenue lost a year, low case to high, one row per version of the method. Decided method: {low} to {high}, middle {middle}. {rows}', claim: null },
  sensAltRow: { text: '{label}: {low} to {high}, middle {middle}.', claim: null },
  sensTip: { text: '{label}: {low} to {high}; middle {middle}', claim: null },
  sensAxis: { text: 'Revenue lost a year', claim: null },
  sensNote: { text: 'Dot: the middle case; dashed: the decided method’s middle.', claim: null },
  sensSource: { text: 'This site’s reruns of the scenario file, FY{fy} cost reports (CMS HCRIS)', claim: null },
  sensColVersion: { text: 'Version', claim: null },
  sensColLow: { text: 'Low', claim: null },
  sensColMiddle: { text: 'Middle', claim: null },
  sensColHigh: { text: 'High', claim: null },
  sensColAdded: { text: 'Added uncompensated care, middle', claim: null },
  sensColFalls: { text: 'Lose a point of margin, middle', claim: null },
  sens_decided: { text: 'Decided method', claim: null },
  sens_line2_5: { text: 'Lines {a} + {b} counted', claim: null },
  sens_share_next_year: { text: 'Next year’s expansion share (federal FY{next})', claim: null },
  sens_share_net_of_dsh: { text: 'Expansion share net of DSH', claim: null },
  sens_use_low: { text: 'Use rate at {pct}', claim: null },
  sens_use_high: { text: 'Use rate at {pct}', claim: null },
  sens_state_share_only: { text: 'State share only, no hospital adjustment', claim: null },
  sensShort_share_next_year: { text: 'Next year’s share (FY{next})', claim: null },
  sensShort_state_share_only: { text: 'State share only', claim: null },

  // Who has no scenario.
  noneHeading: { text: 'Who has no scenario', claim: null },
  noneText: {
    text: 'The requirement applies to adults in Medicaid’s expansion group and to adults covered by a waiver whose coverage is equivalent to minimum essential coverage. Urban projects declines for expansion enrollees, so the {n} states that did not expand Medicaid ({list}) have no scenario: their {h} hospitals show the reason and no number.',
    claim: ['WR-02', 'WR-03'],
  },
  noneGeorgia: {
    text: 'Through Georgia Pathways to Coverage, a waiver demonstration, Georgia covers some adults with incomes up to the poverty line, on the condition that they meet a community engagement requirement; it is the only state that already makes community engagement a condition of Medicaid eligibility for some adults. Urban expects the law to reach waiver programs in some states that did not expand Medicaid, but leaves Pathways out of its projections, so Georgia’s hospitals have no scenario either.',
    claim: ['WR-13', 'WR-14', 'WR-15'],
  },
  noneWisconsin: {
    text: 'Urban’s table includes {state}’s waiver enrollees, but {state}’s {spendForm} reports show no expansion group, so the method has no expansion share to apply, and its {n} hospitals have no scenario.',
    claim: ['WR-16', 'WR-23'],
  },
  noneTerritories: { text: 'The territories ({list}) are not in Urban’s state table, so their {n} hospitals have no scenario.', claim: 'WR-18' },
  noneNoReport: { text: '{n} hospitals have no FY{fy} cost report in CMS’s file, so the scenario has nothing to measure; each shows the reason, never a number.', claim: null },
  noneQuarters: {
    text: '{states}: the pinned {spendForm} file has no complete federal FY{fy} for them, so their latest four quarters stand in, and their next-year and net-of-DSH shares equal the base share.',
    claim: null,
  },
  noneMaryland: { text: 'Maryland is left out for another reason, below.', claim: null },

  // Maryland.
  mdHeading: { text: 'Maryland', claim: null },
  mdText: {
    text: 'Maryland’s hospitals are paid under an all-payer model: every payer pays them at rates set by the state’s Health Services Cost Review Commission (HSCRC).',
    claim: ['WR-10', 'WR-19'],
  },
  mdUcc: {
    text: 'HSCRC factors the cost of uncompensated care into those rates. The scenario takes each hospital’s loss from its own margin, which doesn’t fit hospitals whose rates carry uncompensated care, so this site doesn’t model Maryland: its {n} hospitals are out of every total and the ranking, and each shows the reason.',
    claim: 'WR-20',
  },
  mdHscrc: {
    text: 'HSCRC has made its own estimate of what the law’s coverage changes add to its hospitals’ uncompensated care, and expects the work requirement’s inpatient part to be near zero, reasoning that an inpatient stay can exempt a person from it. Under the law that is a state’s option, at the person’s request. For Maryland, read {link}.',
    claim: ['WR-21', 'WR-22'],
  },
  mdHscrcLink: { text: 'HSCRC’s estimate', claim: null },

  // The screens.
  scrHeading: { text: 'Screens: filing errors, outliers and the day floor', claim: null },
  scrIntro: { text: 'Of the {total} hospitals in scenario states:', claim: null },
  scrFilingHead: { text: 'Filing errors.', claim: null },
  scrFiling: { text: 'A cost report showing Medicaid revenue below zero, or more Medicaid revenue than patient revenue, is screened out: the hospital gets no loss and shows the reason. {n} hospitals.', claim: null },
  scrOutliersHead: { text: 'Margin outliers.', claim: null },
  scrOutliers: {
    text: 'An operating margin more than {iqr} interquartile ranges below the first quartile or above the third is an outlier. The hospital’s loss stays in every dollar total, and its margins show on its hospital record, but it is left out of the margin roll-ups: the margins before and after, and the counts of hospitals losing a point or going from a positive to a negative margin. {n} hospitals. Filing errors leave the margin roll-ups too.',
    claim: null,
  },
  scrFloorHead: { text: 'The day floor.', claim: null },
  scrFloor: { text: 'Below {days} Medicaid inpatient days, a hospital’s own maternity split is too unsteady from year to year to use, so it keeps its state’s share unchanged. {n} hospitals.', claim: null },
  scrPartHead: { text: 'Part years.', claim: null },
  scrPart: { text: 'A report covering fewer than {days} days is used as filed, not stretched to a year, and flagged. {n} hospitals.', claim: null },
  scrCapHead: { text: 'The cost ratio.', claim: null },
  scrCap: { text: 'Medicaid cost above {cap} dollars a dollar of Medicaid revenue is read as a data error and held there. {n} hospitals.', claim: null },
  scrNoneHead: { text: 'No Medicaid revenue.', claim: null },
  scrNone: { text: 'A hospital that reports none on line {a} loses nothing and shows the reason, never a zero. {n} hospitals.', claim: null },

  // The safety-net flag.
  safetyHeading: { text: 'Our safety-net flag', claim: null },
  safetyText: {
    text: 'The safety-net chip in step one is this site’s flag, not an official list. A hospital is flagged when its Medicaid share of inpatient days is at least {sds} standard deviation above its state’s mean (over every hospital in the state’s cost report file with Medicaid days, of any type), or when its Medicaid revenue, lines {a} + {b}, is more than {share} of its patient revenue.',
    claim: null,
  },
  safetyCount: { text: 'Across every state and territory, Maryland’s included, the flag marks {n} hospitals with a cost report; {s} of them are in scenario states and go through the four steps.', claim: null },

  // Exposed on both.
  bothHeading: { text: 'Exposed on both', claim: null },
  bothText: {
    text: 'Step five’s corner holds the hospitals exposed on both. A hospital is in it when its loss in the case shown is {share} or more of its patient revenue, at your use rate, and its FY{pfy} Medicare penalties (readmissions plus hospital-acquired conditions, this site’s estimates) as a share of the same patient revenue are in the top quarter: at or above the {pctile} percentile of that share, {cut} today.',
    claim: null,
  },
  bothPop: {
    text: 'The percentile is taken over the hospitals Figure five plots: the {n} hospitals step one draws that have an FY{pfy} penalty estimate, those with no penalty included. Both lines are this site’s framing, not a rule of CMS’s or Urban’s.',
    claim: null,
  },

  // The sources.
  srcHeading: { text: 'Sources and files', claim: null },
  srcText: {
    text: 'Every input is a public file or an extract of one, pinned byte for byte in this site’s repository: the build reads only these copies, and a test fails if a byte changes. Each {hash} is the pinned copy’s. A dash for the source’s date means the source gives no date of its own; the day this site retrieved it is always shown.',
    claim: null,
  },
  srcGroup_scenario: { text: 'The scenario’s inputs', claim: null },
  srcGroup_hospitals: { text: 'The hospital list: names, places and kinds', claim: null },
  srcGroup_penalties: { text: 'The Medicare penalty estimates beside the scenario', claim: null },
  srcColFile: { text: 'File', claim: null },
  srcColDate: { text: 'Source’s date', claim: null },
  srcColGot: { text: 'Retrieved', claim: null },
  srcColHash: { text: '{hash}', claim: null },
  srcNoDate: { text: '—', claim: null },
  srcPublishedSub: { text: 'Published sources quoted', claim: null },
  srcLaw: { text: 'The law: the enrolled text of the reconciliation act', claim: null },
  srcRule: { text: 'CMS’s rule on the community engagement requirement', claim: null },
  srcCbo: { text: 'CBO’s cost estimate for the law’s Medicaid chapter', claim: null },
  srcUrban: { text: 'Urban Institute and RWJF’s state projections', claim: null },
  srcCwf: { text: 'Dobson DaVanzo’s technical appendix for the Commonwealth Fund', claim: null },
  srcPathways: { text: 'Georgia’s Pathways extension request', claim: null },
  srcHscrc: { text: 'HSCRC on uncompensated care', claim: null },
  srcHscrcDeck: { text: 'HSCRC’s estimate for its payment models workgroup', claim: null },
  srcCode: { text: 'The code that builds the file and these pages, its tests and the register of every claim the site makes: {repo}.', claim: null },
  srcCodeLink: { text: 'the repository', claim: null },

  // Changes and corrections.
  changesHeading: { text: 'Changes and corrections', claim: null },
  changesText: {
    text: 'This page describes methods version {v} of the scenario file. A change to the method gets a new version in the repository’s methods log; a correction to a number gets a dated entry in the family’s {log}.',
    claim: null,
  },
  changesLog: { text: 'corrections log', claim: null },

  // The citation block.
  citeHeading: { text: 'Cite this page', claim: null },
  citeText: { text: '{site}. {title}. {url}. Methods version {v}; numbers of {date}.', claim: null },
  citeCopy: { text: 'Copy citation', claim: null },
  citeCopied: { text: 'Copied.', claim: null },
  citeFailed: { text: 'Could not copy. The citation is selected; copy it with your keyboard.', claim: null },
};

// fill and t give each {spendForm}, {revSheet}, {marginSheet} or {hash} in a text its name (constants.js FORM_NAMES), as the copy gate
// keeps digits out of copy; the caller fills the rest.
const base = copyOf(COPY, SHARED);
const named = (key, values = {}) => {
  const text = copyText(COPY[key] ?? SHARED[key] ?? '');
  return { ...Object.fromEntries(Object.entries(FORM_NAMES).filter(([name]) => text.includes(`{${name}}`))), ...values };
};
export const fill = (key, values) => base.fill(key, named(key, values));
export const fillKeep = (key, values, keep) => base.fillKeep(key, named(key, values), keep);
export const t = (key) => fill(key);
