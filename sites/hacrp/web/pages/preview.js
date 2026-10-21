// The preview index (/preview/, a preview build only): links to the sample hospital pages built in each state map
// placement, for the owner to compare. noindex, out of the sitemap, never in a production build (generate.js).
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { fill, t } from '../copy.js';

const LABELS = { e: 'previewE', f: 'previewF', g: 'previewG', h: 'previewH', i: 'previewI', j: 'previewJ' };

// links: [{ placement, path, view }], in placement order.
export function previewIndex(links, assets) {
  const placements = [...new Set(links.map((l) => l.placement))];
  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${t('previewTitle')}</h1>
<p class="dek">${t('previewIntro')}</p>
</header>
${placements.map((placement) => html`<section class="block" aria-labelledby="preview-${placement}">
<h2 id="preview-${placement}" class="h-sm">${t(LABELS[placement])}</h2>
<ul class="links" role="list">${links.filter((l) => l.placement === placement).map(({ path, view }) => html`<li><a href="${path}">${fill('previewLink', { name: view.name, state: view.state })}</a></li>`)}</ul>
</section>`)}
</article>`;
  return page({ title: `${t('previewTitle')} · ${SITE.name}`, description: t('previewIntro'), path: '/preview/', robots: 'noindex', body, assets });
}
