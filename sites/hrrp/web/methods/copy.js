// Ported from Thirty Day Readmissions (web/src/js/views/methods.js at 33d1959).
// The Readmissions Methods page's words so far: the kicker and heading, About, the formula and the replication
// sentence, the dollar estimate's method, how to read a penalty, places, history, sources and a short glossary. No
// digit characters: every number arrives through a {placeholder}. A sentence that states a program rule carries the
// claim id of its row in sites/hrrp/CLAIMS.md.
import { copyOf } from '../../../../web/render/components.js';
import { COPY as SITE } from '../copy.js';
import { COPY as PROGRAM } from '../program/copy.js';

export const COPY = {
  pageTitle: { text: 'Methods and sources: Readmissions, {edition}', claim: null },
  pageDescription: {
    text: 'How the Readmissions pages are made: the formula behind each hospital’s cut, how the dollars are estimated, and the sources.',
    claim: null,
  },
  kicker: { text: 'Methods & sources', claim: null },
  heading: { text: 'How this was made', claim: null },

  aboutHeading: { text: 'About', claim: null },
  aboutIntro: {
    text: 'This site explains Medicare’s Hospital Readmissions Reduction Program and shows the {edition} penalty for every hospital in it. It is built entirely from public federal files and is meant for anyone: patients and families, reporters, and the hospital teams who work with these numbers every day.',
    claim: null,
  },
  aboutBy: {
    text: 'Built by Dalton Haslam, MD, MBA, a physician advisor, with Claude Code. It is an independent project, not affiliated with or endorsed by the Centers for Medicare & Medicaid Services. To report an error or suggest a change, use the {feedback}.',
    claim: null,
  },
  feedbackLink: { text: 'feedback form', claim: null },

  formulaHeading: { text: 'The formula', claim: null },
  formulaIntro: {
    text: 'For each of the {conditions} conditions with at least {minCases} cases, CMS compares the hospital’s excess readmission ratio with its peer group’s median. Each condition above the median contributes:',
    claim: ['HRRP-01', 'HRRP-02', 'HRRP-03', 'HRRP-04'],
  },
  formulaCut: { text: 'neutrality modifier × payment weight × (ratio − peer median)', claim: null },
  formulaCap: {
    text: 'The contributions are added, capped at {cap}%, and subtracted from one to give the payment adjustment factor. This year the neutrality modifier is {nm}. The cut applies to every traditional-Medicare base inpatient payment the hospital receives from {pay}.',
    claim: ['HRRP-06', 'HRRP-09', 'HRRP-10'],
  },
  replicationAll: {
    text: 'Recomputing every hospital from the values CMS publishes, read at full precision from the Excel version of its file, reproduces its factor exactly for all {total} hospitals.',
    claim: null,
  },
  replicationSome: {
    text: 'Recomputing every hospital from the values CMS publishes, read at full precision from the Excel version of its file, reproduces its factor exactly for {exact} of {total} hospitals.',
    claim: null,
  },

  dollarsHeading: { text: 'Estimated dollars', claim: null },
  dollarsIntro: {
    text: 'CMS publishes each hospital’s percentage, not a dollar amount. This site estimates the base payments the cut applies to, then multiplies by the cut:',
    claim: null,
  },
  dollarsFormula: { text: 'cases × case-mix index × (labor amount × wage index + non-labor amount × cost-of-living adjustment)', claim: null },
  dollarsInputs: {
    text: 'Cases and case-mix index are each hospital’s transfer-adjusted traditional-Medicare figures from the {edition} IPPS impact file, which uses claims from two years earlier. The standardized amounts come from the final rule’s standardized-amount tables (correction notice), choosing the column that matches each hospital’s quality-reporting and EHR status as CMS flags it in the impact file.',
    claim: null,
  },

  readHeading: { text: 'How to read a penalty', claim: null },
  readRelative: {
    text: 'It is relative. CMS sets each median over every hospital in the peer group, so about half of the hospitals measured on a condition sit above it, and most hospitals measured on several conditions get some cut.',
    claim: 'HRRP-04',
  },
  readSmall: { text: 'A condition with fewer than {minCases} cases does not count toward a hospital’s cut.', claim: 'HRRP-01' },
  readWindow: { text: 'The data window is {window}, so the cut reflects care from roughly one to three years before it takes effect.', claim: null },

  placesHeading: { text: 'Places', claim: null },
  placesText: {
    text: 'Metro areas are the core-based statistical area where each hospital sits, from the IPPS impact file. Regions and divisions follow the Census Bureau.',
    claim: null,
  },

  historyHeading: { text: 'History', claim: null },
  historyText: { text: 'Penalties for {first} through {last} come from CMS’s archived final-rule supplemental files.', claim: null },

  moreHeading: { text: 'Feedback, privacy and accessibility', claim: null },
  moreText: { text: 'How the family of sites handles feedback and privacy is on the {privacy} page, and its accessibility standard is on the {accessibility} page.', claim: null },
  morePrivacy: { text: 'privacy', claim: null },
  moreAccessibility: { text: 'accessibility', claim: null },

  sourcesHeading: { text: 'Sources', claim: null },
  sourceSupplemental: { text: 'CMS archived HRRP supplemental data files, {first} through {last}', claim: null },
  sourceRules: { text: 'Federal Register IPPS final rules, {span}', claim: null },

  glossaryHeading: { text: 'Glossary', claim: null },
  termPeer: { text: 'Peer group', claim: null },
  defPeer: {
    text: 'One of five groups of hospitals, sorted by the share of their patients who are dually eligible for Medicare and full Medicaid.',
    claim: 'HRRP-05',
  },
  termDual: { text: 'Dual-eligible', claim: null },
  defDual: { text: 'A person enrolled in both Medicare and full Medicaid benefits, a common marker of low income.', claim: null },
  termNeutrality: { text: 'Neutrality modifier', claim: null },
  defNeutrality: {
    text: 'A single factor, the same for every hospital in a year, that keeps total savings under peer grouping equal to what the earlier method with no peer groups would have produced.',
    claim: 'HRRP-10',
  },
  termFfs: { text: 'Traditional Medicare (FFS)', claim: null },
  defFfs: {
    text: 'Fee-for-service Medicare, paid directly by CMS. Medicare Advantage plans are private plans paid separately; the cut applies to the traditional payments.',
    claim: 'HRRP-06',
  },
  termCcn: { text: 'CCN', claim: null },
  defCcn: { text: 'CMS Certification Number, the six-digit ID CMS assigns each hospital.', claim: null },
  termCbsa: { text: 'Metro area (CBSA)', claim: null },
  defCbsa: { text: 'A core-based statistical area defined by the Office of Management and Budget: a city and the counties tied to it by commuting.', claim: null },
};

export const { fill, fillKeep, t } = copyOf(COPY, PROGRAM, SITE);
