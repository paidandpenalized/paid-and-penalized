// Ported from Thirty Day Readmissions (web/src/js/views/scope.js at 33d1959). A place's page (a Census region, a division,
// a state or a metro area) so far: the breadcrumb, the kind, the name, the deck (the count of cuts, the average cut, a
// state's rank, the estimated total) beside the six-field card compared with the nation, and the places inside it.
// Then its figures (the map, the size of the cuts, which conditions drive the penalties, the peer groups, the average cut over time).
// Then the places inside it as a table and the area's hospitals as a table, each with its CSV.
import { counter } from '../../../../web/charts/figure.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { conditionsFigure, mapFigure, peersFigure, sizeFigure, trendFigure } from '../figures/place.js';
import { hospitalsSection, kidsTable } from '../figures/place-table.js';
import { PROGRAM_PATH } from '../links.js';
import { t } from '../place/copy.js';
import { estimateTag } from '../estimate-tag.js';
import { breadcrumb, recordCard, shellOf } from './parts.js';
import { HALF, RAIL } from '../figures/layout.js';

// A figure under its title; a figure the place cannot draw (it is '') leaves no title and takes no number. side: its words beside
// its chart where there is room (styles.css .pic--side).
const titled = (id, title, figureHtml, side = false) => (figureHtml ? html`<section class="place__fig${side ? ' pic--side' : ''}" aria-labelledby="pf-${id}"><h2 class="place__figh" id="pf-${id}">${title}</h2>
${figureHtml}</section>` : '');

// The page's figures in order, composed against Thirty Day Readmissions' state page: the map beside the size of the cuts with the
// peer groups under it (a place without a map has those two side by side), which conditions drive the penalties across the
// page, then the average cut over time with its words beside it. shared: the area context (the state outlines, the edition's
// label); null draws no map.
function figuresOf(view, shared) {
  const f = view.figures;
  const n = counter();
  const edition = view.edition;
  const map = shared?.shapes ? mapFigure(f.place, f.map, shared, n) : '';
  // The top row's layout, chosen once: the map beside the size and peer figures stacked in the narrow column, or those two as a pair.
  const top = map ? { cls: 'place__pair', wide: RAIL } : { cls: 'place__pair place__pair--even', wide: HALF };
  const { wide } = top;
  const size = titled('size', t('figSizeTitle'), sizeFigure(f.size, { name: view.name, id: f.id, edition, n, wide }));
  const peers = titled('peer', t('figPeerTitle'), peersFigure(f.peers, { id: f.id, edition, total: f.size.n, n, wide }));
  const conditions = f.conditions.measuredAny
    ? titled('cond', t('figCondTitle'), conditionsFigure(f.conditions, { conditions: f.conditionList, id: f.id, edition, n }))
    : html`<section class="place__fig"><h2 class="place__figh">${t('figCondTitle')}</h2><p class="small muted">${t('condNoMeasured')}</p></section>`;
  const trend = titled('trend', t('figTrendTitle'), trendFigure(f.trend, { name: view.name, id: f.id, edition, span: f.span, n }), true);
  const row = html`<div class="${top.cls}">${map ? html`${titled('map', t('figMapTitle'), map)}<div class="place__stack">${size}${peers}</div>` : html`${size}${peers}`}</div>`;
  return html`${row}
${conditions}
${trend}`;
}

// view: placeView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths;
// shared: areaContext()'s result (the outlines the map draws), or null for a page without a map; rowsUrl: the hospitals tables' rows
// asset (generate.js), or null for none.
export function placePage({ view, robots, assets, shared = null, rowsUrl = null, hospitalsUrl = null }) {
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
${view.children ? kidsTable(view.children, { fy: view.fy }) : ''}
${hospitalsSection(view.hospitals, { name: view.name, conditions: view.figures.conditionList, fy: view.fy, rowsUrl })}
<p class="page__links"><a href="${PROGRAM_PATH}">${view.back}</a></p>
</article>`;
  const title = `${view.heading} · ${SITE.name}`;
  return page({
    title,
    description: view.description,
    path: view.path,
    robots,
    body,
    scripts: [assets.js.figure, assets.js['hrrp-place']],  // its script mounts the bar's search too
    assets,
    ...shellOf({ edition: view.edition, current: 'explore', searchUrl: hospitalsUrl }),
  });
}
