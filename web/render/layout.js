// The page every page renders through: head metadata, skip link, the family's header and footer (render/shell.js),
// <main>, scripts. The body supplies the page's one <h1>; the header and footer have none.
import { COPY } from '../copy.js';
import { SITE, siteOf } from '../site.js';
import { CARD_SIZE, SHARE_CARDS, shareCardOf } from '../share-card.js';
import { html, jsonText, raw } from './html.js';
import { familyFooter, familyHeader } from './shell.js';

// A link to another site, opening in a new tab (render/shell.js, which the footer's links use too).
export { externalLink } from './shell.js';

// The fonts a page preloads (files in web/fonts), by default: the headline face, the body face and IBM Plex Mono 400
// (tables, facts and place lines). A page whose first screen shows another face passes its own list (preloadFonts):
// a hospital page swaps in the mono 700 of its hero number.
export const PRELOAD_FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400']);
const FONT_NAME = /^[a-z0-9-]+$/;

// The feedback form's address with its two questions prefilled, built at page-build time so it works without
// scripts. pageUrl: the page's canonical address, passed through encodeURIComponent whole (a page's own query
// string stays inside the one value); null or omitted for a page with no address of its own (the not-found page).
export function feedbackHref({ siteName: name, pageUrl = null } = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('feedbackHref: siteName is required');
  if (pageUrl !== null && (typeof pageUrl !== 'string' || !pageUrl)) throw new TypeError('feedbackHref: pageUrl must be a non-empty string');
  const { url, siteEntry, pageEntry } = SITE.feedback;
  const answers = [[siteEntry, name], ...(pageUrl === null ? [] : [[pageEntry, pageUrl]])];
  return `${url}?${answers.map(([entry, answer]) => `${entry}=${encodeURIComponent(answer)}`).join('&')}`;
}

// The feedback form's address for a page, the one prefill the footer and a page's own link use: the page's site by
// name (siteOf(path); the family's on the hub's pages) and its canonical address (address: by default the origin and
// its path; null for a page with none of its own).
export const feedbackFor = ({ path, address = SITE.origin + path }) => feedbackHref({ siteName: siteOf(path)?.title ?? SITE.name, pageUrl: address });

// A link's card where it is shared (Open Graph, and X's large-image card, which falls back to Open Graph for all but
// its own card type and image): the page's title, description and canonical URL, and its share card (web/share-card.js:
// its site's own, else the family's), an absolute URL to the build's content-hashed copy, with its size and alt text.
// Harmless on a noindex page. The family's front page and each program's hub page are a website; every other page is
// an article.
const WEBSITES = new Set(['/', ...Object.values(SITE.sites).map((s) => s.path)]);
const socialTags = ({ title, description, url, type, image, alt }) => html`<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${url === null ? '' : html`<meta property="og:url" content="${url}">
`}<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${CARD_SIZE.width}">
<meta property="og:image:height" content="${CARD_SIZE.height}">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">`;

// body: Safe markup (a plain string is escaped, never trusted). assets: the build's paths (css, the shared stylesheet;
// sheets, the stylesheets of their own by name; js by entry name; cards, the share cards by id, web/share-card.js) and
// the shell's facts (assets.shell: what the header and footer show on every page, computed once by the build). Every
// page runs the theme's classic script in its head, before the stylesheets (web/client/theme.js: the reader's
// light/dark choice for the visit, on <html> before the first paint). Its modules start with the shell's script, then
// the sticky header's (topbar.js), since every page wears that header. scripts: the page's own module URLs, loaded in order after those two: a page with a figure
// (web/charts/figure.js) lists assets.js.figure, one with the citation block (components.js) assets.js.cite, then its
// own. preloadFonts: font file names to preload (PRELOAD_FONTS). sheets: the names of the stylesheets of their own the
// page links after the shared one, in order (a hub page's: ['hub']); render-blocking, as the shared one is, so the page
// never paints without them.
// The shell's parts (render/shell.js familyHeader): program, the current program's id (null on the family's own pages);
// hospital, the followed hospital ({ ccn, name, net, inTdr }) on a hospital's page, else null; sections, a program's
// section menu ([{ id, label, href }], or null for none) and current, the section to mark (an id, or null); search, the
// bar's search box (searchForm markup, or '' for none). The page's site, from its path (siteOf), names the site in the
// footer's feedback link (feedbackFor).
// address: the page's canonical address, by default the origin and its path; null for a page with none of its own
// (the not-found page, served at every missing address), which then has no canonical link, og:url or page prefill.
export function page({ title, description, path, address = SITE.origin + path, robots, body, scripts = [], sheets = [], jsonLd = null, assets, preloadFonts = PRELOAD_FONTS, program = null, hospital = null, sections = null, current = null, search = '' }) {
  if (!title || !description || !body) throw new TypeError('page: title, description and body are required');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new RangeError(`page: path must start with "/", got "${path}"`);
  if (!assets?.css || !assets.js?.theme || !assets.js.shell || !assets.js.topbar) throw new TypeError('page: assets must hold the CSS, and the theme, shell and sticky-header script paths');
  if (!assets.shell) throw new TypeError('page: assets must hold the shell facts (the build computes them once, as ctx.assets.shell)');
  const card = shareCardOf(path);
  if (!assets.cards?.[card]) throw new TypeError(`page: assets.cards must hold the "${card}" share card's path`);
  if (!scripts.every((src) => typeof src === 'string' && src)) throw new TypeError('page: every script must be a path');
  if ([assets.js.theme, assets.js.shell, assets.js.topbar].some((src) => scripts.includes(src))) throw new TypeError('page: every page loads the theme, shell and sticky-header scripts; leave them out of scripts');
  if (!preloadFonts.every((f) => typeof f === 'string' && FONT_NAME.test(f))) throw new TypeError('page: every preloaded font must be a font file name');
  const stylesheets = [assets.css, ...sheets.map((name) => {
    if (!Object.hasOwn(assets.sheets ?? {}, name)) throw new TypeError(`page: no stylesheet "${name}" in assets.sheets`);
    return assets.sheets[name];
  })];
  const modules = [assets.js.shell, assets.js.topbar, ...scripts];
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${address === null ? '' : html`<link rel="canonical" href="${address}">
`}${robots ? html`<meta name="robots" content="${robots}">` : ''}
${socialTags({ title, description, url: address, type: WEBSITES.has(path) ? 'website' : 'article', image: SITE.origin + assets.cards[card], alt: SHARE_CARDS[card] })}
<meta name="color-scheme" content="light dark">
<script src="${assets.js.theme}"></script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${preloadFonts.map((f) => html`<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>
`)}${stylesheets.map((href) => html`<link rel="stylesheet" href="${href}">
`)}${jsonLd ? raw(`<script type="application/ld+json">${jsonText(jsonLd)}</script>`) : ''}
</head>
<body>
<a class="skip" href="#main">${COPY.skip}</a>
${familyHeader({ path, program, hospital, sections, current, search, shell: assets.shell })}
<main id="main">
${body}
</main>
${familyFooter({ feedback: feedbackFor({ path, address }), shell: assets.shell })}
${modules.map((src) => html`<script type="module" src="${src}"></script>
`)}</body>
</html>
`.toString();
}
