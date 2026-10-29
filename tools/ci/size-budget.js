// CI size budget: no page may weigh more than its page type's budget. A page's weight is what a first visit loads,
// brotli-compressed at quality 5: the page's HTML (its inline data scripts included), each stylesheet it links and
// each script it loads (module or not), every file counted once per page. Not counted: fonts (already compressed
// WOFF2), the favicon, and the JSON data files that scripts fetch later. Two more limits on every page: its scripts
// (JS_BUDGET), and the scripts its parser stops for (BLOCKING_JS_BUDGET).
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
// starting number, which they fit. Every other type got the heaviest page of that type, when the type was added, plus
// 15%, rounded up to the next 10 KB, measured at quality 5; each run prints the heaviest page of each type against its
// budget. Raising a budget is a decision to record, not a fix to slip in; lowering one is always fine.
export const BUDGETS = {
  hub: 100 * KB, // ARCH-27
  policy: 100 * KB, // ARCH-27's starting number, as for hub pages (a test pins it).
  coming: 50 * KB, // The placeholder pages of the programs with no page here (hub/coming.js).
  program: 360 * KB, // Over ARCH-27's 100 KB for a site's front page.
  hospital: 120 * KB, // ARCH-27's 150 KB for these also holds.
  place: 150 * KB, // ARCH-27 names no number; over its 100 KB for a hub.
  methods: 100 * KB,
  dictionary: 50 * KB, // HACRP's data dictionary (/hacrp/data/).
  notFound: 50 * KB,
  // A hospital's page across the programs (hub/hospital/page.js) with its script (hub/client/hospital.js): the exception
  // to the rule above. 70 KB is the owner's approved raise of 2026-10-28, past what the formula gave; it is not raised
  // again. ARCH-27's 150 KB for a hospital page holds.
  hubHospital: 70 * KB,
  // The interim Readmissions pages (hub/hrrp/page.js), /hrrp/ and its hospitals'. ARCH-27's 100 KB for a hub page and
  // 150 KB for a hospital page hold.
  hrrp: 50 * KB,
  hrrpHospital: 50 * KB,
};
// ARCH-27: the JavaScript a page loads, brotli-compressed.
export const JS_BUDGET = 120 * KB;
// The scripts a page's parser stops for (a plain <script src>: no module, defer or async), brotli-compressed. They hold
// the first paint until they have run, so they stay tiny: today the head's theme script alone (web/client/theme.js).
export const BLOCKING_JS_BUDGET = 1 * KB;

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

// Whether the parser stops for a script tag's attrs until it has run: a plain script, not a module, deferred or async.
const blocks = (attrs) => attrs.type?.trim().toLowerCase() !== 'module' && !('defer' in attrs) && !('async' in attrs);

// The brotli weight in bytes of one page, htmlPath being its file from distDir ('hacrp/index.html'): { html, css, js,
// blocking (the part of js the parser stops for), total }.
export function pageWeight(distDir, htmlPath, cache = new Map()) {
  const bytes = readFileSync(join(distDir, htmlPath));
  const css = new Set();
  const js = new Set();
  const blocking = new Set();
  for (const { name, attrs } of tags(bytes.toString('utf8'), { names: ['link', 'script'] })) {
    if (name === 'link' && attrs.href && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) css.add(attrs.href);
    else if (name === 'script' && attrs.src) {
      js.add(attrs.src);
      if (blocks(attrs)) blocking.add(attrs.src);
    }
  }
  const sum = (refs) => [...refs].reduce((total, ref) => total + assetSize(distDir, ref, cache), 0);
  const html = brotliSize(bytes);
  const cssBytes = sum(css);
  const jsBytes = sum(js);
  return { html, css: cssBytes, js: jsBytes, blocking: sum(blocking), total: html + cssBytes + jsBytes };
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

// The rows over a limit: a page over its type's budget (part 'total'), a page whose scripts alone pass the script
// budget (part 'js') and a page whose blocking scripts pass theirs (part 'blocking'), each with the measured bytes of
// that part.
export function overBudget(rows, { budgets = BUDGETS, js = JS_BUDGET, blocking = BLOCKING_JS_BUDGET } = {}) {
  const over = [];
  for (const row of rows) {
    const budget = budgets[row.type];
    if (budget === undefined) throw new RangeError(`no budget for page type "${row.type}"`);
    if (row.total > budget) over.push({ path: row.path, type: row.type, part: 'total', bytes: row.total, budget });
    if (row.js > js) over.push({ path: row.path, type: row.type, part: 'js', bytes: row.js, budget: js });
    if (row.blocking > blocking) over.push({ path: row.path, type: row.type, part: 'blocking', bytes: row.blocking, budget: blocking });
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
  const blocking = rows.reduce((a, b) => (b.blocking > a.blocking ? b : a));
  console.log(`blocking scripts: heaviest ${kb(blocking.blocking)} of ${kb(BLOCKING_JS_BUDGET)}  ${blocking.path}`);
  const over = overBudget(rows);
  const PARTS = { total: '', js: ', scripts', blocking: ', blocking scripts' };
  for (const { path, type, part, bytes, budget } of over)
    console.error(`OVER BUDGET ${path} (${type}${PARTS[part]}): ${kb(bytes)} > ${kb(budget)}`);
  if (over.length > 0) process.exit(1);
  console.log(`size budget: ${rows.length} pages within budget`);
}
