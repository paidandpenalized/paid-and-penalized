// Ported from Thirty Day Readmissions (web/src/js/views/methods.js and views/explainer.js at 33d1959).
// Figures the Readmissions pages state in words; each is passed to the copy through a placeholder.
// CLAIMS (below) names the claims-register row (sites/hrrp/CLAIMS.md) behind each method constant.

// CMS's upper-bound estimate of new-technology add-on payments, FY2027 IPPS final rule (FR doc 2026-15833), 91 FR 50423:
// "Aggregate Estimated Total FY 2027 Impact $1,739,715,745.72". Any share of the modeled base is computed from the data
// where the page needs it, not typed here.
export const NTAP_FY = 2027;
export const NTAP_TOTAL = '$1.7 billion';

// Medicare pays Pennsylvania Rural Health Model hospitals a global budget through this date: CMS Transmittal 12622
// (CR 13595, May 2, 2024) extended the model's termination date to 12/31/2026. The row drops out of later editions.
export const PARHM_END = '2026-12-31';

// "About 2,900 hospitals": the hospital count rounded to the nearest hundred (Thirty Day Readmissions, views/explainer.js).
export const ROUND_COUNT_TO = 100;

// The claims-register row behind each method constant the gate checks (pipeline/test/copy-gate.test.js).
// NTAP_FY and ROUND_COUNT_TO are not here: NTAP_FY is the year NTAP_TOTAL states, and ROUND_COUNT_TO is a rounding of how a
// count is shown, not a claim about CMS's program.
export const CLAIMS = {
  NTAP_TOTAL: 'HRRP-07',
  PARHM_END: 'HRRP-08',
};

// What the copy gate reads: the prefix of this site's claim ids, and the method constants it checks (name and type).
export const CLAIM_PREFIX = 'HRRP';
export const METHOD_CONSTANTS = Object.freeze({ NTAP_TOTAL: 'string', PARHM_END: 'string' });

// Care Compare rates hospitals from one star to this many (CMS's overall rating scale); the record card shows the rating as filled and empty stars.
export const STARS_MAX = 5;

// The area pages' "cut this much or more" field counts hospitals at or above this cut (percent): summarize()'s nGe1.
export const GE_CUT_PCT = 1;

// The example hospital's picks (derive.js exampleHospital): at least this many conditions flagged and this many beds. They
// reproduce Thirty Day Readmissions' worksheet-example rule (views/explainer.js at 33d1959); they are not claims.
export const EXAMPLE_MIN_FLAGS = 3;
export const EXAMPLE_MIN_BEDS = 150;

// The state map's shading (figures/map-data.js): each measure's four thresholds, ascending, which split its values into five
// bins; a value at a threshold takes the bin above. They are Thirty Day Readmissions' (web/src/js/charts/usmap.js METRICS at
// 33d1959), display choices and not CMS's. Average cut in percent; share penalized and share cut 1% or more in percent;
// dollars in millions. A value is binned as the map prints it (average cut to two decimals, the shares to a whole percent,
// dollars to a tenth of a million), so a color never disagrees with its label.
export const MAP_RAMPS = Object.freeze({
  avg: Object.freeze([0.25, 0.35, 0.45, 0.6]),
  share: Object.freeze([70, 80, 85, 90]),
  dollars: Object.freeze([2, 5, 10, 20]),
  ge1: Object.freeze([4, 8, 12, 16]),
});

// The state HRRP-01 leaves out of the program ("non-Maryland subsection (d) hospitals"); the map hatches it, and says
// only that its hospitals are not in the program. HRRP-01 gives no reason, so the page gives none.
export const NOT_IN_PROGRAM_STATE = 'MD';

// The "Every state" table shows this many rows to a page.
export const STATES_PAGE_SIZE = 15;
