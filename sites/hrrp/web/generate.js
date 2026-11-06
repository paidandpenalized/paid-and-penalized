// The Readmissions site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes the
// program page, one page for each hospital in the file, each place's page and Methods (last).
// Before it writes anything it checks that the formula (engine/js/hrrp/formula.js) gives CMS's payment adjustment factor
// for every hospital.
import { MIN_DISCHARGES, contrib } from '../../../engine/js/hrrp/formula.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { SITE } from '../../../web/site.js';
import { dictionaryText, hospitalCsv, hospitalsCsvName, placeCsv } from './csv.js';
import { hospitalsAsset } from './figures/explore-data.js';
import { placeRowsAsset } from './figures/place-table-data.js';
import { statesCsvRows } from './figures/map-data.js';
import { swarmRest } from './figures/swarm.js';
import { worksheetAsset } from './figures/worksheet-data.js';
import { loadHrrp } from './data.js';
import { dictionaryPage } from './pages/dictionary.js';
import { hospitalPage } from './pages/hospital.js';
import { methodsPage } from './pages/methods.js';
import { placePage } from './pages/place.js';
import { programPage } from './pages/program.js';
import { DICTIONARY_PAGE, METHODS_PATH, PROGRAM_PATH, csvPath, dictionaryPath, hospitalPath } from './links.js';
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
  const shared = hospitalContext(data);  // data.shapes and data.counties: the outlines the nearby map draws
  const places = buildPlaces(hospitals, meta);
  const area = areaContext({ ...data, places, side: shared.side, lines: shared.lines });  // data.shapes: the state outlines the map draws
  const program = programView(area);
  // The search asset (one short row for each hospital and the site's places) is what the pages that only search read: a hospital page,
  // Methods and the dictionary.
  const placeRows = places.list.map((p) => [p.kind, p.key, p.name, p.path, p.hospitals.length]);
  const hospitalsUrl = ctx.asset('hrrp-hospitals', 'json', JSON.stringify(hospitalsAsset(hospitals, placeRows)));
  // Worksheet R's hospital box reads every hospital's worksheet inputs, loaded when a hospital is picked.
  const worksheetUrl = ctx.asset('hrrp-worksheet', 'json', JSON.stringify(worksheetAsset(hospitals, meta)));
  // Step 2's swarms past heart failure's: drawn here, fetched by the page when a condition is first picked.
  const swarmUrl = ctx.asset('hrrp-swarm', 'json', JSON.stringify(swarmRest({ how: program.how })));
  // The rows asset (every hospital, plus what the search needs) is the one file the program page and the place pages read: the search
  // box, Worksheet R's box, the explorer (filtered in the browser, so its rows are never in the page) and the place pages' hospitals
  // tables, which carry their first page and read the rest from it near the table. It is fetched once on a page.
  const placeRowsUrl = ctx.asset('hrrp-place-rows', 'json', JSON.stringify(placeRowsAsset(hospitals, meta, area.edition.conditions, placeRows)));
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ view: program, robots, assets, hospitalsUrl: placeRowsUrl, worksheetUrl, swarmUrl, rowsUrl: placeRowsUrl }) });
  ctx.emit({ path: program.picture.csvHref, noindex: robots !== null, text: hospitalCsv(program.picture.largest.map((r) => r.h)) });
  ctx.emit({ path: program.map.csvHref, noindex: robots !== null, text: placeCsv(statesCsvRows(program.map.pages)) });
  // The full hospitals file and its dictionary: files, then the dictionary as a page.
  const { fy } = meta;
  const csvHref = csvPath(fy, hospitalsCsvName(fy));
  const dictionaryFilled = dictionaryText(data.dictionary, { edition: program.edition, fy, minCases: MIN_DISCHARGES });
  ctx.emit({ path: csvHref, noindex: robots !== null, text: hospitalCsv(hospitals) });
  ctx.emit({ path: dictionaryPath(fy), noindex: robots !== null, text: dictionaryFilled });
  ctx.emit({ path: DICTIONARY_PAGE, robots, text: dictionaryPage({ text: dictionaryFilled, edition: program.edition, csvHref, markdownHref: dictionaryPath(fy), robots, assets, hospitalsUrl }) });
  // One file for each area a hospital page tables (a metro, or a state outside its metros), shared by every hospital in it.
  for (const group of shared.areas.values()) {
    ctx.emit({ path: csvPath(fy, group.csvName), noindex: robots !== null, text: hospitalCsv(group.rows.map((r) => r.h)) });
  }
  for (const hospital of hospitals) {
    ctx.emit({ path: hospitalPath(hospital.id), robots, text: hospitalPage({ view: hospitalView(hospital, shared), robots, assets, hospitalsUrl }) });
  }
  for (const place of places.list) {
    const view = placeView(place, area);
    ctx.emit({ path: place.path, robots, text: placePage({ view, robots, assets, shared: area, rowsUrl: placeRowsUrl, hospitalsUrl: placeRowsUrl }) });
    // The files its two tables link: the places inside it, and its hospitals (a metro area's are the area file written above).
    if (view.children) ctx.emit({ path: csvPath(fy, view.children.csvName), noindex: robots !== null, text: placeCsv(view.children.csvRows, view.children.column) });
    if (view.hospitals.csvOwn) ctx.emit({ path: csvPath(fy, view.hospitals.csvName), noindex: robots !== null, text: hospitalCsv(view.hospitals.rows.map((r) => r.h)) });
  }
  // Methods last, with the count of the pages under the program.
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ view: methodsView(area), robots, assets, hospitalsUrl }) });
  log(`HRRP: ${1 + hospitals.length + places.list.length + 2} pages under ${PROGRAM_PATH}`);
  return { updated: { cmsReleased: data.cmsReleased, changed: data.changedOn } };
}

// The Readmissions site's build manifest. Four browser scripts (the last, the top bar's search, rides on the pages that have none of its own): the program page's (search, Worksheet R's box, the map, the swarms), the hospital page's (the what-if and the area table's pager) and the place page's (its map's dots open their hospitals).
export const HRRP = {
  id: 'hrrp',
  entries: { 'hrrp-program': 'sites/hrrp/client/program.js', 'hrrp-hospital': 'sites/hrrp/client/hospital.js', 'hrrp-place': 'sites/hrrp/client/place.js', 'hrrp-search': 'sites/hrrp/client/bar.js' },
  styles: [...KIT_STYLES, 'sites/hrrp/web/styles.css'],
  generate: (ctx) => generateHrrp(ctx),
};
