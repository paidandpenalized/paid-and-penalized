// Shared test helpers for the page build.
import { mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoFiles, writeFileMkdir } from '../files.js';
import { tags, textOf } from '../site/html.js';
import { createSiteServer, listen, stop } from '../site/serve.js';

// The assets page() needs (web/render/layout.js), for a page rendered outside a build: the CSS and script paths, and the
// shell's facts (what a build computes once and hands every page: ctx.assets.shell). Invented numbers and no hospital.
// Pass css, sheets (the sites' stylesheets of their own, by name: HACRP's and the hub's, which each site's pages link), js (merged over the
// shell, sticky-header and family-search scripts a page can load, and the home page's story) or shell (merged over the
// facts below) to change a part.
export const testAssets = ({ css = '/assets/site.test.css', sheets = { hacrp: '/assets/hacrp.test.css', hub: '/assets/hub.test.css' }, js = {}, shell = {} } = {}) => ({
  css,
  sheets,
  js: { shell: '/assets/shell.test.js', topbar: '/assets/topbar.test.js', 'hub-search': '/assets/hub-search.test.js', 'hub-home': '/assets/hub-home.test.js', 'hub-hospital': '/assets/hub-hospital.test.js', ...js },
  shell: {
    fy: 2026,
    hospitals: 3,
    changed: '2026-10-22',
    programs: {
      hrrp: { dollars: -2000000, cutN: 2 },
      hacrp: { dollars: -1000000, cutN: 1 },
      hvbp: { moved: 500000, net: -100000 },
    },
    hubUrl: '/assets/hub-hospitals.test.json',
    ...shell,
  },
});
export const ASSETS = testAssets();

// A rendered page's shell, as tests read it (web/render/shell.js): the family's header, the footer, and the followed
// hospital's chip when it shows (null when it is hidden or absent).
export const headerOf = (page) => /<header class="topbar fam"[\s\S]*?<\/header>/.exec(page)[0];
export const footerOf = (page) => /<footer class="foot">[\s\S]*?<\/footer>/.exec(page)[0];
export const chipOf = (page) => /<p class="chip" data-chip>[\s\S]*?<\/p>/.exec(page)?.[0] ?? null;

// Runs fn(dir) in a fresh folder under the system temp directory and removes it afterwards, pass or fail.
export function withTemp(prefix, fn) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return Promise.resolve().then(() => fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// Writes each { path: text } of files under dir, making its folders first.
export function writeTree(dir, files) {
  for (const [path, text] of Object.entries(files)) writeFileMkdir(join(dir, path), text);
}

// Runs fn(port) against the local server (serve.js) for root, on a free loopback port, and closes it afterwards.
export async function withServer(root, fn) {
  const server = createSiteServer(root);
  const port = await listen(server);
  try {
    return await fn(port);
  } finally {
    await stop(server);
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

// Words that promise a program, a page or a date to come: "coming", "soon", "sooner", "launch", "launches", and the
// words that call a page a stand-in for a later one ("interim", "temporary", "temporarily", "for now"). A program the site
// has no page for is "under consideration" and its page "not built yet"; nothing says one will arrive, or when.
// web/test/house-words.test.js runs it over every copy file, hub/test/promises.test.js over rendered pages.
export const FUTURE_WORDS = /\bcoming\b|\bsoon(er)?\b|\blaunch(es)?\b|\binterim\b|\btemporar(y|ily)\b|\bfor now\b/i;

// The words a page shows or reads aloud: its text (comments, scripts and styles dropped) and the attributes a browser
// shows on hover or a screen reader says (title, aria-label, alt, placeholder) or a search result shows (a meta's content).
const SPOKEN = ['title', 'aria-label', 'alt', 'placeholder', 'content'];
export const readerWords = (page) => [textOf(page), ...[...tags(page, { having: SPOKEN })].flatMap(({ attrs }) => SPOKEN.filter((a) => a in attrs).map((a) => attrs[a]))].join(' \n ');
