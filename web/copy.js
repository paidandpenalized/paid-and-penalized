// Fixed words shared by every page's header and footer, and the chart kit's figure frame (web/charts/figure.js).
// No digit characters: numbers never live in copy files.
import { typesetCopy } from './render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  skip: 'Skip to content',
  wordmarkLead: 'Paid &',
  wordmarkPen: 'Penalized',
  bylineLead: 'Built by',
  bylineName: 'Dalton Haslam, MD, MBA',
  newTab: ' (opens in a new tab)',
  themeToggle: 'Dark mode',
  // A program site's top bar (layout.js programHeader): the family's small mark ("P&" in ink, the last "P" in the
  // penalty red, as the wordmark's "Penalized"), its link's full name for screen readers, and the section nav's name.
  markLead: 'P&',
  markPen: 'P',
  markHome: 'Paid & Penalized home',
  navLabel: 'Sections',
  affiliation: 'Uses public data from the Centers for Medicare & Medicaid Services (CMS) and shows no patient information. Not affiliated with or endorsed by CMS or any hospital.',
  builtWith: 'Built with Claude Code',
  feedback: 'Send feedback',
  // The footer's short Terms line, with its link to /terms/, and the links to the other policy pages.
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
