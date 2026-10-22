// Test setup read from the pinned HACRP data (fixtures.js holds only synthetic data): the loaded files, the
// national ranges and score span the pages draw, the national context, and the program page's arguments for tests that vary one of them.
import { loadHacrp } from '../web/data.js';
import { scoreRange } from '../web/generate.js';
import { nationalContext } from '../web/compare.js';
import { ASSETS, BOUNDARY_TEXT } from './fixtures.js';

export const DATA = loadHacrp();
export const RANGE = scoreRange(DATA.hospitals);
// What a hospital page compares a hospital with (compare.js), built once from the pinned data, and the model: every
// hospitalPage call takes both.
export const NAT = nationalContext({ hospitals: DATA.hospitals, master: DATA.master, model: DATA.model });
export const PAGE_CTX = { nat: NAT, model: DATA.model };

export const PROGRAM_ARGS = {
  fy: DATA.fy, counts: { decided: 2, yes: 1, scored: 2 }, boundaryText: BOUNDARY_TEXT,
  periods: DATA.periods, searchUrl: '/assets/x.json', source: DATA.source, robots: null, assets: ASSETS,
};
