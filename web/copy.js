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
  affiliation: 'Uses public data from the Centers for Medicare & Medicaid Services (CMS) and shows no patient information. Not affiliated with or endorsed by CMS.',
  builtWith: 'Built with Claude Code',
  feedback: 'Send feedback',
  methods: 'Methods',
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
});
