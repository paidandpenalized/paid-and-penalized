// The program page's research Part: published findings grouped by theme, each with its cite and a link to the study.
// Text from the content file is escaped by html``; a link is drawn only for an https address (history-data.js researchData).
import { html } from '../../../../web/render/html.js';
import { externalLink } from '../../../../web/render/layout.js';
import { t } from '../program/copy.js';

// groups: history-data.js researchData().
export function researchPart(groups) {
  return html`<p class="part__intro">${t('researchIntro')}</p>
${groups.map((g, i) => html`<section class="rs" aria-labelledby="research-theme-${i + 1}">
<h3 class="part__sub" id="research-theme-${i + 1}">${g.theme}</h3>
<ul class="rs__list" role="list">
${g.items.map((r) => html`<li class="rs__item">
<p class="rs__cite"><strong>${r.cite}</strong>. ${r.url ? externalLink(r.url, r.title) : r.title}</p>
<p class="rs__finding">${r.finding}</p>
</li>
`)}</ul>
</section>
`)}`;
}
