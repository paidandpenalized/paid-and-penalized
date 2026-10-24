// The one rule for where a page lives in the built folder and the address it is served at, shared by the build (emit),
// the local server, and the checks that read dist/: a path ending in "/" is its folder's index.html, any other path is
// its own file, and a folder asked for without its "/" is redirected to it (as Cloudflare serves static assets).

// The not-found page: served, with status 404, at every path with no file (Cloudflare's "404-page" handling in
// wrangler.jsonc reads the root 404.html, and so does serve.js).
export const NOT_FOUND_PATH = '/404.html';

// The file, relative to the built folder, that a site path is written to and served from: '/a/' is 'a/index.html',
// '/' is 'index.html', '/404.html' is '404.html'.
export const fileFor = (path) => (path.endsWith('/') ? `${path}index.html` : path).replace(/^\/+/, '');

// The address a file in the built folder is served at, fileFor's inverse: 'a/index.html' is '/a/', 'index.html' is '/',
// any other file keeps its name ('404.html' is '/404.html').
export const addressOf = (file) => `/${file === 'index.html' ? '' : file.endsWith('/index.html') ? file.slice(0, -'index.html'.length) : file}`;

// How a request for a site path (decoded, from the root) is answered: { status: 200, file } with the file as fileFor
// names it, { status: 301 } for a folder asked for without its "/" (the server sends it to the path with one), or
// { status: 404 }. isFile and isDir answer for a site path; a folder with no index.html is a 404.
export function lookup(path, { isFile, isDir }) {
  if (isDir(path)) {
    if (!path.endsWith('/')) return { status: 301 };
    return isFile(`${path}index.html`) ? { status: 200, file: fileFor(path) } : { status: 404 };
  }
  return isFile(path) ? { status: 200, file: fileFor(path) } : { status: 404 };
}

// Whether a file in the built folder is ever served: every one but _headers (in any letter case), which Cloudflare reads
// its response headers from and never serves, and nor does serve.js.
export const isServed = (file) => file.toLowerCase() !== '_headers';

// lookup's isFile and isDir over a list of the built folder's files ('/'-separated, from it, as filesUnder lists them),
// for the checks that read dist/ without a server: a site path is a file when the list has it and it is served, and a
// folder when it holds one of the files ('/' is the built folder itself).
export function filesAt(files) {
  const names = new Set(files);
  const folders = new Set(files.flatMap((file) => file.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/')))).add('');
  return { isFile: (p) => names.has(p.slice(1)) && isServed(p.slice(1)), isDir: (p) => folders.has(p.slice(1).replace(/\/$/, '')) };
}
