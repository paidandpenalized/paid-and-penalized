// make build: write the static site to dist/. Empties the output directory, builds the shared assets, then runs
// each page generator in order. PP_ENV=production is the only build that may be indexed.
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../files.js';
import { buildAssets } from './assets.js';

// Browser JS entries, { name: path }; each becomes /assets/<name>.<hash>.js.
export const ENTRIES = {};

// Page generators, run in this order. Each is { name, generate(ctx) → Promise<{ pages, ... }> }, where ctx is
// { outDir, env, assets, results } and results holds every earlier generator's return value by name.
export const GENERATORS = [];

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

export async function build({ outDir = 'dist', env = process.env.PP_ENV, generators = GENERATORS } = {}) {
  const dir = checkOutDir(outDir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = { outDir: dir, env, assets: await buildAssets({ outDir: dir, entries: ENTRIES }), results: {} };
  let pages = 0;
  for (const { name, generate } of generators) {
    ctx.results[name] = await generate(ctx);
    pages += ctx.results[name].pages;
  }
  return { pages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pages } = await build();
  console.log(`dist/: ${pages} pages (PP_ENV=${process.env.PP_ENV ?? 'unset'})`);
}
