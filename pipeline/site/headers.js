// The response headers the site is served with, as Cloudflare's _headers file for Workers static assets
// (https://developers.cloudflare.com/workers/static-assets/headers/), which the build writes to dist/_headers; and
// the parser and matcher that read the file back the way Cloudflare does, for the local server (serve.js) and for
// checking the live site's headers against the file.

const DAY = 24 * 60 * 60;
const IMMUTABLE = `public, max-age=${365 * DAY}, immutable`;
const WEEK = `public, max-age=${7 * DAY}`;

// One policy for every response: nothing loads from another origin, no script runs inline, no page can be framed.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
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
    ['Content-Security-Policy', CSP],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Strict-Transport-Security', `max-age=${365 * DAY}`],
    // Every build but production stays out of search results (a preview on workers.dev, a local build), on top of
    // each page's meta robots; the same line robotsFor (context.js) draws for pages.
    ...(env === 'production' ? [] : [['X-Robots-Tag', 'noindex']]),
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

// A rule's pattern as Cloudflare matches it: whole, against the request's path; one splat (*) at most, matching any
// characters, slashes included; each :placeholder once, matching one path segment. Text matched fills :splat and
// :placeholder in a header's value. headersFor takes a path, so an absolute URL rule (https://host/...) is refused.
function matcher(path, where = path) {
  if (!path.startsWith('/')) throw new RangeError(`${where}: a rule must be a path starting with "/", not "${path}"`);
  const parts = path.split('*');
  if (parts.length > 2) throw new RangeError(`${where}: Cloudflare allows one splat in a rule, "${path}" has more`);
  const names = new Set();
  const source = parts.map((part) => escapeRegExp(part).replace(/:([A-Za-z]\w*)/g, (_, name) => {
    if (names.has(name)) throw new RangeError(`${where}: each placeholder may appear once, ":${name}" repeats`);
    names.add(name);
    return `(?<${name}>[^/]+)`;
  })).join('(?<splat>.*)');
  return new RegExp(`^${source}$`);
}

// _headers text as rules [{ path, set: [[name, value]], detach: [name] }], in file order. A line that starts with
// whitespace belongs to the rule above it: "Name: value" sets a header, "! Name" detaches one. Blank lines and #
// comments are skipped. Anything Cloudflare would not read as meant throws, naming the line.
export function parseHeaders(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const where = `_headers line ${i + 1}`;
    if (!/^\s/.test(raw)) {
      matcher(line, where);
      if (out.some((r) => r.path === line)) throw new RangeError(`${where}: "${line}" is already a rule`);
      out.push({ path: line, set: [], detach: [] });
      return;
    }
    const rule = out.at(-1);
    if (!rule) throw new RangeError(`${where}: a header before any rule`);
    const detach = /^!\s+(\S+)$/.exec(line);
    const set = /^([^:\s]+):\s*(.*)$/.exec(line);
    const name = detach?.[1] ?? set?.[1];
    if (!name || !TOKEN.test(name)) throw new RangeError(`${where}: expected "Name: value" or "! Name", got "${line}"`);
    if (detach) rule.detach.push(name);
    else rule.set.push([name, set[2]]);
  });
  return out;
}

// The headers the rules give a request path, names lowercased. Every matching rule applies, in file order: its
// detaches remove what an earlier rule set, then its headers are set, and a header set again joins the earlier value
// with a comma. Cloudflare's own defaults (Cache-Control, ETag, Content-Type) are not part of the result.
export function headersFor(rules, pathname) {
  const headers = new Map();
  for (const rule of rules) {
    const match = matcher(rule.path).exec(pathname);
    if (!match) continue;
    const fill = (value) => Object.entries(match.groups ?? {}).reduce((v, [name, text]) => v.replaceAll(`:${name}`, () => text), value);
    for (const name of rule.detach) headers.delete(name.toLowerCase());
    for (const [name, value] of rule.set) {
      const key = name.toLowerCase();
      headers.set(key, headers.has(key) ? `${headers.get(key)}, ${fill(value)}` : fill(value));
    }
  }
  return Object.fromEntries(headers);
}
