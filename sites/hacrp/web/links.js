// Outside pages the HACRP site links to. Every URL here is checked live before launch; CMS's dataset page comes
// from the pinned-input manifest (landingPage), not from this list.
export const LINKS = Object.freeze({
  cmsProgram: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-acquired-condition-reduction-program-hacrp',
  careCompare: 'https://www.medicare.gov/care-compare/',
  leapfrog: 'https://www.hospitalsafetygrade.org/',
});

// The dataset CSV of every hospital's CMS values (written by the page build), at one path per fiscal year. The
// program page links to it, so the hospital table's data are there without JavaScript.
export const csvPath = (fy) => `/data/hacrp/fy${fy}/hacrp-hospitals.csv`;
