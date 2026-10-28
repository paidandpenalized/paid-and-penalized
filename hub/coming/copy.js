// The words of the coming-soon pages (hub/coming.js), one at the folder of each program still to come. No digit
// characters: numbers arrive through {placeholders}. The buttons' first word is the family's (web/copy.js allPrograms).
import { typesetCopy } from '../../web/render/components.js';

// Typeset once (straight apostrophes and quotes to curly), as every page shows them.
export const COPY = typesetCopy({
  // The kicker: "<abbreviation> · <what the program does to payment> · Coming". The directory on the front page names three
  // of the groups (hub/home/copy.js soonPrice, soonReporting, soonEpisode) and the page reads them from there; the quality
  // programs are live cards there, so their name is only here.
  groupQuality: 'Quality programs',
  coming: 'Coming',

  // The second button, to the live programs on the front page.
  livePrograms: 'The live programs',

  // The status card: its title bar ("<abbreviation> · Page status", the fiscal year at its right), the hatched band, then
  // two fields. Figures: HVBP's estimate from the dollar file ({amount} money, {fy} the year), and for the rest none yet.
  cardTitle: '{ab} · Page status',
  comingBand: "This program's page is coming.",
  programLabel: 'Program',
  figuresLabel: 'Figures',
  figuresMoved: '{amount} moved between hospitals, estimated FY{fy}',
  figuresNone: 'None until computed from CMS files',

  // The request under the card; {feedback} is the link to the feedback form (hub/copy.js feedbackForm).
  sooner: 'Want this one sooner? Say so on the {feedback}.',
});
