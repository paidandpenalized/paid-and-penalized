// Fixed words shared by every page's header and footer, and the chart kit's figure frame (web/charts/figure.js).
// No digit characters: numbers never live in copy files.
import { CHIP } from './chip-copy.js';
import { typesetCopy } from './render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  skip: 'Skip to content',
  // The family bar (render/shell.js): the wordmark, and the compact mark a phone shows in its place ("P&" in ink, the
  // last "P" in the penalty red, as the wordmark's "Penalized"; a screen reader hears it, then markSep, then the words);
  // the tagline beside it; the phone's search button and the theme toggle, each named for screen readers (they show an
  // icon).
  wordmarkLead: 'Paid &',
  wordmarkPen: 'Penalized',
  markLead: 'P&',
  markPen: 'P',
  markSep: ', ',
  tagline: 'Public Medicare data, made visible.',
  find: 'Find a hospital or state',
  themeToggle: 'Dark mode',
  // The followed hospital's chip (key, net, stop link): chip-copy.js, which the shell's script reads too.
  ...CHIP,
  // The program tabs (and the footer's first field): their name and the first tab.
  programs: 'Programs',
  allPrograms: 'All programs',
  // A program's numbered section menu.
  navLabel: 'Sections',
  // The footer, the back of the form: its four fields, their words, then the signature lines.
  footSite: 'The site',
  footAsOf: 'Data as of',
  footFeedback: 'Feedback',
  footEstimated: 'Estimated FY{fy}:',
  footMoved: '{amount} moved',
  footConsidered: 'Under consideration:',
  footFy: 'FY{fy}',
  footEstimates: '{fy} estimates from public CMS files, {n} hospitals.',
  footChanged: 'Estimates last changed {date}.',
  footDates: 'Dates and corrections',
  footStamp: 'Est.',
  footFeedbackNote: 'Opens a Google Form.',
  footForm: 'Form P&P-{yy} · FY{fy}',
  bylineLead: 'Built by',
  bylineName: 'Dalton Haslam, MD, MBA',
  newTab: ' (opens in a new tab)',
  affiliation: 'Uses public data from the Centers for Medicare & Medicaid Services (CMS) and shows no patient information. Not affiliated with or endorsed by CMS or any hospital.',
  builtWith: 'Built with Claude Code',
  feedback: 'Send feedback',
  // The footer's short Terms line, with its link to /terms/, and the family's pages its second field lists.
  termsShort: 'Nothing here is medical, legal or financial advice.',
  termsLink: 'Terms of use',
  methods: 'Methods',
  privacy: 'Privacy',
  corrections: 'Corrections',
  about: 'About',
  accessibility: 'Accessibility',
  licenseLead: 'Text licensed',
  figure: 'Figure',
  showTable: 'Show table',
  downloadCsv: 'Download CSV',
  // Said (to screen readers) when a figure's table is sorted by a column head; the build writes them on the table for
  // web/client/figure.js, which fills in {column}.
  sortedUp: 'Sorted by {column}, ascending',
  sortedDown: 'Sorted by {column}, descending',
  // A figure's claim level, said under the chart when its values are not CMS's own (DES-25 words).
  claimRecomputed: 'This site recomputes',
  claimEstimate: 'Estimate',
  claimHypothetical: 'Hypothetical',
  // Each program's one-sentence dek (web/programs.js fills the placeholders from the programs' rules, in digits or in
  // words): on the placeholder pages of the programs without a page of their own (hub/coming.js), the
  // Readmissions program page and the home page's directory. dekHrrp says "in the {days} days after discharge" where CMS
  // says "within", since the house-words test reads "within" as a promised time. Readmissions' cap and value-based
  // purchasing's withhold are shares of base payments (the base operating DRG payment), not of all inpatient pay; the
  // hospital-acquired conditions cut is a share of the whole payment, so its dek says "pay".
  dekHrrp: "Cuts base payments by up to {cap} when a hospital's risk-adjusted readmissions in the {days} days after discharge run above its peer group's median.",
  dekHacrp: 'Cuts pay by a flat {cut} for {top} of hospitals with the highest infection and patient-safety scores.',
  dekHvbp: 'Holds back {withhold} of base payments and returns it by quality score, as a bonus or a net cut. Budget-neutral by design.',
  dekWageIndex: 'Raises or lowers the labor share of each payment to match local wages.',
  dekDsh: 'Adds payments for hospitals that serve many low-income patients, plus a share of an uncompensated-care pool.',
  dekIme: 'Adds payments for hospitals that train medical residents.',
  // The quality-reporting and electronic-records cuts are shares of the market-basket increase (before the productivity
  // adjustment), which is more than the yearly update a hospital ends up with.
  dekIqr: "Hospitals that don't report required quality data have {share} of the market-basket increase taken off their yearly payment update.",
  dekPi: 'Hospitals that miss electronic health record requirements have {share} of the market-basket increase taken off their yearly update.',
  // Who is not in the Readmissions program: its Methods page and the hub's not-found page both say it (claim HRRP-11).
  notInHrrp: {
    text: "The Readmissions program covers the hospitals in the fifty states and the District of Columbia that Medicare pays under its inpatient payment system, so critical access hospitals, the hospitals paid outside it (children's, cancer, psychiatric, rehabilitation and long-term care hospitals) and Puerto Rico's hospitals are not in it and have no page here.",
    claim: ['HRRP-11', 'HRRP-12', 'HRRP-13', 'HRRP-16'],
  },
  dekTeam: 'In selected areas, hospitals earn or owe money against a spending target for {surgeries} surgeries.',
});
