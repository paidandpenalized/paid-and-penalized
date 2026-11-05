// Ported from Thirty Day Readmissions (web/src/js/views/home.js and views/methods.js at 33d1959).
// The Readmissions program page's words: the hero, the At-a-glance card, the Parts' headings, and the line on who is
// not in the program (the family's 404 page carries it too). No digit characters: every number arrives through a
// {placeholder}. A sentence that states a program rule carries the claim id of its row in sites/hrrp/CLAIMS.md.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';

export const COPY = {
  // The page's head.
  pageTitle: { text: 'Readmissions: the Hospital Readmissions Reduction Program, {edition}', claim: null },
  pageDescription: {
    text: 'Every hospital in the {edition} Hospital Readmissions Reduction Program: who takes a cut, how big it is and how CMS works it out.',
    claim: null,
  },

  // The hero.
  kicker: { text: '{edition} edition · Year {n} of Medicare readmission penalties', claim: null },
  deckLead: {
    text: 'When too many patients land back in the hospital within {days} days of going home, Medicare pays that hospital less for a full year. Starting {pay}, ',
    claim: ['HRRP-04', 'HRRP-06'],
  },
  deckCount: { text: '{nPen} of the {n} hospitals', claim: null },
  deckMid: { text: ' CMS evaluated take a cut. ', claim: null },
  deckShare: { text: 'That is {pct} of the {nMeasured} hospitals measured on at least one condition.', claim: null },
  heroTry: { text: 'Try {state}, {metro}, or {every}. New to this? Start with {how}.', claim: null },
  heroEvery: { text: 'browse every hospital', claim: null },
  heroHow: { text: 'how the penalty works', claim: null },

  // The At-a-glance card, the record form with eight numbered fields.
  glanceTitle: { text: '{edition} at a glance', claim: null },
  glanceSource: { text: 'All figures from CMS unless marked', claim: null },
  glanceEvaluated: { text: 'Hospitals evaluated', claim: null },
  glancePenalized: { text: 'Hospitals penalized', claim: null },
  glancePenalizedNote: { text: '{pct} of the {nMeasured} measured on at least one condition', claim: null },
  glanceMean: { text: 'Average cut, all hospitals', claim: null },
  glanceMeanPen: { text: 'Average cut, penalized only', claim: null },
  glanceMax: { text: 'At the {cap}% maximum', claim: 'HRRP-09' },
  glanceMaxNote: { text: 'hospitals', claim: null },
  glanceDollars: { text: 'Estimated dollars', claim: null },
  glanceDollarsValue: { text: '≈ {money}', claim: null },
  glanceDollarsNote: { text: "Modeled here. CMS's rule-time estimate, from preliminary data: {cms}.{missing}", claim: null },
  glanceWindow: { text: 'Data window', claim: null },
  glanceWindowValue: { text: '{start} – {end}', claim: null },
  glancePay: { text: 'Payment year', claim: null },
  glanceStamp: { text: 'Final · posted {date}', claim: null },

  // The Parts the section menu opens (their figures come with the batches that draw them).
  partTag: { text: 'Part {n}', claim: null },

  // Who is not in the program: the family's 404 page carries this line too (hub/pages.js).
  notInProgram: {
    text: 'The Readmissions program covers the hospitals Medicare pays under its inpatient payment system. A hospital paid another way is not in it, and has no page here.',
    claim: 'HRRP-11',
  },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE);
