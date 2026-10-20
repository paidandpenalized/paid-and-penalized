// What each site's generator gets from the build: the output folder, the build's env and asset paths, emit() (the
// one way a page or file is written; it counts pages and collects the paths that may be indexed, which the hub's
// sitemap lists) and asset() for a site's own content-hashed data. robotsFor holds the indexing rule.
import { join } from 'node:path';
import { writeFileMkdir } from '../files.js';
import { writeHashed } from './assets.js';

// The meta robots value for a page, or null when it may be indexed (ARCH-13, ARCH-22): only a production build, only
// a released site, and only a page its site counts as eligible (HACRP: a hospital with a score).
export function robotsFor({ env, released, eligible = true }) {
  return env === 'production' && released === true && eligible ? null : 'noindex';
}

// A site path: "/", folders ending in "/", or one file name ("/404.html", "/robots.txt").
const PATH = /^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+\.[a-z]+)?$/;

export function createContext({ outDir, env, assets }) {
  const ctx = {
    outDir,
    env,
    assets,
    pages: 0,
    indexable: [],
    // A path ending in "/" writes its index.html. robots: the page's meta robots value, as robotsFor returns it;
    // null lists the page in the sitemap. Leave it out for a file that is not a page.
    emit({ path, text, robots }) {
      if (!PATH.test(path)) throw new RangeError(`emit: bad path "${path}"`);
      const file = path.endsWith('/') ? `${path}index.html` : path;
      writeFileMkdir(join(outDir, file), String(text));
      if (file.endsWith('.html')) ctx.pages++;
      if (robots === null) ctx.indexable.push(path);
    },
    // A content-hashed file under /assets/; returns its public path.
    asset: (name, ext, text) => writeHashed(join(outDir, 'assets'), name, ext, text),
  };
  return ctx;
}
