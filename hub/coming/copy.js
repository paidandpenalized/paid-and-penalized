// The words of the placeholder pages (hub/coming.js), one at the folder of each program with no page here. They say what
// is so (the page is not built; the program is under consideration) and promise no page and no date. No digit
// characters: numbers arrive through {placeholders}. The buttons' first word is the family's (web/copy.js allPrograms).
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // The kicker: "<abbreviation> · <what the program does to payment> · <status>". The directory on the front page names
  // three of the groups (hub/home/copy.js soonPrice, soonReporting, soonEpisode) and the page reads them from there; the
  // quality programs are live cards there, so their name is only here. The status: a program the dollar estimates
  // already include has only its page to build; the rest are under consideration, as the directory and the footer say.
  groupQuality: 'Quality programs',
  statusInData: 'Page not built yet',
  statusConsidered: 'Under consideration',

  // The second button, to the live programs on the front page.
  livePrograms: 'The live programs',

  // The status card: its title bar ("<abbreviation> · Page status", with the fiscal year at its right when the card
  // shows a figure), the hatched band, then two fields, under the stamp. Figures: HVBP's estimate from the dollar file
  // ({amount} money, {fy} the year), and for the rest none.
  cardTitle: '{ab} · Page status',
  band: "This program's page isn't built yet.",
  programLabel: 'Program',
  figuresLabel: 'Figures',
  figuresMoved: '{amount} moved between hospitals, estimated FY{fy}',
  figuresNone: 'Not estimated here',
  stamp: 'Not built',

  // The request under the card; {feedback} is the link to the feedback form (hub/copy.js feedbackForm).
  ask: 'Want this one? Say so on the {feedback}.',
});
