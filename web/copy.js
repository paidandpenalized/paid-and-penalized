// Fixed words shared by every page's header and footer, and the chart kit's figure frame (web/charts/figure.js).
// No digit characters: numbers never live in copy files.
import { typesetCopy } from './render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  skip: 'Skip to content',
  // The family bar (render/shell.js): the wordmark, and the compact mark a phone shows in its place ("P&" in ink, the
  // last "P" in the penalty red, as the wordmark's "Penalized"); the tagline beside it; the phone's search button and
  // the theme toggle, each named for screen readers (they show an icon).
  wordmarkLead: 'Paid &',
  wordmarkPen: 'Penalized',
  markLead: 'P&',
  markPen: 'P',
  tagline: 'Public Medicare data, made visible.',
  find: 'Find a hospital or state',
  themeToggle: 'Dark mode',
  // The followed hospital's chip: its key, the words a screen reader hears before its net, and the stop link's name.
  chipKey: 'Hospital',
  chipNet: 'Estimated FY{fy} net:',
  chipStop: 'Stop following {name}',
  // The program tabs (and the footer's first field): their name, the first tab, the gap before the coming programs,
  // and a coming tab's title.
  programs: 'Programs',
  allPrograms: 'All programs',
  coming: 'coming',
  comingTitle: '{name} ({ab}): coming',
  // A program's numbered section menu.
  navLabel: 'Sections',
  // The footer, the back of the form: its four fields, their words, then the signature lines.
  footSite: 'The site',
  footAsOf: 'Data as of',
  footFeedback: 'Feedback',
  footEstimated: 'Estimated FY{fy}:',
  footMoved: '{amount} moved',
  footComing: 'Coming:',
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
  // Each program's one-sentence dek (web/programs.js fills the placeholders from the programs' rules): on the shell's
  // coming-soon pages, the home page's directory and a program's tab. dekHrrp says "in the thirty days after leaving"
  // where CMS says "within", since the house-words test reads "within" as a promised time.
  dekHrrp: 'Cuts pay by up to {cap} when more patients than expected return to the hospital in the thirty days after leaving.',
  dekHacrp: 'Cuts pay by a flat {cut} for the quarter of hospitals with the highest infection and patient-safety scores.',
  dekHvbp: 'Holds back {withhold} of pay and returns it by quality score, as a bonus or a net cut. Budget-neutral by design.',
  dekWageIndex: 'Raises or lowers the labor share of each payment to match local wages.',
  dekDsh: 'Adds payments for hospitals that serve many low-income patients, plus a share of an uncompensated-care pool.',
  dekIme: 'Adds payments for hospitals that train medical residents.',
  dekIqr: "Hospitals that don't report required quality data lose a quarter of their yearly payment increase.",
  dekPi: 'Hospitals that miss electronic health record requirements lose three-quarters of their yearly increase.',
  dekTeam: 'In selected areas, hospitals earn or owe money against a spending target for five surgeries.',
});
