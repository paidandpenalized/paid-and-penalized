// CI size budget: no page may weigh more than its page type's budget. A page's weight is what a first visit loads,
// brotli-compressed at quality 11 (the smallest the wire can carry): the page's HTML (its inline data scripts
// included), each stylesheet it links and each script it loads (module or not), every file counted once per page.
// Not counted: fonts (already compressed WOFF2), the favicon, and the JSON data files that scripts fetch later.
//
// Quality 11 is slow (about 10 CPU-minutes for the whole site), so checkBudgets clears most pages with a fast
// pass at quality 5 first and measures at quality 11 only the pages that pass can't clear, plus the heaviest page
// of each type for the report. That is sound because quality 11 never comes out larger than quality 5 on these
// pages (by 15% to 20%). Everything it reports is a quality-11 number.
//
// Scripts are not followed: the build bundles each script entry into one self-contained file (pipeline/site/
// assets.js, no code splitting), so a page's scripts are exactly the ones its HTML names. A script that imports
// another file would hide weight, so it throws here instead; if code splitting is ever turned on, count the
// chunks first.
//
// A page whose path matches no type throws: a new page type needs a budget (and a line in pageType).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { REPO_ROOT } from '../../pipeline/files.js';
import { SITE } from '../../web/site.js';
import { htmlPages, pageUrl, tags } from './html.js';

const KB = 1024;
const EXACT = 11;
const FAST = 5;
const compress = promisify(brotliCompress);
const brotliSize = async (bytes, quality) => (await compress(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: quality } })).length;

// Budgets in bytes of brotli per page (HTML + CSS + JS; 1 KB = 1,024 bytes). Hub and policy pages get ARCH-27's
// starting number, which they fit. Every other type gets the heaviest page of that type on the FY2026 build of
// 2026-10-23 (3,540 pages) plus 15%, rounded up to the next 10 KB: the "max" below. Raising a budget is a decision
// to record, not a fix to slip in; lowering one is always fine.
export const BUDGETS = {
  hub: 100 * KB, // ARCH-27; max 18.3 KB
  policy: 100 * KB, // ARCH-27; max 19.4 KB (/terms/)
  program: 300 * KB, // max 260.3 KB (/hacrp/). Over ARCH-27's 100 KB for a site's front page by 160 KB.
  hospital: 100 * KB, // max 84.4 KB (the heaviest hospital page). ARCH-27's 150 KB for these also holds.
  place: 130 * KB, // max 105.2 KB (/hacrp/region/south/). ARCH-27 names no number; over its 100 KB for a hub by 5 KB.
  methods: 90 * KB, // max 70.2 KB
  dictionary: 40 * KB, // max 27.7 KB
  notFound: 30 * KB, // max 18.3 KB
};
// ARCH-27: the JavaScript a page loads, brotli-compressed.
export const JS_BUDGET = 120 * KB;

const HACRP = SITE.sites.hacrp.path;
const POLICY = new Set(Object.values(SITE.pages));
const HOSPITAL = new RegExp(`^${HACRP}hospital/[0-9A-Z]{6}/$`);
const PLACE = new RegExp(`^${HACRP}(?:region|division|state|metro)/[a-z0-9-]+/$`);

// The type of the page at a site path ('/hacrp/state/ca/'); a type's budget is in BUDGETS.
export function pageType(path) {
  if (path === '/') return 'hub';
  if (path === '/404.html') return 'notFound';
  if (POLICY.has(path)) return 'policy';
  if (path === HACRP) return 'program';
  if (path === `${HACRP}methods/`) return 'methods';
  if (path === `${HACRP}data/`) return 'dictionary';
  if (HOSPITAL.test(path)) return 'hospital';
  if (PLACE.test(path)) return 'place';
  throw new RangeError(`no page type for "${path}": a new page type needs a budget in tools/ci/size-budget.js`);
}

// A script that pulls in another file by a relative or site path (static or dynamic import).
const IMPORTS = /\b(?:from|import)\s*\(?\s*["'](?:\.{1,2}\/|\/)[^"']*\.m?js["']/;

// One asset's compressed size, computed once per run (cache maps a quality and reference to its promise).
function assetSize(distDir, ref, kind, quality, cache) {
  const key = `${quality} ${ref}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      if (!ref.startsWith('/') || ref.startsWith('//')) throw new Error(`${ref}: not a path on this site, so it can't be measured`);
      const bytes = await readFile(join(distDir, ref.split(/[?#]/)[0])).catch(() => {
        throw new Error(`${ref} is referenced but is not in ${distDir}`);
      });
      if (kind === 'js' && IMPORTS.test(bytes.toString('utf8')))
        throw new Error(`${ref} imports another file, and the size budget does not follow imports`);
      return brotliSize(bytes, quality);
    })());
  }
  return cache.get(key);
}

// The brotli weight in bytes of one page, htmlPath being its file from distDir ('hacrp/index.html'). quality 11
// unless a fast estimate is asked for; cache is shared between pages so each asset is compressed once.
export async function pageWeight(distDir, htmlPath, { quality = EXACT, cache = new Map() } = {}) {
  const bytes = await readFile(join(distDir, htmlPath));
  const css = new Set();
  const js = new Set();
  for (const { name, attrs } of tags(bytes.toString('utf8'))) {
    if (name === 'link' && attrs.href && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) css.add(attrs.href);
    else if (name === 'script' && attrs.src) js.add(attrs.src);
  }
  const sum = async (refs, kind) => (await Promise.all([...refs].map((ref) => assetSize(distDir, ref, kind, quality, cache)))).reduce((a, b) => a + b, 0);
  const [html, cssBytes, jsBytes] = await Promise.all([brotliSize(bytes, quality), sum(css, 'css'), sum(js, 'js')]);
  return { html, css: cssBytes, js: jsBytes, total: html + cssBytes + jsBytes };
}

// Every page in distDir: { htmlPath, path, type }, in path order. Throws on a page of no known type or an empty
// build, before anything is measured.
function listPages(distDir) {
  const pages = htmlPages(distDir).map((htmlPath) => ({ htmlPath, path: pageUrl(htmlPath) }));
  if (pages.length === 0) throw new Error(`no pages in ${distDir}: build the site first (make build)`);
  for (const page of pages) page.type = pageType(page.path);
  return pages;
}

// Pages measured at once: the compression runs on libuv's thread pool, a few at a time.
const CONCURRENCY = 8;

async function measurePages(distDir, pages, quality) {
  const cache = new Map();
  const rows = new Array(pages.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages.length) }, async () => {
    while (next < pages.length) {
      const i = next++;
      const { htmlPath, path, type } = pages[i];
      rows[i] = { path, type, ...(await pageWeight(distDir, htmlPath, { quality, cache })) };
    }
  }));
  return rows;
}

// Every page in distDir: { path, type, html, css, js, total }, in path order, all at quality 11 (slow).
export const measure = (distDir) => measurePages(distDir, listPages(distDir), EXACT);

// The rows over a limit: a page over its type's budget (part 'total') and a page whose scripts alone pass the
// script budget (part 'js'). In both, total is the measured bytes of that part.
export function overBudget(rows, { budgets = BUDGETS, js = JS_BUDGET } = {}) {
  const over = [];
  for (const row of rows) {
    const budget = budgets[row.type];
    if (budget === undefined) throw new RangeError(`no budget for page type "${row.type}"`);
    if (row.total > budget) over.push({ path: row.path, type: row.type, part: 'total', total: row.total, budget });
    if (row.js > js) over.push({ path: row.path, type: row.type, part: 'js', total: row.js, budget: js });
  }
  return over;
}

// The check: { pages (how many), over (overBudget's rows), heaviest ([{ type, count, row }] for each type present,
// the heaviest page of the type measured at quality 11) }.
export async function audit(distDir, limits) {
  const pages = listPages(distDir);
  const fast = await measurePages(distDir, pages, FAST);
  const heaviest = new Map();
  for (const row of fast) {
    const seen = heaviest.get(row.type);
    heaviest.set(row.type, { count: (seen?.count ?? 0) + 1, row: seen && seen.row.total >= row.total ? seen.row : row });
  }
  const worth = new Set([...overBudget(fast, limits).map((o) => o.path), ...[...heaviest.values()].map((h) => h.row.path)]);
  const exact = await measurePages(distDir, pages.filter((p) => worth.has(p.path)), EXACT);
  const exactRow = new Map(exact.map((row) => [row.path, row]));
  return {
    pages: pages.length,
    over: overBudget(exact, limits),
    heaviest: [...heaviest].map(([type, { count, row }]) => ({ type, count, row: exactRow.get(row.path) })),
  };
}

export const checkBudgets = async (distDir, limits) => (await audit(distDir, limits)).over;

const kb = (bytes) => (bytes / KB).toFixed(1) + ' KB';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pages, over, heaviest } = await audit(process.argv[2] ?? REPO_ROOT + 'dist/');
  for (const type of Object.keys(BUDGETS)) {
    const found = heaviest.find((h) => h.type === type);
    if (!found) continue;
    const { count, row } = found;
    console.log(`${type.padEnd(10)} ${String(count).padStart(5)} pages  heaviest ${kb(row.total).padStart(9)} of ${kb(BUDGETS[type])}  (scripts ${kb(row.js)} of ${kb(JS_BUDGET)})  ${row.path}`);
  }
  for (const { path, type, part, total, budget } of over)
    console.error(`OVER BUDGET ${path} (${type}${part === 'js' ? ', scripts' : ''}): ${kb(total)} > ${kb(budget)}`);
  if (over.length > 0) process.exit(1);
  console.log(`size budget: ${pages} pages within budget`);
}
