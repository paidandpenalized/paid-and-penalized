// make serve: preview dist/ at http://127.0.0.1:8080/. Local use only; it binds to the loopback address.
// A directory serves its index.html, a directory path without its trailing slash redirects to it, and anything
// else missing gets 404.html with status 404. Paths never resolve outside the served folder.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../files.js';

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

export function createSiteServer(root) {
  const base = normalize(root + sep);
  const send = (res, status, file, headers = {}) => {
    res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers });
    res.end(readFileSync(file));
  };
  const notFound = (res) => {
    if (isFile(base + '404.html')) return send(res, 404, base + '404.html');
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  };

  return createServer((req, res) => {
    let url, path;
    try {
      url = new URL(req.url, 'http://localhost');
      path = decodeURIComponent(url.pathname);
    } catch {
      return res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('bad request');
    }
    const file = normalize(join(base, path));
    if (path.includes('\0') || !file.startsWith(base)) return notFound(res);
    if (isDir(file)) {
      // One leading slash, so the redirect can't become a protocol-relative URL to another host.
      if (!path.endsWith('/')) return res.writeHead(301, { location: `${url.pathname.replace(/^\/+/, '/')}/${url.search}` }).end();
      return isFile(join(file, 'index.html')) ? send(res, 200, join(file, 'index.html')) : notFound(res);
    }
    return isFile(file) ? send(res, 200, file) : notFound(res);
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
