// The page shell every page renders through: head metadata, skip link, header (the family's masthead, or a program
// site's top bar: programHeader), <main>, footer, scripts. The body supplies the page's one <h1>; the header has none.
import { COPY } from '../copy.js';
import { SITE, siteOf } from '../site.js';
import { fillCopy } from './components.js';
import { html, jsonText, raw } from './html.js';

// The fonts a page preloads (files in web/fonts), by default: the headline face, the body face and IBM Plex Mono 400
// (tables, facts and place lines). A page whose first screen shows another face passes its own list (preloadFonts):
// a hospital page swaps in the mono 700 of its hero number.
export const PRELOAD_FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400']);
const FONT_NAME = /^[a-z0-9-]+$/;

// A link to another site: it opens in a new tab, and hidden words tell a screen reader so. text: words or markup.
// rel: the link's relations, noopener among them.
const newTab = html`<span class="vh">${COPY.newTab}</span>`;
export const externalLink = (href, text, { rel = 'noopener' } = {}) => html`<a href="${href}" target="_blank" rel="${rel}">${text}${newTab}</a>`;

const byline = html`<p class="byline">${COPY.bylineLead} ${externalLink(SITE.linkedin, html`<span class="nw">${COPY.bylineName}</span>`)}</p>`;
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

// The banner a program site's pages carry while SITE.sites.<id>.maintenance names a release it has not been updated
// for; '' while the flag is null, and always for the hub (site: null, as siteOf gives it). The release name comes from
// the config and is escaped as any value is. role="status" announces it politely once, and it sits above <main>,
// below the header.
export function maintenanceBanner(site) {
  if (!site || site.maintenance === null) return '';
  const release = site.maintenance;
  if (typeof release !== 'string' || !release || release !== release.trim()) {
    throw new TypeError(`site ${site.path}: maintenance must be null or a non-empty trimmed release name, got ${JSON.stringify(release)}`);
  }
  return html`<div class="notice" role="status">
  <div class="wrap">
    <p>${fillCopy(COPY, 'maintenance', { release })}</p>
  </div>
</div>
`;
}

// The footer: what the data is and is not (the affiliation and Terms lines), the credit and license, then the
// feedback link (with the warning beside it) and the family's other pages, in SITE.pages' order. feedback: the form's
// prefilled address (feedbackHref), the one part that differs between pages.
const FOOTER_PAGES = Object.keys(SITE.pages).filter((name) => name !== 'terms');
const footer = (feedback) => html`<footer class="foot">
  <div class="wrap foot__row">
    <div class="foot__text">
      <p>${COPY.affiliation}</p>
      <p>${COPY.termsShort} <a href="${SITE.pages.terms}">${COPY.termsLink}</a></p>
    </div>
    <ul class="foot__meta" role="list">
      <li>${COPY.builtWith}</li>
      <li>${COPY.licenseLead} ${externalLink(SITE.license.content.url, SITE.license.content.name, { rel: 'license noopener' })}</li>
    </ul>
    <ul class="foot__meta foot__links" role="list">
      <li>${externalLink(feedback, COPY.feedback)} <span class="foot__note">${COPY.feedbackWarning}</span></li>${FOOTER_PAGES.map((name) => html`
      <li><a href="${SITE.pages[name]}">${COPY[name]}</a></li>`)}
    </ul>
  </div>
</footer>`;

// A link's card where it is shared (Open Graph, and X's summary card, which falls back to Open Graph): the page's
// title, description and canonical URL, as text only (no image). Harmless on a noindex page. The family's front page
// and each program's hub page are a website; every other page is an article.
const WEBSITES = new Set(['/', ...Object.values(SITE.sites).map((s) => s.path)]);
const socialTags = ({ title, description, url, type }) => html`<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${url === null ? '' : html`<meta property="og:url" content="${url}">
`}<meta name="twitter:card" content="summary">`;

// body: Safe markup (a plain string is escaped, never trusted). scripts: the page's module URLs, loaded in order
// after the theme script: a page with a figure (web/charts/figure.js) lists assets.js.figure, one with the citation
// block (components.js) assets.js.cite, then its own. preloadFonts: font file names to preload (PRELOAD_FONTS).
// topbar: a program site's header (programHeader), in place of the family's masthead. The page's site, from its path
// (siteOf), names the site in the feedback link and says whose maintenance banner the page carries.
// address: the page's canonical address, by default the origin and its path; null for a page with none of its own
// (the not-found page, served at every missing address), which then has no canonical link, og:url or page prefill.
export function page({ title, description, path, address = SITE.origin + path, robots, body, scripts = [], jsonLd = null, assets, preloadFonts = PRELOAD_FONTS, topbar = null }) {
  if (!title || !description || !body) throw new TypeError('page: title, description and body are required');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new RangeError(`page: path must start with "/", got "${path}"`);
  if (!assets?.css || !assets.js?.theme) throw new TypeError('page: assets must hold the CSS and theme script paths');
  if (!scripts.every((src) => typeof src === 'string' && src)) throw new TypeError('page: every script must be a path');
  if (!preloadFonts.every((f) => typeof f === 'string' && FONT_NAME.test(f))) throw new TypeError('page: every preloaded font must be a font file name');
  const site = siteOf(path);
  const name = site?.title ?? SITE.name;
  const modules = [assets.js.theme, ...scripts];
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${address === null ? '' : html`<link rel="canonical" href="${address}">
`}${robots ? html`<meta name="robots" content="${robots}">` : ''}
${socialTags({ title, description, url: address, type: WEBSITES.has(path) ? 'website' : 'article' })}
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
${footer(feedbackHref({ siteName: name, pageUrl: address }))}
${modules.map((src) => html`<script type="module" src="${src}"></script>
`)}</body>
</html>
`.toString();
}
