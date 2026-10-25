// Test setup read from the pinned HACRP data (fixtures.js holds only synthetic data): the loaded files, the
// national ranges and score span the pages draw, the national context, what the program page and the place pages
// draw, each hospital's view, the history, and the program page's arguments for tests that vary one of them.
import { EQUAL_FROM, Z_FROM } from '../../../engine/js/hacrp/eras.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { ESTIMATE_THRESHOLD } from '../../../engine/js/hacrp/params.js';
import { listText } from '../../../web/render/format.js';
import { SHORT_NAMES } from '../web/constants.js';
import { loadHacrp } from '../web/data.js';
import { scoreRange } from '../web/generate.js';
import { nationalContext } from '../web/compare.js';
import { historySource } from '../web/history-figures.js';
import { t as mt } from '../web/methods/copy.js';
import { methodsPage } from '../web/pages/methods.js';
import { placePage } from '../web/pages/place.js';
import { programPage } from '../web/pages/program.js';
import { buildPlaces } from '../web/places.js';
import { programData } from '../web/program-data.js';
import { hospitalView } from '../web/view.js';
import { historyData } from '../web/history-data.js';
import { moneyData } from '../web/money-data.js';
import { ASSETS, BOUNDARY_TEXT, NO_ESTIMATE } from './fixtures.js';

export const DATA = loadHacrp();
export const RANGE = scoreRange(DATA.hospitals);
// What a hospital page compares a hospital with (compare.js), built once from the pinned data, and the model: every
// hospitalPage call takes both, and a hospital's dollars (these tests' synthetic hospitals have no estimate; a test of the
// dollars passes the pinned row's), and what a likely range means (the statement's note).
export const NAT = nationalContext({ hospitals: DATA.hospitals, master: DATA.master, model: DATA.model, dollars: DATA.dollars });
export const PAGE_CTX = { nat: NAT, model: DATA.model, money: NO_ESTIMATE, backtest: DATA.dollars.backtest };
// What the program page and the place pages draw (program-data.js, places.js), built once from the pinned data.
export const PD = programData({ hospitals: DATA.hospitals, master: DATA.master, model: DATA.model });
export const PLACES = buildPlaces({ hospitals: DATA.hospitals, master: DATA.master, rows: PD.rows });
// What the money's figures draw (money-data.js), built once from the pinned data.
export const MD = moneyData({ pd: PD, dollars: DATA.dollars, model: DATA.model });

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
  md: MD,
  ...overrides,
});

// A place page as the build renders it, for a buildPlaces() entry.
export const renderPlace = (place, overrides = {}) => placePage({
  place, places: PLACES, pd: PD, model: DATA.model, hospitalRows: HOSPITAL_ROWS, master: DATA.master, shapes: DATA.shapes, counties: DATA.counties,
  fy: DATA.fy, periods: DATA.periods, source: DATA.source, searchUrl: SEARCH_URL, robots: null, assets: ASSETS, md: MD, ...overrides,
});

// The Methods page as the build renders it (generate.js), on the pinned data with its history and the dollars: the
// self-check for every year, the newest year's pipeline numbers, the estimate's tolerance and tagged measures.
// overrides replace any argument.
const tagged = MEASURE_IDS.filter((id) => DATA.estimate[id].tagged);
export const renderMethods = (overrides = {}) => methodsPage({
  fy: DATA.fy,
  checks: HD.checks.map((c) => ({ fy: c.fy, rule: mt(c.ruleKey), check: c.check })),
  years: HD.years.map((y) => ({ fy: y.fy, periods: y.periods })),
  newest: { rows: DATA.sourceRows, source: DATA.source, periods: DATA.periods, pin: DATA.manifest.find((e) => e.id === DATA.source.id), measures: MEASURE_IDS.length, pages: 1, sourceLine: historySource(HD) },
  pins: DATA.pinsUsed, changes: DATA.changes,
  estimate: { tolerance: ESTIMATE_THRESHOLD, tagged: tagged.length ? listText(tagged.map((id) => SHORT_NAMES[id])) : null, maxError: tagged.length ? Math.max(...tagged.map((id) => DATA.estimate[id].maxError)) : null },
  boundaryText: DATA.boundaryText, eqFy: EQUAL_FROM, zFy: Z_FROM, robots: null, assets: ASSETS, searchUrl: SEARCH_URL, dollars: DATA.dollars, names: () => null,
  ...overrides,
});

export const PROGRAM_ARGS = {
  fy: DATA.fy, counts: { decided: 2, yes: 1, scored: 2 }, boundaryText: BOUNDARY_TEXT,
  periods: DATA.periods, searchUrl: '/assets/x.json', source: DATA.source, robots: null, assets: ASSETS,
};
