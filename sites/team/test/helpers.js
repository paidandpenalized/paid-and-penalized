// What the TEAM site's tests share: the family search's file holding given rows, and the program page as the build draws
// it (unreleased, noindex), with the test assets' names.
import { testAssets } from '../../../pipeline/test/helpers.js';
import { loadAtlas, loadMaster } from '../web/data.js';
import { programPage } from '../web/pages/program.js';

// The page's two data files, as testAssets names the rest.
export const LOOKUP_URL = '/assets/team-lookup.test.json';
export const CALC_URL = '/assets/team-calc.test.json';

// A family search file (hub/search) of rows, each [ccn, name, city, state, kind].
export const searchFile = (rows) => ({ cols: ['ccn', 'name', 'city', 'state', 'kind'], rows, states: {} });

// The program page for the TEAM file; search: the family search's file, by default one naming the file's default
// hospital (made-up name, Kentucky).
export const programFor = (team, search = searchFile([[team.defaultCcn, 'Example Hospital', null, 'KY', 'acute']])) =>
  programPage({ team, master: loadMaster(), atlas: loadAtlas(), robots: 'noindex', assets: testAssets(), lookupUrl: LOOKUP_URL, calcUrl: CALC_URL, search });
