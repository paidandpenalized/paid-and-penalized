// Ported from Thirty Day Readmissions (web/src/js/model.js, views/hospital.js and views/scope.js at 33d1959).
// The Readmissions site's words. No digit characters: every number arrives through a {placeholder}, formatted before it
// is filled. A sentence that states a program rule carries the claim id (or ids) of its row in sites/hrrp/CLAIMS.md;
// the rest are null.
import { copyOf } from '../../../web/render/components.js';

export const COPY = {
  // Wording helpers.
  nounHospital: { text: 'hospital', claim: null },
  nounHospitals: { text: 'hospitals', claim: null },
  vsNation: { text: 'nation', claim: null },
  unitPts: { text: 'pts', claim: null },
  noneMeasuredOne: { text: 'not measured on any condition', claim: null },
  noneMeasuredMany: { text: 'none measured on any condition', claim: null },
  penalizedOfMeasured: { text: '{pct} of {n} measured', claim: null },
  vsSame: { text: 'same as {word}', claim: null },
  vsDiff: { text: '{delta} {unit} vs {word}', claim: null },
  noEstimateOne: { text: '{n} hospital has no estimate and is left out of the total', claim: null },
  noEstimateMany: { text: '{n} hospitals have no estimate and are left out of the total', claim: null },

  // Hospital page: where the cut ranks.
  rankNone: { text: 'No reduction, like {n} other hospitals.', claim: null },
  rankNoneOne: { text: 'No reduction, like {n} other hospital.', claim: null },
  rankLine: {
    text: 'Larger cut than {nation}% of hospitals nationally, {state}% of the {stateCount} in {stateName}, and {peer}% in peer group {group}.',
    claim: 'HRRP-05',
  },

  // Hospital page: the verdict sentence.
  sumNoneMeasured: {
    text: '{name} has no {edition} cut. None of its {conditions} conditions reached {minCases} cases in the data window, so none could count against it.',
    claim: ['HRRP-01', 'HRRP-02', 'HRRP-03'],
  },
  sumNoneBelow: {
    text: "{name} has no {edition} cut. All {nMeasured} of its measured conditions came in at or below its peer group's median.",
    claim: 'HRRP-04',
  },
  sumNoneRounded: {
    text: "{name} has no {edition} cut. {names} came in above the peer-group median, but {share} of the hospital's Medicare payments is small enough that the reduction rounded to zero.",
    claim: 'HRRP-04',
  },
  shareOne: { text: 'its share', claim: null },
  shareMany: { text: 'their share', claim: null },
  and: { text: ' and ', claim: null },
  leadPaid: {
    text: 'Medicare is paying {name} {pct} less on the base payment for every traditional-Medicare inpatient stay from {pay}. ',
    claim: 'HRRP-06',
  },
  leadInactive: { text: 'CMS set the {edition} cut for {name} at {pct}. ', claim: null },
  sumPenalized: {
    text: "{nAbove} of its {nMeasured} measured conditions came in above the peer-group median; {top} added the most.",
    claim: 'HRRP-04',
  },

  // Hospital page: a hospital whose Medicare agreement CMS lists as ended.
  inactive: {
    text: "CMS lists this hospital's Medicare agreement under CCN {ccn} as ended{when} ({reason}). It will not be paid under this ID in {edition}{tail}.",
    claim: null,
  },
  inactiveOn: { text: ' on {date}', claim: null },
  inactiveTail: { text: ', so its cut is unlikely to be collected', claim: null },

  // The edition's phrases (derive.js edition): each date is spelled out by the formatter, the label and span built here.
  editionLabel: { text: 'FY{fy}', claim: null },
  editionSpan: { text: 'FY{first}\u2013FY{last}', claim: null },
  editionRange: { text: '{start} through {end}', claim: null },
  editionPayShort: { text: '{start} \u2013 {end}', claim: null },
  capMark: { text: '{cap}% cap', claim: null },
  capMarkShort: { text: '{cap}%', claim: null },

  // The section menu (pages/parts.js): the six Parts of the program page, then Methods (web/copy.js).
  navHow: { text: 'How it works', claim: null },
  navPicture: { text: 'The {edition} picture', claim: null },
  navMap: { text: 'Map', claim: null },
  navHistory: { text: 'History', claim: null },
  navExplore: { text: 'Every hospital', claim: null },
  navResearch: { text: 'Research', claim: null },

  // The estimate tag beside a modeled dollar figure (it links to Methods).
  estimate: { text: 'estimate', claim: null },
  estimateLabel: { text: 'Modeled on this site; how the estimate is made', claim: null },

  // The breadcrumb (hospital and place pages).
  crumbsLabel: { text: 'Breadcrumb', claim: null },
  crumbNation: { text: 'Nation', claim: null },

  // The data dictionary page (pages/dictionary.js): the Markdown file's words in the site's shell, then the files themselves.
  dictKicker: { text: 'Data dictionary', claim: null },
  dictFilesHeading: { text: 'The files', claim: null },
  dictFileHospitals: { text: 'Download every hospital as a CSV', claim: null },
  dictFileMarkdown: { text: 'Download this dictionary as Markdown', claim: null },

  // Area pages.
  deckShareNone: { text: 'it is {none}', claim: null },
  deckShare: { text: '{pct} of the {n} measured on at least one condition', claim: null },
  deckLeadOne: { text: '{nPen} of {hospitals} takes a cut in {label}: {share}.', claim: null },
  deckLeadMany: { text: '{nPen} of {hospitals} take a cut in {label}: {share}.', claim: null },
  penalizedNote: { text: 'of {n} measured', claim: null },
  penalizedNoteVs: { text: 'of {n} measured · {vs}', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY);
