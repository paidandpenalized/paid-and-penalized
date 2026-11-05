// Ported from Thirty Day Readmissions (web/src/js/views/home.js at 33d1959), after HACRP's program page. The Readmissions
// program page so far: the top (the kicker, the name, the deck with this year's count, the places to try) beside the
// At-a-glance record card under its stamp, then the six Parts the section menu opens, each a numbered heading until its
// figures are drawn. The search box under the deck (hidden until client/program.js mounts it) reads the hospitals
// asset; the suggestions below it work without the script.
import { fillAround, stamp } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { searchForm } from '../../../../web/render/shell.js';
import { counter } from '../../../../web/charts/figure.js';
import { SITE } from '../../../../web/site.js';
import { explorePart } from '../figures/explore.js';
import { historyPart } from '../figures/history.js';
import { howPart } from '../figures/how.js';
import { mapPart } from '../figures/map.js';
import { picturePart } from '../figures/picture.js';
import { researchPart } from '../figures/research.js';
import { PROGRAM_PATH } from '../links.js';
import { fill, t } from '../program/copy.js';
import { SECTIONS, estimateTag, labelOf, recordCard, shellOf } from './parts.js';

function top(view, { hospitalsUrl }) {
  const { deck, card } = view;
  const { metro } = view.try;
  const hints = fillAround((marks) => fill(metro ? 'heroTry' : 'heroTryNoMetro', marks), {
    state: html`<a href="${view.try.state.path}">${view.try.state.name}</a>`,
    ...(metro && { metro: html`<a href="${metro.path}">${metro.name}</a>` }),
    every: html`<a href="#explore">${t('heroEvery')}</a>`,
    how: html`<a href="#how">${t('heroHow')}</a>`,
  });
  return html`<header class="page__head prog__top">
<div class="prog__intro stack">
<p class="cap kicker prog__kicker">${view.kicker}</p>
<h1 class="prog__title"><span class="prog__title-lead">${t('heroLead')}</span> <span class="prog__title-pen">${SITE.sites.hrrp.title}</span></h1>
<p class="prog__deck">${deck.lead}<strong>${deck.count}</strong>${deck.mid}${deck.share}</p>
<div class="prog__find stack">
${hospitalsUrl && searchForm({ id: 'hero', hero: true, src: hospitalsUrl, label: t('searchHeading'), find: t('searchFind'), findRest: t('heroFindRest'), placeholder: t('heroPlaceholder') })}
<p class="prog__try">${hints}</p>
</div>
</div>
<div class="prog__card stack">
${recordCard(card)}
${stamp({ label: card.stamp })}
</div>
</header>`;
}

// A Part: its number, its heading, and its body (none until its figures are drawn).
const part = (id, n, label, body = '') => html`<section class="part" id="${id}" aria-labelledby="${id}-h">
<div class="part__head">
<p class="part__tag">${fill('partTag', { n: String(n) })}</p>
<h2 class="part__title" id="${id}-h">${label}</h2>
</div>
${body}
</section>`;

// view: programView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths;
// hospitalsUrl: the hospitals asset's path the search and the explorer read (null: the shell has no source); worksheetUrl:
// the worksheet asset Worksheet R's hospital box reads (null: no box).
export function programPage({ view, robots, assets, hospitalsUrl = null, worksheetUrl = null }) {
  const figure = counter();
  const bodies = {
    how: howPart(view.how, { figure, edition: view.edition, estimateTag, hospitalsUrl, worksheetUrl }),
    picture: picturePart(view.picture, { figure, edition: view.edition }),
    map: mapPart(view.map, { figure, edition: view.edition }),
    history: historyPart(view.history, { figure }),
    explore: explorePart(view.explore, { url: hospitalsUrl }),
    research: researchPart(view.research),
  };
  const body = html`<article class="wrap page page--prog prog">
${top(view, { hospitalsUrl })}
${SECTIONS.map((id, i) => part(id, i + 1, labelOf(id, view.edition), bodies[id]))}
</article>`;
  return page({
    title: `${view.heading} · ${SITE.name}`,
    description: view.description,
    path: PROGRAM_PATH,
    robots,
    body,
    scripts: hospitalsUrl ? [assets.js['hrrp-program']] : [],
    assets,
    ...shellOf({ edition: view.edition }),
  });
}
