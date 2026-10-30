// What each site's generator gets from the build: the output folder, the build's env and assets (asset paths, and the
// shell's facts as assets.shell), emit() (the one way a page or file is written; it counts pages and collects the paths
// that may be indexed, which the hub's sitemap lists) and asset() for a site's own content-hashed data. robotsFor holds
// the indexing rule, and siteDates the check on the two dates a program site gives back for the hub's corrections page.
import { join } from 'node:path';
import { isIsoDate } from '../../engine/js/dates.js';
import { writeFileMkdir } from '../files.js';
import { fileFor } from './address.js';
import { writeHashed } from './assets.js';

// Whether a build's env (PP_ENV) is production, the one build search engines may index (_headers' X-Robots-Tag too).
export const isProduction = (env) => env === 'production';

// A build's env from its process environment: PP_ENV when it is set (blank or spaces count as unset); otherwise production only
// for Workers Builds' build of main (WORKERS_CI_BRANCH, set from the push), so every other branch's preview stays
// noindex. Cloudflare's build variables apply to every branch, so PP_ENV is not set there. A PP_ENV that is not one of
// ENVS (a typo) stops the build rather than quietly building a noindex site.
const PRODUCTION_BRANCH = 'main';
const ENVS = ['production', 'preview'];
export function buildEnv({ PP_ENV, WORKERS_CI, WORKERS_CI_BRANCH } = {}) {
  const set = PP_ENV?.trim();
  if (set) {
    if (!ENVS.includes(set)) throw new RangeError(`PP_ENV must be one of ${ENVS.join(', ')} or unset, not ${JSON.stringify(PP_ENV)}`);
    return set;
  }
  return WORKERS_CI === '1' && WORKERS_CI_BRANCH === PRODUCTION_BRANCH ? 'production' : undefined;
}

// The meta robots value for a page, or null when it may be indexed (ARCH-13, ARCH-22): only a production build, only
// a released site, and only a page its site counts as eligible (HACRP: a hospital with a score).
export function robotsFor({ env, released, eligible = true }) {
  return isProduction(env) && released === true && eligible ? null : 'noindex';
}

// A site path: "/", folders ending in "/", or one file name ("/404.html", "/robots.txt", ".../DATA-DICTIONARY.md").
// Folders are lowercase; a file name may hold capitals, except a page's (.html).
const PATH = /^\/(?:[a-z0-9-]+\/)*(?:[A-Za-z0-9-]+\.[a-z]+)?$/;

// A program site's two dates, each YYYY-MM-DD, from what its generate returned ({ updated: { cmsReleased, changed } }):
// when CMS released the file the site uses, and when the site's numbers last changed. The hub's /corrections/ page
// lists them, so a site that returned none, or a date that is not one, stops the build.
export function siteDates(siteId, result) {
  if (!result?.updated) throw new RangeError(`"${siteId}" gave the build no dates (its generate returns { updated: { cmsReleased, changed } }), so /corrections/ has none for it`);
  const { cmsReleased, changed } = result.updated;
  for (const [name, date] of [['cmsReleased', cmsReleased], ['changed', changed]]) {
    if (!isIsoDate(date)) throw new RangeError(`"${siteId}" ${name} is not a YYYY-MM-DD date on the calendar: ${JSON.stringify(date)}`);
  }
  return { cmsReleased, changed };
}

// shell: the facts the header and footer show on every page, computed once by the build (build.js's buildContext); it
// becomes ctx.assets.shell, beside the paths in `assets` (which the caller's object keeps unchanged). Leave it out when
// `assets` already holds one.
export function createContext({ outDir, env, assets, shell }) {
  const written = new Set();
  const ctx = {
    outDir,
    env,
    assets: shell === undefined ? assets : { ...assets, shell },
    pages: 0,
    indexable: [],
    // A path ending in "/" writes its index.html. robots: the page's meta robots value, as robotsFor returns it;
    // null lists the page in the sitemap. Leave it out for a file that is not a page.
    emit({ path, text, robots }) {
      if (!PATH.test(path)) throw new RangeError(`emit: bad path "${path}"`);
      const file = fileFor(path);
      if (file.endsWith('.html') && /[A-Z]/.test(file)) throw new RangeError(`emit: bad path "${path}"`);
      // Compared without case, so two paths that one case-insensitive disk would merge never both get written.
      if (written.has(file.toLowerCase())) throw new RangeError(`emit: "${path}" is already written`);
      written.add(file.toLowerCase());
      writeFileMkdir(join(outDir, file), String(text));
      if (file.endsWith('.html')) ctx.pages++;
      if (robots === null) ctx.indexable.push(path);
    },
    // A content-hashed file under /assets/; returns its public path.
    asset: (name, ext, text) => writeHashed(join(outDir, 'assets'), name, ext, text),
  };
  return ctx;
}
