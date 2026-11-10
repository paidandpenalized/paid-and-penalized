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

// ctx: the build's context (pipeline/site/context.js). data: loadMedicaid()'s result (tests pass their own); released:
// whether the site's pages may be indexed in a production build; log: where progress lines go. Returns the two dates the
// hub's corrections page lists: the CMS-64 file's (the newest CMS input) and the day the scenario file was built.
export function generateWr(ctx, { data = loadMedicaid(), released = SITE.sites['work-requirement'].released, log = console.log } = {}) {
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ data, robots, assets }) });
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ data, robots, assets }) });
  log(`Work requirement: 2 pages under ${PROGRAM_PATH}, ${data.hospitals.size} hospitals in the FY${data.meta.fy} file`);
  return { updated: { cmsReleased: data.meta.cmsReleased, changed: data.meta.changed } };
}

// The work-requirement site's build manifest. One browser script, the program page's (empty until its steps are drawn).
export const WR = {
  id: 'work-requirement',
  entries: { 'wr-page': 'sites/work-requirement/client/page.js' },
  styles: [...KIT_STYLES, 'sites/work-requirement/web/styles.css'],
  generate: (ctx, { log } = {}) => generateWr(ctx, { log }),
};
