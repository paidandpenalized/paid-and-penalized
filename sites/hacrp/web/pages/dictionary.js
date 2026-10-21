// The data dictionary as a page (/hacrp/data/): sites/hacrp/DATA-DICTIONARY.md, filled as the downloadable file is
// (csv.js dictionaryText), in the site shell. Its words are the file's; the page adds only the kicker the other HACRP
// pages carry. The Markdown file stays at its own address beside the CSV.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { markdownSections } from '../../../../web/render/markdown.js';
import { SITE } from '../../../../web/site.js';
import { dictionaryText } from '../csv.js';
import { kicker } from './parts.js';

// dictionary: the raw Markdown (data.js loads it); robots: null for an indexable page.
export function dictionaryPage({ dictionary, fy, source, path, robots, assets }) {
  const { title, intro, sections } = markdownSections(dictionaryText(dictionary, { fy, source }), { idPrefix: 'dict', tableClass: 'gb gb--dict' });
  if (!title || !intro) throw new RangeError('dictionaryPage: the dictionary needs a "# " title and an opening paragraph');
  const body = html`<article class="wrap page page--article dict">
<header class="page__head">
${kicker(fy)}
<h1>${title}</h1>
</header>
${sections.map((s) => (s.heading
    ? html`<section class="block" aria-labelledby="${s.id}">
<h2 id="${s.id}" class="h-sm">${s.heading}</h2>
${s.body}
</section>`
    : html`<div class="prose">${s.body}</div>`))}
</article>`;
  // The figure script makes the wide table's scroll box keyboard-reachable on a phone (web/client/figure.js).
  return page({ title: `${title} · ${SITE.name}`, description: intro, path, robots, body, scripts: [assets.js.figure], assets });
}
