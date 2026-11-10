// The work-requirement Methods page. So far its head (the kicker and the heading) under the section menu, Methods
// current; its sections (the steps and parameters, what the method can't tell you, the sources) are later work.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { t } from '../copy.js';
import { METHODS_PATH } from '../links.js';
import { shellOf } from './parts.js';

// robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function methodsPage({ robots, assets }) {
  const body = html`<article class="wrap page wr-meth">
<header class="page__head">
<p class="cap kicker">${t('methodsKicker')}</p>
<h1>${t('methodsHeading')}</h1>
</header>
</article>`;
  return page({
    title: `${t('methodsHeading')} · ${SITE.name}`,
    description: t('methodsDescription'),
    path: METHODS_PATH,
    robots,
    body,
    assets,
    ...shellOf({ current: 'methods' }),
  });
}
