// The HACRP page generator: checks acceptance A1 on the emitted data (the build fails if it doesn't hold), then
// emits the program page, one page per hospital, and the dataset CSV with its data dictionary through the build
// context.
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { decidedHospitals, scoredHospitals } from '../../../engine/js/hacrp/hospital.js';
import { medianHospital } from '../../../engine/js/hacrp/median.js';
import { percentileSas5 } from '../../../engine/js/stats.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { decimal } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { RAMP_HIGH_PCT, RAMP_LOW_PCT } from './constants.js';
import { dictionaryText, hospitalsCsv } from './csv.js';
import { loadHacrp } from './data.js';
import { measureRanges } from './figures.js';
import { compareDefault } from './hospital-table.js';
import { DICTIONARY_PAGE, csvPath, dictionaryPath } from './links.js';
import { dictionaryPage } from './pages/dictionary.js';
import { programPage, PATH as PROGRAM_PATH } from './pages/program.js';
import { hospitalPage } from './pages/hospital.js';
import { HOSPITALS_PATH, hospitalView, stateCounts } from './view.js';

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
// one row per hospital, [ccn, name, city, state, total, decision, zip]: the CCN as CMS writes it (a page is at
// hospitalPath + the CCN in lowercase + "/"), names, places and ZIP codes from the hospital master, CMS's Total HAC
// Score text as published (hyphen-minus, so the table sorts on CMS's own number; "N/A" when none) and CMS's payment
// reduction text. Rows are in the hospital table's default order (state, then name; hospital-table.js); the search
// ranks its own matches.
export function hospitalRows(views) {
  const rows = views.map((v) => [v.ccn, v.name, v.city, v.state, v.score.raw, v.decision.text, v.zip]).sort(compareDefault);
  return { hospitalPath: HOSPITALS_PATH, rows };
}

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
  const { fy, hospitals, model, estimate, footnotes, master, periods, source, boundaryText, dictionary } = data;
  const a1 = checkA1(hospitals, model);
  log(a1Summary(a1));
  if (!a1.ok) throw new Error(`HACRP acceptance A1 failed; decision mismatches: ${a1.b.mismatches.join(', ') || 'none'}`);

  const pages = hospitals.map((hospital) => ({
    hospital,
    view: hospitalView({ hospital, model, estimate, footnotes, master: master.get(hospital.ccn), fy, periods, boundaryText }),
  }));
  const views = pages.map((p) => p.view);

  // The dataset file and its dictionary: files, not pages (no robots: they are not in the sitemap).
  ctx.emit({ path: csvPath(fy), text: hospitalsCsv(hospitals, master) });
  const dictionaryFilled = dictionaryText(dictionary, { fy, source });
  ctx.emit({ path: dictionaryPath(fy), text: dictionaryFilled });

  const range = scoreRange(hospitals);
  const programRobots = robotsFor({ env, released });
  // The hospitals asset: the top bar's search on every page, and the program page's table.
  const searchUrl = ctx.asset('hacrp-hospitals', 'json', JSON.stringify(hospitalRows(views)));
  // The dictionary as a page, which the data links open; indexed as the program page is.
  ctx.emit({ path: DICTIONARY_PAGE, robots: programRobots, text: dictionaryPage({ text: dictionaryFilled, fy, path: DICTIONARY_PAGE, robots: programRobots, assets, searchUrl }) });
  ctx.emit({
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
      // The histogram's population is A1(b)'s too.
      scores: decidedHospitals(hospitals).map((h) => ({ total: h.total, yes: h.paymentReduction === 'Yes' })),
      boundary: model.boundary,
      states: stateCounts(views),
    }),
  });

  const ranges = measureRanges(model);
  for (const { hospital, view } of pages) {
    const robots = robotsFor({ env, released, eligible: view.scored });
    ctx.emit({ path: view.path, robots, text: hospitalPage({ view, source, robots, assets, ranges, searchUrl, whatif: { hospital, model, estimate, range } }) });
  }
}

// The HACRP site's build manifest (pipeline/site/build.js lists it).
export const HACRP = {
  id: 'hacrp',
  entries: { 'hacrp-program': 'sites/hacrp/client/program.js', 'hacrp-hospital': 'sites/hacrp/client/hospital.js', 'hacrp-search': 'sites/hacrp/client/search.js' },
  styles: ['sites/hacrp/web/styles.css'],
  generate: (ctx) => generateHacrp(ctx),
};
