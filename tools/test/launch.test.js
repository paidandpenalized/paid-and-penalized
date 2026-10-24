// The launch command's comparison of live headers with dist/_headers, on synthetic responses: no browser, no network.
// (The command itself, tools/e2e/launch.js, is run by hand; see its header.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headersFile, headersFor, parseHeaders } from '../../pipeline/site/headers.js';
import { checksFor, compareResponse, formatReport, parseCounts } from '../e2e/launch.js';

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
  { type: 'hospital-cut', path: '/prog/hospital/000001/' },
  { type: 'hospital-unscored', path: '/prog/hospital/000002/' },
  { type: 'not-found', path: '/nothing-here/' },
];
const OK_PAGE = { status: 200, headers: { 'X-Content-Type-Options': 'nosniff', 'strict-transport-security': 'max-age=31536000', date: 'now', server: 'cloudflare', 'cf-ray': 'x' } };
const check = { label: 'a page', path: '/prog/', status: 200 };
const diffs = (result) => result.rows.filter((row) => !row.ok);

test('checksFor: the six requests, each page picked by type and the asset by pattern, with a hash no build has for the missing one', () => {
  assert.deepEqual(checksFor(PAGES, ['site.0bfb0a2f.css', 'theme.3ef483a0.js', 'fonts']), [
    { label: 'home page', path: '/', status: 200 },
    { label: 'program page', path: '/prog/', status: 200 },
    { label: 'hospital page', path: '/prog/hospital/000001/', status: 200 },
    { label: 'hashed asset', path: '/assets/site.0bfb0a2f.css', status: 200 },
    { label: 'unknown path', path: '/nothing-here/', status: 404 },
    { label: 'missing hashed asset', path: '/assets/site.00000000.css', status: 404 },
  ]);
});

test('checksFor throws when a page type or the stylesheet is missing, or the stylesheet could pass for a missing one', () => {
  assert.throws(() => checksFor(PAGES.filter((p) => p.type !== 'hospital-cut'), ['site.0bfb0a2f.css']), /no "hospital-cut" page/);
  assert.throws(() => checksFor(PAGES, ['theme.3ef483a0.js', 'site.css']), /no hashed stylesheet/);
  assert.throws(() => checksFor(PAGES, ['site.00000000.css']), /cannot stand in/);
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
  const redirected = compareResponse(RULES, check, { ...OK_PAGE, status: 301 });
  assert.deepEqual(diffs(redirected), [{ name: ':status', file: '200', live: '301', ok: false }]);
  assert.equal(changed.ok || missing.ok || redirected.ok, false);
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

test('compareResponse: a missing hashed file\'s 404 is a difference only when it carries the file\'s year-long Cache-Control', () => {
  const missing = { label: 'missing', path: '/assets/site.00000000.css', status: 404 };
  const response = (cacheControl) => ({ status: 404, headers: { ...OK_PAGE.headers, ...(cacheControl && { 'cache-control': cacheControl }) } });
  assert.equal(compareResponse(RULES, missing, response(null)).ok, true);
  // Cloudflare's own Cache-Control on a 404 is not the file's, so it is recorded (live) and not a difference.
  const own = compareResponse(RULES, missing, response('public, max-age=0, must-revalidate'));
  assert.equal(own.ok, true);
  assert.equal(own.live['cache-control'], 'public, max-age=0, must-revalidate');
  const kept = compareResponse(RULES, missing, response(IMMUTABLE));
  assert.equal(kept.ok, false);
  assert.deepEqual(diffs(kept), [{ name: 'cache-control', file: null, live: IMMUTABLE, ok: false, withheld: IMMUTABLE }]);
});

test('compareResponse on the real file: a response that is exactly what headersFor gives, plus Cloudflare\'s own headers, differs nowhere', () => {
  for (const env of ['production', 'preview']) {
    const rules = parseHeaders(headersFile({ env }));
    for (const c of checksFor(PAGES, ['site.0bfb0a2f.css'])) {
      const headers = { ...headersFor(rules, c.path, { status: c.status }), date: 'now', server: 'cloudflare', etag: '"1"', 'content-type': 'text/html' };
      assert.equal(compareResponse(rules, c, { status: c.status, headers }).ok, true, `${env} ${c.path}`);
    }
  }
});

test('compareResponse on the real file: a preview\'s noindex missing from a response is caught', () => {
  const rules = parseHeaders(headersFile({ env: 'preview' }));
  const headers = headersFor(rules, '/', {});
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

test('formatReport: the Cache-Control sent on each 404 is listed, "(not sent)" when there is none', () => {
  const missing = { label: 'missing', path: '/assets/site.00000000.css', status: 404 };
  const unknown = { label: 'unknown', path: '/nothing-here/', status: 404 };
  const sent = compareResponse(RULES, missing, { status: 404, headers: { ...OK_PAGE.headers, 'cache-control': 'no-store' } });
  const none = compareResponse(RULES, unknown, { status: 404, headers: OK_PAGE.headers });
  const report = formatReport([sent, none]);
  assert.match(report, /Cache-Control the site sends on a 404:\n {2}\/assets\/site\.00000000\.css +no-store\n {2}\/nothing-here\/ +\(not sent\)$/);
});

test('formatReport: a withheld header that the live 404 carries shows the file\'s 200 value beside what is sent', () => {
  const missing = { label: 'missing', path: '/assets/site.00000000.css', status: 404 };
  const kept = compareResponse(RULES, missing, { status: 404, headers: { ...OK_PAGE.headers, 'cache-control': IMMUTABLE } });
  assert.match(formatReport([kept]), new RegExp(`cache-control\\n {4}file: none for a 404 \\(the file's value for a 200 is: ${IMMUTABLE}\\)\\n {4}live: ${IMMUTABLE}\\n`));
});

test('parseCounts reads the pass and fail totals from either reporter\'s summary, and gives null when there is none', () => {
  assert.deepEqual(parseCounts('ℹ tests 12\nℹ pass 11\nℹ fail 1\nℹ cancelled 0\n'), { pass: 11, fail: 1 });
  assert.deepEqual(parseCounts('# tests 12\n# pass 12\n# fail 0\n'), { pass: 12, fail: 0 });
  assert.deepEqual(parseCounts('ok 1 - a pass 3 in a title\n'), { pass: null, fail: null });
});
