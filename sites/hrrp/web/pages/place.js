// Ported from Thirty Day Readmissions (web/src/js/views/scope.js at 33d1959). A place's page (a Census region, a division,
// a state or a metro area) so far: the breadcrumb, the kind, the name, the deck (the count of cuts, the average cut, a
// state's rank, the estimated total) beside the six-field card compared with the nation, and the places inside it.
// The place's figures and its hospitals' table come in later batches.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { PROGRAM_PATH } from '../links.js';
import { breadcrumb, estimateTag, recordCard, shellOf } from './parts.js';

const children = (kids) => html`<section class="place__kids" aria-labelledby="kids-h">
<h2 id="kids-h">${kids.title}</h2>
<ul class="kids" role="list">
${kids.rows.map((r) => html`<li>${r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label} <span class="muted">${r.count}</span></li>
`)}</ul>
</section>`;

// view: placeView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function placePage({ view, robots, assets }) {
  const { deck } = view;
  const body = html`<article class="wrap page page--place">
${breadcrumb(view.crumbs, view.name)}
<header class="page__head place__top">
<div class="place__intro stack">
<p class="cap kicker">${view.kicker}</p>
<h1 class="place__title">${view.name}</h1>
<p class="place__deck">${deck.lead}${deck.average}${deck.total}${deck.totalValue}${estimateTag}${deck.totalNote}${deck.totalEnd}</p>
</div>
<div class="place__card stack">
${recordCard(view.card)}
</div>
</header>
${view.children && view.children.rows.length ? children(view.children) : ''}
<p class="page__links"><a href="${PROGRAM_PATH}">${view.back}</a></p>
</article>`;
  const title = `${view.heading} · ${SITE.name}`;
  return page({
    title,
    description: view.description,
    path: view.path,
    robots,
    body,
    assets,
    ...shellOf({ edition: view.edition, current: 'explore' }),
  });
}
