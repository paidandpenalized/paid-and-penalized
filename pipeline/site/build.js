// make build: write the static site to dist/. Empties the output directory, builds the assets (shared ones plus each
// site's scripts and styles), writes the hub's data asset and computes the shell's facts, runs each site's generator in
// order, then writes Cloudflare's _headers (headers.js).
// PP_ENV=production is the only build that may be indexed (robotsFor in context.js holds the rule for pages).
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { hubAsset } from '../../hub/asset.js';
import { loadHub } from '../../hub/data.js';
import { hubHospitals, shellFacts, storyFacts } from '../../hub/model.js';
import { HUB } from '../../hub/pages.js';
import { HACRP } from '../../sites/hacrp/web/generate.js';
import { DIST_DIR, REPO_ROOT, isMain, writeFileMkdir } from '../files.js';
import { SITE } from '../../web/site.js';
import { buildAssets, writeHashed } from './assets.js';
import { createContext, siteDates } from './context.js';
import { headersFile } from './headers.js';

// Every site, in build order. Each exports a manifest { id, entries, styles, generate(ctx, { updated }) }: entries are
// its browser JS ({ name: path }, each becoming /assets/<name>.<hash>.js), styles its own CSS files (bundled after
// web/styles/). A program site (one in web/site.js's SITE.sites) returns its two dates for the corrections page,
// { updated: { cmsReleased, changed } }; updated is the dates of the program sites run before, by id. Last: the hub
// lists those dates, and writes robots.txt and sitemap.xml, listing every page an earlier site emitted as indexable.
export const SITES = [HACRP, HUB];
// Shared by every site: the shell's script (the theme buttons, the followed hospital, the phone's search button, the
// tabs' scroll) and the sticky header's (its offset and the section menu's scroll-spy), which layout.js loads first on
// every page; then the figure layer (pages with a figure), the citation Copy button (pages with a citation block) and
// the share control (pages with one), which a page lists when it needs them.
export const SHARED_ENTRIES = { shell: 'web/client/shell.js', figure: 'web/client/figure.js', cite: 'web/client/cite.js', share: 'web/client/share.js', topbar: 'web/client/topbar.js' };

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

// The build's context for the sites. The hub's one browser asset (every hospital's dollars and place,
// hub-hospitals.<hash>.json) is written once, and the facts every page's shell shows (hub/model.js's shellFacts, and
// hubUrl: the asset's path) are computed once and handed to every page as ctx.assets.shell. A change to the dollar
// estimates changes the facts on every page, the hub's and a program site's alike. `assets` (what buildAssets
// returned) is not edited: createContext copies it with the shell added.
export function buildContext({ outDir, env, assets }) {
  const hub = loadHub();
  const hospitals = hubHospitals(hub);
  const facts = shellFacts({ facts: storyFacts(hospitals), builtAt: hub.builtAt, fy: hub.fy });
  const hubUrl = writeHashed(join(outDir, 'assets'), 'hub-hospitals', 'json', JSON.stringify(hubAsset(hospitals, hub)));
  return createContext({ outDir, env, assets, shell: { ...facts, hubUrl } });
}

export async function build({ outDir = DIST_DIR, env = process.env.PP_ENV, sites = SITES } = {}) {
  const dir = checkOutDir(outDir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const assets = await buildAssets({
    outDir: dir,
    entries: mergeEntries(SHARED_ENTRIES, ...sites.map((s) => s.entries ?? {})),
    styles: sites.flatMap((s) => s.styles ?? []),
  });
  const ctx = buildContext({ outDir: dir, env, assets });
  const updated = new Map();
  for (const site of sites) {
    const result = await site.generate(ctx, { updated });
    if (Object.hasOwn(SITE.sites, site.id)) updated.set(site.id, siteDates(site.id, result));
  }
  // Not through emit: _headers is no page and no asset, and Cloudflare reads it rather than serving it.
  writeFileMkdir(join(dir, '_headers'), headersFile({ env }));
  return { pages: ctx.pages };
}

if (isMain(import.meta.url)) {
  const { pages } = await build();
  console.log(`dist/: ${pages} pages (PP_ENV=${process.env.PP_ENV ?? 'unset'})`);
}
