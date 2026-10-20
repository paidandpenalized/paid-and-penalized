// The hub: the family's front page (a stub until the hub is built), the methods stub, the not-found page, and the
// two files crawlers read: robots.txt and sitemap.xml. It runs last, so the sitemap lists every indexable page the
// sites before it wrote. The hub's own pages stay noindex until the hub is built.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COPY as SHARED } from '../web/copy.js';
import { escapeHtml, html } from '../web/render/html.js';
import { page } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { COPY } from './copy.js';

const ROBOTS = 'noindex';
const SITE_PATHS = { hacrp: '/hacrp/' };
const PATH = /^\/[a-z0-9/-]*$/;

function write(outDir, file, text) {
  const path = join(outDir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function home(assets) {
  const sites = Object.entries(SITE_PATHS).map(([id, path]) => {
    const { title, subtitle } = SITE.sites[id];
    return html`<li><a href="${path}">${title} <span class="short">(${subtitle})</span></a></li>`;
  });
  const body = html`<article class="wrap page home">
<header class="page__head">
<h1 class="home__mark">${SHARED.wordmarkLead} <span class="wordmark__pen">${SHARED.wordmarkPen}</span></h1>
<p class="dek">${COPY.tagline}</p>
</header>
<section class="block" aria-labelledby="sites-h">
<h2 id="sites-h" class="h-sm">${COPY.sitesHeading}</h2>
<ul class="links" role="list">${sites}</ul>
</section>
</article>`;
  return page({ title: COPY.homeTitle, description: COPY.homeDescription, path: '/', robots: ROBOTS, body, assets });
}

function methods(assets) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${COPY.methodsTitle}</h1>
<p class="dek">${COPY.methodsIntro}</p>
</header>
<section class="block" id="estimate" aria-labelledby="estimate-h">
<h2 id="estimate-h">${COPY.estimateHeading}</h2>
<p>${COPY.estimateWhat}</p>
<p>${COPY.estimateHow}</p>
<p>${COPY.estimateNot}</p>
</section>
<section class="block" id="ai" aria-labelledby="ai-h">
<h2 id="ai-h">${COPY.aiHeading}</h2>
<p>${COPY.aiUse}</p>
</section>
</article>`;
  return page({ title: `${COPY.methodsTitle} · ${SITE.name}`, description: COPY.methodsDescription, path: '/methods/', robots: ROBOTS, body, assets });
}

function notFound(assets) {
  const { title, subtitle } = SITE.sites.hacrp;
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${COPY.notFoundTitle}</h1>
<p class="dek">${COPY.notFoundBody}</p>
</header>
<ul class="links" role="list">
<li><a href="/">${COPY.notFoundHome}</a></li>
<li><a href="${SITE_PATHS.hacrp}">${title} <span class="short">(${subtitle})</span></a></li>
</ul>
</article>`;
  return page({ title: `${COPY.notFoundTitle} · ${SITE.name}`, description: COPY.notFoundBody, path: '/404.html', robots: ROBOTS, body, assets });
}

// paths: site-relative paths that may be indexed ("/hacrp/", …); only these go in the sitemap.
export function sitemapXml(paths) {
  for (const p of paths) if (!PATH.test(p)) throw new RangeError(`sitemap: bad path "${p}"`);
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(SITE.origin + p)}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

// env is accepted for symmetry with the site generators; the hub's pages are noindex in every build for now.
export async function generateHub({ outDir, assets, sitemap = [] }) {
  write(outDir, 'index.html', home(assets));
  write(outDir, 'methods/index.html', methods(assets));
  write(outDir, '404.html', notFound(assets));
  write(outDir, 'robots.txt', robotsTxt());
  write(outDir, 'sitemap.xml', sitemapXml(sitemap));
  return { pages: 3 };
}
