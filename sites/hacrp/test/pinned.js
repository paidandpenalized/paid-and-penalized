// Test setup read from the pinned HACRP data (fixtures.js holds only synthetic data): the loaded files, the
// national ranges and score span the pages draw, the national context, what the program page and the place pages
// draw, each hospital's view, the history, and the program page's arguments for tests that vary one of them.
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { loadHacrp } from '../web/data.js';
import { scoreRange } from '../web/generate.js';
import { nationalContext } from '../web/compare.js';
import { placePage } from '../web/pages/place.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { programData } from '../web/program-data.js';
import { hospitalView } from '../web/view.js';
import { historyData } from '../web/history-data.js';
import { ASSETS, BOUNDARY_TEXT } from './fixtures.js';

export const DATA = loadHacrp();
export const RANGE = scoreRange(DATA.hospitals);
// What a hospital page compares a hospital with (compare.js), built once from the pinned data, and the model: every
// hospitalPage call takes both.
export const NAT = nationalContext({ hospitals: DATA.hospitals, master: DATA.master, model: DATA.model });
export const PAGE_CTX = { nat: NAT, model: DATA.model };
// What the program page and the place pages draw (program-data.js, places.js), built once from the pinned data.
export const PD = programData({ hospitals: DATA.hospitals, master: DATA.master, model: DATA.model });
export const PLACES = buildPlaces({ hospitals: DATA.hospitals, master: DATA.master, rows: PD.rows });

// Every pinned hospital's page view, and the rows a place page's map reads from them (generate.js builds the same).
export const VIEWS = DATA.hospitals.map((h) => hospitalView({ hospital: h, model: DATA.model, estimate: DATA.estimate, footnotes: DATA.footnotes, master: DATA.master.get(h.ccn), fy: DATA.fy, periods: DATA.periods, boundaryText: DATA.boundaryText }));
export const HOSPITAL_ROWS = new Map(VIEWS.map((v) => [v.ccn, { name: v.name, city: v.city, state: v.state, totalText: v.score.raw, decision: v.decision.text, point: v.point, href: v.path }]));
export const SEARCH_URL = '/assets/hacrp-hospitals.0000abcd.json';
// Every program year (the emitted history) as the pages draw it, and the asset the roll call and year map read.
// HISTORY_ARGS adds the history to a program page or a place page: renderProgram(HISTORY_ARGS) is the page as the build
// renders it; without them, it is the page of the newest year alone.
export const HD = historyData({ history: DATA.history, master: DATA.master });
export const HISTORY_URL = '/assets/hacrp-history.0000abcd.json';
export const HISTORY_ARGS = { hd: HD, rollUrl: HISTORY_URL, master: DATA.master };

// The program page as the build renders it (generate.js): every part, the sandbox on the median hospital, the hero's
// suggestions (the state and the metro area with the most hospitals with a decision). overrides replace any argument.
const most = (kind) => PLACES.list.filter((p) => p.kind === kind).sort((a, b) => b.counts.decided - a.counts.decided || a.name.localeCompare(b.name, 'en'))[0];
export const renderProgram = (overrides = {}) => programPage({
  fy: DATA.fy, counts: { decided: PD.counts.decided, yes: PD.counts.yes, scored: PD.counts.scored }, boundaryText: DATA.boundaryText, periods: DATA.periods,
  searchUrl: SEARCH_URL, source: DATA.source, robots: null, assets: ASSETS,
  whatif: { hospital: medianHospital(DATA.model, { fiscalYear: String(DATA.fy), periods: DATA.periods }), model: DATA.model, estimate: DATA.estimate, range: RANGE },
  pd: PD, exploreUrl: '/assets/hacrp-explore.0000abcd.json', tryPlaces: { state: most('state'), metro: most('metro') }, places: PLACES, shapes: DATA.shapes,
  ...overrides,
});

// A place page as the build renders it, for a buildPlaces() entry.
export const renderPlace = (place, overrides = {}) => placePage({
  place, places: PLACES, pd: PD, model: DATA.model, hospitalRows: HOSPITAL_ROWS, master: DATA.master, shapes: DATA.shapes, counties: DATA.counties,
  fy: DATA.fy, periods: DATA.periods, source: DATA.source, searchUrl: SEARCH_URL, robots: null, assets: ASSETS, ...overrides,
});

export const PROGRAM_ARGS = {
  fy: DATA.fy, counts: { decided: 2, yes: 1, scored: 2 }, boundaryText: BOUNDARY_TEXT,
  periods: DATA.periods, searchUrl: '/assets/x.json', source: DATA.source, robots: null, assets: ASSETS,
};
