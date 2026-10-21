// The page shell every page renders through: head metadata, skip link, header (wordmark, byline, theme toggle),
// <main>, footer, scripts. The body supplies the page's one <h1>; the header has none.
import { COPY } from '../copy.js';
import { SITE } from '../site.js';
import { html, jsonText, raw } from './html.js';

const LINKEDIN = 'https://www.linkedin.com/in/dalton-haslam';
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
// The fonts a page preloads (files in web/fonts), by default: the headline face, the body face and IBM Plex Mono 400
// (tables, facts and place lines). A page whose first screen shows another face passes its own list (preloadFonts):
// a hospital page swaps in the mono 700 of its hero number.
export const PRELOAD_FONTS = Object.freeze(['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400']);
const FONT_NAME = /^[a-z0-9-]+$/;

const newTab = html`<span class="vh">${COPY.newTab}</span>`;

const header = html`<header class="masthead">
  <div class="wrap masthead__row">
    <a class="wordmark" href="/">${COPY.wordmarkLead} <span class="wordmark__pen">${COPY.wordmarkPen}</span></a>
    <p class="byline">${COPY.bylineLead} <a href="${LINKEDIN}" target="_blank" rel="noopener"><span class="nw">${COPY.bylineName}</span>${newTab}</a></p>
    <button type="button" class="theme-toggle" aria-pressed="false" hidden>${COPY.themeToggle}</button>
  </div>
</header>`;

const footer = html`<footer class="foot">
  <div class="wrap foot__row">
    <p>${COPY.affiliation}</p>
    <ul class="foot__meta" role="list">
      <li>${COPY.builtWith}</li>
      <li><a href="${SITE.feedbackUrl}" target="_blank" rel="noopener">${COPY.feedback}${newTab}</a></li>
      <li>${COPY.licenseLead} <a href="${LICENSE}" target="_blank" rel="license noopener">CC BY 4.0${newTab}</a></li>
      <li><a href="/methods/">${COPY.methods}</a></li>
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
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">`;

// body: Safe markup (a plain string is escaped, never trusted). scripts: the page's module URLs, loaded in order
// after the theme script: a page with a figure (web/charts/figure.js) lists assets.js.figure, one with the citation
// block (components.js) assets.js.cite, then its own. preloadFonts: font file names to preload (PRELOAD_FONTS).
export function page({ title, description, path, robots, body, scripts = [], jsonLd = null, assets, preloadFonts = PRELOAD_FONTS }) {
  if (!title || !description || !body) throw new TypeError('page: title, description and body are required');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new RangeError(`page: path must start with "/", got "${path}"`);
  if (!assets?.css || !assets.js?.theme) throw new TypeError('page: assets must hold the CSS and theme script paths');
  if (!scripts.every((src) => typeof src === 'string' && src)) throw new TypeError('page: every script must be a path');
  if (!preloadFonts.every((f) => typeof f === 'string' && FONT_NAME.test(f))) throw new TypeError('page: every preloaded font must be a font file name');
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
${header}
<main id="main">
${body}
</main>
${footer}
${modules.map((src) => html`<script type="module" src="${src}"></script>
`)}</body>
</html>
`.toString();
}
