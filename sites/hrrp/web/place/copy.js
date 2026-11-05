// Ported from Thirty Day Readmissions (web/src/js/views/scope.js at 33d1959).
// The words of a place's page (a Census region, a division, a state or a metro area): its head, deck and the six-field
// card. The deck's first sentence and the Penalized note are in ../copy.js (wording.js builds them). No digit characters.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';

export const COPY = {
  // The page's head.
  pageTitle: { text: '{name}: Hospital Readmissions Reduction Program, {edition}', claim: null },
  pageDescription: { text: '{name}: {lead}', claim: null },

  // The kicker over the name.
  kindRegion: { text: 'Census region', claim: null },
  kindDivision: { text: 'Census division', claim: null },
  kindState: { text: 'State', claim: null },
  kindMetro: { text: 'Metro area', claim: null },
  kindSpans: { text: '{kind} · spans {states}', claim: null },

  // The deck: the first sentence is wording.js deckLead; then the average cut, the state's rank, the total.
  deckAvgOne: { text: 'The average cut, counting its one hospital, is {pct}', claim: null },
  deckAvgMany: { text: 'The average cut, counting all {hospitals}, is {pct}', claim: null },
  deckRankFirst: { text: ', the largest among the {n} states{dc} in the program. ', claim: null },
  deckRankNth: { text: ', the {nth}-largest among the {n} states{dc} in the program. ', claim: null },
  deckNoRank: { text: '. ', claim: null },
  deckAndDc: { text: ' and DC', claim: null },
  deckTotal: { text: 'Estimated total: ', claim: null },
  deckTotalEnd: { text: '.', claim: null },
  deckTotalNote: { text: ' ({note})', claim: null },

  // The six-field card.
  cardTitle: { text: '{name} · {edition}', claim: null },
  cardVs: { text: 'Compared with all hospitals nationally', claim: null },
  kpiHospitals: { text: 'Hospitals', claim: null },
  kpiPenalized: { text: 'Penalized', claim: null },
  kpiMean: { text: 'Average cut', claim: null },
  kpiGe: { text: 'Cut {pct} or more', claim: null },
  kpiGeNote: { text: '{share} of hospitals (nation {nation})', claim: null },
  kpiMax: { text: 'At the {cap}% cap', claim: 'HRRP-09' },
  kpiDollars: { text: 'Estimated dollars', claim: null },

  // The way down to the places inside this one.
  childrenDivisions: { text: 'Divisions', claim: null },
  childrenStates: { text: 'States', claim: null },
  childrenMetros: { text: 'Metro areas', claim: null },
  childPart: { text: '{name} ({st} part)', claim: null },
  childOutside: { text: 'Outside metro areas', claim: null },
  childCount: { text: '{hospitals}', claim: null },
  back: { text: 'Back to the program page', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE);
