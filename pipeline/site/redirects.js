// The site's short links, as Cloudflare's _redirects file for Workers static assets
// (https://developers.cloudflare.com/workers/static-assets/redirects/), which the build writes to dist/_redirects; and
// the parser and matcher that read the file back the way Cloudflare does, for the local server (serve.js) and the launch
// check. They read the part of Cloudflare's grammar this file uses: static rules to an absolute URL.
//
// Cloudflare answers a request that matches a rule before it looks for a file, so a rule's source hides any page at
// the same address (a test checks that none is there). A source is matched whole against the request's path as sent
// (percent-encoded) and in its letter case, with no trailing-slash folding: "/a" and "/a/" each need a rule of their
// own. The request's query string is carried over when the destination has none. The redirect gets the headers
// _headers gives its path, like any other response (asset-worker in wrangler 4.151.0, the version wrangler.jsonc names).

// The Inpatient-Only lookup, a separate site, at its short address. 302, not 301: these move when the lookup moves under
// /ipo/ on this site, and a browser keeps a 301 for good. Each rule goes away then.
const IPO = 'https://inpatient-only-lookup.vercel.app/';
const SHORT_LINKS = [
  ['/ipo', IPO],
  ['/ipo/stake', `${IPO}revenue-at-stake/`],
];
const STATUS = 302;

// The rules in file order, [{ from, to, status }]: each short link, without and with its "/".
export const REDIRECTS = SHORT_LINKS.flatMap(([from, to]) => [from, `${from}/`].map((path) => ({ from: path, to, status: STATUS })));

// The _redirects text.
export function redirectsFile(rules = REDIRECTS) {
  const lines = rules.map(({ from, to, status }) => `${from} ${to} ${status}`);
  return `# Written by pipeline/site/redirects.js. Cloudflare reads this file and does not serve it.\n${lines.join('\n')}\n`;
}

// The redirect codes Cloudflare takes (200, a rewrite, is refused here: this file writes none).
const CODES = new Set([301, 302, 303, 307, 308]);

// _redirects text as rules [{ from, to, status }], in file order. A line is "source destination [code]" (302 when
// the code is left out); blank lines and # comments are skipped. Anything Cloudflare would skip or read otherwise than
// meant, or that this reader does not support (a splat, a :placeholder, a source with a host, a destination that is
// not an absolute http(s) URL), throws, naming the line.
export function parseRedirects(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const where = `_redirects line ${i + 1}`;
    const tokens = line.replace(/\s+#.*$/, '').split(/\s+/);
    if (tokens.length < 2 || tokens.length > 3) throw new RangeError(`${where}: expected "source destination [code]", got "${line}"`);
    const [from, to, code = '302'] = tokens;
    if (!from.startsWith('/')) throw new RangeError(`${where}: a source must be a path starting with "/", not "${from}"`);
    if (from.includes('*') || /:[A-Za-z]/.test(from)) throw new RangeError(`${where}: splats and ":placeholder" sources are not supported, "${from}"`);
    if (!/^https?:\/\/[^/]/.test(to)) throw new RangeError(`${where}: a destination must be an absolute http(s) URL, not "${to}"`);
    const status = Number(code);
    if (!CODES.has(status)) throw new RangeError(`${where}: the code must be one of ${[...CODES].join(', ')}, not "${code}"`);
    if (out.some((r) => r.from === from)) throw new RangeError(`${where}: "${from}" is already a rule`);
    out.push({ from, to, status });
  });
  return out;
}

// How the rules answer a request: { status, location } for the rule whose source is the path (as sent, percent-encoded),
// or null. location is the destination with the request's query string (search, "?..." or "") when it has none of its
// own, as Cloudflare builds it.
export function redirectFor(rules, pathname, search = '') {
  const rule = rules.find((r) => r.from === pathname);
  if (!rule) return null;
  const to = new URL(rule.to);
  const bare = to.href.slice(0, to.href.length - to.search.length - to.hash.length);
  return { status: rule.status, location: `${bare}${to.search || search}${to.hash}` };
}
