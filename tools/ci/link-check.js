// CI link check: every internal link in the built site (dist/) must resolve. It reads each page's static HTML, and
// for every href, src and data-src (a, link, script, img, SVG use, the search form's index, ...) it checks:
//   - a same-site URL (a path, or an absolute URL on SITE.origin) names a file in dist/, resolved as the server
//     does: a folder is its index.html, and a folder without its trailing slash is the redirect to it;
//   - a #fragment names an id on the page it points at (same page included; ids on SVG elements count). The site
//     also keeps reader state in fragments, which the page's script reads: "#state=TX" names no element, and
//     "#whatif&MRSA=0.9" is an element, then the state. So the id checked is the text before the first "&", and
//     only a fragment starting with "state=" is exempt; any other key=value fragment is checked as an id and fails
//     until it is added here on purpose.
// Skipped: any other origin, mailto:, tel:, data: and every non-web scheme; external links are never fetched.
// Not covered: links that scripts build at run time, and URLs outside those attributes (srcset, content,
// sitemap.xml).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../../web/site.js';
import { filesIn, htmlPages, pageUrl, tags } from './html.js';

const LINK_ATTRIBUTES = ['href', 'src', 'xlink:href', 'data-src'];
const STATE_FRAGMENT = /^state=/;

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
function problemWith(href, base, files, idsByFile) {
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
  if (id === '' || STATE_FRAGMENT.test(id) || id.toLowerCase() === 'top' || !target.endsWith('.html')) return null;
  return idsByFile.get(target).has(id) ? null : 'missing id';
}

// Every broken internal link: [{ from (the page's path), href (as written), problem }], pages in file-name order. A
// page repeating a link is told once.
export function checkLinks(distDir) {
  const names = filesIn(distDir);
  const htmlFiles = names.filter((name) => name.endsWith('.html'));
  if (htmlFiles.length === 0) throw new Error(`no pages in ${distDir}: build the site first (make build)`);
  const files = new Set(names);
  // One read of each page: its ids and its distinct links, in the order they appear.
  const pages = htmlFiles.map((htmlPath) => {
    const ids = new Set();
    const links = new Set();
    for (const { attrs } of tags(readFileSync(join(distDir, htmlPath), 'utf8'))) {
      if (attrs.id !== undefined) ids.add(attrs.id);
      for (const name of LINK_ATTRIBUTES) if (attrs[name] !== undefined) links.add(attrs[name]);
    }
    return { htmlPath, ids, links };
  });
  const idsByFile = new Map(pages.map(({ htmlPath, ids }) => [htmlPath, ids]));
  const found = [];
  for (const { htmlPath, links } of pages) {
    const from = pageUrl(htmlPath);
    const base = SITE.origin + from;
    for (const href of links) {
      const problem = problemWith(href, base, files, idsByFile);
      if (problem) found.push({ from, href, problem });
    }
  }
  return found;
}

// The problems by distinct link and kind: [{ problem, href, count (pages), example (the first page) }], the most
// widespread first (ties in the order found). A break in a template is one entry, not one per page.
export function groupProblems(found) {
  const groups = new Map();
  for (const { from, href, problem } of found) {
    const key = `${problem}\0${href}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { problem, href, count: 1, example: from });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

const SHOWN = 40;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? REPO_ROOT + 'dist/';
  const found = checkLinks(distDir);
  if (found.length > 0) {
    const groups = groupProblems(found);
    for (const { problem, href, count, example } of groups.slice(0, SHOWN))
      console.error(`${problem}: ${href} (${count === 1 ? `on ${example}` : `on ${count} pages, e.g. ${example}`})`);
    if (groups.length > SHOWN) console.error(`... and ${groups.length - SHOWN} more distinct links`);
    console.error(`link check: ${found.length} problem${found.length === 1 ? '' : 's'} (${groups.length} distinct link${groups.length === 1 ? '' : 's'})`);
    process.exit(1);
  }
  console.log(`link check: ${htmlPages(distDir).length} pages, 0 problems`);
}
