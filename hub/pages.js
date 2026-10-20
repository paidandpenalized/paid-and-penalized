// The hub: the family's front page (a stub until the hub is built), the methods stub, the not-found page, and the
// two files crawlers read: robots.txt and sitemap.xml. It runs last, so the sitemap lists every indexable page the
// sites before it emitted. The hub's own pages stay noindex until the hub is built.
import { robotsFor } from '../pipeline/site/context.js';
import { COPY as SHARED } from '../web/copy.js';
import { escapeHtml, html } from '../web/render/html.js';
import { page } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { COPY } from './copy.js';

// The hub is not released: its pages are noindex in every build until it is built.
const RELEASED = false;
const PATH = /^\/[a-z0-9/-]*$/;

// A link to one family site, by its id in web/site.js.
function siteLink(id) {
  const { path, title, subtitle } = SITE.sites[id];
  return html`<a href="${path}">${title} <span class="short">(${subtitle})</span></a>`;
}
const SITE_IDS = Object.keys(SITE.sites);

function home(assets, robots) {
  const body = html`<article class="wrap page home">
<header class="page__head">
<h1 class="home__mark">${SHARED.wordmarkLead} <span class="wordmark__pen">${SHARED.wordmarkPen}</span></h1>
<p class="dek">${COPY.tagline}</p>
</header>
<section class="block" aria-labelledby="sites-h">
<h2 id="sites-h" class="h-sm">${COPY.sitesHeading}</h2>
<ul class="links" role="list">${SITE_IDS.map((id) => html`<li>${siteLink(id)}</li>`)}</ul>
</section>
</article>`;
  return page({ title: COPY.homeTitle, description: COPY.homeDescription, path: '/', robots, body, assets });
}

function methods(assets, robots) {
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
  return page({ title: `${COPY.methodsTitle} · ${SITE.name}`, description: COPY.methodsDescription, path: '/methods/', robots, body, assets });
}

function notFound(assets, robots) {
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${COPY.notFoundTitle}</h1>
<p class="dek">${COPY.notFoundBody}</p>
</header>
<ul class="links" role="list">
<li><a href="/">${COPY.notFoundHome}</a></li>
${SITE_IDS.map((id) => html`<li>${siteLink(id)}</li>
`)}</ul>
</article>`;
  return page({ title: `${COPY.notFoundTitle} · ${SITE.name}`, description: COPY.notFoundBody, path: '/404.html', robots, body, assets });
}

// paths: site-relative paths that may be indexed ("/hacrp/", …); only these go in the sitemap.
export function sitemapXml(paths) {
  for (const p of paths) if (!PATH.test(p)) throw new RangeError(`sitemap: bad path "${p}"`);
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(SITE.origin + p)}</loc></url>\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

export async function generateHub(ctx) {
  const { assets } = ctx;
  const robots = robotsFor({ env: ctx.env, released: RELEASED });
  ctx.emit({ path: '/', robots, text: home(assets, robots) });
  ctx.emit({ path: '/methods/', robots, text: methods(assets, robots) });
  // The not-found page is never indexed, released or not.
  const notFoundRobots = robotsFor({ env: ctx.env, released: RELEASED, eligible: false });
  ctx.emit({ path: '/404.html', robots: notFoundRobots, text: notFound(assets, notFoundRobots) });
  ctx.emit({ path: '/robots.txt', text: robotsTxt() });
  ctx.emit({ path: '/sitemap.xml', text: sitemapXml(ctx.indexable) });
}

export const HUB = { id: 'hub', entries: {}, styles: [], generate: generateHub };
