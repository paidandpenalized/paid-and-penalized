// The work-requirement site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads: the prefix
// of this site's claim ids (sites/work-requirement/CLAIMS.md) and the method constants it checks, each with its claim.
// The scenario's own method constants are the engine's (engine/js/medicaid/scenario.js PARAMS, the emitted file's params).
import { CASES } from '../../../engine/js/medicaid/hospital.js';

export const CLAIM_PREFIX = 'WR';
export const METHOD_CONSTANTS = Object.freeze({});
export const CLAIMS = Object.freeze({});

// The program page's five steps, in order, by the id each section carries (the section menu links #<id>), then Methods.
export const SECTIONS = Object.freeze(['finding', 'how', 'states', 'hospital', 'both']);

// The three scenarios, low to high losses (the emitted file's scenarios[].id: the engine's CASES), and the one a page
// opens on.
export const SCENARIOS = CASES;
export const DEFAULT_SCENARIO = 'middle';

// The group chips on step 1, in the order they show: the emitted file's group roll-ups (`groups`, built by
// pipeline/py/pp_pipeline/medicaid/build.py), whose definitions web/program/strips.js groupsOf repeats for each hospital
// (a test holds its counts to the file's). BEDS: the two bed-size groups' cuts, the build's beds_lt50 and beds_300plus.
export const GROUPS = Object.freeze(['critical_access', 'rural', 'safety_net', 'public', 'nonprofit', 'forprofit', 'beds_lt50', 'beds_300plus']);
export const BEDS = Object.freeze({ small: 50, large: 300 });

// The strips' reference line: a loss of 1% of the hospital's patient revenue (dashed in each strip; the chips' readout
// counts the group's hospitals at or past it). A reading aid, not a method constant.
export const REF_SHARE = 0.01;

// The state a page's random hospital is never drawn from (the site's rule for a default hospital: client/find.js).
export const DEFAULT_SKIP_STATE = 'VA';

// The use-rate what-if's stop (the slider moves in steps of this many hundredths; its ends and default are the file's
// params.use_min, use_max and use_default). A control's step, not a method constant.
export const USE_STEP = 0.05;

// Step 3's figure (web/program/states.js): the contours of the share of patient revenue lost drawn behind the states, by
// drawing (the phone's has room to label fewer), a reading aid like REF_SHARE, not a method constant; and how many of a
// state's most exposed hospitals its card names.
export const CONTOURS = Object.freeze({ narrow: Object.freeze([0.005, 0.01, 0.02]), wide: Object.freeze([0.005, 0.01, 0.02]) });
export const MOST_EXPOSED = 4;

// Step 5's corner, "exposed on both" (web/program/both.js), the rule the page and Methods state: a hospital that loses
// BOTH_SHARE or more of its patient revenue in the case shown (at the reader's use rate), and whose FY Medicare penalties
// (readmissions plus hospital-acquired conditions, the hub's estimates) as a share of the same patient revenue are in the
// top quarter: at or above the BOTH_QUANTILE quantile of that share among the hospitals Figure 5 plots (step 1's
// hospitals with a penalty estimate, those with no penalty included), the cut being the sorted shares' entry at
// floor(BOTH_QUANTILE × (n − 1)). The cut is computed from the data, never typed. These are this site's framing, not a
// rule of CMS's or Urban's, so they carry no claim id and sit outside METHOD_CONSTANTS (the copy gate's sourced constants);
// Methods lists them.
export const BOTH_SHARE = 0.01;
export const BOTH_QUANTILE = 0.75;
// How many of the named table's rows show before "Show all" (with JavaScript; without it every row shows).
export const NAMED_FIRST = 10;

// The cost report's lines Methods names (Form CMS-2552-10, Worksheet S-10 Part I): Medicaid net revenue, the line the
// scenario takes its loss from; Medicaid supplemental payments (DSH and other), which the lines 2 + 5 version adds; and
// Medicaid cost. The form's own line numbers, not method constants.
export const S10_LINES = Object.freeze({ revenue: 2, supplemental: 5, cost: 7 });

// Names with digits in them, which copy can't hold (the copy gate): the CMS form states report Medicaid spending on, the
// cost report's two worksheets Methods names, and the hash the pins are checked by. Copy writes {spendForm}, {revSheet}, {marginSheet} and
// {hash}; methods/copy.js fills them.
export const FORM_NAMES = Object.freeze({ spendForm: 'CMS-64', revSheet: 'Worksheet S-10', marginSheet: 'Worksheet G-3', hash: 'SHA-256' });
