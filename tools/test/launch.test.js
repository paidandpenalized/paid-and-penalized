// The launch command's comparison of live headers with dist/_headers, on synthetic responses: no browser, no network.
// (The command itself, tools/e2e/launch.js, is run by hand; see its header.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { headersFile, headersFor, parseHeaders } from '../../pipeline/site/headers.js';
import { checksFor, compareResponse, formatReport, killSuites, parseCounts, stopSuites, verdict } from '../e2e/launch.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const RULES = parseHeaders(`/*
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000

/assets/*.css
  Cache-Control: ${IMMUTABLE}
`);
const PAGES = [
  { type: 'hub', path: '/' },
  { type: 'program', path: '/prog/' },
  { type: 'hospital-cut', path: '/prog/hospital/990001/' },
  { type: 'hospital-unscored', path: '/prog/hospital/990002/' },
  { type: 'not-found', path: '/nothing-here/' },
];
const OK_PAGE = { status: 200, headers: { 'X-Content-Type-Options': 'nosniff', 'strict-transport-security': 'max-age=31536000', date: 'now', server: 'cloudflare', 'cf-ray': 'x' } };
const check = { label: 'a page', path: '/prog/', status: 200 };
const diffs = (result) => result.rows.filter((row) => !row.ok);

// A built site's files, as filesUnder lists them.
const FILES = ['404.html', 'assets/site.0bfb0a2f.css', 'assets/topbar.3ef483a0.js', 'index.html', 'prog/hospital/990001/index.html', 'prog/hospital/990002/index.html', 'prog/index.html'];

test('checksFor: the three pages, a request for each rule (a page it matches, else the first file), the unknown path and a missing asset', () => {
  assert.deepEqual(checksFor(RULES, PAGES, FILES), [
    { label: 'home page, rule /*', path: '/', status: 200 },
    { label: 'program page', path: '/prog/', status: 200 },
    { label: 'hospital page', path: '/prog/hospital/990001/', status: 200 },
    { label: 'rule /assets/*.css', path: '/assets/site.0bfb0a2f.css', status: 200 },
    { label: 'unknown path', path: '/nothing-here/', status: 404 },
    { label: 'missing hashed asset', path: '/assets/site.00000000.css', status: 404 },
    { label: 'folder without its "/"', path: '/prog', status: 307, location: '/prog/' },
    { label: 'not-found page by file name', path: '/404.html', status: 307, location: '/404' },
  ]);
  // A request expects what the server's address rule gives: 200 for a file's address in dist/, else 404.
  const bare = checksFor(RULES, PAGES, FILES.filter((f) => !f.startsWith('prog/hospital/')));
  assert.equal(bare.find((c) => c.label === 'hospital page').status, 404);
});

test('checksFor: a rule\'s request goes to an address served with a 200, never _headers or a .html name Cloudflare redirects', () => {
  // In file order, the first file each rule's pattern matches is 404.html (/*l, but its address is /404) and _headers
  // (/*s, never served); the first address that both servers answer with a 200 is the sitemap and the stylesheet.
  const rules = parseHeaders('/*l\n  X-A: 1\n\n/*s\n  X-B: 2\n');
  const files = [...FILES, '_headers', 'sitemap.xml'].sort();
  assert.deepEqual(files.slice(0, 2), ['404.html', '_headers']);
  assert.deepEqual(checksFor(rules, PAGES, files).filter((c) => c.label.startsWith('rule')), [
    { label: 'rule /*l', path: '/sitemap.xml', status: 200 },
    { label: 'rule /*s', path: '/assets/site.0bfb0a2f.css', status: 200 },
  ]);
  // A rule that only those two match has no request to make.
  for (const rule of ['/*.html', '/_*']) {
    assert.throws(() => checksFor(parseHeaders(`${rule}\n  X-A: 1\n`), PAGES, files), /no page or file in dist\/ served with a 200 for the rule/);
  }
  // And a page at _headers' address would be expected to be a 404, as the server answers.
  const odd = PAGES.map((p) => (p.type === 'not-found' ? { ...p, path: '/_headers' } : p));
  assert.equal(checksFor(RULES, odd, files).find((c) => c.label === 'unknown path').status, 404);
});

test('checksFor throws when a page type is missing, or a rule matches nothing in dist/', () => {
  assert.throws(() => checksFor(RULES, PAGES.filter((p) => p.type !== 'hospital-cut'), FILES), /no "hospital-cut" page/);
  assert.throws(() => checksFor(RULES, PAGES, FILES.filter((f) => !f.endsWith('.css'))), /no page or file in dist\/ served with a 200 for the rule \/assets\/\*\.css/);
});

test('compareResponse: every header the file sets matches, whatever the case of the live names and whatever else is sent', () => {
  const result = compareResponse(RULES, check, OK_PAGE);
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((r) => r.name), [':status', 'x-content-type-options', 'strict-transport-security']);
  assert.ok(result.rows.every((r) => r.ok));
});

test('compareResponse: a changed value, a missing header and a different status are each a difference, with both sides kept', () => {
  const changed = compareResponse(RULES, check, { status: 200, headers: { 'x-content-type-options': 'sniff', 'strict-transport-security': 'max-age=31536000' } });
  assert.deepEqual(diffs(changed), [{ name: 'x-content-type-options', file: 'nosniff', live: 'sniff', ok: false }]);
  const missing = compareResponse(RULES, check, { status: 200, headers: { 'x-content-type-options': 'nosniff' } });
  assert.deepEqual(diffs(missing), [{ name: 'strict-transport-security', file: 'max-age=31536000', live: null, ok: false }]);
  const redirected = compareResponse(RULES, check, { ...OK_PAGE, status: 307 });
  assert.deepEqual(diffs(redirected), [{ name: ':status', file: '200', live: '307', ok: false }]);
  assert.equal(changed.ok || missing.ok || redirected.ok, false);
});

test('compareResponse: a redirect\'s Location must be where lookup sends it', () => {
  const bare = { label: 'bare', path: '/prog', status: 307, location: '/prog/' };
  const sent = (location) => compareResponse(RULES, bare, { status: 307, headers: { ...OK_PAGE.headers, ...(location && { Location: location }) } });
  assert.equal(sent('/prog/').ok, true);
  assert.deepEqual(diffs(sent('/elsewhere/')), [{ name: ':location', file: '/prog/', live: '/elsewhere/', ok: false }]);
  assert.deepEqual(diffs(sent(null)), [{ name: ':location', file: '/prog/', live: null, ok: false }]);
  assert.equal(compareResponse(RULES, check, OK_PAGE).rows.some((r) => r.name === ':location'), false, 'only a redirect has one');
});

test('compareResponse: a header the file does not set for the path is ignored, and one it does set for another path is not required', () => {
  const live = { ...OK_PAGE, headers: { ...OK_PAGE.headers, 'cache-control': 'public, max-age=0, must-revalidate', etag: '"x"' } };
  assert.equal(compareResponse(RULES, check, live).ok, true);
  assert.equal(compareResponse(RULES, check, OK_PAGE).rows.some((r) => r.name === 'cache-control'), false);
});

test('compareResponse: a hashed file is expected to carry the year-long Cache-Control', () => {
  const asset = { label: 'asset', path: '/assets/site.0bfb0a2f.css', status: 200 };
  const sent = { ...OK_PAGE.headers, 'cache-control': IMMUTABLE };
  assert.equal(compareResponse(RULES, asset, { status: 200, headers: sent }).ok, true);
  const without = compareResponse(RULES, asset, OK_PAGE);
  assert.deepEqual(diffs(without), [{ name: 'cache-control', file: IMMUTABLE, live: null, ok: false }]);
});

test('compareResponse: on a 404 each header is the file\'s value (the deployed Worker) or absent (a preview URL); another value differs', () => {
  const missing = { label: 'missing', path: '/assets/site.00000000.css', status: 404 };
  const declared = headersFor(RULES, missing.path);
  assert.equal(compareResponse(RULES, missing, { status: 404, headers: { ...declared, server: 'cloudflare' } }).ok, true, 'the deployed Worker');
  assert.equal(compareResponse(RULES, missing, { status: 404, headers: { server: 'cloudflare' } }).ok, true, 'a preview URL');
  const other = compareResponse(RULES, missing, { status: 404, headers: { ...declared, 'cache-control': 'no-store' } });
  assert.deepEqual(diffs(other), [{ name: 'cache-control', file: IMMUTABLE, live: 'no-store', ok: false }]);
  // A 200 must carry every one.
  assert.equal(compareResponse(RULES, { ...missing, status: 200 }, { status: 200, headers: { server: 'cloudflare' } }).ok, false);
});

test('compareResponse on the real file: a response that is exactly what headersFor gives (and lookup\'s Location), plus Cloudflare\'s own headers, differs nowhere', () => {
  for (const env of ['production', 'preview']) {
    const rules = parseHeaders(headersFile({ env }));
    for (const c of checksFor(rules, PAGES, [...FILES, 'assets/fonts/a.woff2', 'assets/x.1.json', 'favicon.svg'])) {
      const headers = { ...headersFor(rules, c.path), date: 'now', server: 'cloudflare', etag: '"1"', 'content-type': 'text/html', ...(c.location && { location: c.location }) };
      assert.equal(compareResponse(rules, c, { status: c.status, headers }).ok, true, `${env} ${c.path}`);
    }
  }
});

test('compareResponse on the real file: a preview\'s noindex missing from a response is caught', () => {
  const rules = parseHeaders(headersFile({ env: 'preview' }));
  const headers = headersFor(rules, '/');
  delete headers['x-robots-tag'];
  assert.deepEqual(diffs(compareResponse(rules, { label: 'home', path: '/', status: 200 }, { status: 200, headers })).map((r) => r.name), ['x-robots-tag']);
});

test('formatReport: a clean run says what was compared; a difference is named with the file\'s value and the live one', () => {
  const clean = formatReport([compareResponse(RULES, check, OK_PAGE)]);
  assert.match(clean, /^ {2}ok {4}\/prog\/ +200 +a page +3 compared, all match$/m);
  assert.doesNotMatch(clean, /DIFF/);

  const bad = compareResponse(RULES, check, { status: 200, headers: { 'x-content-type-options': 'sniff', 'strict-transport-security': 'max-age=31536000' } });
  const report = formatReport([bad, { label: 'down', path: '/x/', status: 200, ok: false, error: 'ECONNREFUSED' }]);
  assert.match(report, /^ {2}DIFF {2}\/prog\/ +200 +a page +1 differ$/m);
  assert.match(report, /^ {2}DIFF {2}\/x\/ +200 +down +no response: ECONNREFUSED$/m);
  assert.match(report, /\n {2}x-content-type-options\n {4}file: nosniff\n {4}live: sniff$/);
});

test('formatReport: a difference of letter case or spacing alone is marked as one', () => {
  const loose = compareResponse(RULES, check, { status: 200, headers: { ...OK_PAGE.headers, 'strict-transport-security': 'Max-Age=31536000 ' } });
  const spaced = compareResponse(RULES, check, { status: 200, headers: { ...OK_PAGE.headers, 'strict-transport-security': 'max-age = 31536000' } });
  const other = compareResponse(RULES, check, { status: 200, headers: { ...OK_PAGE.headers, 'strict-transport-security': 'max-age=0' } });
  for (const result of [loose, spaced, other]) assert.equal(result.ok, false);
  assert.match(formatReport([loose]), /live: Max-Age=31536000\n {4}\(these differ only in letter case or spacing\)/);
  assert.match(formatReport([spaced]), /\(these differ only in letter case or spacing\)/);
  assert.doesNotMatch(formatReport([other]), /differ only/);
});

test('formatReport: the Cache-Control sent on each 404 is listed, "(not sent)" when there is none', () => {
  const missing = { label: 'missing', path: '/assets/site.00000000.css', status: 404 };
  const unknown = { label: 'unknown', path: '/nothing-here/', status: 404 };
  const sent = compareResponse(RULES, missing, { status: 404, headers: { ...OK_PAGE.headers, 'cache-control': 'no-store' } });
  const none = compareResponse(RULES, unknown, { status: 404, headers: OK_PAGE.headers });
  const report = formatReport([sent, none]);
  assert.match(report, /Cache-Control the site sends on a 404:\n {2}\/assets\/site\.00000000\.css +no-store\n {2}\/nothing-here\/ +\(not sent\)$/);
});

test('formatReport: the 404 list holds the responses that were 404s, whatever was expected', () => {
  const unknown = { label: 'unknown', path: '/nothing-here/', status: 404 };
  const served = compareResponse(RULES, unknown, { status: 200, headers: { ...OK_PAGE.headers, 'cache-control': 'no-store' } });
  const gone = compareResponse(RULES, check, { status: 404, headers: { ...OK_PAGE.headers, 'cache-control': 'no-store' } });
  const report = formatReport([served, gone]);
  assert.match(report, /Cache-Control the site sends on a 404:\n {2}\/prog\/ +no-store$/);
  assert.doesNotMatch(formatReport([served]), /on a 404/);
});

test('verdict: ready only when every engine passes and every header matches; otherwise it names the engines and requests', () => {
  const pass = (engine) => ({ engine, code: 0 });
  const good = compareResponse(RULES, check, OK_PAGE);
  assert.deepEqual(verdict([pass('chromium'), pass('webkit')], [good]), { ok: true, line: 'READY: the browser checks pass on chromium, webkit, and every header matches.' });
  const bad = compareResponse(RULES, check, { status: 301, headers: { 'x-content-type-options': 'sniff' } });
  const down = { label: 'down', path: '/x/', status: 200, ok: false, error: 'ECONNREFUSED' };
  assert.deepEqual(verdict([pass('chromium'), { engine: 'firefox', code: 1 }, { engine: 'webkit', code: 1 }], [good, bad, down]), {
    ok: false,
    line: 'NOT READY: the browser checks failed on firefox, webkit; and headers differ on /prog/ (:status, x-content-type-options, strict-transport-security); /x/ (no response).',
  });
  assert.deepEqual(verdict([{ engine: 'chromium', code: 1 }], [good]), { ok: false, line: 'NOT READY: the browser checks failed on chromium.' });
  assert.deepEqual(verdict([pass('chromium')], [down]), { ok: false, line: 'NOT READY: headers differ on /x/ (no response).' });
});

test('parseCounts reads the pass and fail totals from either reporter\'s summary, and gives null when there is none', () => {
  assert.deepEqual(parseCounts('ℹ tests 12\nℹ pass 11\nℹ fail 1\nℹ cancelled 0\n'), { pass: 11, fail: 1 });
  assert.deepEqual(parseCounts('# tests 12\n# pass 12\n# fail 0\n'), { pass: 12, fail: 0 });
  assert.deepEqual(parseCounts('ok 1 - a pass 3 in a title\n'), { pass: null, fail: null });
});

// A stand-in for process.kill over process groups: groups[pgid] is how many signal-0 checks the group answers before it
// is empty (Infinity: it never empties; 0: it is gone already). Every signal sent is recorded.
function groupsKill(groups) {
  const sent = [];
  const kill = (pid, signal) => {
    const group = -pid;
    if (!(groups[group] > 0)) throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
    sent.push([pid, signal]);
    if (signal === 0) groups[group]--;
  };
  return { sent, kill };
}

// Whether a process with the pid is running.
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Resolves once the process is gone, or after five seconds: a process whose parent has exited is reaped by the system,
// not at once.
async function gone(pid) {
  const end = Date.now() + 5000;
  while (alive(pid) && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
}

// SIGKILL to each pid and its group, whatever is left of them when a test ends.
function cleanUp(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Gone already.
    }
  }
}

test('stopSuites: a SIGTERM to each suite\'s whole process group, then a wait until every group is empty', async () => {
  const { sent, kill } = groupsKill({ 101: 1, 202: 3 });
  await stopSuites(new Set([101, 202]), { kill, graceMs: 60_000, pollMs: 1 });
  assert.deepEqual(sent.filter(([, signal]) => signal !== 0), [[-101, 'SIGTERM'], [-202, 'SIGTERM']]);
  assert.ok(sent.some(([pid, signal]) => pid === -202 && signal === 0), 'it asked whether the group had emptied');
});

test('stopSuites: a group already gone is skipped, and one with a process left after graceMs gets SIGKILL', async () => {
  const { sent, kill } = groupsKill({ 101: 0, 202: Infinity });
  const started = Date.now();
  await stopSuites([101, 202], { kill, graceMs: 50, pollMs: 5 });
  assert.ok(Date.now() - started >= 45, 'it waited graceMs');
  assert.deepEqual(sent.filter(([, signal]) => signal !== 0), [[-202, 'SIGTERM'], [-202, 'SIGKILL']]);
  await stopSuites([], { kill: () => assert.fail('nothing to signal') });
});

test('stopSuites on a real process tree: the group\'s leader and a process it started that ignores SIGTERM both go', async () => {
  // A stand-in suite, spawned detached as runSuite spawns one: it starts a process that ignores SIGTERM, as the test
  // runner keeps going after one, and prints that process's pid once it is listening for the signal.
  const stubborn = "process.on('SIGTERM', () => {}); console.log(process.pid); setInterval(() => {}, 1000);";
  const lead = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(stubborn)}], { stdio: ['ignore', 'inherit', 'ignore'] }); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ['-e', lead], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = once(child, 'exit');
  const [line] = await once(child.stdout.setEncoding('utf8'), 'data');
  // Its pipe closed, so a process left behind cannot hold this test file open.
  child.stdout.destroy();
  const started = Number(line.trim());
  try {
    assert.ok(alive(started), 'the process the suite started is running');
    await stopSuites([child.pid], { graceMs: 300 });
    await exited;
    // The process left after the grace got SIGKILL; its parent being gone, the system reaps it.
    await gone(started);
    assert.equal(alive(started), false, 'the process the suite started is gone');
  } finally {
    // When the test fails, nothing of it is left running.
    cleanUp([-child.pid, started]);
  }
});

test('killSuites: a SIGKILL to each suite\'s whole process group at once, a group already gone skipped', () => {
  const { sent, kill } = groupsKill({ 101: 0, 202: Infinity, 303: 1 });
  killSuites(new Set([101, 202, 303]), { kill });
  assert.deepEqual(sent, [[-202, 'SIGKILL'], [-303, 'SIGKILL']]);
  killSuites([], { kill: () => assert.fail('nothing to signal') });
});

test('killSuites in an exit handler: a command that crashes while a suite runs leaves no suite running', async () => {
  // A stand-in for the command, wired as main is: it starts a suite in a process group of its own (as runSuite does),
  // kills the suites on its 'exit' event, prints the suite's pid, and crashes on an uncaught error.
  const command = [
    "import { spawn } from 'node:child_process';",
    `import { killSuites } from ${JSON.stringify(import.meta.resolve('../e2e/launch.js'))};`,
    "const suite = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });",
    "process.on('exit', () => killSuites([suite.pid]));",
    'console.log(suite.pid);',
    "setTimeout(() => { throw new Error('a crash'); }, 50);",
  ].join('\n');
  const child = spawn(process.execPath, ['--input-type=module', '-e', command], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = once(child, 'exit');
  const [line] = await once(child.stdout.setEncoding('utf8'), 'data');
  const suite = Number(line.trim());
  try {
    const [code] = await exited;
    assert.equal(code, 1, 'the command crashed');
    await gone(suite);
    assert.equal(alive(suite), false, 'the suite is gone');
  } finally {
    cleanUp([-suite, suite]);
  }
});
