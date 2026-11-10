// The work-requirement site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes
// the program page and Methods. The site is a scenario, not a CMS payment program (web/site.js), and stays unreleased
// (noindex, out of the sitemap) until its released flag turns true.
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { SITE } from '../../../web/site.js';
import { loadMedicaid } from './data.js';
import { METHODS_PATH, PROGRAM_PATH } from './links.js';
import { methodsPage } from './pages/methods.js';
import { programPage } from './pages/program.js';
import { stripWords } from './program/finding.js';
import { howModel } from './program/how.js';
import { baseAsset, serverTotals } from './program/model.js';
import { axisTop, hospitalRows, stripsAsset } from './program/strips.js';

// ctx: the build's context (pipeline/site/context.js). data: loadMedicaid()'s result (tests pass their own); released:
// whether the site's pages may be indexed in a production build; log: where progress lines go. Returns the two dates the
// hub's corrections page lists: the newest date CMS gives any of the scenario file's inputs (data.js newestCmsDate) and
// the day the scenario file was built.
export function generateWr(ctx, { data = loadMedicaid(), released = SITE.sites['work-requirement'].released, log = console.log } = {}) {
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  const rows = hospitalRows(data);
  const stripsUrl = ctx.asset('wr-strips', 'json', JSON.stringify(stripsAsset(rows, {
    top: axisTop(rows, data.params.use_max), words: stripWords(data), totals: serverTotals(data), how: howModel(data),
  })));
  const baseUrl = ctx.asset('wr-base', 'json', JSON.stringify(baseAsset(data)));
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ data, rows, robots, assets, stripsUrl, baseUrl }) });
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ data, robots, assets }) });
  log(`Work requirement: 2 pages under ${PROGRAM_PATH}, ${data.hospitals.size} hospitals in the FY${data.meta.fy} file`);
  return { updated: { cmsReleased: data.meta.cmsReleased, changed: data.meta.changed } };
}

// The work-requirement site's build manifest. One browser script, the program page's (client/page.js: the strips, the
// chips, the bar's Find, the scenario switch and the use-rate what-if, and step 2's chain).
export const WR = {
  id: 'work-requirement',
  entries: { 'wr-page': 'sites/work-requirement/client/page.js' },
  styles: [...KIT_STYLES, 'sites/work-requirement/web/styles.css'],
  generate: (ctx, { log } = {}) => generateWr(ctx, { log }),
};
