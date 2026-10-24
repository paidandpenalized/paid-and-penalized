// The launch command: `E2E_BASE_URL=<site> npm run e2e:launch`. Run it by hand before a launch, on a machine that has
// all three browser engines; CI runs Chromium only (the `browser` job). It does two things against the site at
// E2E_BASE_URL (a preview, the live site, or `make serve` at http://127.0.0.1:8080):
//
//   1. The browser checks (npm run e2e, tools/e2e/) once per engine: Chromium, Firefox and WebKit (E2E_ENGINE).
//   2. The live response headers of six requests, each compared name by name with what dist/_headers says the
//      request gets (headersFor in pipeline/site/headers.js, which reads the file as Cloudflare does): the home page,
//      the program page, one hospital page, one real hashed asset, a path no page has (the 404 page) and a hashed asset
//      that does not exist (so whether Cloudflare keeps a missing file's 404 for a year is on record). Only headers
//      the file sets are compared; Cloudflare's own (date, server, cf-ray, etag, ...) are not.
//
// It needs a dist/ built from the same commit, and with the same PP_ENV (`PP_ENV=production make build` for the live
// site; X-Robots-Tag: noindex is in every other build's file), as the site that is deployed: the page choices and the
// expected headers come from dist/. Exit 0 only when every engine passes and no header differs; 1 otherwise.
//
// The comparison itself (checksFor, compareResponse, formatReport, parseCounts) is pure and tested in
// tools/test/launch.test.js, which needs no browser or network.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DIST_DIR as DIST, REPO_ROOT } from '../../pipeline/files.js';
import { headersFor, parseHeaders } from '../../pipeline/site/headers.js';

export const ENGINES = ['chromium', 'firefox', 'webkit'];
// A hashed asset that no build has: the hash is eight zeros, and checksFor refuses the real file if it ever matches.
const MISSING_HASH = '00000000';
const FETCH_TIMEOUT_MS = 30_000;

// The requests whose headers are compared: [{ label, path, status }]. `pages` is samplePages()'s answer; `assets` the
// file names in dist/assets/. The pages are picked by type and the asset by pattern, so none is named here.
export function checksFor(pages, assets) {
  const pathOf = (type) => {
    const page = pages.find((p) => p.type === type);
    if (!page) throw new Error(`checksFor: no "${type}" page among the sample pages`);
    return page.path;
  };
  const css = assets.find((name) => /^site\.[0-9a-f]{8}\.css$/.test(name));
  if (!css) throw new Error('checksFor: no hashed stylesheet (site.<hash>.css) in dist/assets/ (run make build)');
  const missing = `site.${MISSING_HASH}.css`;
  if (css === missing) throw new Error(`checksFor: the built stylesheet is named ${missing}, so it cannot stand in for a missing one`);
  return [
    { label: 'home page', path: pathOf('hub'), status: 200 },
    { label: 'program page', path: pathOf('program'), status: 200 },
    { label: 'hospital page', path: pathOf('hospital-cut'), status: 200 },
    { label: 'hashed asset', path: `/assets/${css}`, status: 200 },
    { label: 'unknown path', path: pathOf('not-found'), status: 404 },
    { label: 'missing hashed asset', path: `/assets/${missing}`, status: 404 },
  ];
}

const lowercased = (headers) => Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim()]));

// One check's result: the live response ({ status, headers }) against the rules. `rows` has one entry per header
// compared, { name, file, live, ok } (null: not sent), plus the status as ':status'; `live` is all the response's headers,
// names lowercased. A header is compared when the
// file sets it for this path and status; a header the file sets for the path but withholds from this status (the
// Cache-Control of a 404, which headersFor omits) is a difference only when the live response carries the file's value,
// because Cloudflare may send a Cache-Control of its own there; the row's `withheld` flag marks it for the report.
export function compareResponse(rules, check, response) {
  const live = lowercased(response.headers);
  const expected = headersFor(rules, check.path, { status: check.status });
  const declared = headersFor(rules, check.path);
  const rows = [{ name: ':status', file: String(check.status), live: String(response.status), ok: response.status === check.status }];
  for (const [name, value] of Object.entries(expected)) rows.push({ name, file: value, live: live[name] ?? null, ok: live[name] === value });
  for (const [name, value] of Object.entries(declared)) {
    if (name in expected) continue;
    rows.push({ name, file: null, live: live[name] ?? null, ok: live[name] !== value, withheld: value });
  }
  return { ...check, rows, live, ok: rows.every((row) => row.ok) };
}

const show = (value) => (value === null ? '(not sent)' : value);

// The report text for the results of compareResponse: one line per request, then each difference in full and the
// live Cache-Control of the two 404s (whatever it is: it is the answer to whether Cloudflare keeps a 404).
export function formatReport(results) {
  const pathWidth = Math.max(...results.map((r) => r.path.length));
  const lines = ['Live headers against dist/_headers', ''];
  for (const r of results) {
    const detail = r.error ? `no response: ${r.error}` : r.ok ? `${r.rows.filter((row) => !row.withheld).length} compared, all match` : `${r.rows.filter((row) => !row.ok).length} differ`;
    lines.push(`  ${r.ok ? 'ok  ' : 'DIFF'}  ${r.path.padEnd(pathWidth)}  ${String(r.status).padEnd(3)}  ${r.label.padEnd(20)}  ${detail}`);
  }
  for (const r of results.filter((x) => x.rows?.some((row) => !row.ok))) {
    lines.push('', `${r.path} (${r.label}, expect ${r.status})`);
    for (const row of r.rows.filter((x) => !x.ok)) {
      const file = row.withheld === undefined ? show(row.file) : `none for a ${r.status} (the file's value for a 200 is: ${row.withheld})`;
      lines.push(`  ${row.name}`, `    file: ${file}`, `    live: ${show(row.live)}`);
    }
  }
  const notes = results.filter((r) => r.status === 404 && r.live);
  if (notes.length) {
    lines.push('', 'Cache-Control the site sends on a 404:');
    for (const r of notes) lines.push(`  ${r.path.padEnd(pathWidth)}  ${show(r.live['cache-control'] ?? null)}`);
  }
  return lines.join('\n');
}

// "pass N" and "fail N" from a node:test run's summary, in either reporter's format ("ℹ pass 12" or "# pass 12").
export function parseCounts(output) {
  const count = (word) => {
    const found = [...output.matchAll(new RegExp(`^(?:ℹ|#) ${word} (\\d+)\\s*$`, 'gm'))].at(-1);
    return found ? Number(found[1]) : null;
  };
  return { pass: count('pass'), fail: count('fail') };
}

// ---- the command (below here touches the browser, the file system and the network) ----

// Runs `npm run e2e` for one engine against `base`, showing its output as it comes. Resolves { engine, code, ms, pass, fail }.
function runSuite(engine, base) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('npm', ['run', 'e2e'], { cwd: REPO_ROOT, env: { ...process.env, E2E_ENGINE: engine, E2E_BASE_URL: base }, stdio: ['inherit', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.on('error', (error) => { console.error(`could not start npm: ${error.message}`); resolve({ engine, code: 1, ms: Date.now() - started, pass: null, fail: null }); });
    child.on('close', (code) => resolve({ engine, code: code ?? 1, ms: Date.now() - started, ...parseCounts(output) }));
  });
}

// The live response for a check: its status and headers, redirects not followed (a redirect is a difference).
async function fetchLive(base, check) {
  const response = await fetch(new URL(check.path, base), { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  await response.body?.cancel();
  return { status: response.status, headers: Object.fromEntries(response.headers) };
}

async function main() {
  const given = process.env.E2E_BASE_URL;
  if (!given) {
    console.error('E2E_BASE_URL is required: the site to test, e.g. E2E_BASE_URL=http://127.0.0.1:8080 npm run e2e:launch\n(build dist/ first, with the same commit and PP_ENV as the deployed site)');
    return 1;
  }
  const url = new URL(given);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RangeError('E2E_BASE_URL must be an http or https address');
  const base = url.origin;
  // Read before the suites start, so a missing or malformed dist/ fails in a second, not after thirty minutes.
  const rules = parseHeaders(readFileSync(DIST + '_headers', 'utf8'));
  const { samplePages } = await import('./lib.js');
  const checks = checksFor(samplePages(), readdirSync(DIST + 'assets'));

  const suites = [];
  for (const engine of ENGINES) {
    console.log(`\n=== ${engine}: npm run e2e against ${base} ===\n`);
    suites.push(await runSuite(engine, base));
  }

  const results = [];
  for (const check of checks) {
    try {
      results.push(compareResponse(rules, check, await fetchLive(base, check)));
    } catch (error) {
      results.push({ ...check, ok: false, error: error.cause?.code ?? error.message });
    }
  }

  console.log('\n=== summary ===\n');
  for (const s of suites) console.log(`  ${s.code === 0 ? 'ok  ' : 'FAIL'}  ${s.engine.padEnd(8)}  ${s.pass ?? '?'} passed, ${s.fail ?? '?'} failed  ${(s.ms / 1000).toFixed(0)} s`);
  console.log(`\n${formatReport(results)}`);
  const failed = suites.some((s) => s.code !== 0) || results.some((r) => !r.ok);
  console.log(`\n${failed ? 'NOT READY: a browser check failed or a header differs.' : 'All three engines pass and every header matches.'}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(1); });
}
