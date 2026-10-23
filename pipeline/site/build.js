// make build: write the static site to dist/. Empties the output directory, builds the assets (shared ones plus each
// site's scripts and styles), then runs each site's generator in order. PP_ENV=production is the only build that may
// be indexed (robotsFor in context.js holds the rule).
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HUB } from '../../hub/pages.js';
import { HACRP } from '../../sites/hacrp/web/generate.js';
import { REPO_ROOT } from '../files.js';
import { buildAssets } from './assets.js';
import { createContext } from './context.js';

// Every site, in build order. Each exports a manifest { id, entries, styles, generate(ctx) }: entries are its browser
// JS ({ name: path }, each becoming /assets/<name>.<hash>.js), styles its own CSS files (bundled after web/styles/).
// Last: the hub writes robots.txt and sitemap.xml, listing every page an earlier site emitted as indexable.
export const SITES = [HACRP, HUB];
// Shared by every site: the theme toggle (every page), the figure layer (pages with a figure), the citation Copy
// button (pages with a citation block), the share control (pages with one) and a program site's top bar (pages with
// one); layout.js loads the theme script, and a page lists the others it needs.
export const SHARED_ENTRIES = { theme: 'web/client/theme.js', figure: 'web/client/figure.js', cite: 'web/client/cite.js', share: 'web/client/share.js', topbar: 'web/client/topbar.js' };

const DIST = resolve(REPO_ROOT, 'dist');
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

export async function build({ outDir = 'dist', env = process.env.PP_ENV, sites = SITES } = {}) {
  const dir = checkOutDir(outDir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const assets = await buildAssets({
    outDir: dir,
    entries: mergeEntries(SHARED_ENTRIES, ...sites.map((s) => s.entries ?? {})),
    styles: sites.flatMap((s) => s.styles ?? []),
  });
  const ctx = createContext({ outDir: dir, env, assets });
  for (const site of sites) await site.generate(ctx);
  return { pages: ctx.pages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pages } = await build();
  console.log(`dist/: ${pages} pages (PP_ENV=${process.env.PP_ENV ?? 'unset'})`);
}
