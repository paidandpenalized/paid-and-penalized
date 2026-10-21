// The page shell every page renders through: head metadata, skip link, header (wordmark, byline, theme toggle),
// <main>, footer, scripts. The body supplies the page's one <h1>; the header has none.
import { COPY } from '../copy.js';
import { SITE } from '../site.js';
import { html, jsonText, raw } from './html.js';

const LINKEDIN = 'https://www.linkedin.com/in/dalton-haslam';
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
const PRELOAD_FONTS = ['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-400'];

const newTab = html`<span class="vh">${COPY.newTab}</span>`;

const header = html`<header class="masthead">
  <div class="wrap masthead__row">
    <a class="wordmark" href="/">${COPY.wordmarkLead} <span class="wordmark__pen">${COPY.wordmarkPen}</span></a>
    <p class="byline">${COPY.bylineLead} <a href="${LINKEDIN}" target="_blank" rel="noopener">${COPY.bylineName}${newTab}</a></p>
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

// body: Safe markup (a plain string is escaped, never trusted). scripts: extra module URLs after the theme script.
export function page({ title, description, path, robots, body, scripts = [], jsonLd = null, assets }) {
  if (!title || !description || !body) throw new TypeError('page: title, description and body are required');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new RangeError(`page: path must start with "/", got "${path}"`);
  if (!assets?.css || !assets.js?.theme) throw new TypeError('page: assets must hold the CSS and theme script paths');
  const modules = [assets.js.theme, ...scripts];
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${SITE.origin + path}">
${robots ? html`<meta name="robots" content="${robots}">` : ''}
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${PRELOAD_FONTS.map((f) => html`<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>
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
