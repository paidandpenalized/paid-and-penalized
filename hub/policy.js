// The template for the hub's policy pages (Terms, privacy, corrections, About, accessibility): the title over its
// one-line description and, beside them or under them, an "in brief" record card (a .form of numbered lines, the
// family's signature device), then the page's sections with an index of them beside the text on a wide screen and
// above it on a narrow one. No figures; the look is components.js's form parts and tokens.css's inks (styles:
// web/styles/pages.css, ".doc" and ".pol__*").
import { formField, formTitle } from '../web/render/components.js';
import { Safe, html } from '../web/render/html.js';
import { page } from '../web/render/layout.js';
import { SITE } from '../web/site.js';
import { COPY } from './copy.js';
import { hubBar } from './parts.js';

// A section's id is a link target other pages and readers keep: lowercase words joined by single hyphens.
const SECTION_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// brief: the card's lines (text or Safe), three to five of the page's points. sections: [{ id, heading, body }] in
// reading order, body a Safe (the section's paragraphs); the index lists them by heading. title is the page's name:
// its <h1>, and its <title> with the site's name after it.
export function policyPage({ path, title, description, brief, sections, assets, robots }) {
  if (!Array.isArray(brief) || !brief.length) throw new TypeError('policyPage: brief must be a non-empty list');
  if (!Array.isArray(sections) || !sections.length) throw new TypeError('policyPage: sections must be a non-empty list');
  const seen = new Set();
  for (const { id, heading, body } of sections) {
    if (typeof id !== 'string' || !SECTION_ID.test(id)) throw new RangeError(`policyPage: section id ${JSON.stringify(id)} must be lowercase words joined by hyphens`);
    if (seen.has(id)) throw new RangeError(`policyPage: section id "${id}" is used twice`);
    seen.add(id);
    if (typeof heading !== 'string' || !heading) throw new TypeError(`policyPage: section "${id}" needs a heading`);
    if (!(body instanceof Safe)) throw new TypeError(`policyPage: section "${id}" body must be markup (html\`\`), not a string`);
  }
  const body = html`<article class="wrap page">
<header class="page__head pol__top">
<div class="pol__intro">
<h1 class="pol__title">${title}</h1>
<p class="dek pol__dek">${description}</p>
</div>
<div class="form pol__brief" role="group" aria-label="${COPY.briefTitle}">
${formTitle(COPY.briefTitle, SITE.name)}
${brief.map((line, i) => html`${formField({ no: i + 1, label: '', value: line, size: 'text', wide: true })}
`)}</div>
</header>
<div class="doc">
<nav class="doc__toc" aria-label="${COPY.indexLabel}">
<p class="doc__toc-h cap" aria-hidden="true">${COPY.indexLabel}</p>
<ol>${sections.map((s, i) => html`<li><a href="#${s.id}"><span class="doc__toc-n">${String(i + 1)}</span>${s.heading}</a></li>`)}</ol>
</nav>
<div class="doc__main">
${sections.map((s) => html`<section class="doc__sec" id="${s.id}" aria-labelledby="${s.id}-h">
<h2 class="doc__h" id="${s.id}-h">${s.heading}</h2>
${s.body}
</section>
`)}</div>
</div>
</article>`;
  return page({ title: `${title} · ${SITE.name}`, description, path, robots, body, ...hubBar(assets), assets });
}
