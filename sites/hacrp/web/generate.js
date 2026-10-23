// The HACRP page generator: checks acceptance A1 on the emitted data (the build fails if it doesn't hold), then
// emits the program page, one page per hospital, and the dataset CSV with its data dictionary through the build
// context.
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { EQUAL_FROM, Z_FROM } from '../../../engine/js/hacrp/eras.js';
import { yearCheck } from '../../../engine/js/hacrp/history.js';
import { scoredHospitals, scoredMeasures } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { ESTIMATE_THRESHOLD } from '../../../engine/js/hacrp/params.js';
import { totalFromZ } from '../../../engine/js/hacrp/score.js';
import { percentileSas5 } from '../../../engine/js/stats.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { decimal, listText } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { RAMP_HIGH_PCT, RAMP_LOW_PCT, SHORT_NAMES } from './constants.js';
import { sourceText } from './copy.js';
import { nationalContext } from './compare.js';
import { dictionaryText, hospitalsCsv } from './csv.js';
import { loadHacrp } from './data.js';
import { historyData } from './history-data.js';
import { historySource, rollAsset } from './history-figures.js';
import { compareDefault } from './hospital-table.js';
import { DICTIONARY_PAGE, csvPath, dictionaryPath } from './links.js';
import { t as mt } from './methods/copy.js';
import { dictionaryPage } from './pages/dictionary.js';
import { hospitalPage } from './pages/hospital.js';
import { methodsPage, METHODS_PATH } from './pages/methods.js';
import { placePage } from './pages/place.js';
import { programPage, PATH as PROGRAM_PATH } from './pages/program.js';
import { exploreAsset, programData } from './program-data.js';
import { hospitalMoney } from './money.js';
import { KINDS, buildPlaces } from './places.js';
import { HOSPITALS_PATH, hospitalView } from './view.js';

const dp5 = (x) => (x === null ? 'none' : decimal(x, 5));

function a1Summary({ ok, a, b, info }) {
  return [
    `A1 ${ok ? 'ok' : 'FAILED'}`,
    `(a) ${a.within} of ${a.n} scored hospitals: mean published z equals the Total HAC Score; max error ${dp5(a.maxError)}`,
    `(b) ${b.n} scored Yes/No hospitals: ${b.mismatches.length} decision mismatches`,
    `info: p75 of all scored totals ${dp5(info.pctAllScored)}; of Yes/No totals ${dp5(info.pctDecided)}`,
  ].join('\n  ');
}

// The hospitals asset (/assets/hacrp-hospitals.<hash>.json) the program page's client reads: { hospitalPath, rows },
// one row per hospital, [ccn, name, city, state, total, decision, zip, cut]: the CCN as CMS writes it (a page is at
// hospitalPath + the CCN in lowercase + "/"), names, places and ZIP codes from the hospital master, CMS's Total HAC
// Score text as published (hyphen-minus, so the table sorts on CMS's own number; "N/A" when none), CMS's payment
// reduction text and, with dollars (Map of CCN -> row of the dollar estimates), this site's estimate of the HAC cut in
// whole dollars (cutDollars). Rows are in the hospital table's default order (state, then name; hospital-table.js); the
// search ranks its own matches.
export function hospitalRows(views, places = null, dollars = null) {
  const rows = views.map((v) => [v.ccn, v.name, v.city, v.state, v.score.raw, v.decision.text, v.zip, ...(dollars ? [cutDollars(dollars.get(v.ccn))] : [])]).sort(compareDefault);
  return { hospitalPath: HOSPITALS_PATH, rows, ...(places ? { places: placeEntries(places) } : {}) };
}

// A hospital's HAC cut as the tables show it, this site's estimate in whole dollars: the dollars at stake for a
// hospital CMS cut, 0 for one it didn't or for Maryland's (exempt), null with no estimate.
export function cutDollars(row) {
  if (!row) throw new RangeError('cutDollars: a row of the dollar estimates is required');
  if (row.status === 'maryland') return 0;
  if (row.status !== 'estimated') return null;
  return row.cut ? row.atStake : 0;
}

// The places the search finds, [kind, key, name, path, hospitals in CMS's file], in kind order then by name.
export const placeEntries = (places) => places.list
  .map((p) => [p.kind, p.key, p.name, p.path, p.counts.file])
  .sort((a, b) => KINDS.indexOf(a[0]) - KINDS.indexOf(b[0]) || a[2].localeCompare(b[2], 'en'));

// The what-if ramp's national span: the RAMP_LOW_PCT and RAMP_HIGH_PCT percentiles of CMS's published Total HAC
// Scores (SAS's default definition, as elsewhere), so a hospital's ramp shows its score among most others'.
export function scoreRange(hospitals) {
  const totals = scoredHospitals(hospitals).map((h) => h.total).sort((a, b) => a - b);
  return { low: percentileSas5(totals, RAMP_LOW_PCT / 100), high: percentileSas5(totals, RAMP_HIGH_PCT / 100) };
}

// ctx: the build context (pipeline/site/context.js). released defaults to web/site.js; tests pass it, and may pass
// data from loadHacrp() to read the files once.
export async function generateHacrp(ctx, { released = SITE.sites.hacrp.released, data = loadHacrp(), log = console.log } = {}) {
  const { env, assets } = ctx;
  const { fy, hospitals, model, estimate, footnotes, master, periods, source, boundaryText, dictionary, careCompare, careCompareSource, shapes, counties, masterFy, changes, manifest, sourceRows, history, infections, pinsUsed, dollars } = data;
  // Every program year, when the build holds the history: Part 4, the Methods page's checks, each hospital's record.
  const hd = history ? historyData({ history, master }) : null;
  if (hd) {
    const failed = hd.checks.filter((c) => !c.check.ok);
    if (failed.length) throw new Error(`HACRP self-check failed for ${failed.map((c) => `FY${c.fy} (largest miss ${c.check.maxError}; out of order: ${c.check.wrongSide.length})`).join(', ')}`);
  }
  const a1 = checkA1(hospitals, model);
  log(a1Summary(a1));
  if (!a1.ok) throw new Error(`HACRP acceptance A1 failed; decision mismatches: ${a1.b.mismatches.join(', ') || 'none'}`);

  const pages = hospitals.map((hospital) => ({
    hospital,
    view: hospitalView({ hospital, model, estimate, footnotes, master: master.get(hospital.ccn), fy, periods, boundaryText, careCompare: careCompare?.get(hospital.ccn) ?? null }),
  }));
  const views = pages.map((p) => p.view);

  // The dataset file and its dictionary: files, not pages (no robots: they are not in the sitemap).
  ctx.emit({ path: csvPath(fy), text: hospitalsCsv(hospitals, master, dollars.byCcn) });
  const dictionaryFilled = dictionaryText(dictionary, { fy, source });
  ctx.emit({ path: dictionaryPath(fy), text: dictionaryFilled });
  // The pages this site writes, counted as they go (the Methods page, written last, reports the total).
  let pageCount = 0;
  const emitPage = (p) => {
    pageCount++;
    ctx.emit(p);
  };

  const range = scoreRange(hospitals);
  const programRobots = robotsFor({ env, released });
  // What the program page and the place pages draw, computed once.
  const pd = programData({ hospitals, master, model });
  const places = buildPlaces({ hospitals, master, rows: pd.rows });
  // The hospitals asset: the searches on every page (hospitals and places), and the hospital tables.
  const searchUrl = ctx.asset('hacrp-hospitals', 'json', JSON.stringify(hospitalRows(views, places, dollars.byCcn)));
  // The dictionary as a page, which the data links open; indexed as the program page is.
  emitPage({ path: DICTIONARY_PAGE, robots: programRobots, text: dictionaryPage({ text: dictionaryFilled, fy, path: DICTIONARY_PAGE, robots: programRobots, assets, searchUrl }) });
  // The explore asset: what the explorable figures draw in the browser (program-data.js exploreAsset).
  const exploreUrl = ctx.asset('hacrp-explore', 'json', JSON.stringify(exploreAsset(pd, model)));
  // The hero's suggestions: the state and the metro area with the most hospitals with a payment decision.
  const most = (kind) => places.list.filter((p) => p.kind === kind).sort((a, b) => b.counts.decided - a.counts.decided || a.name.localeCompare(b.name, 'en'))[0];
  emitPage({
    path: PROGRAM_PATH,
    robots: programRobots,
    text: programPage({
      fy,
      // Penalty counts use A1(b)'s population (scored, decided Yes/No); the score count, every scored hospital.
      counts: { decided: a1.b.n, yes: a1.b.yes, scored: a1.a.n },
      boundaryText,
      periods,
      searchUrl,
      source,
      robots: programRobots,
      assets,
      whatif: { hospital: medianHospital(model, { fiscalYear: String(fy), periods }), model, estimate, range },
      pd,
      exploreUrl,
      tryPlaces: most('state') && most('metro') ? { state: most('state'), metro: most('metro') } : null,
      places,
      shapes,
      hd,
      rollUrl: hd ? ctx.asset('hacrp-history', 'json', JSON.stringify(rollAsset(hd, { shapes, master }))) : null,
      master,
    }),
  });

  // A page for every place: each region, division, state and metro area. Its map needs each hospital's place and
  // page, from the views.
  const hospitalRowsByCcn = new Map(views.map((v) => [v.ccn, { name: v.name, city: v.city, state: v.state, totalText: v.score.raw, decision: v.decision.text, point: v.point, href: v.path }]));
  for (const place of places.list) {
    emitPage({
      path: place.path,
      robots: programRobots,
      text: placePage({ place, places, pd, model, hospitalRows: hospitalRowsByCcn, master, shapes, counties, fy, periods, source, searchUrl, robots: programRobots, assets, hd }),
    });
  }

  // What every hospital page compares a hospital with, computed once, and any hospital's estimated cut.
  const nat = nationalContext({ hospitals, master, model });
  const cutOf = (ccn) => cutDollars(dollars.byCcn.get(ccn));
  for (const { hospital, view } of pages) {
    const robots = robotsFor({ env, released, eligible: view.scored });
    const money = hospitalMoney(dollars.byCcn.get(hospital.ccn), dollars.bands);
    emitPage({
      path: view.path,
      robots,
      text: hospitalPage({ view, hospital, model, nat, master: master.get(hospital.ccn), source, robots, assets, searchUrl, shapes, counties, careSource: careCompareSource, masterFy, whatif: { hospital, model, estimate, range, money }, history: hd ? { rec: hd.recordOf(hospital.ccn), hd, sir: infections.get(hospital.ccn) ?? null } : null, money, cutOf }),
    });
  }

  // The Methods page, written last: the self-check for every year this build holds (checked above), or, without the history, the
  // newest year's; the pipeline's numbers for the newest.
  const checks = hd ? hd.checks.map((c) => ({ fy: c.fy, rule: mt(c.ruleKey), check: c.check })) : [{ fy, rule: mt('ruleEqual'), check: newestOnly(hospitals, fy) }];
  const tagged = MEASURE_IDS.filter((id) => estimate[id].tagged);
  emitPage({
    path: METHODS_PATH,
    robots: programRobots,
    text: methodsPage({
      fy,
      checks,
      years: hd ? hd.years.map((y) => ({ fy: y.fy, periods: y.periods })) : [{ fy, periods }],
      newest: { rows: sourceRows, source, pin: manifest.find((e) => e.id === source.id), measures: MEASURE_IDS.length, pages: pageCount + 1, sourceLine: hd ? historySource(hd) : sourceText({ fy, source }) },
      pins: pinsUsed,
      changes,
      estimate: { tolerance: ESTIMATE_THRESHOLD, tagged: tagged.length ? listText(tagged.map((id) => SHORT_NAMES[id])) : null, maxError: tagged.length ? Math.max(...tagged.map((id) => estimate[id].maxError)) : null },
      boundaryText,
      eqFy: EQUAL_FROM,
      zFy: Z_FROM,
      robots: programRobots,
      assets,
      searchUrl,
    }),
  });
}

// The newest year's self-check, for a build without the history: each hospital's z-scores averaged again against
// CMS's Total HAC Score, and CMS's decisions against the line this site finds.
export function newestCheck(hospitals) {
  return yearCheck(hospitals.map((h) => {
    const ids = scoredMeasures(h);
    return { ccn: h.ccn, total: h.total, recomputed: ids.length ? totalFromZ(ids.map((id) => h.measures[id].z)) : null, decision: h.paymentReduction };
  }));
}

// newestCheck, failing the build when it fails.
function newestOnly(hospitals, fy) {
  const check = newestCheck(hospitals);
  if (!check.ok) throw new Error(`HACRP self-check failed for FY${fy}: largest miss ${check.maxError}; wrong side: ${check.wrongSide.join(', ') || 'none'}`);
  return check;
}

// Every dollar figure carries its likely range. Until the back-test's ranges exist the pages say they are pending,
// which is for review only: a production build of the site stops here.
export function refusePendingRanges(env, dollars) {
  if (env === 'production' && dollars.bands === null) throw new Error('HACRP: the dollar estimates have no ranges yet (bands is null); a production build cannot publish them');
}

// The HACRP site's build manifest (pipeline/site/build.js lists it).
export const HACRP = {
  id: 'hacrp',
  entries: { 'hacrp-program': 'sites/hacrp/client/program.js', 'hacrp-place': 'sites/hacrp/client/place.js', 'hacrp-hospital': 'sites/hacrp/client/hospital.js', 'hacrp-search': 'sites/hacrp/client/search.js' },
  styles: ['sites/hacrp/web/styles.css'],
  generate: (ctx) => {
    const data = loadHacrp();
    refusePendingRanges(ctx.env, data.dollars);
    return generateHacrp(ctx, { data });
  },
};
