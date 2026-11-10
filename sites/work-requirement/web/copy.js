// The work-requirement site's words. No digit characters: every number arrives through a {placeholder}, formatted
// before it is filled. A sentence that states a fact about the law carries the claim id (or ids) of its row in
// sites/work-requirement/CLAIMS.md; the rest are null. The page's dek is the family's (web/copy.js dekWorkRequirement,
// through web/programs.js programDek), so the directory and the page say one thing.
import { copyOf } from '../../../web/render/components.js';

export const COPY = {
  // The program page: the line above its title, and its description for search results and link previews.
  kicker: { text: 'Medicaid · a scenario, not a payment', claim: null },
  description: {
    text: 'A scenario, not a payment: how much Medicaid revenue each hospital could lose under the Medicaid work requirement, from the low case to the high.',
    claim: null,
  },

  // The five steps (constants.js SECTIONS), each a heading and its label in the section menu.
  navFinding: { text: 'What hospitals could lose', claim: null },
  navHow: { text: 'How the scenario works', claim: null },
  navStates: { text: 'State by state', claim: null },
  navHospital: { text: 'One hospital', claim: null },
  navBoth: { text: 'Exposed on both', claim: null },

  // The Methods page.
  methodsKicker: { text: 'Methods', claim: null },
  methodsHeading: { text: 'How the work-requirement scenario is built', claim: null },
  methodsDescription: { text: 'How this site models what the Medicaid work requirement could cost each hospital: its sources, its steps and what it can’t tell you.', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY);
