// The page shell every page renders through: head metadata, skip link, header (the family's masthead, or a program
// site's top bar: programHeader), <main>, footer, scripts. The body supplies the page's one <h1>; the header has none.
import { has } from '../../engine/js/has.js';
import { COPY } from '../copy.js';
import { SITE } from '../site.js';
import { fillCopy } from './components.js';
import { html, jsonText, raw } from './html.js';

// The byline's profile (the About page links it too).
export const LINKEDIN = 'https://www.linkedin.com/in/dalton-haslam';
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
// The fonts a page preloads (files in web/fonts), by default: the headline face, the body face and IBM Plex Mono 400
// (tables, facts and place lines). A page whose first screen shows another face passes its own list (preloadFonts):
// a hospital page swaps in the mono 700 of its hero number.
export const PRELOAD_FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400']);
const FONT_NAME = /^[a-z0-9-]+$/;

// The hidden words a link that opens a new tab carries, for a screen reader.
export const newTab = html`<span class="vh">${COPY.newTab}</span>`;

const byline = html`<p class="byline">${COPY.bylineLead} <a href="${LINKEDIN}" target="_blank" rel="noopener"><span class="nw">${COPY.bylineName}</span>${newTab}</a></p>`;
const themeToggle = html`<button type="button" class="theme-toggle" aria-pressed="false" hidden>${COPY.themeToggle}</button>`;

// The family's header (the hub's pages): the wordmark, the byline, the theme toggle.
const header = html`<header class="masthead">
  <div class="wrap masthead__row">
    <a class="wordmark" href="/">${COPY.wordmarkLead} <span class="wordmark__pen">${COPY.wordmarkPen}</span></a>
    ${byline}
    ${themeToggle}
  </div>
</header>`;

// A program site's header, after Thirty Day Readmissions' top bar. Row one: the family's small mark (to /), the
// program's name with its edition tag in red (to the program page), the search (markup the site supplies; '' for
// none) and the theme toggle. Row two: the numbered section nav, the current item (current: its id, or null)
// marked aria-current, then the byline. Markup order is the visual and tab order at every width.
//   name, href, tag  the program's name, its page and its edition tag ("HACRP · FY2026")
//   nav     [{ id, label, href }], numbered in order
export function programHeader({ name, href, tag, nav, current = null, search = '' }) {
  if (!name || !href || !tag || !Array.isArray(nav) || !nav.length) throw new TypeError('programHeader: name, href, tag and nav are required');
  if (current !== null && !nav.some((item) => item.id === current)) throw new RangeError(`programHeader: no nav item "${current}"`);
  return html`<header class="topbar">
  <div class="wrap topbar__row">
    <a class="pp-mark" href="/">${COPY.markLead}<span class="pp-mark__pen">${COPY.markPen}</span><span class="vh"> ${COPY.markHome}</span></a>
    <a class="program-mark" href="${href}"><span class="wordmark__name">${name}</span> <span class="wordmark__tag">${tag}</span></a>
    <div class="topbar__search">${search}</div>
    ${themeToggle}
  </div>
  <div class="wrap topbar__sub">
    <nav class="nav" aria-label="${COPY.navLabel}"><ol>${nav.map((item, i) => html`<li><a href="${item.href}" data-nav="${item.id}"${item.id === current ? html` aria-current="true"` : ''}><span class="nav__num">${String(i + 1)}</span>${item.label}</a></li>`)}</ol></nav>
    ${byline}
  </div>
</header>`;
}

// The pages' site: the family's own pages are 'hub'; a program's are its key in SITE.sites. siteConfig is that
// entry (null for the hub) and throws on anything else; siteName is the name the feedback form is prefilled with.
const HUB = 'hub';
const NOT_FOUND_PATH = '/404.html';
function siteConfig(site) {
  if (site === HUB) return null;
  if (typeof site === 'string' && has(SITE.sites, site)) return SITE.sites[site];
  throw new RangeError(`page: site must be "${HUB}" or one of ${Object.keys(SITE.sites).join(', ')}, got ${JSON.stringify(site)}`);
}
const siteName = (site) => siteConfig(site)?.title ?? SITE.name;

// The feedback form's address with its two questions prefilled, built at page-build time so it works without
// scripts. pageUrl: the page's canonical address, passed through encodeURIComponent whole (a page's own query
// string stays inside the one value); omitted for a page with no address of its own (the not-found page).
export function feedbackHref({ siteName: name, pageUrl } = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('feedbackHref: siteName is required');
  if (pageUrl !== undefined && (typeof pageUrl !== 'string' || !pageUrl)) throw new TypeError('feedbackHref: pageUrl must be a non-empty string');
  const { url, siteEntry, pageEntry } = SITE.feedback;
  const answers = [[siteEntry, name], ...(pageUrl === undefined ? [] : [[pageEntry, pageUrl]])];
  return `${url}?${answers.map(([entry, answer]) => `${entry}=${encodeURIComponent(answer)}`).join('&')}`;
}

// The banner a program site's pages carry while SITE.sites.<id>.maintenance names a release it has not been updated
// for; '' while the flag is null, and always for the hub. The release name comes from the config and is escaped as
// any value is. role="status" announces it politely once, and it sits above <main>, below the header.
export function maintenanceBanner(site) {
  const config = siteConfig(site);
  if (!config || config.maintenance === null) return '';
  const release = config.maintenance;
  if (typeof release !== 'string' || !release || release !== release.trim()) {
    throw new TypeError(`site "${site}": maintenance must be null or a non-empty trimmed release name, got ${JSON.stringify(release)}`);
  }
  return html`<div class="notice" role="status">
  <div class="wrap">
    <p>${fillCopy(COPY, 'maintenance', { release })}</p>
  </div>
</div>
`;
}

// The footer: what the data is and is not (the affiliation and Terms lines), the credit and license, then the
// feedback link (with the warning beside it) and the site's policy pages.
function footer({ name, path }) {
  const feedback = feedbackHref({ siteName: name, pageUrl: path === NOT_FOUND_PATH ? undefined : SITE.origin + path });
  return html`<footer class="foot">
  <div class="wrap foot__row">
    <div class="foot__text">
      <p>${COPY.affiliation}</p>
      <p>${COPY.termsShort} <a href="/terms/">${COPY.termsLink}</a></p>
    </div>
    <ul class="foot__meta" role="list">
      <li>${COPY.builtWith}</li>
      <li>${COPY.licenseLead} <a href="${LICENSE}" target="_blank" rel="license noopener">CC BY 4.0${newTab}</a></li>
    </ul>
    <ul class="foot__meta foot__links" role="list">
      <li class="foot__feedback"><a href="${feedback}" target="_blank" rel="noopener">${COPY.feedback}${newTab}</a> <span class="foot__note">${COPY.feedbackWarning}</span></li>
      <li><a href="/about/">${COPY.about}</a></li>
      <li><a href="/methods/">${COPY.methods}</a></li>
      <li><a href="/privacy/">${COPY.privacy}</a></li>
      <li><a href="/corrections/">${COPY.corrections}</a></li>
      <li><a href="/accessibility/">${COPY.accessibility}</a></li>
    </ul>
  </div>
</footer>`;
}

// A link's card where it is shared (Open Graph, and X's summary card, which falls back to Open Graph): the page's
// title, description and canonical URL, as text only (no image). Harmless on a noindex page. The family's front page
// and each program's hub page are a website; every other page is an article.
const WEBSITES = new Set(['/', ...Object.values(SITE.sites).map((s) => s.path)]);
const socialTags = ({ title, description, url, type }) => html`<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">`;

// body: Safe markup (a plain string is escaped, never trusted). scripts: the page's module URLs, loaded in order
// after the theme script: a page with a figure (web/charts/figure.js) lists assets.js.figure, one with the citation
// block (components.js) assets.js.cite, then its own. preloadFonts: font file names to preload (PRELOAD_FONTS).
// topbar: a program site's header (programHeader), in place of the family's masthead.
// site: 'hub' for the family's own pages, else the program's key in SITE.sites (required): it names the site in the
// feedback link and says whose maintenance banner the page carries.
export function page({ title, description, path, robots, body, scripts = [], jsonLd = null, assets, preloadFonts = PRELOAD_FONTS, topbar = null, site }) {
  if (!title || !description || !body) throw new TypeError('page: title, description and body are required');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new RangeError(`page: path must start with "/", got "${path}"`);
  if (!assets?.css || !assets.js?.theme) throw new TypeError('page: assets must hold the CSS and theme script paths');
  if (!scripts.every((src) => typeof src === 'string' && src)) throw new TypeError('page: every script must be a path');
  if (!preloadFonts.every((f) => typeof f === 'string' && FONT_NAME.test(f))) throw new TypeError('page: every preloaded font must be a font file name');
  const name = siteName(site);
  const modules = [assets.js.theme, ...scripts];
  const url = SITE.origin + path;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
${robots ? html`<meta name="robots" content="${robots}">` : ''}
${socialTags({ title, description, url, type: WEBSITES.has(path) ? 'website' : 'article' })}
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${preloadFonts.map((f) => html`<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>
`)}<link rel="stylesheet" href="${assets.css}">
${jsonLd ? raw(`<script type="application/ld+json">${jsonText(jsonLd)}</script>`) : ''}
</head>
<body>
<a class="skip" href="#main">${COPY.skip}</a>
${topbar ?? header}
${maintenanceBanner(site)}<main id="main">
${body}
</main>
${footer({ name, path })}
${modules.map((src) => html`<script type="module" src="${src}"></script>
`)}</body>
</html>
`.toString();
}
