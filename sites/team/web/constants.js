// The TEAM site's fixed choices, and what the copy gate (pipeline/test/copy-gate.test.js) reads once the site is
// registered: the prefix of its claim ids (sites/team/CLAIMS.md), the method constants it checks and the claim of each
// constant named here. The method constants are the engine's (engine/js/team/params.js), re-exported so the gate sees
// them; the band's constants are this site's own choices, not rules, so they are not here. The dates below are rules of
// CMS's, dated and sourced in the register.
import { CQS_CAPS, EPISODE_DAYS, LOW_VOLUME, MEASURES, MISSING_QUALITY, TRACKS } from '../../../engine/js/team/params.js';

export { CQS_CAPS, EPISODE_DAYS, LOW_VOLUME, MEASURES, MISSING_QUALITY, TRACKS };
export const CLAIM_PREFIX = 'TEAM';
export const METHOD_CONSTANTS = Object.freeze({ TRACKS: 'object', CQS_CAPS: 'object', LOW_VOLUME: 'number', EPISODE_DAYS: 'number', MISSING_QUALITY: 'number', MEASURES: 'object' });

// The day the model's second performance year starts (performance years are calendar years; the model began January 1,
// 2026), and the day CJR-X starts (the nationwide expansion of the joint-replacement model). ISO dates; pages format them
// with web/render/format.js.
export const PY2_START = '2027-01-01';
export const CJRX_START = '2028-01-01';

export const CLAIMS = Object.freeze({
  PY2_START: 'TEAM-07', CJRX_START: 'TEAM-12',
  TRACKS: 'TEAM-14', CQS_CAPS: 'TEAM-15', LOW_VOLUME: 'TEAM-16', MISSING_QUALITY: 'TEAM-17', MEASURES: 'TEAM-18', EPISODE_DAYS: 'TEAM-19',
});
