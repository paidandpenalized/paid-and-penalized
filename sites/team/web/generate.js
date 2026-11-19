// The TEAM site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes the program
// page and Methods. TEAM is a payment model, not a penalty program; the site stays unreleased (noindex, out of the
// sitemap) until its released flag turns true.
import { builtOn } from '../../../engine/js/dates.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { SITE } from '../../../web/site.js';
import { loadAtlas, loadMaster, loadSources, loadTeam } from './data.js';
import { METHODS_PATH, PROGRAM_PATH } from './links.js';
import { methodsPage } from './pages/methods.js';
import { programPage } from './pages/program.js';

// The newest date of CMS's among the inputs the page shows (the participant and CJR-X lists' as-of dates, the regional
// prices' date and the quality measures' release): the date the corrections page gives for the site.
const newestCmsDate = (meta) => [meta.listAsOf, meta.cjrxAsOf, meta.pricesDated, meta.qualityReleased].sort().at(-1);

// ctx: the build's context (pipeline/site/context.js); team, master, atlas: data.js's loads (tests pass their own);
// released: whether the site's pages may be indexed in a production build; log: where progress lines go. Returns the two
// dates the hub's corrections page lists: the newest date CMS gives an input and the day the TEAM file was built.
export function generateTeam(ctx, { team = loadTeam(), master = loadMaster(), atlas = loadAtlas(), released = SITE.sites.team.released, log = console.log } = {}) {
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ team, master, atlas, robots, assets }) });
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ sources: loadSources(team), robots, assets }) });
  log(`TEAM: 2 pages under ${PROGRAM_PATH}, ${team.counts.listed} hospitals on CMS's list`);
  return { updated: { cmsReleased: newestCmsDate(team.meta), changed: builtOn(team.built_at) } };
}

// The TEAM site's build manifest. No browser script of its own yet: the page loads the figures' (assets.js.figure).
export const TEAM = {
  id: 'team',
  entries: {},
  styles: [...KIT_STYLES, 'sites/team/web/styles.css'],
  generate: (ctx, { log } = {}) => generateTeam(ctx, { log }),
};
