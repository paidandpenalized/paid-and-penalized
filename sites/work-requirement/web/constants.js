// The work-requirement site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads: the prefix
// of this site's claim ids (sites/work-requirement/CLAIMS.md) and the method constants it checks, each with its claim.
// The scenario's own method constants are the engine's (engine/js/medicaid/scenario.js PARAMS, the emitted file's params).

export const CLAIM_PREFIX = 'WR';
export const METHOD_CONSTANTS = Object.freeze({});
export const CLAIMS = Object.freeze({});

// The program page's five steps, in order, by the id each section carries (the section menu links #<id>), then Methods.
export const SECTIONS = Object.freeze(['finding', 'how', 'states', 'hospital', 'both']);

// The three scenarios, low to high losses (the emitted file's scenarios[].id), and the one a page opens on.
export const SCENARIOS = Object.freeze(['low', 'middle', 'high']);
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
