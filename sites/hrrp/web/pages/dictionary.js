// The data dictionary as a page (/hrrp/data/): sites/hrrp/DATA-DICTIONARY.md, filled as the downloadable file is
// (csv.js dictionaryText), in the site shell, as HACRP's dictionary page is. Its words are the file's; the page adds the
// kicker and, after the sections, links to the files themselves (the hospitals CSV and the Markdown).
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { markdownSections } from '../../../../web/render/markdown.js';
import { SITE } from '../../../../web/site.js';
import { t } from '../copy.js';
import { DICTIONARY_PAGE } from '../links.js';
import { shellOf } from './parts.js';

// text: the filled Markdown (csv.js dictionaryText), as the downloadable file holds it; edition: the edition's label;
// csvHref and markdownHref: the files' addresses; robots: null for an indexable page.
export function dictionaryPage({ text, edition, csvHref, markdownHref, robots, assets, hospitalsUrl = null }) {
  const { title, intro, sections } = markdownSections(text, { idPrefix: 'dict', tableClass: 'gb gb--dict' });
  if (!title || !intro) throw new RangeError('dictionaryPage: the dictionary needs a "# " title and an opening paragraph');
  const body = html`<article class="wrap page page--article dict">
<header class="page__head">
<p class="cap kicker">${t('dictKicker')}</p>
<h1>${title}</h1>
</header>
${sections.map((s) => (s.heading
    ? html`<section class="block" aria-labelledby="${s.id}">
<h2 id="${s.id}" class="h-sm">${s.heading}</h2>
${s.body}
</section>`
    : html`<div class="prose">${s.body}</div>`))}
<section class="block" aria-labelledby="dict-files">
<h2 id="dict-files" class="h-sm">${t('dictFilesHeading')}</h2>
<ul>
<li><a href="${csvHref}" download>${t('dictFileHospitals')}</a></li>
<li><a href="${markdownHref}" download>${t('dictFileMarkdown')}</a></li>
</ul>
</section>
</article>`;
  // The figure script makes the wide table's scroll box keyboard-reachable, as on HACRP's dictionary page.
  return page({ title: `${title} · ${SITE.name}`, description: intro, path: DICTIONARY_PAGE, robots, body, scripts: [assets.js.figure, ...(hospitalsUrl ? [assets.js['hrrp-search']] : [])], assets, ...shellOf({ edition, searchUrl: hospitalsUrl }) });
}
