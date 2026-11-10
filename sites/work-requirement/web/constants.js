// The work-requirement site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads: the prefix
// of this site's claim ids (sites/work-requirement/CLAIMS.md) and the method constants it checks, each with its claim.
// The scenario's own method constants are the engine's (engine/js/medicaid/scenario.js PARAMS, the emitted file's params).

export const CLAIM_PREFIX = 'WR';
export const METHOD_CONSTANTS = Object.freeze({});
export const CLAIMS = Object.freeze({});

// The program page's five steps, in order, by the id each section carries (the section menu links #<id>), then Methods.
export const SECTIONS = Object.freeze(['finding', 'how', 'states', 'hospital', 'both']);
