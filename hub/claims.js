// What the copy gate (pipeline/test/copy-gate.test.js) reads for the family's claims register, hub/CLAIMS.md, as it reads
// a program site's web/constants.js: the register's id prefix, the rule constants every page prints (web/programs.js) with
// their types, and the claim id behind each constant and behind each program's name as CMS gives it (web/site.js
// programs[].long). The register covers the hub's pages and the copy every page shares (web/), so, like shared copy, this
// map may cite a program site's row where one already supports the fact. Only the tests import this module.
export {
  HAC_CUT_PCT, HAC_TOP_SHARE, HRRP_CAP_PCT, HRRP_WINDOW_DAYS, IQR_REDUCTION_SHARE, PI_REDUCTION_SHARE, TEAM_SURGERIES,
  VBP_WITHHOLD_PCT,
} from '../web/programs.js';

export const CLAIM_PREFIX = 'HUB';
export const METHOD_CONSTANTS = Object.freeze({
  HRRP_CAP_PCT: 'number', HAC_CUT_PCT: 'number', VBP_WITHHOLD_PCT: 'number', HRRP_WINDOW_DAYS: 'number',
  HAC_TOP_SHARE: 'number', IQR_REDUCTION_SHARE: 'number', PI_REDUCTION_SHARE: 'number', TEAM_SURGERIES: 'number',
});

// Each program's name, by its registry id, and the row that gives it as CMS does.
export const PROGRAM_NAME_CLAIMS = Object.freeze({
  hrrp: 'HUB-17', hacrp: 'HUB-18', hvbp: 'HUB-19', 'wage-index': 'HUB-20', dsh: 'HUB-21', ime: 'HUB-22', iqr: 'HUB-23',
  pi: 'HUB-24', team: 'HUB-25',
});

export const CLAIMS = Object.freeze({
  HRRP_CAP_PCT: 'HRRP-09',
  HAC_CUT_PCT: 'HACRP-01',
  VBP_WITHHOLD_PCT: 'HUB-01',
  HRRP_WINDOW_DAYS: 'HRRP-23',
  HAC_TOP_SHARE: 'HACRP-02',
  IQR_REDUCTION_SHARE: 'HUB-06',
  PI_REDUCTION_SHARE: 'HUB-07',
  TEAM_SURGERIES: 'HUB-11',
  ...Object.fromEntries(Object.entries(PROGRAM_NAME_CLAIMS).map(([id, claim]) => [`name:${id}`, claim])),
});
