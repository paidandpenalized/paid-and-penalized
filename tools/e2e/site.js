// The site the browser checks visit, with no browser of its own: which site (dist/ served locally, or E2E_BASE_URL), the
// engines, and the pages to visit. The launch command (launch.js) reads it as the checks do; lib.js adds the browser.
import { existsSync } from 'node:fs';
import { isDecided } from '../../engine/js/hacrp/hospital.js';
import { loadHub } from '../../hub/data.js';
import { hubHospitals } from '../../hub/model.js';
import { DIST_DIR } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { htmlPages } from '../../pipeline/site/html.js';
import { createSiteServer, listen, stop } from '../../pipeline/site/serve.js';
import { readNewestEmitted } from '../../sites/hacrp/pipeline/build.js';
import { SITE, hospitalPathOf } from '../../web/site.js';
import { DICTIONARY_PAGE, KINDS, METHODS_PATH, PROGRAM_PATH, hospitalPath, placeKind } from '../ci/page-types.js';

// The browser engines Playwright drives, by the name E2E_ENGINE takes.
export const ENGINES = ['chromium', 'firefox', 'webkit'];

// The origin of the site E2E_BASE_URL names (no trailing slash), or null when it names none. Only http and https.
export function baseUrlFromEnv() {
  if (!process.env.E2E_BASE_URL) return null;
  const url = new URL(process.env.E2E_BASE_URL);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RangeError('E2E_BASE_URL must be an http or https address');
  return url.origin;
}

// The site under test: dist/ (make build) served with its real _headers by make serve's server on a free loopback port,
// or the site E2E_BASE_URL names (a preview, a deployed site), which nothing is started for. Returns its origin (base:
// http://127.0.0.1:<port>, no trailing slash) and close(), which stops the server.
export async function startSite() {
  const given = baseUrlFromEnv();
  if (given) return { base: given, close: async () => {} };
  if (!existsSync(DIST_DIR)) throw new Error('dist/ not found: run `make build` first (or set E2E_BASE_URL)');
  const server = createSiteServer(DIST_DIR);
  const port = await listen(server);
  return { base: `http://127.0.0.1:${port}`, close: () => stop(server) };
}

// The first place page of each kind that dist/ holds, by file name: '/hacrp/<kind>/<key>/'.
function firstPlaces() {
  const first = new Map();
  for (const path of htmlPages(DIST_DIR).map(addressOf)) {
    const kind = placeKind(path);
    if (kind !== null && !first.has(kind)) first.set(kind, path);
  }
  for (const kind of KINDS) if (!first.has(kind)) throw new Error(`samplePages: no ${kind} page in dist/ (run make build)`);
  return first;
}

// The sample hospitals by type, each the first in the newest HACRP file (in the file's order) that CMS cut, that has no
// score, and that has a score and was not cut: [type, what it is, the test].
const HOSPITALS = [
  ['hospital-cut', 'with a payment cut', (h) => isDecided(h) && h.paymentReduction === 'Yes'],
  ['hospital-unscored', 'with no score', (h) => h.total === null],
  ['hospital-not-cut', 'with a score and no cut', (h) => isDecided(h) && h.paymentReduction === 'No'],
];

// The sample hospital's page of a type (HOSPITALS), { type, name, path, hospital: its emitted record }, from the
// emitted data alone (no walk of dist/). all: the newest HACRP file's hospitals, when the caller has read them.
export function hospitalSample(type, all = readNewestEmitted().hospitals) {
  const [, what, test] = HOSPITALS.find(([t]) => t === type) ?? [];
  if (!test) throw new RangeError(`hospitalSample: no sample type "${type}"`);
  const found = all.find(test);
  if (!found) throw new Error(`hospitalSample: no hospital ${what} in the data`);
  return { type, name: type, path: hospitalPath(found.ccn), hospital: found };
}

// The sample hospitals' pages across the programs (the hub's), by type, each the first in the dollar file's order that
// has an estimate with a net cut and the hospital-acquired conditions cut, and that is in Maryland (no estimate: the
// variant page): [type, what it is, the test].
const HUB_HOSPITALS = [
  ['hub-hospital-cut', 'with a net cut and the HAC cut', (h) => h.est !== null && h.est.cut && h.est.net < 0],
  ['hub-hospital-maryland', 'in Maryland', (h) => h.status === 'maryland'],
];

// The sample hospital's page across the programs of a type (HUB_HOSPITALS), { type, name, path, hospital: its hub
// record }, from the emitted data alone.
export function hubHospitalSample(type, all = hubHospitals(loadHub())) {
  const [, what, test] = HUB_HOSPITALS.find(([t]) => t === type) ?? [];
  if (!test) throw new RangeError(`hubHospitalSample: no sample type "${type}"`);
  const found = all.find(test);
  if (!found) throw new Error(`hubHospitalSample: no hospital ${what} in the data`);
  return { type, name: type, path: hospitalPathOf('hub', found.ccn), hospital: found };
}

// The sample interim Readmissions hospital pages (hub/hrrp/page.js), by type, each the first hospital in the pinned Thirty Day
// Readmissions file with a payment cut and an estimate, with no cut, or that the dollar file does not have (no estimate, no
// page across the programs): [type, what it is, the test]. test reads the pinned record and the hub hospital (null when the
// dollar file does not have it).
const HRRP_HOSPITALS = [
  ['hrrp-hospital-cut', 'with a payment cut and an estimate', (r, h) => r.paf < 1 && h?.est?.hrrpListed === true],
  ['hrrp-hospital-no-cut', 'with no payment cut', (r) => r.paf >= 1],
  ['hrrp-hospital-no-estimate', 'the dollar file does not have', (r, h) => h === null],
];

// The sample interim Readmissions hospital page of a type (HRRP_HOSPITALS), { type, name, path, hospital: its pinned
// record }, from the pinned file and the emitted data alone.
export function hrrpHospitalSample(type, hub = loadHub(), all = hubHospitals(hub)) {
  const [, what, test] = HRRP_HOSPITALS.find(([t]) => t === type) ?? [];
  if (!test) throw new RangeError(`hrrpHospitalSample: no sample type "${type}"`);
  const byCcn = new Map(all.map((h) => [h.ccn, h]));
  const found = [...hub.tdr.hospitals.values()].find((r) => test(r, byCcn.get(r.id) ?? null));
  if (!found) throw new Error(`hrrpHospitalSample: no hospital ${what} in the data`);
  return { type, name: type, path: hospitalPathOf('hrrp', found.id, { inTdr: true }), hospital: found };
}

// One page of every type, [{ type, name, path }]: the hub's home and each of its policy pages, a program's
// coming-soon page (value-based purchasing's, the one with a figure), the program page, its Methods and dictionary, the three sample hospitals
// (hospitalSample), the first region, division, state and metro page in dist/, the two sample hospitals' pages across the
// programs (hubHospitalSample), the interim Readmissions page and its three sample hospitals' pages (hrrpHospitalSample), and
// a path no page has (the not-found page, served with status 404). name is the page's
// name in a test's title: its type, and a policy page's path; never a hospital's name or address. Needs dist/ and the
// emitted data, whichever site the browser visits.
export function samplePages() {
  const all = readNewestEmitted().hospitals;
  const hubData = loadHub();
  const hub = hubHospitals(hubData);
  const page = (type, path) => ({ type, name: type, path });
  const places = firstPlaces();
  return [
    page('hub', '/'),
    ...Object.values(SITE.pages).map((path) => ({ type: 'policy', name: `policy ${path}`, path })),
    page('coming', SITE.programs.find((p) => p.id === 'hvbp').path),
    page('program', PROGRAM_PATH),
    ...HOSPITALS.map(([type]) => hospitalSample(type, all)),
    ...KINDS.map((kind) => page(kind, places.get(kind))),
    page('methods', METHODS_PATH),
    page('dictionary', DICTIONARY_PAGE),
    ...HUB_HOSPITALS.map(([type]) => hubHospitalSample(type, hub)),
    page('hrrp', SITE.programs.find((p) => p.id === 'hrrp').path),
    ...HRRP_HOSPITALS.map(([type]) => hrrpHospitalSample(type, hubData, hub)),
    page('not-found', '/no-page-has-this-address/'),
  ];
}
