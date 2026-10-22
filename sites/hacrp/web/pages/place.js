// A place's page: a Census region, a division, a state or a metro area (/hacrp/<kind>/<key>/), after Thirty Day
// Readmissions' place views. The top: the breadcrumb, the place's kind and name, a sentence of its count against the
// nation's beside a summary form compared with the nation, under a stamp of its share cut; then the score rule with
// the place's hospitals ticked through it. Then its map, its scores against the nation's, its measures against the
// national medians, its children (divisions, states or metro areas) and its hospitals. The foot: the data facts,
// downloads and citation.
import { historySource, placeYearsFigure } from '../history-figures.js';
import { nameInText } from '../places.js';
import { fill as hfill } from '../history/copy.js';
import { formField, formTitle, stamp } from '../../../../web/render/components.js';
import { cmsText, count, decimal, ordinal, pct, shownAbove } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { counter } from '../../../../web/charts/figure.js';
import { SCORE_DECIMALS as DP } from '../../../../engine/js/hacrp/score.js';
import { MEASURE_IDS } from '../../../../engine/js/hacrp/measures.js';
import { FEW_DECIDED } from '../constants.js';
import { sourceText } from '../copy.js';
import { fill, t } from '../program/copy.js';
import { childrenTable, placeHistFigure, placeMapFigure, placeMeasuresFigure, psec, ruleFigure } from '../program-figures.js';
import { ancestors } from '../places.js';
import { asofBar, citation, dataLinks, hospitalTable, printLink, siteHeader } from './parts.js';

const KIND = { region: 'placeKindRegion', division: 'placeKindDivision', state: 'placeKindState', metro: 'placeKindMetro' };
const KINDS_WORDS = { region: 'kpiKindsRegion', division: 'kpiKindsDivision', state: 'kpiKindsState' };

// The breadcrumb: the nation (the program page), then each place above this one, then this one (not a link).
function breadcrumb(places, place) {
  const chain = ancestors(places.places, place);
  return html`<nav class="crumbs" aria-label="${t('crumbLabel')}"><ol>
<li><a href="${SITE.sites.hacrp.path}#map">${t('placeNation')}</a></li>
${chain.map((p) => html`<li><a href="${p.path}">${p.name}</a></li>`)}
<li aria-current="page">${place.name}</li>
</ol></nav>`;
}

// The place's rank by share cut among its peers (the regions, the divisions, the states, or the metro areas with
// enough decisions), highest share first; null for a place too small to rank.
function rankOf(places, place) {
  const share = (p) => p.counts.yes / p.counts.decided;
  const peers = places.list.filter((p) => p.kind === place.kind && p.counts.decided >= (p.kind === 'metro' ? FEW_DECIDED : 1));
  if (!peers.includes(place)) return null;
  const sorted = peers.map(share).sort((a, b) => b - a);
  return { rank: sorted.findIndex((v) => v <= share(place) + 1e-12) + 1, of: peers.length };
}

const points = (diff) => `${diff >= 0 ? '+' : '−'}${decimal(Math.abs(diff) * 100, 1)} pts`;

// The summary form against the nation.
function placeCard(place, { pd, places, fy }) {
  const c = place.counts;
  const nation = pd.counts.yes / pd.counts.decided;
  const share = c.decided ? c.yes / c.decided : null;
  const rank = rankOf(places, place);
  const allSix = pd.rows.filter((r) => r.ids.length === MEASURE_IDS.length).length / pd.rows.length;
  const kinds = place.kind === 'metro' ? fill('kpiKindsMetro', { few: count(FEW_DECIDED) }) : t(KINDS_WORDS[place.kind]);
  const fields = [
    { label: t('kpiCut'), value: count(c.yes), size: 'big', note: fill('kpiCutNote', { decided: count(c.decided) }) },
    share !== null && { label: t('kpiShare'), value: pct(share, 1), size: 'big', note: fill('kpiShareNote', { diff: points(share - nation), nation: pct(nation, 1) }) },
    rank && { label: t('kpiRank'), value: fill('kpiRankValue', { rank: ordinal(rank.rank), of: count(rank.of) }), note: fill('kpiRankNote', { kinds }) },
    c.median !== null && { label: t('kpiMedian'), value: cmsText(decimal(c.median, DP)), note: fill('kpiMedianNote', { nation: cmsText(decimal(pd.medianScore, DP)) }) },
    c.scored > 0 && { label: fill('kpiAllSix', { six: String(MEASURE_IDS.length) }), value: count(c.allSix), note: fill('kpiAllSixNote', { scored: count(c.scored), share: pct(c.allSix / c.scored, 0), nation: pct(allSix, 0) }) },
    { label: t('kpiAssigned'), value: count(c.assigned), note: t('kpiAssignedNote') },
  ].filter(Boolean);
  return html`<div class="place__card">
<div class="form prog__summary">
${formTitle(fill('placeCardTitle', { name: place.name, fy: String(fy) }), t('placeCardVs'))}
${fields.map((field, i) => html`${formField({ no: i + 1, ...field })}
`)}</div>
${share !== null ? stamp({ label: fill('placeStamp', { share: pct(share, 0) }), ink: !shownAbove(share, nation, 0) }) : ''}
</div>`;
}

// place: a buildPlaces() entry; places: all of them; pd: programData(); hospitalRows: Map ccn -> { name, city,
// totalText, decision, point, href } for the map; shapes, counties: the atlas; searchUrl: the hospitals asset.
export function placePage({ place, places, pd, model, hospitalRows, master, shapes, counties, fy, periods, source, searchUrl, exploreUrl = null, robots, assets, hd = null }) {
  const c = place.counts;
  const fyText = String(fy);
  const nation = pd.counts.yes / pd.counts.decided;
  const heading = fill('placeTitle', { name: place.name, fy: fyText });
  const line = sourceText({ fy, source });
  const deck = c.decided > 1
    ? fill('placeDeck', { yes: count(c.yes), decided: count(c.decided), name: nameInText(place), fy: fyText, share: pct(c.yes / c.decided, 1), nation: pct(nation, 1) })
    : c.decided === 1 ? fill(c.yes ? 'placeDeckOneYes' : 'placeDeckOneNo', { name: nameInText(place), fy: fyText })
      : c.file === 1 ? fill('placeDeckNoneOne', { name: nameInText(place), fy: fyText }) : fill('placeDeckNone', { n: count(c.file), name: nameInText(place), fy: fyText });
  const notes = [
    place.kind === 'metro' && place.stateCodes.length > 1 && fill('placeMultiState', { states: place.stateCodes.join(', ') }),
    place.rows.some((r) => r.yes === null) && t('placeMarylandNote'),
    c.decided > 0 && c.decided < FEW_DECIDED && t('placeSmall'),
  ].filter(Boolean);
  // Figures numbered in page order; a figure a place can't draw (no map, no decisions, no measures) takes no number.
  const figureNo = counter();
  const map = placeMapFigure({ place, places, pd, shapes, counties, hospitalRows, master, next: figureNo, source: line });
  const hist = c.decided ? placeHistFigure({ place, pd, model, next: figureNo, source: line }) : null;
  const measures = placeMeasuresFigure({ place, model, next: figureNo, source: line });
  const years = hd ? placeYearsFigure({ place, hd, master, next: figureNo, source: historySource(hd), src: searchUrl }) : null;
  const kids = place.kind === 'metro' ? null : childrenTable({ place, places, nation });
  const ccns = new Set(place.ccns);

  const body = html`<article class="wrap page page--prog page--place"${exploreUrl ? html` data-explore="${exploreUrl}"` : ''}>
${breadcrumb(places, place)}
<header class="page__head prog__top place__top">
<div class="prog__intro">
<p class="cap kicker prog__kicker">${t(KIND[place.kind])}</p>
<h1 class="place__title">${place.name}</h1>
<p class="prog__lede place__deck">${deck}</p>
${notes.map((s) => html`<p class="note">${s}</p>`)}
</div>
${placeCard(place, { pd, places, fy })}
</header>
${ruleFigure(pd, { highlight: ccns, searchUrl, caption: fill('placeRuleCaption', { name: nameInText(place) }), here: c.yes })}
${map && psec({ id: 'where', level: 2, heading: t('placeMapHeading'), text: html`<p>${t('placeMapText')}</p>`, figure: map })}
${hist && psec({ id: 'scores', level: 2, heading: t('placeHistHeading'), text: html`<p>${t('placeHistText')}</p>`, figure: hist })}
${measures && psec({ id: 'measures', level: 2, heading: t('placeMeasuresHeading'), text: html`<p>${t('placeMeasuresText')}</p>`, figure: measures })}
${years && psec({ id: 'years', level: 2, wide: true, heading: hfill('placeYearsHeading', { name: nameInText(place, { start: true }) }), text: html`<p>${hfill('placeYearsText', { name: nameInText(place) })}</p>`, figure: years })}
${kids ?? ''}
${hospitalTable({ fy, searchUrl, source, heading: fill('placeTableHeading', { name: nameInText(place) }), intro: t('placeTableIntro'), caption: fill('placeTableCaption', { name: nameInText(place) }), noScript: t('placeTableNoScript'), area: [...ccns].join(' ') })}
<div class="prog__foot">
<div class="prog__facts">
${asofBar({ fy, periods, source })}
${dataLinks(fy, source)}
<p class="page__links">${printLink(SITE.sites.hacrp.path, t('placeBack'))}</p>
</div>
<div class="prog__facts">
<p class="standing">${t('standing')}</p>
${citation({ fy, title: heading, path: place.path, source })}
</div>
</div>
</article>`;

  return page({
    title: `${heading} · ${SITE.name}`,
    description: fill('placeDescription', { fy: fyText, name: nameInText(place) }),
    path: place.path,
    robots,
    body,
    scripts: [assets.js.figure, assets.js.cite, assets.js.topbar, assets.js['hacrp-search'], assets.js['hacrp-place']],
    assets,
    topbar: siteHeader({ fy, current: 'map', searchUrl }),
  });
}
