// The site the browser checks visit, with no browser of its own: which site (dist/ served locally, or E2E_BASE_URL), the
// engines, and the pages to visit. The launch command (launch.js) reads it as the checks do; lib.js adds the browser.
import { existsSync } from 'node:fs';
import { isDecided } from '../../engine/js/hacrp/hospital.js';
import { DIST_DIR } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { htmlPages } from '../../pipeline/site/html.js';
import { createSiteServer, listen, stop } from '../../pipeline/site/serve.js';
import { readNewestEmitted } from '../../sites/hacrp/pipeline/build.js';
import { SITE } from '../../web/site.js';
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

// One page of every type, [{ type, name, path }]: the hub's home and each of its policy pages, a program's
// placeholder (value-based purchasing's), the program page, its Methods and dictionary, the three sample hospitals
// (hospitalSample), the first region, division, state and metro page in dist/, and a path no page has (the not-found
// page, served with status 404). name is the page's name in a test's title: its type, and a policy page's path; never a
// hospital's name or address. Needs dist/ and the emitted data, whichever site the browser visits.
export function samplePages() {
  const all = readNewestEmitted().hospitals;
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
    page('not-found', '/no-page-has-this-address/'),
  ];
}
