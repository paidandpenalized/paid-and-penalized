// The words of the placeholder pages (hub/coming.js), one at the folder of each program with no page here. They say what
// is so (the page is not built; the program is under consideration) and promise no page and no date. No digit
// characters: numbers arrive through {placeholders}. The buttons' first word is the family's (web/copy.js allPrograms).
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // The kicker: "<abbreviation> · <what the program does to payment> · <status>". What it does to payment is the
  // directory's group words (hub/home/copy.js GROUP_WORDS). The status: a program the dollar estimates already include
  // has its page under construction, as the directory says; the rest are under consideration, as the directory and the
  // footer say.
  statusInData: 'Under construction',
  statusConsidered: 'Under consideration',

  // The second button, to the live programs on the front page.
  livePrograms: 'The live programs',

  // The status card: its title bar ("<abbreviation> · Page status", with the fiscal year at its right when the card
  // shows a figure), the hatched band (its own words for a page under construction), then two fields, under the stamp
  // (its own word too). Figures: HVBP's estimate from the dollar file
  // ({amount} money, {fy} the year), and for the rest none.
  cardTitle: '{ab} · Page status',
  band: "This program's page isn't built yet.",
  bandInData: "This program's page is under construction.",
  programLabel: 'Program',
  figuresLabel: 'Figures',
  figuresMoved: '{amount} moved between hospitals, estimated FY{fy}',
  figuresNone: 'Not estimated here',
  stamp: 'Not built',
  stampInData: 'Under construction',

  // The request under the card; {feedback} is the link to the feedback form (hub/copy.js feedbackForm).
  ask: 'Want this one? Say so on the {feedback}.',
});
