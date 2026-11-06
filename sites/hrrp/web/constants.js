// Ported from Thirty Day Readmissions (web/src/js/views/methods.js and views/explainer.js at 33d1959).
// Figures the Readmissions pages state in words; each is passed to the copy through a placeholder.
// CLAIMS (below) names the claims-register row (sites/hrrp/CLAIMS.md) behind each method constant.

// CMS's upper-bound estimate of new-technology add-on payments, FY2027 IPPS final rule (FR doc 2026-15833), 91 FR 50423:
// "Aggregate Estimated Total FY 2027 Impact $1,739,715,745.72". Any share of the modeled base is computed from the data
// where the page needs it, not typed here.
export const NTAP_FY = 2027;
export const NTAP_AMOUNT = 1739715745.72;

// Medicare pays Pennsylvania Rural Health Model hospitals a global budget through this date: CMS Transmittal 12622
// (CR 13595, May 2, 2024) extended the model's termination date to 12/31/2026. The row drops out of later editions.
export const PARHM_END = '2026-12-31';

// "About 2,900 hospitals": the hospital count rounded to the nearest hundred (Thirty Day Readmissions, views/explainer.js).
export const ROUND_COUNT_TO = 100;

// Methods' display choices (not claims): the resident-to-bed ratio at which this site's hospital master calls a hospital major
// teaching (engine/py/pp_engine/master.py MAJOR_TEACHING); the "within this share" band of the dollar check, which is the
// check's own `within15` key (data meta.dollarCheck); the first and last fiscal years whose CMS files also listed hospitals
// the history's share penalized leaves out.
export const TEACH_MAJOR = 0.25;
export const ACCURACY_BAND = 15;
export const SMALL_HOSPITAL_BEDS = 100;
export const HISTORY_LISTED_FYS = Object.freeze([2013, 2018]);
// The history years whose total is a later CMS simulation of that year under the earlier method, not the rule's own table
// (the data's source label for FY2025 says so; a test pins this list to the data).
export const HISTORY_SIMULATED_FYS = Object.freeze([2025]);

// The claims-register row behind each method constant the gate checks (pipeline/test/copy-gate.test.js).
// NTAP_FY and ROUND_COUNT_TO are not here: NTAP_FY is the year NTAP_AMOUNT states, and ROUND_COUNT_TO is a rounding of how a
// count is shown, not a claim about CMS's program.
export const CLAIMS = {
  NTAP_AMOUNT: 'HRRP-07',
  PARHM_END: 'HRRP-08',
};

// What the copy gate reads: the prefix of this site's claim ids, and the method constants it checks (name and type).
export const CLAIM_PREFIX = 'HRRP';
export const METHOD_CONSTANTS = Object.freeze({ NTAP_AMOUNT: 'number', PARHM_END: 'string' });

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

// The history's rule marks (figures/history-data.js): the fiscal year each took effect and the copy entry that words it
// (its claim id is on that entry): peer groups HRRP-05 (FY2019, the FY2018 final rule's recap), the pneumonia measure's
// suppression HRRP-17 (FY2023), Medicare Advantage stays in the ratios HRRP-14 (FY2027).
export const HISTORY_MARKS = Object.freeze([
  Object.freeze({ fy: 2019, key: 'histMarkPeer' }),
  Object.freeze({ fy: 2023, key: 'histMarkPn' }),
  Object.freeze({ fy: 2027, key: 'histMarkMa' }),
]);

// The fiscal years shaded as the COVID-19 years (first, last): the years whose data windows CMS shortened or cut around the
// claims it left out (HRRP-18), which are those left out, January 1 to June 30, 2020. The data test checks the windows.
export const COVID_FYS = Object.freeze([2022, 2024]);
export const COVID_EXCLUDED = Object.freeze(['2020-01-01', '2020-06-30']);

// The explorer's table shows this many rows to a page (design: 25).
export const EXPLORE_PAGE_SIZE = 25;

// The other-hospitals table on a hospital page: rows to a page, and the drawing width of its map.
export const NEIGHBORS_PAGE_SIZE = 25;
export const NEARBY_MAP_WIDTH = 460;

// A place page's figures. The cut histogram's bins (percentage points) and the width of the "no cut" pile drawn before the scale's
// zero; the dots on a place's map shaded by the cut at these thresholds (percent: under the first, up to each next, the last
// and over) and sized by Medicare volume in this many steps; a place with more hospitals than DENSE draws its dots as one
// path for each shade and size, with no tooltips (the page's table lists them all).
export const PLACE_CUT_BIN = 0.1;
export const PLACE_ZERO_WIDTH = 0.3;
export const PLACE_SHADES = Object.freeze([0.25, 0.5, 1, 2]);
export const PLACE_SIZES = 4;
export const PLACE_DENSE = 160;
export const PLACE_MAP_WIDE = 560;
