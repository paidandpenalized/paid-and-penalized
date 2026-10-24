// The one rule for where a page lives in the built folder and the address it is served at, shared by the build (emit),
// the local server, and the checks that read dist/: a path ending in "/" is its folder's index.html, any other path is
// its own file, and a folder asked for without its "/" is redirected to it (as Cloudflare serves static assets).

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
