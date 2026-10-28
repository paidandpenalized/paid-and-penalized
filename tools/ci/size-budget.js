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
import { brotliCompressSync, constants } from 'node:zlib';
import { DIST_DIR, isMain } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { htmlPages, tags } from '../../pipeline/site/html.js';
import { pageType } from './page-types.js';

const KB = 1024;
const QUALITY = 5;
const brotliSize = (bytes) => brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: QUALITY } }).length;

// Budgets in bytes of brotli per page (HTML + CSS + JS; 1 KB = 1,024 bytes). Hub and policy pages get ARCH-27's
// starting number, which they fit. Every other type gets the heaviest page of that type on the FY2026 build of
// 2026-10-23 (3,540 pages) plus 15%, rounded up to the next 10 KB, measured at quality 5; each run prints the heaviest
// page of each type against its budget. Raising a budget is a decision to record, not a fix to slip in; lowering one is
// always fine.
export const BUDGETS = {
  hub: 100 * KB, // ARCH-27
  // ARCH-27's starting number, by the rule above for hub and policy pages (text pages, 42.6 KB on the FY2026 build of
  // 2026-10-28), not the 15% formula; a test pins it.
  policy: 100 * KB,
  // The placeholder pages (hub/coming.js) of the programs under consideration, not built yet: hub pages with the family
  // search's script and the hub's stylesheet. The heaviest on the FY2026 build of 2026-10-28 (41.7 KB) plus 15%, rounded
  // up to 10 KB.
  coming: 50 * KB,
  program: 360 * KB, // Over ARCH-27's 100 KB for a site's front page.
  hospital: 120 * KB, // ARCH-27's 150 KB for these also holds.
  place: 150 * KB, // ARCH-27 names no number; over its 100 KB for a hub.
  methods: 100 * KB,
  // The data dictionary (/hacrp/data/): its weight on the FY2026 build of 2026-10-28, with the hub's page styles in a
  // stylesheet of their own that HACRP pages don't load (37.7 KB), plus 15%, rounded up to 10 KB.
  dictionary: 50 * KB,
  // A hub page with the family search's script and the hub's stylesheet, as the placeholder pages are: 41.3 KB on the
  // FY2026 build of 2026-10-28 plus 15%, rounded up to 10 KB.
  notFound: 50 * KB,
  // A hospital's page across the programs (hub/hospital/page.js) with its script (hub/client/hospital.js: the swarm, the
  // peer toggle, the strips and the peer table): the heaviest of the 3,055 is 67.3 KB of its 70 KB on the FY2026 build of
  // 2026-10-28, past what the 15% formula gives (80 KB). 70 KB is the owner's approved raise of 2026-10-28; it is not raised
  // again. ARCH-27's 150 KB for a hospital page holds.
  hubHospital: 70 * KB,
  // The interim Readmissions pages (hub/hrrp/page.js): hub pages with the family search's script and no script of their own.
  // The heaviest of each on the FY2026 build of 2026-10-28 (/hrrp/ 41.9 KB; the heaviest of the 2,912 hospital pages 42.9 KB)
  // plus 15%, rounded up to 10 KB. ARCH-27's 100 KB for a hub page and 150 KB for a hospital page hold.
  hrrp: 50 * KB,
  hrrpHospital: 50 * KB,
};
// ARCH-27: the JavaScript a page loads, brotli-compressed.
export const JS_BUDGET = 120 * KB;

// A script that pulls in another file by a relative or site path (static or dynamic import).
const IMPORTS = /\b(?:from|import)\s*\(?\s*["'](?:\.{1,2}\/|\/)[^"']*\.m?js["']/;

// One asset's compressed size; cache (reference -> size) lets pages that share an asset compress it once. A script's
// file must not import another (see the header).
function assetSize(distDir, ref, cache) {
  if (!cache.has(ref)) {
    if (!ref.startsWith('/') || ref.startsWith('//')) throw new Error(`${ref}: not a path on this site, so it can't be measured`);
    let bytes;
    try {
      bytes = readFileSync(join(distDir, ref.split(/[?#]/)[0]));
    } catch {
      throw new Error(`${ref} is referenced but is not in ${distDir}`);
    }
    if (/\.m?js$/.test(ref.split(/[?#]/)[0]) && IMPORTS.test(bytes.toString('utf8')))
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
  for (const { name, attrs } of tags(bytes.toString('utf8'), { names: ['link', 'script'] })) {
    if (name === 'link' && attrs.href && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) css.add(attrs.href);
    else if (name === 'script' && attrs.src) js.add(attrs.src);
  }
  const sum = (refs) => [...refs].reduce((total, ref) => total + assetSize(distDir, ref, cache), 0);
  const html = brotliSize(bytes);
  const cssBytes = sum(css);
  const jsBytes = sum(js);
  return { html, css: cssBytes, js: jsBytes, total: html + cssBytes + jsBytes };
}

// Every page in distDir: { path, type, html, css, js, total }, in path order. Throws on a page of no known type
// or an empty build, before anything is measured.
export function measure(distDir) {
  const pages = htmlPages(distDir).map((htmlPath) => ({ htmlPath, path: addressOf(htmlPath) }));
  for (const page of pages) {
    // The type of the page (page-types.js); a type's budget is in BUDGETS.
    page.type = pageType(page.path);
    if (page.type === null) throw new RangeError(`no page type for "${page.path}": a new page type needs a budget in tools/ci/size-budget.js`);
  }
  const cache = new Map();
  return pages.map(({ htmlPath, path, type }) => ({ path, type, ...pageWeight(distDir, htmlPath, cache) }));
}

// The rows over a limit: a page over its type's budget (part 'total') and a page whose scripts alone pass the
// script budget (part 'js'), each with the measured bytes of that part.
export function overBudget(rows, { budgets = BUDGETS, js = JS_BUDGET } = {}) {
  const over = [];
  for (const row of rows) {
    const budget = budgets[row.type];
    if (budget === undefined) throw new RangeError(`no budget for page type "${row.type}"`);
    if (row.total > budget) over.push({ path: row.path, type: row.type, part: 'total', bytes: row.total, budget });
    if (row.js > js) over.push({ path: row.path, type: row.type, part: 'js', bytes: row.js, budget: js });
  }
  return over;
}

const kb = (bytes) => (bytes / KB).toFixed(1) + ' KB';

if (isMain(import.meta.url)) {
  const rows = measure(process.argv[2] ?? DIST_DIR);
  for (const type of Object.keys(BUDGETS)) {
    const ofType = rows.filter((row) => row.type === type);
    if (ofType.length === 0) continue;
    const heaviest = ofType.reduce((a, b) => (b.total > a.total ? b : a));
    console.log(`${type.padEnd(10)} ${String(ofType.length).padStart(5)} pages  heaviest ${kb(heaviest.total).padStart(9)} of ${kb(BUDGETS[type])}  (scripts ${kb(heaviest.js)} of ${kb(JS_BUDGET)})  ${heaviest.path}`);
  }
  const over = overBudget(rows);
  for (const { path, type, part, bytes, budget } of over)
    console.error(`OVER BUDGET ${path} (${type}${part === 'js' ? ', scripts' : ''}): ${kb(bytes)} > ${kb(budget)}`);
  if (over.length > 0) process.exit(1);
  console.log(`size budget: ${rows.length} pages within budget`);
}
