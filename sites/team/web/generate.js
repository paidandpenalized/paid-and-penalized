// The TEAM site's page build: its manifest (pipeline/site/build.js lists it) and the generator that writes the program
// page and Methods. TEAM is a payment model, not a penalty program; the site stays unreleased (noindex, out of the
// sitemap) until its released flag turns true.
import { join } from 'node:path';
import { builtOn } from '../../../engine/js/dates.js';
import { readJson } from '../../../pipeline/files.js';
import { KIT_STYLES } from '../../../pipeline/site/assets.js';
import { robotsFor } from '../../../pipeline/site/context.js';
import { count } from '../../../web/render/format.js';
import { SITE } from '../../../web/site.js';
import { loadAtlas, loadMaster, loadSources, loadTeam } from './data.js';
import { calcAsset } from '../../../web/team/calc-data.js';
import { lookupFile } from './lookup-copy.js';
import { METHODS_PATH, PROGRAM_PATH } from './links.js';
import { methodsPage } from './pages/methods.js';
import { programPage } from './pages/program.js';

// The newest date of CMS's among the inputs the page shows (the participant and CJR-X lists' as-of dates, the regional
// prices' date and the quality measures' release): the date the corrections page gives for the site.
const newestCmsDate = (meta) => [meta.listAsOf, meta.cjrxAsOf, meta.pricesDated, meta.qualityReleased].sort().at(-1);

// The CCNs among the lookup's codes rows ([ccn, code, arg]) that the family search's file (hub/search/asset.js: cols and
// rows) can't find: no row there, or one with no name. The lookup lists only hospitals that file names, so each of these
// would be a hospital the box silently never shows.
export function lookupMissing(rows, search) {
  const at = search.cols.indexOf('ccn');
  const name = search.cols.indexOf('name');
  const named = new Set(search.rows.filter((r) => typeof r[name] === 'string' && r[name]).map((r) => r[at]));
  return rows.map(([ccn]) => ccn).filter((ccn) => !named.has(ccn));
}

// The family search's file as the build wrote it (pipeline/site/build.js buildContext), from ctx's output folder.
const writtenSearch = (ctx) => readJson(join(ctx.outDir, ctx.assets.shell.searchUrl));

// ctx: the build's context (pipeline/site/context.js); team, master, atlas: data.js's loads (tests pass their own);
// search: the family search's file (the one the build wrote); released: whether the site's pages may be indexed in a
// production build; log: where progress lines go. Returns the two
// dates the hub's corrections page lists: the newest date CMS gives an input and the day the TEAM file was built.
export function generateTeam(ctx, { team = loadTeam(), master = loadMaster(), atlas = loadAtlas(), search = writtenSearch(ctx), released = SITE.sites.team.released, log = console.log } = {}) {
  const robots = robotsFor({ env: ctx.env, released });
  const { assets } = ctx;
  // The lookup's codes and words: one hashed file, fetched on the box's first focus (client/lookup.js). Every hospital it
  // places must be one the family search names, or the box would never list it: the build stops, saying how many (never
  // which: build logs are public).
  const lookup = lookupFile(team);
  const missing = lookupMissing(lookup.rows, search);
  if (missing.length) throw new RangeError(`TEAM lookup: ${missing.length} hospitals the codes place are missing from the family search's file`);
  log(`TEAM lookup: every one of ${count(lookup.rows.length)} hospitals the lookup places can be found in the family search`);
  const lookupUrl = ctx.asset('team-lookup', 'json', JSON.stringify(lookup));
  // The calculator's participants: one hashed file, fetched on the reader's first move toward another hospital
  // (client/calc.js); the default hospital's row is in the page.
  const calcUrl = ctx.asset('team-calc', 'json', JSON.stringify(calcAsset(team)));
  ctx.emit({ path: PROGRAM_PATH, robots, text: programPage({ team, master, atlas, robots, assets, lookupUrl, calcUrl, search }) });
  ctx.emit({ path: METHODS_PATH, robots, text: methodsPage({ sources: loadSources(team), robots, assets }) });
  log(`TEAM: 2 pages under ${PROGRAM_PATH}, ${team.counts.listed} hospitals on CMS's list`);
  return { updated: { cmsReleased: newestCmsDate(team.meta), changed: builtOn(team.built_at) } };
}

// The TEAM site's build manifest: the program page's script (client/page.js), beside the figures' (assets.js.figure).
export const TEAM = {
  id: 'team',
  entries: { 'team-page': 'sites/team/client/page.js' },
  styles: [...KIT_STYLES, 'sites/team/web/styles.css'],
  generate: (ctx, { log } = {}) => generateTeam(ctx, { log }),
};
