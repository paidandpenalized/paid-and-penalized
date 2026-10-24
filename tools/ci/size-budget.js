// CI size budget: no page may weigh more than its page type's budget. A page's weight is what a first visit loads,
// brotli-compressed at quality 5: the page's HTML (its inline data scripts included), each stylesheet it links and
// each script it loads (module or not), every file counted once per page. Not counted: fonts (already compressed
// WOFF2), the favicon, and the JSON data files that scripts fetch later.
//
// One quality, 5, for every page: deterministic, no assumption about the encoder, and closer to what a CDN
// compresses on the fly than the smallest possible output (quality 11 is about 15% to 20% smaller and 50 times
// slower, 10 CPU-minutes for the whole site). The budgets below are quality-5 numbers; they are not comparable
// with a quality-11 or gzip figure.
//
// Scripts are not followed: the build bundles each script entry into one self-contained file (pipeline/site/
// assets.js, no code splitting), so a page's scripts are exactly the ones its HTML names. A script that imports
// another file would hide weight, so it throws here instead; if code splitting is ever turned on, count the
// chunks first.
//
// A page whose path matches no type throws: a new page type needs a budget (and a line in page-types.js).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
import { DIST_DIR } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { htmlPages, tags } from './html.js';
import { pageType as typeOf } from './page-types.js';

const KB = 1024;
const QUALITY = 5;
const brotliSize = (bytes) => brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: QUALITY } }).length;

// Budgets in bytes of brotli per page (HTML + CSS + JS; 1 KB = 1,024 bytes). Hub and policy pages get ARCH-27's
// starting number, which they fit. Every other type gets the heaviest page of that type on the FY2026 build of
// 2026-10-23 (3,540 pages) plus 15%, rounded up to the next 10 KB: the "max" below, measured at quality 5. Raising
// a budget is a decision to record, not a fix to slip in; lowering one is always fine.
export const BUDGETS = {
  hub: 100 * KB, // ARCH-27; max 20.5 KB
  policy: 100 * KB, // ARCH-27; max 21.7 KB
  program: 360 * KB, // max 309.9 KB. Over ARCH-27's 100 KB for a site's front page by 210 KB.
  hospital: 120 * KB, // max 97.7 KB (the heaviest hospital page). ARCH-27's 150 KB for these also holds.
  place: 150 * KB, // max 128.4 KB. ARCH-27 names no number; over its 100 KB for a hub by 28 KB.
  methods: 100 * KB, // max 85.6 KB
  dictionary: 40 * KB, // max 30.6 KB
  notFound: 30 * KB, // max 20.4 KB
};
// ARCH-27: the JavaScript a page loads, brotli-compressed.
export const JS_BUDGET = 120 * KB;

// The type of the page at a site path ('/hacrp/state/ca/', page-types.js); a type's budget is in BUDGETS.
export function pageType(path) {
  const type = typeOf(path);
  if (type === null) throw new RangeError(`no page type for "${path}": a new page type needs a budget in tools/ci/size-budget.js`);
  return type;
}

// A script that pulls in another file by a relative or site path (static or dynamic import).
const IMPORTS = /\b(?:from|import)\s*\(?\s*["'](?:\.{1,2}\/|\/)[^"']*\.m?js["']/;

// One asset's compressed size; cache (reference -> size) lets pages that share an asset compress it once.
function assetSize(distDir, ref, kind, cache) {
  if (!cache.has(ref)) {
    if (!ref.startsWith('/') || ref.startsWith('//')) throw new Error(`${ref}: not a path on this site, so it can't be measured`);
    let bytes;
    try {
      bytes = readFileSync(join(distDir, ref.split(/[?#]/)[0]));
    } catch {
      throw new Error(`${ref} is referenced but is not in ${distDir}`);
    }
    if (kind === 'js' && IMPORTS.test(bytes.toString('utf8')))
      throw new Error(`${ref} imports another file, and the size budget does not follow imports`);
    cache.set(ref, brotliSize(bytes));
  }
  return cache.get(ref);
}

// The brotli weight in bytes of one page, htmlPath being its file from distDir ('hacrp/index.html').
export function pageWeight(distDir, htmlPath, cache = new Map()) {
  const bytes = readFileSync(join(distDir, htmlPath));
  const css = new Set();
  const js = new Set();
  for (const { name, attrs } of tags(bytes.toString('utf8'))) {
    if (name === 'link' && attrs.href && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) css.add(attrs.href);
    else if (name === 'script' && attrs.src) js.add(attrs.src);
  }
  const sum = (refs, kind) => [...refs].reduce((total, ref) => total + assetSize(distDir, ref, kind, cache), 0);
  const html = brotliSize(bytes);
  const cssBytes = sum(css, 'css');
  const jsBytes = sum(js, 'js');
  return { html, css: cssBytes, js: jsBytes, total: html + cssBytes + jsBytes };
}

// Every page in distDir: { path, type, html, css, js, total }, in path order. Throws on a page of no known type
// or an empty build, before anything is measured.
export function measure(distDir) {
  const pages = htmlPages(distDir).map((htmlPath) => ({ htmlPath, path: addressOf(htmlPath) }));
  if (pages.length === 0) throw new Error(`no pages in ${distDir}: build the site first (make build)`);
  for (const page of pages) page.type = pageType(page.path);
  const cache = new Map();
  return pages.map(({ htmlPath, path, type }) => ({ path, type, ...pageWeight(distDir, htmlPath, cache) }));
}

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

export const checkBudgets = (distDir, limits) => overBudget(measure(distDir), limits);

const kb = (bytes) => (bytes / KB).toFixed(1) + ' KB';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = measure(process.argv[2] ?? DIST_DIR);
  for (const type of Object.keys(BUDGETS)) {
    const ofType = rows.filter((row) => row.type === type);
    if (ofType.length === 0) continue;
    const heaviest = ofType.reduce((a, b) => (b.total > a.total ? b : a));
    console.log(`${type.padEnd(10)} ${String(ofType.length).padStart(5)} pages  heaviest ${kb(heaviest.total).padStart(9)} of ${kb(BUDGETS[type])}  (scripts ${kb(heaviest.js)} of ${kb(JS_BUDGET)})  ${heaviest.path}`);
  }
  const over = overBudget(rows);
  for (const { path, type, part, total, budget } of over)
    console.error(`OVER BUDGET ${path} (${type}${part === 'js' ? ', scripts' : ''}): ${kb(total)} > ${kb(budget)}`);
  if (over.length > 0) process.exit(1);
  console.log(`size budget: ${rows.length} pages within budget`);
}
