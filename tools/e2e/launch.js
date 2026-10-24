// The launch command: `E2E_BASE_URL=<site> npm run e2e:launch`. Run it by hand before a launch, on a machine that has
// all three browser engines; CI runs Chromium only (the `browser` job). It does two things against the site at
// E2E_BASE_URL (a preview, the live site, or `make serve` at http://127.0.0.1:8080):
//
//   1. The live response headers of a request for each rule in dist/_headers (the first sample page or file in dist/
//      that the rule matches), the home, program and hospital pages, a path no page has (the 404 page) and a hashed
//      asset that does not exist (so whether Cloudflare keeps a missing file's 404 for a year is on record), each
//      compared name by name with what the file says the request gets (headersFor in pipeline/site/headers.js, which
//      reads the file as Cloudflare does). Only headers the file sets are compared; Cloudflare's own (date, server,
//      cf-ray, etag, ...) are not. Its report prints at once, before the half hour of browser checks.
//   2. The browser checks (npm run e2e, tools/e2e/) once per engine: Chromium, Firefox and WebKit (E2E_ENGINE).
//
// It needs a dist/ built from the same commit, and with the same PP_ENV (`PP_ENV=production make build` for the live
// site; X-Robots-Tag: noindex is in every other build's file), as the site that is deployed: the requests and the
// expected headers come from dist/. Exit 0 only when every engine passes and no header differs; 1 otherwise, with a last
// line that names what failed.
//
// The comparison itself (checksFor, compareResponse, formatReport, parseCounts, verdict) is pure and tested in
// tools/test/launch.test.js, which needs no browser or network.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DIST_DIR as DIST, REPO_ROOT, filesUnder } from '../../pipeline/files.js';
import { addressOf } from '../../pipeline/site/address.js';
import { headersFor, parseHeaders } from '../../pipeline/site/headers.js';
import { ENGINES, baseUrlFromEnv, samplePages } from './site.js';

// A hashed asset that no build has (a hash of eight zeros); were a build ever to write it, its check expects a 200.
const MISSING_ASSET = '/assets/site.00000000.css';
const FETCH_TIMEOUT_MS = 30_000;

// The requests whose headers are compared: [{ label, path, status }]. rules: dist/_headers, parsed. pages: samplePages()'s
// answer. files: every file in dist/, as filesUnder lists them. The home, program and hospital pages, then one request
// per rule (the first of those pages, else of the files, that the rule matches; a page already listed gains the rule
// in its label), the unknown path and the missing asset. A request expects 200 when it is a file's address in dist/
// (addressOf) and 404 otherwise. The pages are picked by type, so none is named here.
export function checksFor(rules, pages, files) {
  const pathOf = (type) => {
    const page = pages.find((p) => p.type === type);
    if (!page) throw new Error(`checksFor: no "${type}" page among the sample pages`);
    return page.path;
  };
  const addresses = files.map(addressOf);
  const checks = [
    { label: 'home page', path: pathOf('hub') },
    { label: 'program page', path: pathOf('program') },
    { label: 'hospital page', path: pathOf('hospital-cut') },
  ];
  for (const rule of rules) {
    const path = [...checks.map((c) => c.path), ...addresses].find((p) => rule.pattern.test(p));
    if (!path) throw new Error(`checksFor: no page or file in dist/ for the rule ${rule.path} (run make build)`);
    const listed = checks.find((c) => c.path === path);
    if (listed) listed.label += `, rule ${rule.path}`;
    else checks.push({ label: `rule ${rule.path}`, path });
  }
  checks.push({ label: 'unknown path', path: pathOf('not-found') }, { label: 'missing hashed asset', path: MISSING_ASSET });
  const served = new Set(addresses);
  return checks.map((check) => ({ ...check, status: served.has(check.path) ? 200 : 404 }));
}

const lowercased = (headers) => Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim()]));

// One check's result: the live response ({ status, headers }) against the rules. `rows` has one entry per header
// compared, { name, file, live, ok } (null: not sent), plus the status as ':status'; `live` is all the response's
// headers, names lowercased, and `liveStatus` its status. A header is compared when the file sets it for this path and
// status; a header the file sets for the path but withholds from this status (the Cache-Control of a 404, which
// headersFor omits) is a difference only when the live response carries the file's value, because Cloudflare may send a
// Cache-Control of its own there; the row's `withheld` flag marks it for the report.
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
  return { ...check, rows, live, liveStatus: response.status, ok: rows.every((row) => row.ok) };
}

const show = (value) => (value === null ? '(not sent)' : value);
// Two values that differ only in letter case or spacing (a difference still, but named as such in the report).
const looselyEqual = (a, b) => a !== null && b !== null && a !== b && a.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '');

// The report text for the results of compareResponse: one line per request, then each difference in full (marked when
// it is only letter case or spacing) and the live Cache-Control of each response that was a 404 (whatever it is: it is
// the answer to whether Cloudflare keeps a 404).
export function formatReport(results) {
  const pathWidth = Math.max(...results.map((r) => r.path.length));
  const labelWidth = Math.max(...results.map((r) => r.label.length));
  const lines = ['Live headers against dist/_headers', ''];
  for (const r of results) {
    const detail = r.error ? `no response: ${r.error}` : r.ok ? `${r.rows.filter((row) => !row.withheld).length} compared, all match` : `${r.rows.filter((row) => !row.ok).length} differ`;
    lines.push(`  ${r.ok ? 'ok  ' : 'DIFF'}  ${r.path.padEnd(pathWidth)}  ${String(r.status).padEnd(3)}  ${r.label.padEnd(labelWidth)}  ${detail}`);
  }
  for (const r of results.filter((x) => x.rows?.some((row) => !row.ok))) {
    lines.push('', `${r.path} (${r.label}, expect ${r.status})`);
    for (const row of r.rows.filter((x) => !x.ok)) {
      const file = row.withheld === undefined ? show(row.file) : `none for a ${r.status} (the file's value for a 200 is: ${row.withheld})`;
      lines.push(`  ${row.name}`, `    file: ${file}`, `    live: ${show(row.live)}`);
      if (row.withheld === undefined && looselyEqual(row.file, row.live)) lines.push('    (these differ only in letter case or spacing)');
    }
  }
  const notes = results.filter((r) => r.liveStatus === 404);
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

// The run's verdict: { ok, line }, the line saying it is ready or naming what failed: the engines whose browser checks
// failed, and each request whose headers differ (with the headers) or that got no response.
export function verdict(suites, results) {
  const engines = suites.filter((s) => s.code !== 0).map((s) => s.engine);
  const requests = results.filter((r) => !r.ok).map((r) => (r.error ? `${r.path} (no response)` : `${r.path} (${r.rows.filter((row) => !row.ok).map((row) => row.name).join(', ')})`));
  if (engines.length === 0 && requests.length === 0) return { ok: true, line: `READY: the browser checks pass on ${suites.map((s) => s.engine).join(', ')}, and every header matches.` };
  const failed = [];
  if (engines.length) failed.push(`the browser checks failed on ${engines.join(', ')}`);
  if (requests.length) failed.push(`headers differ on ${requests.join('; ')}`);
  return { ok: false, line: `NOT READY: ${failed.join('; and ')}.` };
}

// ---- the command (below here touches the browser, the file system and the network) ----

// The suites running now, so a SIGTERM to this command stops them too (main).
const running = new Set();

// Runs `npm run e2e` for one engine against `base`, showing its output as it comes. Resolves { engine, code, ms, pass, fail }.
function runSuite(engine, base) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('npm', ['run', 'e2e'], { cwd: REPO_ROOT, env: { ...process.env, E2E_ENGINE: engine, E2E_BASE_URL: base }, stdio: ['inherit', 'pipe', 'inherit'] });
    running.add(child);
    let output = '';
    // Decoded as text, so a character split across two chunks is not garbled.
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.on('error', (error) => { running.delete(child); console.error(`could not start npm: ${error.message}`); resolve({ engine, code: 1, ms: Date.now() - started, pass: null, fail: null }); });
    child.on('close', (code) => { running.delete(child); resolve({ engine, code: code ?? 1, ms: Date.now() - started, ...parseCounts(output) }); });
  });
}

// The live response for a check: its status and headers, redirects not followed (a redirect is a difference).
async function fetchLive(base, check) {
  const response = await fetch(new URL(check.path, base), { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  await response.body?.cancel();
  return { status: response.status, headers: Object.fromEntries(response.headers) };
}

async function main() {
  const base = baseUrlFromEnv();
  if (!base) {
    console.error('E2E_BASE_URL is required: the site to test, e.g. E2E_BASE_URL=http://127.0.0.1:8080 npm run e2e:launch\n(build dist/ first, with the same commit and PP_ENV as the deployed site)');
    return 1;
  }
  // Read before the suites start, so a missing or malformed dist/ fails in a second, not after thirty minutes.
  const rules = parseHeaders(readFileSync(DIST + '_headers', 'utf8'));
  const checks = checksFor(rules, samplePages(), filesUnder(DIST));

  // Stopped from outside (a SIGTERM, not a terminal's Ctrl-C, which reaches the suites itself): stop the suite running.
  process.on('SIGTERM', () => {
    for (const child of running) child.kill('SIGTERM');
    process.exit(143);
  });
  // The headers first: a difference there is known in seconds, not after the browser checks.
  const results = await Promise.all(checks.map(async (check) => {
    try {
      return compareResponse(rules, check, await fetchLive(base, check));
    } catch (error) {
      return { ...check, ok: false, error: error.cause?.code ?? error.message };
    }
  }));
  console.log(`\n${formatReport(results)}`);

  const suites = [];
  for (const engine of ENGINES) {
    console.log(`\n=== ${engine}: npm run e2e against ${base} ===\n`);
    suites.push(await runSuite(engine, base));
  }

  console.log('\n=== summary ===\n');
  for (const s of suites) console.log(`  ${s.code === 0 ? 'ok  ' : 'FAIL'}  ${s.engine.padEnd(8)}  ${s.pass ?? '?'} passed, ${s.fail ?? '?'} failed  ${(s.ms / 1000).toFixed(0)} s`);
  const { ok, line } = verdict(suites, results);
  console.log(`\n${line}`);
  return ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(1); });
}
