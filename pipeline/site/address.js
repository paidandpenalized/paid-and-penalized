// The one rule for where a page lives in the built folder and the address it is served at, shared by the build (emit),
// the local server, and the checks that read dist/: a path ending in "/" is its folder's index.html, any other path is
// its own file, and a page is served without its ".html", as Cloudflare's "auto-trailing-slash" handling of static
// assets serves it (wrangler.jsonc).

// Where the not-found page is written: the root 404.html, which is served, with status 404, at every path with no file
// (Cloudflare's "404-page" handling in wrangler.jsonc reads it, and so does serve.js). Its own address is
// NOT_FOUND_ADDRESS.
export const NOT_FOUND_PATH = '/404.html';

// The file, relative to the built folder, that a site path is written to: '/a/' is 'a/index.html', '/' is
// 'index.html', '/404.html' is '404.html'.
export const fileFor = (path) => (path.endsWith('/') ? `${path}index.html` : path).replace(/^\/+/, '');

// The address a file in the built folder is served at (lookup's answer): a folder's index.html is the folder with its
// "/" ('a/index.html' is '/a/', 'index.html' is '/'), any other page its name without ".html" ('404.html' is '/404'),
// and any other file keeps its name.
export const addressOf = (file) => `/${file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`;

// The not-found page's own address: '/404'.
export const NOT_FOUND_ADDRESS = addressOf(fileFor(NOT_FOUND_PATH));

const NOT_FOUND = { status: 404 };
const served = (path) => ({ status: 200, file: path.slice(1) });
const redirect = (to) => ({ status: 307, to });

// How a request for a site path (decoded, from the root) is answered, as the deployed Worker answers it (its
// auto-trailing-slash handling, seen 2026-10-25): { status: 200, file } with the file from the built folder,
// { status: 307, to } with the site path it is sent to, or { status: 404 }. Each page is served at its address
// (addressOf) only, and each other way of asking for it is sent there: a folder without its "/", its index.html or
// index ('/a', '/a/index.html', '/a/index' go to '/a/'), and another page's name with ".html" or a "/" ('/404.html',
// '/404/' go to '/404'). Repeated slashes are sent to the path with one. Any other file is served at its own name only.
// isFile answers for a site path.
export function lookup(path, at) {
  const { isFile } = at;
  const single = path.replace(/\/{2,}/g, '/');
  if (single !== path) {
    const there = lookup(single, at);
    return there.status === 200 ? redirect(single) : there;
  }
  if (/\/index(?:\.html)?$/.test(path)) {
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    const there = lookup(folder, at);
    if (there.status !== 404) return there.status === 200 ? redirect(folder) : there;
  }
  if (path.endsWith('.html')) return isFile(path) ? redirect(path.slice(0, -'.html'.length)) : NOT_FOUND;
  if (isFile(path)) return served(path);
  if (path.endsWith('/')) {
    if (isFile(`${path}index.html`)) return served(`${path}index.html`);
    return path !== '/' && isFile(`${path.slice(0, -1)}.html`) ? redirect(path.slice(0, -1)) : NOT_FOUND;
  }
  if (isFile(`${path}.html`)) return served(`${path}.html`);
  return isFile(`${path}/index.html`) ? redirect(`${path}/`) : NOT_FOUND;
}

// Whether a file in the built folder is ever served: every one but _headers (in any letter case), which Cloudflare reads
// its response headers from and never serves, and nor does serve.js.
export const isServed = (file) => file.toLowerCase() !== '_headers';

// lookup's isFile over a list of the built folder's files ('/'-separated, from it, as filesUnder lists them), for the
// checks that read dist/ without a server: a site path is a file when the list has it and it is served.
export function filesAt(files) {
  const names = new Set(files);
  return { isFile: (p) => names.has(p.slice(1)) && isServed(p.slice(1)) };
}
