// Ported from Thirty Day Readmissions (web/src/js/views/hospital.js and views/columns.js at 33d1959).
// The words of a hospital's page. No digit characters: every number arrives through a {placeholder}. The verdict
// and rank sentences are in ../copy.js (wording.js builds them); these are the record card's labels and values.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';

export const COPY = {
  // The page's head.
  pageTitle: { text: '{name}, {place}: Hospital Readmissions Reduction Program, {edition}', claim: null },
  // A neutral sentence for a link's preview: no cut and no dollar figure in it.
  pageDescription: {
    text: '{name}, {place}: its record in the {edition} Hospital Readmissions Reduction Program, with the payment adjustment CMS set and how it ranks.',
    claim: null,
  },

  // The record card.
  recordTitle: { text: 'Hospital record · {edition}', claim: null },
  recordCcn: { text: 'CCN {ccn}', claim: null },
  fieldHospital: { text: 'Hospital', claim: null },
  fieldLocation: { text: 'Location', claim: null },
  fieldMetro: { text: 'Metro area', claim: null },
  fieldType: { text: 'Type', claim: null },
  fieldPeer: { text: 'Peer group', claim: null },
  fieldStars: { text: 'Care Compare stars', claim: null },
  alias: { text: 'Also listed by CMS as {alias}', claim: null },
  outsideMetro: { text: 'Outside metro areas', claim: null },
  seeMetro: { text: 'See this metro', claim: null },
  seeState: { text: 'See {state}', claim: null },
  peerValue: { text: '{peer} of {n}', claim: null },
  peerNote: { text: '{pct} of stays dual-eligible', claim: null },
  starsNone: { text: 'Not rated', claim: null },
  starsSpoken: { text: '{n} of {max} stars', claim: null },
  starsLink: { text: 'Open on Medicare.gov', claim: null },

  // The Type field: what the hospital is, from the hospital master and CMS's special-status codes.
  typeNone: { text: '—', claim: null },
  typeBeds: { text: '{beds} beds', claim: null },
  typeBedsCostReport: { text: '{beds} beds (cost report)', claim: null },
  typeUrban: { text: 'Urban', claim: null },
  typeRural: { text: 'Rural', claim: null },
  typeSCH: { text: 'Sole community hospital', claim: null },
  typeMDH: { text: 'Medicare-dependent hospital', claim: null },
  typeRRC: { text: 'Rural referral center', claim: null },
  typeIHS: { text: 'Indian Health Service', claim: null },
  typeEACH: { text: 'Essential access community hospital', claim: null },

  // The stamp.
  stampCut: { text: 'Cut {pct}', claim: null },
  stampNone: { text: 'No cut', claim: null },
  stampInactive: { text: 'Inactive', claim: null },

  // The verdict's two numbers.
  verdictLabel: { text: 'Verdict', claim: null },
  fieldFactor: { text: 'Payment adjustment factor', claim: null },
  factorNote: { text: 'CMS, final', claim: null },
  fieldDollars: { text: 'Estimated dollars', claim: null },
  dollarsNote: { text: 'on ≈ {base} of base payments', claim: null },
  dollarsNoVolume: { text: 'no volume data', claim: null },
  dollarsNone: { text: '—', claim: null },

  // The foot.
  report: { text: "Report a problem with this hospital's data", claim: null },
  source: {
    text: 'Source: CMS {edition} Hospital Readmissions Reduction Program Supplemental Data File, posted {date}. Dollar figures marked estimate are modeled on this site.',
    claim: null,
  },
};

export const { fill, fillKeep, t } = copyOf(COPY, SITE);
