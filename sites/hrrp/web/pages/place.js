// Ported from Thirty Day Readmissions (web/src/js/views/scope.js at 33d1959). A place's page (a Census region, a division,
// a state or a metro area) so far: the breadcrumb, the kind, the name, the deck (the count of cuts, the average cut, a
// state's rank, the estimated total) beside the six-field card compared with the nation, and the places inside it.
// The place's figures and its hospitals' table come in later batches.
import { estTag, formField, formTitle } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { DOLLARS_HREF, PROGRAM_PATH } from '../links.js';
import { t } from '../place/copy.js';
import { breadcrumb, shellOf } from './parts.js';

function card(view) {
  const tag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });
  return html`<div class="place__card stack">
<div class="form prog__summary">
${formTitle(view.card.left, view.card.right)}
${view.card.fields.map((f, i) => html`${formField({ no: i + 1, label: f.label, value: f.estimated ? html`${f.value}${tag}` : f.value, note: f.note })}
`)}</div>
</div>`;
}

const children = (kids) => html`<section class="place__kids" aria-labelledby="kids-h">
<h2 id="kids-h">${kids.title}</h2>
<ul class="kids" role="list">
${kids.rows.map((r) => html`<li>${r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label} <span class="muted">${r.count}</span></li>
`)}</ul>
</section>`;

// view: placeView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function placePage({ view, robots, assets }) {
  const { deck } = view;
  const tag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });
  const body = html`<article class="wrap page page--place">
${breadcrumb(view.crumbs, view.name)}
<header class="page__head place__top">
<div class="place__intro stack">
<p class="cap kicker">${view.kicker}</p>
<h1 class="place__title">${view.name}</h1>
<p class="place__deck">${deck.lead}${deck.average}${deck.total}${deck.totalValue}${tag}${deck.totalNote}${deck.totalEnd}</p>
</div>
${card(view)}
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
