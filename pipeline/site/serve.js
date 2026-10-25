// make serve: preview dist/ at http://127.0.0.1:8080/. Local use only; it binds to the loopback address.
// A directory serves its index.html, a directory path without its trailing slash redirects to it, and anything
// else missing gets 404.html with status 404. Paths never resolve outside the served folder. Every response carries
// the headers the folder's _headers gives its path (headers.js headersFor), as Cloudflare sends them, so a local
// browser run meets the real CSP. Like Cloudflare, the server never serves _headers itself, in any case.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { DIST_DIR, isMain } from '../files.js';
import { NOT_FOUND_PATH, fileFor, isServed, lookup } from './address.js';
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
  // The folder's _headers rules, read on every request like any other file, so a rebuild under a running server is
  // picked up; none when there is no file. A malformed file throws here at start, and later gets a 500.
  const readRules = () => (isFile(base + '_headers') ? parseHeaders(readFileSync(base + '_headers', 'utf8')) : []);
  readRules();

  return createServer((req, res) => {
    let url, path, rules;
    try {
      rules = readRules();
    } catch (err) {
      // A parse error names the line; a file that can't be read names only the error's code, never a local path.
      return res.writeHead(500, TEXT).end(`dist/_headers: ${err.code ? `cannot be read (${err.code})` : err.message}`);
    }
    // Matched on the path as the request sent it (percent-encoded), as Cloudflare matches it.
    const reply = (status, headers, body) => res.writeHead(status, { ...headers, ...headersFor(rules, url?.pathname ?? '/') }).end(body);
    const send = (status, file) => reply(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }, readFileSync(file));
    const notFoundFile = base + fileFor(NOT_FOUND_PATH);
    const notFound = () => (isFile(notFoundFile) ? send(404, notFoundFile) : reply(404, TEXT, 'not found'));
    try {
      url = new URL(req.url, 'http://localhost');
      path = decodeURIComponent(url.pathname);
    } catch {
      return reply(400, TEXT, 'bad request');
    }
    const file = normalize(join(base, path));
    if (path.includes('\0') || !file.startsWith(base) || !isServed(file.slice(base.length))) return notFound();
    const onDisk = (p) => join(base, p);
    const found = lookup(path, { isFile: (p) => isFile(onDisk(p)), isDir: (p) => isDir(onDisk(p)) });
    // One leading slash, so the redirect can't become a protocol-relative URL to another host.
    if (found.status === 301) return reply(301, { location: `${url.pathname.replace(/^\/+/, '/')}/${url.search}` });
    return found.status === 200 ? send(200, onDisk(found.file)) : notFound();
  });
}

// Starts a server on a free loopback port; resolves its port.
export const listen = (server) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

// Stops a server, ending its kept-alive connections (a browser's would otherwise hold the close open).
export const stop = (server) => new Promise((resolve) => {
  server.close(resolve);
  server.closeAllConnections();
});

if (isMain(import.meta.url)) {
  const root = DIST_DIR;
  if (!isDir(root)) {
    console.error('dist/ not found: run `make build` first');
    process.exit(1);
  }
  createSiteServer(root).listen(8080, '127.0.0.1', () => console.log('serving dist/ at http://127.0.0.1:8080/'));
}
