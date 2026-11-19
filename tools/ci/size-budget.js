// CI size budget: no page may weigh more than its page type's budget, and no work-requirement data file more than its
// kind's (JSON_BUDGETS, below). A page's weight is what a first visit loads,
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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { DIST_DIR, isMain } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { htmlPages, tags } from '../../pipeline/site/html.js';
import { PROGRAM_TYPES, pageProgram, pageType } from './page-types.js';

const KB = 1024;
const QUALITY = 5;
const brotliSize = (bytes) => brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: QUALITY } }).length;

// Budgets in bytes of brotli per page (HTML + CSS + JS; 1 KB = 1,024 bytes). Hub and policy pages get ARCH-27's
// starting number, which they fit. Every other type got the heaviest page of that type, when the type was added, plus
// 15%, rounded up to the next 10 KB, measured at quality 5; each run prints the heaviest page of each type against its
// budget. Raising a budget is a decision to record, not a fix to slip in; lowering one is always fine.
// The types that are the same for every program are here; the program-keyed ones (page-types.js PROGRAM_TYPES) are in
// PROGRAM_BUDGETS.
export const BUDGETS = {
  hub: 100 * KB, // ARCH-27
  policy: 100 * KB, // ARCH-27's starting number, as for hub pages (a test pins it).
  coming: 50 * KB, // The placeholder pages of the programs with no page here (hub/coming.js).
  notFound: 50 * KB,
  // A hospital's page across the programs (hub/hospital/page.js) with its script (hub/client/hospital.js): the exception
  // to the rule above. 70 KB is the owner's approved raise of 2026-10-28, past what the formula gave; it is not raised
  // again. ARCH-27's 150 KB for a hospital page holds.
  hubHospital: 70 * KB,
};
// The program-keyed types' budgets (page-types.js PROGRAM_TYPES), by program id. Every program in PROGRAM_SITES needs an
// entry, and a program-keyed page with no entry throws.
const HACRP_BUDGETS = {
  // Over ARCH-27's 100 KB for a site's front page. Re-set 2026-11-02 by the rule for the types above (279.5 KB + 15%) after the
  // drawings' paths went to relative commands (web/charts/pathd.js); it was 360 KB.
  program: 330 * KB,
  hospital: 120 * KB, // ARCH-27's 150 KB for these also holds.
  place: 150 * KB, // ARCH-27 names no number; over its 100 KB for a hub.
  methods: 100 * KB,
  dictionary: 50 * KB, // HACRP's data dictionary (/hacrp/data/).
};
export const PROGRAM_BUDGETS = {
  hacrp: HACRP_BUDGETS,
  // Readmissions starts at HACRP's budgets; any raise is a decision to record here, as above.
  hrrp: { ...HACRP_BUDGETS },
  // The work requirement (a program page and Methods only), set 2026-11-10 by the rule above from the pages as built then
  // (steps 1 and 2 of five): the program page 61.2 KB + 15% (70.4 KB) and Methods 24.4 KB + 15% (28.1 KB), rounded up.
  // Steps 3 to 5 will weigh more: each raises the program budget as it lands, a decision recorded here.
  // Step 3 (states), 2026-11-10: the program page 82.0 KB + 15% (94.3 KB), rounded up to 100 KB.
  // Step 4 (one hospital), 2026-11-10: the program page 93.9 KB + 15% (108.0 KB), rounded up to 110 KB.
  // Step 5 (exposed on both), 2026-11-10: the program page 122.7 KB + 15% (141.1 KB), rounded up to 150 KB.
  // Methods built (its sections, the sensitivities figure and every pin's SHA-256), 2026-11-10: 41.1 KB + 15% (47.3 KB),
  // rounded up to 50 KB.
  'work-requirement': { program: 150 * KB, methods: 50 * KB },
  // TEAM (a program page and Methods only), set 2026-11-19 by the rule above from the pages as built then (Parts 1 to 3
  // and 5 to 7, Part 4's figure and the calculator still to land): the program page 55.2 KB + 15% (63.5 KB), rounded up
  // to 70 KB, and Methods 25.2 KB + 15% (29.0 KB), rounded up to 30 KB. The figure and the calculator each raise the
  // program budget as they land, a decision recorded here.
  // Part 4's figure, the lookup and the calculator (Tasks 7b to 9), 2026-11-19: the program page 94.7 KB + 15% (108.9 KB),
  // rounded up to 110 KB. The calculator's script is most of the rise (its view, words, engine and the family's search
  // box, about 19.5 KB); every participant's numbers stay in a hashed file fetched on the reader's first move (not
  // counted here: team-calc, 19.4 KB brotli). The hub's 70 KB budget is untouched.
  // Methods built in full (Task 11: its sections, the sources' two tables, the DRG remaps and the unknowns), 2026-11-19:
  // 34.2 KB + 15% (39.3 KB), rounded up to 40 KB; it was 30 KB, set from the stub page.
  team: { program: 110 * KB, methods: 40 * KB },
};
// The work requirement's data files: the JSON its page script fetches (not counted in a page's weight above), which carry
// most of what a first visit to its page loads. Each file, brotli at the same quality, against its kind's budget (a kind:
// the file's name without its hash; step 4's per-state files are one kind, wr-hosp). Set 2026-11-10 by the rule above,
// the heaviest file of each kind + 15%, rounded up to the next 10 KB, after steps 3 and 5 moved into files of their own:
// wr-strips 109.8 KB (step 1's, fetched with the page), wr-states 11.1 KB and wr-both 29.0 KB (fetched as their step
// nears), wr-base 117.3 KB (the what-if's, fetched as the reader reaches for the slider), wr-hosp 23.1 KB (California's).
// A new kind of wr- file needs a budget here.
export const JSON_BUDGETS = {
  'wr-strips': 130 * KB,
  'wr-states': 20 * KB,
  'wr-both': 40 * KB,
  'wr-base': 140 * KB,
  'wr-hosp': 30 * KB,
};
// A built data file's kind (wr-strips.0123abcd.json: 'wr-strips'; wr-hosp-ca.0123abcd.json: 'wr-hosp'), or null for a
// file that is not a work-requirement data file.
export function jsonKind(file) {
  const m = /^(wr-[a-z0-9-]+?)\.[0-9a-f]{8}\.json$/.exec(file);
  if (!m) return null;
  return /^wr-hosp-[a-z]{2}$/.test(m[1]) ? 'wr-hosp' : m[1];
}
// Every work-requirement data file in distDir's assets: { file, kind, bytes }, in name order. A kind with no budget throws.
export function measureJson(distDir, budgets = JSON_BUDGETS) {
  const dir = join(distDir, 'assets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((file) => {
    const kind = jsonKind(file);
    if (kind === null) return [];
    if (budgets[kind] === undefined) throw new RangeError(`no budget for the data file "${file}" (kind "${kind}"): a new kind needs one in tools/ci/size-budget.js`);
    return [{ file, kind, bytes: brotliSize(readFileSync(join(dir, file))) }];
  });
}
// The data files over their kind's budget, each with its budget.
export const jsonOverBudget = (rows, budgets = JSON_BUDGETS) => rows.filter((r) => r.bytes > budgets[r.kind]).map((r) => ({ ...r, budget: budgets[r.kind] }));

// The budget in bytes of a page of this type (and, for a program-keyed type, this program).
export function budgetOf({ type, program }, budgets = BUDGETS, programBudgets = PROGRAM_BUDGETS) {
  if (PROGRAM_TYPES.includes(type)) {
    if (!program) throw new RangeError(`page type "${type}" is program-keyed and needs a program`);
    if (!programBudgets[program]) throw new RangeError(`no budgets for program "${program}"`);
    const budget = programBudgets[program][type];
    if (budget === undefined) throw new RangeError(`no budget for page type "${type}" of program "${program}"`);
    return budget;
  }
  if (budgets[type] === undefined) throw new RangeError(`no budget for page type "${type}"`);
  return budgets[type];
}
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

// Every page in distDir: { path, type, program, html, css, js, total }, in path order. Throws on a page of no known type
// or an empty build, before anything is measured.
export function measure(distDir) {
  const pages = htmlPages(distDir).map((htmlPath) => ({ htmlPath, path: addressOf(htmlPath) }));
  for (const page of pages) {
    // The type of the page (page-types.js); its budget is in BUDGETS, or in PROGRAM_BUDGETS for a program-keyed type.
    page.type = pageType(page.path);
    page.program = pageProgram(page.path);
    if (page.type === null) throw new RangeError(`no page type for "${page.path}": a new page type needs a budget in tools/ci/size-budget.js`);
  }
  const cache = new Map();
  return pages.map(({ htmlPath, path, type, program }) => ({ path, type, program, ...pageWeight(distDir, htmlPath, cache) }));
}

// The rows over a limit (each carries its page's program, null for a family-wide type): a page over its type's budget (part 'total'), a page whose scripts alone pass the script
// budget (part 'js') and a page whose blocking scripts pass theirs (part 'blocking'), each with the measured bytes of
// that part.
export function overBudget(rows, { budgets = BUDGETS, programBudgets = PROGRAM_BUDGETS, js = JS_BUDGET, blocking = BLOCKING_JS_BUDGET } = {}) {
  const over = [];
  for (const row of rows) {
    const budget = budgetOf(row, budgets, programBudgets);
    const id = { path: row.path, type: row.type, program: row.program };
    if (row.total > budget) over.push({ ...id, part: 'total', bytes: row.total, budget });
    if (row.js > js) over.push({ ...id, part: 'js', bytes: row.js, budget: js });
    if (row.blocking > blocking) over.push({ ...id, part: 'blocking', bytes: row.blocking, budget: blocking });
  }
  return over;
}

const kb = (bytes) => (bytes / KB).toFixed(1) + ' KB';

if (isMain(import.meta.url)) {
  const rows = measure(process.argv[2] ?? DIST_DIR);
  // One line per type, and per program for the program-keyed types ('hacrp program').
  const groups = [...Object.keys(BUDGETS).map((type) => [null, type]), ...Object.keys(PROGRAM_BUDGETS).flatMap((program) => PROGRAM_TYPES.map((type) => [program, type]))];
  for (const [program, type] of groups) {
    const group = program ? `${program} ${type}` : type;
    const ofType = rows.filter((row) => row.type === type && row.program === program);
    if (ofType.length === 0) continue;
    const heaviest = ofType.reduce((a, b) => (b.total > a.total ? b : a));
    console.log(`${group.padEnd(16)} ${String(ofType.length).padStart(5)} pages  heaviest ${kb(heaviest.total).padStart(9)} of ${kb(budgetOf(heaviest))}  (scripts ${kb(heaviest.js)} of ${kb(JS_BUDGET)})  ${heaviest.path}`);
  }
  const blocking = rows.reduce((a, b) => (b.blocking > a.blocking ? b : a));
  console.log(`blocking scripts: heaviest ${kb(blocking.blocking)} of ${kb(BLOCKING_JS_BUDGET)}  ${blocking.path}`);
  const over = overBudget(rows);
  const PARTS = { total: '', js: ', scripts', blocking: ', blocking scripts' };
  for (const { path, type, program, part, bytes, budget } of over)
    console.error(`OVER BUDGET ${path} (${program ? `${program} ` : ''}${type}${PARTS[part]}): ${kb(bytes)} > ${kb(budget)}`);
  const data = measureJson(process.argv[2] ?? DIST_DIR);
  for (const kind of Object.keys(JSON_BUDGETS)) {
    const ofKind = data.filter((r) => r.kind === kind);
    if (ofKind.length === 0) continue;
    const heaviest = ofKind.reduce((a, b) => (b.bytes > a.bytes ? b : a));
    console.log(`${`data ${kind}`.padEnd(16)} ${String(ofKind.length).padStart(5)} files  heaviest ${kb(heaviest.bytes).padStart(9)} of ${kb(JSON_BUDGETS[kind])}  ${heaviest.file}`);
  }
  const overData = jsonOverBudget(data);
  for (const { file, kind, bytes, budget } of overData) console.error(`OVER BUDGET ${file} (data ${kind}): ${kb(bytes)} > ${kb(budget)}`);
  if (over.length > 0 || overData.length > 0) process.exit(1);
  console.log(`size budget: ${rows.length} pages and ${data.length} data files within budget`);
}
