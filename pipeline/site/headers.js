// The response headers the site is served with, as Cloudflare's _headers file for Workers static assets
// (https://developers.cloudflare.com/workers/static-assets/headers/), which the build writes to dist/_headers; and
// the parser and matcher that read the file back the way Cloudflare does, for the local server (serve.js) and for
// checking the live site's headers against the file. They read the part of Cloudflare's grammar this file uses.
import { isProduction } from './context.js';

const DAY = 24 * 60 * 60;
const IMMUTABLE = `public, max-age=${365 * DAY}, immutable`;
const WEEK = `public, max-age=${7 * DAY}`;

// Cloudflare Web Analytics, set up automatically on the live domain: Cloudflare adds a <script> to each page that
// loads its beacon from static.cloudflareinsights.com (ANALYTICS_ORIGIN, another origin, so script-src lists it), and
// the beacon reports to the site's own /cdn-cgi/rum (Cloudflare's Web Analytics FAQ; connect-src 'self'). It counts
// page views and sets no cookies (the privacy page says so).
export const ANALYTICS_ORIGIN = 'https://static.cloudflareinsights.com';

// Whether an address is the beacon script: /beacon.min.js on ANALYTICS_ORIGIN, or a versioned copy under it.
export function isAnalyticsBeacon(address) {
  const url = new URL(address);
  return url.origin === ANALYTICS_ORIGIN && (url.pathname === '/beacon.min.js' || url.pathname.startsWith('/beacon.min.js/'));
}

// The policy for a build: nothing loads from another origin but a production build's analytics beacon (no other
// build's pages get one), no script runs inline, no page can be framed.
export const cspFor = (env) => [
  "default-src 'none'",
  isProduction(env) ? `script-src 'self' ${ANALYTICS_ORIGIN}` : "script-src 'self'",
  // Inline style attributes are allowed, <style> elements and inline stylesheets are not. The server-rendered charts
  // (web/charts/, the sites' figure modules) set their data-driven custom properties in style="" so they draw without
  // JavaScript, and every such value is a number the build formats and escapes. A browser with CSP Level 3's style
  // directives (Chromium 75, Firefox 108, Safari 15.4 and later) holds elements and stylesheets to style-src-elem's
  // 'self' and takes attributes from style-src; an older one ignores style-src-elem and falls back to style-src, so
  // its charts still draw rather than losing every inline style.
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self'",
  // data: for the stylesheet's paper grain and stamp mask (web/styles/tokens.css).
  "img-src 'self' data:",
  "font-src 'self'",
  // The client scripts fetch the site's own JSON assets and nothing else.
  "connect-src 'self'",
  "base-uri 'none'",
  // The only forms are the search boxes (searchBox in sites/hacrp/web/pages/parts.js), and they never submit: hidden
  // without JavaScript, and with it web/client/omnibox.js cancels the submit and opens the picked page itself.
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// The rules in file order, each [pattern, [[name, value]]]. A request gets every matching rule's headers.
const rulesFor = (env) => [
  ['/*', [
    ['Content-Security-Policy', cspFor(env)],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Strict-Transport-Security', `max-age=${365 * DAY}`],
    // Every build but production stays out of search results (a preview URL, a local build), on top of
    // each page's meta robots (robotsFor, context.js).
    ...(isProduction(env) ? [] : [['X-Robots-Tag', 'noindex']]),
  ]],
  // Content-hashed files (assets.js writeHashed): a changed file gets a new name, so a browser may keep one for good.
  // A splat matches slashes too, so these would also take a .js, .css or .json file under /assets/fonts/; that folder
  // holds only fonts and their licenses, and a test checks every built file against the rule.
  ...['js', 'css', 'json'].map((ext) => [`/assets/*.${ext}`, [['Cache-Control', IMMUTABLE]]]),
  // Fixed names whose content can change in place: kept a week, then checked again.
  ['/assets/fonts/*', [['Cache-Control', WEEK]]],
  ['/favicon.svg', [['Cache-Control', WEEK]]],
];

// The _headers text for a build. env: the build's PP_ENV.
export function headersFile({ env } = {}) {
  const blocks = rulesFor(env).map(([path, set]) => [path, ...set.map(([name, value]) => `  ${name}: ${value}`)].join('\n'));
  return `# Written by pipeline/site/headers.js. Cloudflare reads this file and does not serve it.\n${blocks.join('\n\n')}\n`;
}

// A header name is an HTTP token.
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const escapeRegExp = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

// A rule's pattern as Cloudflare matches it: whole, against the request's path, with one splat (*) at most, matching
// any characters, slashes included. headersFor takes a path, so an absolute URL rule (https://host/...) is refused.
// Cloudflare's :placeholders are not supported (this file writes none), so a path with one is refused too.
function matcher(path, where) {
  if (!path.startsWith('/')) throw new RangeError(`${where}: a rule must be a path starting with "/", not "${path}"`);
  const parts = path.split('*');
  if (parts.length > 2) throw new RangeError(`${where}: Cloudflare allows one splat in a rule, "${path}" has more`);
  if (/:[A-Za-z]/.test(path)) throw new RangeError(`${where}: ":placeholder" paths are not supported, "${path}"`);
  return new RegExp(`^${parts.map(escapeRegExp).join('.*')}$`);
}

// _headers text as rules [{ path, pattern, set: [[name, value]] }], in file order; pattern is the path's RegExp. A
// line that starts with whitespace sets a header ("Name: value") for the rule above it. Blank lines and # comments are
// skipped. Anything Cloudflare would not read as meant, or that this reader does not support (detaching a header with
// "! Name", or a value Cloudflare would fill with the splat's text, ":splat"), throws, naming the line.
export function parseHeaders(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const where = `_headers line ${i + 1}`;
    if (!/^\s/.test(raw)) {
      const pattern = matcher(line, where);
      if (out.some((r) => r.path === line)) throw new RangeError(`${where}: "${line}" is already a rule`);
      out.push({ path: line, pattern, set: [] });
      return;
    }
    const rule = out.at(-1);
    if (!rule) throw new RangeError(`${where}: a header before any rule`);
    if (line.startsWith('!')) throw new RangeError(`${where}: detaching a header ("! Name") is not supported, got "${line}"`);
    const set = /^([^:\s]+):\s*(.*)$/.exec(line);
    if (!set || !TOKEN.test(set[1])) throw new RangeError(`${where}: expected "Name: value", got "${line}"`);
    if (set[2].includes(':splat')) throw new RangeError(`${where}: filling ":splat" into a value is not supported, got "${line}"`);
    rule.set.push([set[1], set[2]]);
  });
  return out;
}

// The headers the rules give a response to a request path, names lowercased. Every matching rule applies, in file
// order, and a header set again joins the earlier value with a comma. They go on every response, whatever its status,
// as the deployed Worker sends them (seen 2026-10-25): a redirect and a 404 carry them too, Cache-Control included, so
// a missing hashed file's 404 says immutable for a year. That is accepted: a hashed name is never reused for other
// content, so a cached 404 can only hide a file that comes back unchanged after a later deploy removed it. (A
// Cloudflare preview URL sends none of them on a 404.) Cloudflare's own defaults (Cache-Control, ETag, Content-Type)
// are not part of the result.
export function headersFor(rules, pathname) {
  const headers = new Map();
  for (const { pattern, set } of rules) {
    if (!pattern.test(pathname)) continue;
    for (const [name, value] of set) {
      const key = name.toLowerCase();
      headers.set(key, headers.has(key) ? `${headers.get(key)}, ${value}` : value);
    }
  }
  return Object.fromEntries(headers);
}
