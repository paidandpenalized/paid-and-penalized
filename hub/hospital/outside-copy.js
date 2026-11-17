// The words of the page of a hospital outside Medicare's penalty programs (a hospital in the hospital master that the
// dollar file does not estimate: hub/outside.js). Each group of outside hospitals (LIKE_GROUPS) has a reason, keyed
// "reason.<group>", and, where Medicare pays it another way, "reasonInstead.<group>"; three have a line on a quality
// program of their own ("own.<group>"). inactive has no reason: its page shows the closed note (web/copy.js closed*).
// No digit characters: numbers arrive through {placeholders}, and the rules' numbers through their named constants
// (web/programs.js), which fillOutside fills in itself. Never count the programs: "Medicare's penalty programs", and in
// a reason "Medicare's hospital penalty programs". The page's other words (pagesHeading, the closed note) are
// hub/hospital/copy.js's and web/copy.js's.
import { has } from '../../engine/js/has.js';
import { CAH_COST_PCT, IPFQR_REDUCTION_PTS, rulePercent } from '../../web/programs.js';
import { copyText, fillCopy, typesetCopy } from '../../web/render/components.js';
import { spelled } from '../../web/render/format.js';

// The sentence that every IPPS-based reason ends on, as its claims: the value-based purchasing and hospital-acquired
// conditions programs apply to subsection (d) hospitals (HUB-29), as Readmissions does, and those are the hospitals
// paid under the inpatient prospective payment system (HACRP-18).
const IPPS = ['HUB-29', 'HACRP-18'];

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // The stamp over the reason (stamp--ink). The page adds the desktop line break before "penalty".
  stamp: "Not in Medicare's penalty programs",

  // Why the programs don't adjust its pay, by group, then how Medicare pays it instead.
  'reason.critical_access': {
    text: "Critical access hospitals are small rural hospitals that Medicare pays on their reasonable costs, not under the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HUB-30', 'HRRP-13', ...IPPS],
  },
  'reasonInstead.critical_access': { text: "Medicare pays them {costPct} of their reasonable costs, or less for one that misses Medicare's electronic health record requirements.", claim: 'HUB-27' },
  'reason.psychiatric': {
    text: "Psychiatric hospitals are paid outside the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HRRP-12', ...IPPS],
  },
  'reasonInstead.psychiatric': { text: 'Medicare pays them under its own prospective payment system for psychiatric hospitals, a set amount for each day of a stay.', claim: 'HUB-31' },
  'reason.childrens': {
    text: "Children's hospitals are paid outside the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HRRP-12', ...IPPS],
  },
  'reasonInstead.childrens': { text: 'Medicare pays them on their reasonable costs, with a ceiling on how fast their inpatient operating costs per stay may rise.', claim: 'HUB-33' },
  'reason.cancer': {
    text: "Hospitals Medicare classifies as cancer hospitals are paid outside the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HRRP-12', ...IPPS],
  },
  'reasonInstead.cancer': { text: 'Medicare pays them on their reasonable costs, with a ceiling on how fast their inpatient operating costs per stay may rise.', claim: 'HUB-33' },
  'reason.long_term': {
    text: "Long-term care hospitals are paid outside the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HRRP-12', ...IPPS],
  },
  'reasonInstead.long_term': { text: 'Medicare pays them under its own prospective payment system for long-term care hospitals.', claim: 'HUB-32' },
  'reason.rural_emergency': {
    text: "Rural emergency hospitals give emergency and other outpatient care, not inpatient hospital care, so they have no stays for the inpatient prospective payment system that Medicare's hospital penalty programs adjust.",
    claim: ['HUB-34', ...IPPS],
  },
  'reasonInstead.rural_emergency': { text: "Medicare pays them its hospital outpatient rate for each service plus a set percentage, and a monthly facility payment.", claim: 'HUB-35' },
  // Federal hospitals: Medicare's hospital insurance (Part A) bars payment to them, apart from narrow exceptions.
  'reason.va': {
    text: "VA medical centers are federal hospitals, which Medicare's hospital insurance doesn't pay apart from narrow exceptions, so Medicare's hospital penalty programs leave them out.",
    claim: 'HUB-36',
  },
  'reason.dod': {
    text: "Department of Defense hospitals are federal hospitals, which Medicare's hospital insurance doesn't pay apart from narrow exceptions, so Medicare's hospital penalty programs leave them out.",
    claim: 'HUB-36',
  },
  // A hospital CMS's files don't list: no reason, only the file that leaves it out, each named by its year. {hacrpFy},
  // {hrrpFy}: the master's programYears. A Puerto Rico hospital gets notInHrrpPuertoRico for Readmissions instead.
  notListedBoth: "CMS's FY{hacrpFy} hospital-acquired conditions file and FY{hrrpFy} Readmissions file don't list this hospital.",
  notListedHacrp: "CMS's FY{hacrpFy} hospital-acquired conditions file doesn't list this hospital.",
  notListedHrrp: "CMS's FY{hrrpFy} Readmissions file doesn't list this hospital.",
  notInHrrpPuertoRico: {
    text: "The Readmissions program covers hospitals in the fifty states and the District of Columbia, so Puerto Rico's hospitals are not in it.",
    claim: ['HRRP-11', 'HRRP-16'],
  },

  // A quality program of the hospital's own, beside the count of hospitals like it.
  'own.critical_access': {
    text: 'Their quality reporting, through the Medicare Beneficiary Quality Improvement Project that the Health Resources and Services Administration created for them, is voluntary.',
    claim: ['HUB-37', 'HUB-38'],
  },
  'own.psychiatric': { text: "Medicare requires them to report quality data: one that doesn't has {ipfqrPts} percentage points taken off its yearly payment update.", claim: 'HUB-28' },
  'own.va': { text: 'The VA publishes its own quality data on how its medical centers meet quality standards.', claim: 'HUB-39' },

  // Hospitals like this one: the count of its group on the master and in its state. {kinds}: likeCount.<group>; {state}:
  // the state's name (likeTextNoState for a code STATE_NAMES lacks). likeTextSome*: a group some of whose hospitals a
  // program file lists ({k} of them: the Readmissions-only not_listed hospitals).
  likeHeading: 'Hospitals like this one',
  'likeCount.critical_access': 'critical access hospitals',
  'likeCount.psychiatric': 'psychiatric hospitals',
  'likeCount.va': 'VA medical centers',
  'likeCount.dod': 'Department of Defense hospitals',
  'likeCount.childrens': "children's hospitals",
  'likeCount.not_listed': "acute care hospitals that a CMS program file doesn't list",
  'likeCount.rural_emergency': 'rural emergency hospitals',
  'likeCount.cancer': 'cancer hospitals',
  'likeCount.inactive': 'acute care hospitals whose Medicare agreements CMS lists as ended',
  'likeCount.long_term': 'long-term care hospitals',
  likeText: "{n} {kinds} are on Medicare's hospital list, {ns} of them in {state}. Medicare's penalty programs adjust none of them.",
  likeTextNoState: "{n} {kinds} are on Medicare's hospital list. Medicare's penalty programs adjust none of them.",
  likeTextSome: "{n} {kinds} are on Medicare's hospital list, {ns} of them in {state}. Medicare's penalty programs adjust {k} of them.",
  likeTextSomeNoState: "{n} {kinds} are on Medicare's hospital list. Medicare's penalty programs adjust {k} of them.",

  // The nearest hospitals with an estimate: the heading, the caption ({miles}: the closest one's distance, formatted;
  // {k} of the {n} nearest with a net cut, in words for none and all) and the table's columns.
  nearHeading: "The nearest hospitals in Medicare's penalty programs",
  nearCaption: 'The closest is {miles} away; the programs cut {k} of the {n} nearest on net.',
  nearCaptionNone: 'The closest is {miles} away; the programs cut none of the {n} nearest on net.',
  nearCaptionAll: 'The closest is {miles} away; the programs cut all {n} nearest on net.',
  nearColRank: '#',
  nearColHospital: 'Hospital',
  nearColMiles: 'Miles',
  nearColNet: 'Estimated FY{fy} net change',
  nearColShare: 'Share of Medicare inpatient pay',

  // The Medicaid band's dek on this page (medicaidBand's note).
  wbNoteOutside: "Medicare's penalty programs don't touch this hospital, but Medicaid's work requirement could. A scenario, not a payment.",

  // The source line at the page's foot: the hospital master's own files ({hacrpFy}, {hrrpFy}: the master's programYears),
  // and, on a page that shows the nearest hospitals' estimated dollars, the dollar model after it.
  sourceOutside: "Source: this site's hospital list, from CMS's Care Compare hospital file, inpatient prospective payment system impact file and Provider of Services file, and CMS's FY{hacrpFy} hospital-acquired conditions and FY{hrrpFy} Readmissions files, which say whether a hospital is in each program.",
  sourceOutsideDollars: "The nearest hospitals' dollars come from this site's dollar model.",

  // The page's description: a group with reasonInstead, a federal hospital, a not_listed one and an inactive one.
  descriptionOutside: "{name} in {place}: why Medicare's hospital penalty programs don't adjust its pay, and how Medicare pays it instead.",
  descriptionOutsideFederal: "{name} in {place}: why Medicare's hospital penalty programs don't adjust its pay.",
  descriptionOutsideNotListed: "{name} in {place}: its Medicare record, and which of CMS's penalty program files list it.",
  descriptionOutsideClosed: "{name} in {place}: its Medicare record. CMS lists its Medicare agreement as ended.",
});

export const hasOutside = (key) => has(COPY, key);

// The rules' numbers, by placeholder, as the sentences print them: "101%" and "two". Worked out once.
const RULES = Object.entries({ costPct: rulePercent(CAH_COST_PCT), ipfqrPts: spelled(IPFQR_REDUCTION_PTS) });

// COPY[key] typeset, with its rule placeholders filled from web/programs.js and the rest from values (strings, formatted).
// A missing key, a missing value or an unused one throws (fillCopy).
export function fillOutside(key, values = {}) {
  const text = has(COPY, key) ? copyText(COPY[key]) : '';
  const rules = Object.fromEntries(RULES.filter(([name]) => text.includes(`{${name}}`)));
  return fillCopy(COPY, key, { ...rules, ...values });
}
