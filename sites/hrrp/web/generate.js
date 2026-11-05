// The Readmissions site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes the
// program page, one page for each hospital in the file, each place's page and Methods (last).
// Before it writes anything it checks that the formula (engine/js/hrrp/formula.js) gives CMS's payment adjustment factor
// for every hospital.
import { contrib } from '../../../engine/js/hrrp/formula.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { SITE } from '../../../web/site.js';
import { hospitalCsv } from './csv.js';
import { loadHrrp } from './data.js';
import { hospitalPage } from './pages/hospital.js';
import { methodsPage } from './pages/methods.js';
import { placePage } from './pages/place.js';
import { programPage } from './pages/program.js';
import { METHODS_PATH, PROGRAM_PATH, hospitalPath } from './links.js';
import { buildPlaces } from './places.js';
import { areaContext, hospitalContext, hospitalView, methodsView, placeView, programView } from './view.js';

// The first hospital whose factor the formula does not reproduce, or null.
export function firstMismatch(hospitals, meta) {
  return hospitals.find((h) => contrib(h, meta).paf !== h.paf) ?? null;
}

// ctx: the build's context (pipeline/site/context.js). data: loadHrrp()'s result (tests pass their own); released:
// whether the site's pages may be indexed in a production build; log: where progress lines go. Returns the two dates the
// hub's corrections page lists.
export function generateHrrp(ctx, { data = loadHrrp(), released = SITE.sites.hrrp.released, log = console.log } = {}) {
  const { hospitals, meta } = data;
  const bad = firstMismatch(hospitals, meta);
  if (bad) throw new Error(`HRRP: the formula does not reproduce CMS's payment adjustment factor for ${bad.id} (CMS ${bad.paf}, formula ${contrib(bad, meta).paf})`);
  log(`HRRP: the formula reproduces CMS's factor for all ${hospitals.length} hospitals`);
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  const shared = hospitalContext(data);
  const places = buildPlaces(hospitals, meta);
  const area = areaContext({ ...data, places });
  const program = programView(area);
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ view: program, robots, assets }) });
  ctx.emit({ path: program.picture.csvHref, text: hospitalCsv(program.picture.largest.map((r) => r.h)) });
  for (const hospital of hospitals) {
    ctx.emit({ path: hospitalPath(hospital.id), robots, text: hospitalPage({ view: hospitalView(hospital, shared), robots, assets }) });
  }
  for (const place of places.list) ctx.emit({ path: place.path, robots, text: placePage({ view: placeView(place, area), robots, assets }) });
  // Methods last, with the count of the pages under the program.
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ view: methodsView(area), robots, assets }) });
  log(`HRRP: ${1 + hospitals.length + places.list.length + 1} pages under ${PROGRAM_PATH}`);
  return { updated: { cmsReleased: data.cmsReleased, changed: data.changedOn } };
}

// The Readmissions site's build manifest. No browser scripts yet.
export const HRRP = {
  id: 'hrrp',
  entries: {},
  styles: [...KIT_STYLES, 'sites/hrrp/web/styles.css'],
  generate: (ctx) => generateHrrp(ctx),
};
