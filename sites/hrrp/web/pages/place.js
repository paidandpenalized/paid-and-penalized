// Ported from Thirty Day Readmissions (web/src/js/views/scope.js at 33d1959). A place's page (a Census region, a division,
// a state or a metro area) so far: the breadcrumb, the kind, the name, the deck (the count of cuts, the average cut, a
// state's rank, the estimated total) beside the six-field card compared with the nation, and the places inside it.
// Then its figures (the map, the size of the cuts, which conditions drive the penalties, the peer groups, the average cut over time).
// The child table and its hospitals' table come in the next batch.
import { counter } from '../../../../web/charts/figure.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { conditionsFigure, mapFigure, peersFigure, sizeFigure, trendFigure } from '../figures/place.js';
import { PROGRAM_PATH } from '../links.js';
import { t } from '../place/copy.js';
import { breadcrumb, estimateTag, recordCard, shellOf } from './parts.js';

const children = (kids) => html`<section class="place__kids" aria-labelledby="kids-h">
<h2 id="kids-h">${kids.title}</h2>
<ul class="kids" role="list">
${kids.rows.map((r) => html`<li>${r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label} <span class="muted">${r.count}</span></li>
`)}</ul>
</section>`;

// A figure under its title; a figure the place cannot draw (it is '') leaves no title and takes no number.
const titled = (id, title, figureHtml) => (figureHtml ? html`<section class="place__fig" aria-labelledby="pf-${id}"><h2 class="place__figh" id="pf-${id}">${title}</h2>
${figureHtml}</section>` : '');

// The page's figures in order, two to a row where the old state page had them (the map beside the size of the cuts, the peer
// groups beside the average cut over time). shared: the area context (the state outlines, the edition's label); null draws no map.
function figuresOf(view, shared) {
  const f = view.figures;
  const n = counter();
  const edition = view.edition;
  const map = shared?.shapes ? mapFigure(f.place, f.map, shared, n()) : '';
  const size = titled('size', t('figSizeTitle'), sizeFigure(f.size, { name: view.name, id: f.id, edition, n: n() }));
  const conditions = f.conditions.measuredAny
    ? titled('cond', t('figCondTitle'), conditionsFigure(f.conditions, { conditions: f.conditionList, id: f.id, edition, n: n() }))
    : html`<section class="place__fig"><h2 class="place__figh">${t('figCondTitle')}</h2><p class="small muted">${t('condNoMeasured')}</p></section>`;
  const peers = titled('peer', t('figPeerTitle'), peersFigure(f.peers, { id: f.id, edition, total: f.size.n, n: n() }));
  const trend = titled('trend', t('figTrendTitle'), trendFigure(f.trend, { name: view.name, id: f.id, edition, span: f.span, n: n() }));
  return html`${map ? html`<div class="place__pair">${titled('map', t('figMapTitle'), map)}${size}</div>` : size}
${conditions}
<div class="place__pair place__pair--rev">${peers}${trend}</div>`;
}

// view: placeView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths;
// shared: areaContext()'s result (the outlines the map draws), or null for a page without a map.
export function placePage({ view, robots, assets, shared = null }) {
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
${figuresOf(view, shared)}
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
    scripts: [assets.js.figure, assets.js['hrrp-place']],
    assets,
    ...shellOf({ edition: view.edition, current: 'explore' }),
  });
}
