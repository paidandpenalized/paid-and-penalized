// CI link check: every internal link in the built site (dist/) must resolve. It reads each page's static HTML, and
// for every href and src (a, link, script, img, SVG use, ...) it checks:
//   - a same-site URL (a path, or an absolute URL on SITE.origin) names a file in dist/, resolved as the server
//     does: a folder is its index.html, and a folder without its trailing slash is the redirect to it;
//   - a #fragment names an id on the page it points at (same page included; ids on SVG elements count). The site
//     also keeps reader state in fragments, which the page's script reads: "#state=TX" names no element (it
//     starts with key=value), and "#whatif&MRSA=0.9" is an element, then the state. So the id checked is the text
//     before the first "&", and a fragment starting with key=value is not checked.
// Skipped: any other origin, mailto:, tel:, data: and every non-web scheme; external links are never fetched.
// Not covered: links that scripts build at run time, and URLs outside href and src (data-src, content, sitemap.xml).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../../web/site.js';
import { filesIn, htmlPages, pageUrl, tags } from './html.js';

const LINK_ATTRIBUTES = ['href', 'src', 'xlink:href'];

// The file in dist/ that the server serves for a decoded path, or null.
function locate(path, files) {
  const rel = path.slice(1);
  if (path.endsWith('/')) return files.has(rel + 'index.html') ? rel + 'index.html' : null;
  if (files.has(rel)) return rel;
  return files.has(rel + '/index.html') ? rel + '/index.html' : null;
}

const tryDecode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
};

// 'missing file', 'missing id' or null for one href found on the page at `base`.
function problemWith(href, base, files, idsOf) {
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return 'missing file';
  }
  if (url.origin !== SITE.origin) return null;
  const path = tryDecode(url.pathname);
  const target = path === null ? null : locate(path, files);
  if (target === null) return 'missing file';
  // "#" and "#top" always work; ids can only be looked up in a page.
  const fragment = tryDecode(url.hash.slice(1)) ?? url.hash.slice(1);
  const id = fragment.split('&')[0];
  if (id === '' || id.includes('=') || id.toLowerCase() === 'top' || !target.endsWith('.html')) return null;
  return idsOf(target).has(id) ? null : 'missing id';
}

// Every broken internal link: [{ from (the page's path), href (as written), problem }], pages in file-name order. A page
// repeating a link is told once.
export function checkLinks(distDir) {
  const pages = htmlPages(distDir);
  if (pages.length === 0) throw new Error(`no pages in ${distDir}: build the site first (make build)`);
  const files = new Set(filesIn(distDir));
  const read = (file) => readFileSync(join(distDir, file), 'utf8');
  const idCache = new Map();
  const idsOf = (file) => {
    if (!idCache.has(file)) idCache.set(file, new Set([...tags(read(file))].map(({ attrs }) => attrs.id).filter((id) => id !== undefined)));
    return idCache.get(file);
  };
  const found = [];
  for (const htmlPath of pages) {
    const from = pageUrl(htmlPath);
    const base = SITE.origin + from;
    const seen = new Set();
    for (const { attrs } of tags(read(htmlPath))) {
      for (const name of LINK_ATTRIBUTES) {
        const href = attrs[name];
        if (href === undefined || seen.has(href)) continue;
        seen.add(href);
        const problem = problemWith(href, base, files, idsOf);
        if (problem) found.push({ from, href, problem });
      }
    }
  }
  return found;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? REPO_ROOT + 'dist/';
  const found = checkLinks(distDir);
  for (const { from, href, problem } of found) console.error(`${from} -> ${href}: ${problem}`);
  if (found.length > 0) {
    console.error(`link check: ${found.length} problem${found.length === 1 ? '' : 's'}`);
    process.exit(1);
  }
  console.log(`link check: ${htmlPages(distDir).length} pages, 0 problems`);
}
