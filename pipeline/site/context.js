// What each site's generator gets from the build: the output folder, the build's env and asset paths, emit() (the
// one way a page or file is written; it counts pages and collects the paths that may be indexed, which the hub's
// sitemap lists), asset() for a site's own content-hashed data, and setUpdated() for the two dates the hub's
// corrections page shows for the site. robotsFor holds the indexing rule.
import { join } from 'node:path';
import { isIsoDate } from '../../engine/js/dates.js';
import { writeFileMkdir } from '../files.js';
import { writeHashed } from './assets.js';

// Whether a build's env (PP_ENV) is production, the one build search engines may index (_headers' X-Robots-Tag too).
export const isProduction = (env) => env === 'production';

// The meta robots value for a page, or null when it may be indexed (ARCH-13, ARCH-22): only a production build, only
// a released site, and only a page its site counts as eligible (HACRP: a hospital with a score).
export function robotsFor({ env, released, eligible = true }) {
  return isProduction(env) && released === true && eligible ? null : 'noindex';
}

// A site path: "/", folders ending in "/", or one file name ("/404.html", "/robots.txt", ".../DATA-DICTIONARY.md").
// Folders are lowercase; a file name may hold capitals, except a page's (.html).
const PATH = /^\/(?:[a-z0-9-]+\/)*(?:[A-Za-z0-9-]+\.[a-z]+)?$/;

// siteIds: the ids of the sites this build runs (build.js), so the hub can tell which ones owe it their dates; a
// context made without them (a test of one generator) has none.
export function createContext({ outDir, env, assets, siteIds = [] }) {
  const written = new Set();
  const updated = new Map();
  const ctx = {
    outDir,
    env,
    assets,
    siteIds,
    pages: 0,
    indexable: [],
    // site id -> { cmsReleased, changed }, in the order the sites set them (setUpdated).
    updated,
    // A site's two dates, each YYYY-MM-DD: when CMS released the file the site uses, and when the site's numbers last
    // changed. Once per site; the hub's /corrections/ page lists them, and a date that is not one stops the build.
    setUpdated(siteId, { cmsReleased, changed }) {
      if (updated.has(siteId)) throw new RangeError(`setUpdated: "${siteId}" is already set`);
      for (const [name, date] of [['cmsReleased', cmsReleased], ['changed', changed]]) {
        if (!isIsoDate(date)) throw new RangeError(`setUpdated: "${siteId}" ${name} is not a YYYY-MM-DD date on the calendar: ${JSON.stringify(date)}`);
      }
      updated.set(siteId, { cmsReleased, changed });
    },
    // A path ending in "/" writes its index.html. robots: the page's meta robots value, as robotsFor returns it;
    // null lists the page in the sitemap. Leave it out for a file that is not a page.
    emit({ path, text, robots }) {
      if (!PATH.test(path)) throw new RangeError(`emit: bad path "${path}"`);
      const file = path.endsWith('/') ? `${path}index.html` : path;
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
