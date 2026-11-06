// A hospital page's "other hospitals in the area": the area's hospitals in one table, largest cut first, this one marked (its
// name, cut with a bar, modeled dollars, peer group and the six-condition glyph), 25 to a page with a pager the script shows
// (all pages show without it), the CSV of the same hospitals as one file for the area, and the kit's nearby map: this hospital a
// triangle and the area's other hospitals dots. Data from figures/neighbors-data.js.
import { CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { areaMap } from '../../../../web/charts/geo.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { printout } from '../../../../web/render/components.js';
import { listText, placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { NEARBY_MAP_WIDTH, NEIGHBORS_PAGE_SIZE } from '../constants.js';
import { conditionShort } from '../derive.js';
import { csvPath, hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../hospital/copy.js';
import { countedNames, glyph } from './picture.js';

const pointOf = (h) => (Number.isFinite(h.lon) && Number.isFinite(h.lat) ? [h.lon, h.lat] : null);
const cutWords = (h) => (h.red > 0 ? fill('nbTipCut', { cut: fmtPct(h.red) }) : t('nbTipNoCut'));

// The map: every other hospital in the area a dot (red where it has a cut, open where it has none) with its name and cut in the
// tooltip, this hospital the triangle; county lines only for a metro area (a state's hospitals outside its metros fill a state-sized
// frame, where the lines would weigh tens of kilobytes and say little); null with fewer than two other hospitals placed, or without outlines.
function nearbyMap(area, current, ctx) {
  if (!ctx.shapes) return null;
  const center = pointOf(current);
  if (!center) return null;
  const points = area.rows.filter((r) => r.h.id !== current.id).map((r) => ({
    point: pointOf(r.h), n: '', cls: `chart-pin--sm ${r.h.red > 0 ? 'chart-pin--yes' : 'chart-pin--no'}`,
    tip: fill('nbTip', { name: r.h.name, place: placeText({ city: r.h.city, state: r.h.st }), cut: cutWords(r.h) }),
  }));
  return areaMap({
    shapes: ctx.shapes, counties: area.metro ? ctx.counties : [], label: t('nbMapAlt'), width: NEARBY_MAP_WIDTH,
    center: { point: center, tip: fill('nbMapThis', { name: current.name }) }, points,
  });
}

function row(r, current, conditions) {
  const { h } = r;
  const names = countedNames(r, conditions);
  const here = h.id === current.id;
  return html`<tr${here ? html` class="is-current" aria-current="true"` : ''}><td class="num nb__rank">${String(r.rank)}</td><th scope="row"><a href="${hospitalPath(h.id)}">${h.name}</a>${here ? html` <span class="nb__here">${t('nbCurrent')}</span>` : ''}<span class="nb__place">${placeText({ city: h.city, state: h.st })}</span></th><td class="num nb__cut"><span class="nb__bar" style="--w: ${Math.min(100, (h.red / CAP_PCT) * 100).toFixed(1)}" aria-hidden="true"></span><span>${fmtPct(h.red)}</span></td><td class="num">${fmtMoney(h.pen)}</td><td class="num">${String(h.peer)}</td><td><span class="pen__glyph">${glyph(r, r.rank, conditions, 'nb')}</span><span class="vh">${names.length ? fill('nbCondsSpoken', { list: listText(names) }) : t('nbCondsNone')}</span></td></tr>`;
}

// area: figures.area (neighbors-data areaGroups' entry); view: hospitalView()'s result; ctx: the build's context (shapes, counties,
// the edition's conditions); n: the figure's number.
export function neighborsFigure(area, { view, ctx, n }) {
  const conditions = ctx.edition.conditions;
  const current = area.rows.find((r) => r.h.id === view.ccn).h;
  const where = area.metro ? fill('nbAreaMetro', { name: area.name }) : fill('nbAreaOutside', { state: area.name });
  const words = { n: fmtInt(area.rows.length), area: where };
  const takeaway = !area.nCut ? fill('nbTakeawayNone', words)
    : area.nCut === area.rows.length ? fill('nbTakeawayAll', words)
      : area.nCut === 1 ? fill('nbTakeawayOne', words) : fill('nbTakeaway', { ...words, cut: fmtInt(area.nCut) });
  const map = nearbyMap(area, current, ctx);
  const csvHref = csvPath(ctx.meta.fy, area.csvName);
  const pager = area.pages.length > 1
    ? html`<nav class="seg nb__pager" aria-label="${t('nbPager')}" hidden>${area.pages.map((_, i) => html`<button type="button" class="btn" data-to-page="${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}">${fill('nbPage', { n: String(i + 1) })}</button>`)}</nav>
<p class="small nb__status" role="status" data-template="${fill('nbStatus', { from: '{from}', to: '{to}', n: '{n}' })}" hidden></p>`
    : '';
  const chart = html`<div class="nb" data-nb data-current="${view.ccn}">
<div class="nb__tablewrap">
${printout(html`<table class="gb nb__table" data-page-size="${NEIGHBORS_PAGE_SIZE}">
<caption class="vh">${t('nbCaption')}</caption>
<thead><tr><th scope="col" class="num">${t('nbColRank')}</th><th scope="col">${t('nbColHospital')}</th><th scope="col" class="num">${t('nbColCut')}</th><th scope="col" class="num">${t('nbColDollars')}</th><th scope="col" class="num">${t('nbColPeer')}</th><th scope="col">${t('nbColConds')}</th></tr></thead>
${area.pages.map((page, i) => html`<tbody data-page="${i + 1}">${page.map((r) => row(r, current, conditions))}</tbody>
`)}</table>`)}
${pager}
<p class="fig__actions"><a class="fig__btn nb__csv" href="${csvHref}" download>${t('nbCsv')}</a></p>
</div>
${map ? html`<div class="nb__map">${map}<p class="small muted">${t('nbNote')}</p></div>` : ''}
</div>`;
  return figure({
    n, takeaway, source: fill('nbSource', { edition: view.edition }), claimLevel: 'estimate',
    csvName: `hrrp-${view.ccn.toLowerCase()}-nearby`, chart,
    table: {
      columns: [{ name: t('nbColRank'), numeric: true }, { name: t('nbColHospital') }, { name: t('nbColCut'), numeric: true }, { name: t('nbColDollars'), numeric: true }, { name: t('nbColPeer'), numeric: true }],
      rows: area.rows.map((r) => [
        num(String(r.rank), r.rank), `${r.h.name}, ${placeText({ city: r.h.city, state: r.h.st })}`, num(fmtPct(r.h.red), r.h.red), num(fmtMoney(r.h.pen), r.h.pen ?? null), num(String(r.h.peer), r.h.peer),
      ]),
    },
  });
}
