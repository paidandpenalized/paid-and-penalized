// make build: write the static site to dist/. Empties the output directory, builds the assets (shared ones plus each
// site's scripts and styles), writes the hub's data asset and computes the shell's facts, runs each site's generator in
// order, then writes Cloudflare's _headers (headers.js) and _redirects (redirects.js).
// A production build (PP_ENV=production, or Workers Builds' build of main: buildEnv in context.js) is the only one that
// may be indexed (robotsFor in context.js holds the rule for pages).
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { hubAsset } from '../../hub/asset.js';
import { searchAsset } from '../../hub/search/asset.js';
import { hubModel } from '../../hub/data.js';
import { shellFacts } from '../../hub/model.js';
import { HUB } from '../../hub/pages.js';
import { HACRP } from '../../sites/hacrp/web/generate.js';
import { HRRP } from '../../sites/hrrp/web/generate.js';
import { TEAM } from '../../sites/team/web/generate.js';
import { WR } from '../../sites/work-requirement/web/generate.js';
import { DIST_DIR, REPO_ROOT, isMain, writeFileMkdir } from '../files.js';
import { SITE } from '../../web/site.js';
import { buildAssets, writeHashed } from './assets.js';
import { buildEnv, createContext, siteDates } from './context.js';
import { headersFile } from './headers.js';
import { redirectsFile } from './redirects.js';

// Every site, in build order. Each exports a manifest { id, entries, styles, generate(ctx, { updated }) }: entries are
// its browser JS ({ name: path }, each becoming /assets/<name>.<hash>.js), styles its own CSS files, a stylesheet of
// their own named by its id (/assets/<id>.<hash>.css, ctx.assets.sheets[id]) that its pages link after the shared one
// (layout.js page()'s `sheets`), so no site's pages carry another's styles. A program site (one in web/site.js's
// SITE.sites) returns its two dates for the corrections page, { updated: { cmsReleased, changed } }; updated is the
// dates of the program sites run before, by id. Last: the hub lists those dates, and writes robots.txt and sitemap.xml,
// listing every page an earlier site emitted as indexable.
export const SITES = [HACRP, HRRP, WR, TEAM, HUB];
// Shared by every site: the head's theme script (the reader's light/dark choice for the visit, put back before the
// page paints), then the shell's script (the theme buttons, the followed hospital, the phone's search button, the
// tabs' scroll) and the sticky header's (its offset and the section menu's scroll-spy), which layout.js loads on every
// page; then the figure layer (pages with a figure), the citation Copy button (pages with a citation block) and the
// share control (pages with one), which a page lists when it needs them.
export const SHARED_ENTRIES = { theme: 'web/client/theme.js', shell: 'web/client/shell.js', figure: 'web/client/figure.js', cite: 'web/client/cite.js', share: 'web/client/share.js', topbar: 'web/client/topbar.js' };
// The entries built as classic scripts, not modules (assets.js): the head's theme script alone, which must run as the
// parser meets it, before the first paint.
export const CLASSIC_ENTRIES = ['theme'];

const DIST = resolve(DIST_DIR);
const inside = (dir, parent) => {
  const rel = relative(parent, dir);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

// The build deletes its output directory, so it only ever deletes dist/ (or a folder in it) or a folder under the
// system temp directory (tests).
function checkOutDir(outDir) {
  const dir = resolve(REPO_ROOT, outDir);
  if (dir === DIST || inside(dir, DIST) || inside(dir, tmpdir())) return dir;
  throw new Error(`refusing to empty ${dir}: the build writes only to dist/ or under ${tmpdir()}`);
}

// The shared entries plus each site's, by name. Two entries with one name would overwrite each other's file.
export function mergeEntries(...sets) {
  const merged = {};
  for (const set of sets) {
    for (const [name, path] of Object.entries(set)) {
      if (Object.hasOwn(merged, name)) throw new Error(`JS entry "${name}" is defined twice (${merged[name]} and ${path})`);
      merged[name] = path;
    }
  }
  return merged;
}

// The build's context for the sites. The hub's browser asset (every dollar-file hospital's dollars and place,
// hub-hospitals.<hash>.json) and the family search's index (every hospital on Medicare's list with its kind,
// hub-search.<hash>.json; hub/search/asset.js) are written once, and the facts every page's shell shows (hub/model.js's
// shellFacts, hubUrl: the hub asset's path, and searchUrl: the search index's) are computed once and handed to every page
// as ctx.assets.shell. A change to the dollar
// estimates changes the facts on every page, the hub's and a program site's alike. The hospitals and their story facts
// are hub/data.js hubModel's, which the hub's pages read too. `assets` (what buildAssets returned) is not edited:
// createContext copies it with the shell added.
export function buildContext({ outDir, env, assets }) {
  const { hub, hospitals, outside, facts: story } = hubModel();
  const facts = shellFacts({ facts: story, builtAt: hub.builtAt, fy: hub.fy, medicaid: hub.medicaid, team: hub.team });
  const dir = join(outDir, 'assets');
  const hubUrl = writeHashed(dir, 'hub-hospitals', 'json', JSON.stringify(hubAsset(hospitals, hub)));
  const searchUrl = writeHashed(dir, 'hub-search', 'json', JSON.stringify(searchAsset({ hospitals, outside, master: hub.master })));
  return createContext({ outDir, env, assets, shell: { ...facts, hubUrl, searchUrl } });
}

export async function build({ outDir = DIST_DIR, env = buildEnv(process.env), sites = SITES } = {}) {
  const dir = checkOutDir(outDir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const assets = await buildAssets({
    outDir: dir,
    entries: mergeEntries(SHARED_ENTRIES, ...sites.map((s) => s.entries ?? {})),
    classic: CLASSIC_ENTRIES,
    siteStyles: Object.fromEntries(sites.filter((s) => s.styles?.length).map((s) => [s.id, s.styles])),
  });
  const ctx = buildContext({ outDir: dir, env, assets });
  const updated = new Map();
  for (const site of sites) {
    const result = await site.generate(ctx, { updated });
    if (Object.hasOwn(SITE.sites, site.id)) updated.set(site.id, siteDates(site.id, result));
  }
  // Not through emit: _headers and _redirects are no page and no asset, and Cloudflare reads them rather than serving them.
  // Every file in dist/ is listed for _headers (emitted or copied), so no noindex splat covers a file that may be indexed.
  const written = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
    .map((e) => '/' + relative(dir, join(e.parentPath, e.name)).split(sep).join('/'));
  writeFileMkdir(join(dir, '_headers'), headersFile({ env, noindexFiles: ctx.noindexFiles, emitted: written }));
  writeFileMkdir(join(dir, '_redirects'), redirectsFile());
  return { pages: ctx.pages, env };
}

// How many files dist/ holds and their total size: Workers Free caps a deploy's files, so the summary prints the count.
export function distStats(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
  return { files: files.length, bytes: files.reduce((sum, e) => sum + statSync(join(e.parentPath, e.name)).size, 0) };
}

// The build's one-line summary: the pages, the files and size of dist/, and the env.
export function summaryLine({ pages, env, files, bytes }) {
  const size = bytes >= 2 ** 30 ? `${(bytes / 2 ** 30).toFixed(1)} GB` : `${(bytes / 2 ** 20).toFixed(1)} MB`;
  return `dist/: ${pages.toLocaleString('en-US')} pages, ${files.toLocaleString('en-US')} files, ${size} (env ${env ?? 'unset'})`;
}

if (isMain(import.meta.url)) {
  const { pages, env } = await build();
  console.log(summaryLine({ pages, env, ...distStats(DIST_DIR) }));
}
