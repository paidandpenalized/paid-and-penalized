// Ported from Thirty Day Readmissions (web/src/js/views/methods.js and views/explainer.js at 33d1959).
// Figures the Readmissions pages state in words; each is passed to the copy through a placeholder.
// CLAIMS (below) names the claims-register row (sites/hrrp/CLAIMS.md) behind each method constant.

// CMS's upper-bound estimate of new-technology add-on payments, FY2027 IPPS final rule (FR doc 2026-15833), 91 FR 50423:
// "Aggregate Estimated Total FY 2027 Impact $1,739,715,745.72". Against the ~$91B modeled base (and CMS's FY2027 HVBP
// pool, ~$1.9B = 2% of base operating DRG payments), that is about 2%.
export const NTAP_FY = 2027;
export const NTAP_TOTAL = '$1.7 billion';
export const NTAP_SHARE = 2;

// Medicare pays Pennsylvania Rural Health Model hospitals a global budget through this date: CMS Transmittal 12622
// (CR 13595, May 2, 2024) extended the model's termination date to 12/31/2026. The row drops out of later editions.
export const PARHM_END = '2026-12-31';

// "About 2,900 hospitals": the hospital count rounded to the nearest hundred (Thirty Day Readmissions, views/explainer.js).
export const ROUND_COUNT_TO = 100;

// The claims-register row behind each method constant the gate checks (pipeline/test/copy-gate.test.js).
// NTAP_FY and ROUND_COUNT_TO are not here: NTAP_FY is the year NTAP_TOTAL states, and ROUND_COUNT_TO is a rounding of how a
// count is shown, not a claim about CMS's program. NTAP_SHARE is this site's own ratio of NTAP_TOTAL to the modeled base,
// so it rests on the same row.
export const CLAIMS = {
  NTAP_TOTAL: 'HRRP-07',
  NTAP_SHARE: 'HRRP-07',
  PARHM_END: 'HRRP-08',
};

// What the copy gate reads: the prefix of this site's claim ids, and the method constants it checks (name and type).
export const CLAIM_PREFIX = 'HRRP';
export const METHOD_CONSTANTS = Object.freeze({ NTAP_TOTAL: 'string', NTAP_SHARE: 'number', PARHM_END: 'string' });

// Care Compare rates hospitals from one star to this many (CMS's overall rating scale); the record card shows the rating as filled and empty stars.
export const STARS_MAX = 5;

// The area pages' "cut this much or more" field counts hospitals at or above this cut (percent): summarize()'s nGe1.
export const GE_CUT_PCT = 1;
