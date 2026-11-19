// The TEAM site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads once the site is
// registered: the prefix of its claim ids (sites/team/CLAIMS.md), the method constants it checks and the claim of each
// constant named here. Method constants join later; the dates below are rules of CMS's, dated and sourced in the register.
export const CLAIM_PREFIX = 'TEAM';
export const METHOD_CONSTANTS = Object.freeze({});

// The day the model's second performance year starts (performance years are calendar years; the model began January 1,
// 2026), and the day CJR-X starts (the nationwide expansion of the joint-replacement model). ISO dates; pages format them
// with web/render/format.js.
export const PY2_START = '2027-01-01';
export const CJRX_START = '2028-01-01';

export const CLAIMS = Object.freeze({ PY2_START: 'TEAM-07', CJRX_START: 'TEAM-12' });
