// make serve: preview dist/ at http://127.0.0.1:8080/. Local use only; it binds to the loopback address.
// A directory serves its index.html, a directory path without its trailing slash redirects to it, and anything
// else missing gets 404.html with status 404. Paths never resolve outside the served folder. Every response carries
// the headers the folder's _headers gives its path (headers.js), as Cloudflare sends them, so a local browser run
// meets the real CSP; like Cloudflare, the server never serves _headers itself.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../files.js';
import { headersFor, parseHeaders } from './headers.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

const TEXT = { 'content-type': 'text/plain; charset=utf-8' };

export function createSiteServer(root) {
  const base = normalize(root + sep);
  // Read once: the file changes only with a build, and a rebuild means a restart.
  const rules = isFile(base + '_headers') ? parseHeaders(readFileSync(base + '_headers', 'utf8')) : [];

  return createServer((req, res) => {
    let url, path;
    // Matched on the path as the request sent it (percent-encoded), as Cloudflare matches it.
    const reply = (status, headers, body) => res.writeHead(status, { ...headers, ...headersFor(rules, url?.pathname ?? '/') }).end(body);
    const send = (status, file) => reply(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }, readFileSync(file));
    const notFound = () => (isFile(base + '404.html') ? send(404, base + '404.html') : reply(404, TEXT, 'not found'));
    try {
      url = new URL(req.url, 'http://localhost');
      path = decodeURIComponent(url.pathname);
    } catch {
      return reply(400, TEXT, 'bad request');
    }
    const file = normalize(join(base, path));
    if (path.includes('\0') || !file.startsWith(base) || file === base + '_headers') return notFound();
    if (isDir(file)) {
      // One leading slash, so the redirect can't become a protocol-relative URL to another host.
      if (!path.endsWith('/')) return reply(301, { location: `${url.pathname.replace(/^\/+/, '/')}/${url.search}` });
      return isFile(join(file, 'index.html')) ? send(200, join(file, 'index.html')) : notFound();
    }
    return isFile(file) ? send(200, file) : notFound();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = REPO_ROOT + 'dist';
  if (!isDir(root)) {
    console.error('dist/ not found: run `make build` first');
    process.exit(1);
  }
  createSiteServer(root).listen(8080, '127.0.0.1', () => console.log('serving dist/ at http://127.0.0.1:8080/'));
}
