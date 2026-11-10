// The work-requirement program page. So far its head (the kicker, the title and the dek) and the five steps the section
// menu opens, each an anchored section with its heading; the steps' figures and words are later work.
import { programDek } from '../../../../web/programs.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { SECTIONS } from '../constants.js';
import { t } from '../copy.js';
import { PROGRAM_PATH } from '../links.js';
import { labelOf, shellOf } from './parts.js';

const TITLE = t('title');

// A step: its id (the section menu's anchor) and its heading; its body comes with its figures.
const step = (id) => html`<section class="step" id="${id}" aria-labelledby="${id}-h">
<h2 id="${id}-h">${labelOf(id)}</h2>
</section>`;

// robots: null for an indexable page, else the meta robots value; assets: the build's paths. The steps will read
// loadMedicaid()'s result (data), which the generator passes already.
export function programPage({ robots, assets }) {
  const body = html`<article class="wrap page wr">
<header class="page__head wr__top">
<p class="cap kicker">${t('kicker')}</p>
<h1>${TITLE}</h1>
<p class="dek">${programDek('work-requirement')}</p>
</header>
${SECTIONS.map(step)}
</article>`;
  return page({
    title: `${TITLE} · ${SITE.name}`,
    description: t('description'),
    path: PROGRAM_PATH,
    robots,
    body,
    assets,
    ...shellOf(),
  });
}
