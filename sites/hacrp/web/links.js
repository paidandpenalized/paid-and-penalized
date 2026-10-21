import { SITE } from '../../../web/site.js';

// Outside pages the HACRP site links to. Every URL here is checked live before launch; CMS's dataset page comes
// from the pinned-input manifest (landingPage), not from this list.
export const LINKS = Object.freeze({
  cmsProgram: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp',
  careCompare: 'https://www.medicare.gov/care-compare/',
  leapfrog: 'https://www.hospitalsafetygrade.org/',
});

// A hospital's page on Care Compare, by its CCN (the record card's stars link to it).
export const careCompareHref = (ccn) => `${LINKS.careCompare}details/hospital/${encodeURIComponent(ccn)}`;

// The dataset CSV of every hospital's CMS values (written by the page build), at one path per fiscal year. The
// program page links to it, so the hospital table's data are there without JavaScript.
export const csvPath = (fy) => `/data/hacrp/fy${fy}/hacrp-hospitals.csv`;
// Its data dictionary (sites/hacrp/DATA-DICTIONARY.md), beside it, and the same dictionary as a page.
export const dictionaryPath = (fy) => `/data/hacrp/fy${fy}/DATA-DICTIONARY.md`;
export const DICTIONARY_PAGE = `${SITE.sites.hacrp.path}data/`;
