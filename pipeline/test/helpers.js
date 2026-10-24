// Shared test helpers for the page build.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { repoFiles } from '../files.js';
import { createSiteServer } from '../site/serve.js';

// The asset paths page() needs (web/render/layout.js), for a page rendered outside a build.
export const ASSETS = { css: '/assets/site.test.css', js: { theme: '/assets/theme.test.js' } };

// Runs fn(dir) in a fresh folder under the system temp directory and removes it afterwards, pass or fail.
export function withTemp(prefix, fn) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return Promise.resolve().then(() => fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// Every regular file under dir, as a path from it (with the platform's separator).
export const filesUnder = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(dir, join(entry.parentPath, entry.name)));

// Runs fn(port) against the local server (serve.js) for root, on a free loopback port, and closes it afterwards.
export async function withServer(root, fn) {
  const server = createSiteServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(server.address().port);
  } finally {
    server.close();
  }
}

// A raw GET to the local server, so the path reaches it exactly as written (no client-side normalising of ..).
// headers: the response's, names lowercased.
export function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, type: res.headers['content-type'], location: res.headers.location, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Every copy file (web/copy.js, hub/copy.js and each site's), tracked or not yet added, from one listing of the repo.
let copyList = null;
export const copyFiles = () => (copyList ??= repoFiles('', { untracked: true }).filter((p) => /^(web|hub|sites)\/(.+\/)?copy\.js$/.test(p)));
