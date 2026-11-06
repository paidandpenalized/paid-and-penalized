// A hospital page's "other hospitals in the area": the area's hospitals in one table, largest cut first, this one marked (its
// name, cut with a bar, modeled dollars, peer group and the six-condition glyph), 25 to a page with a pager the script shows
// (all pages show without it), the CSV of the same hospitals as one file for the area, and the kit's nearby map: this hospital a
// triangle and the area's other hospitals dots. Data from figures/neighbors-data.js.
import { areaMap, pointOf } from '../../../../web/charts/geo.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { printout } from '../../../../web/render/components.js';
import { placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { NEARBY_MAP_WIDTH, PAGE_SIZE } from '../constants.js';
import { csvPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../hospital/copy.js';
import { pagerNav } from './pager.js';
import { hospitalRow } from './place-row.js';

const cutWords = (h) => (h.red > 0 ? fill('nbTipCut', { cut: fmtPct(h.red) }) : t('nbTipNoCut'));

// What every hospital of an area shares, built once for the area: its hospitals' pages differ only in which row is marked and which
// dot is the triangle, so each row's markup, each page's body, each hospital's dot and the figure's data table are kept.
const SHARED = new WeakMap();
function sharedOf(area, conditions) {
  let shared = SHARED.get(area);
  if (shared) return shared;
  const tbody = (i, rows) => html`<tbody data-page="${i + 1}">${rows}</tbody>
`;
  const plain = new Map(area.rows.map((r) => [r.h.id, hospitalRow(r, conditions, { prefix: 'nb', rank: true, beds: false })]));
  shared = {
    tbodies: area.pages.map((page, i) => tbody(i, page.map((r) => plain.get(r.h.id)))),
    // The page with this hospital's row marked is drawn for the hospital's page; every other is the area's.
    marked: (i, here) => tbody(i, area.pages[i].map((r) => (r === here ? hospitalRow(r, conditions, { prefix: 'nb', rank: true, beds: false, current: t('nbCurrent') }) : plain.get(r.h.id)))),
    pins: new Map(area.rows.map((r) => [r.h.id, {
      point: pointOf(r.h), n: '', cls: `chart-pin--sm ${r.h.red > 0 ? 'chart-pin--yes' : 'chart-pin--no'}`,
      tip: fill('nbTip', { name: r.h.name, place: placeText({ city: r.h.city, state: r.h.st }), cut: cutWords(r.h) }),
    }])),
    table: {
      columns: [{ name: t('nbColRank'), numeric: true }, { name: t('nbColHospital') }, { name: t('nbColCut'), numeric: true }, { name: t('nbColDollars'), numeric: true }, { name: t('nbColPeer'), numeric: true }],
      rows: area.rows.map((r) => [
        num(String(r.rank), r.rank), `${r.h.name}, ${placeText({ city: r.h.city, state: r.h.st })}`, num(fmtPct(r.h.red), r.h.red), num(fmtMoney(r.h.pen), r.h.pen ?? null), num(String(r.h.peer), r.h.peer),
      ]),
    },
  };
  SHARED.set(area, shared);
  return shared;
}

// The map: every other hospital in the area a dot (red where it has a cut, open where it has none) with its name and cut in the
// tooltip, this hospital the triangle; county lines only for a metro area (a state's hospitals outside its metros fill a state-sized
// frame, where the lines would weigh tens of kilobytes and say little); null with fewer than two other hospitals placed, or without outlines.
// The frame is fitted around this hospital, so the projection is drawn for each page.
function nearbyMap(area, current, pins) {
  const { shapes, counties } = area.nearby;
  if (!shapes) return null;
  const center = pointOf(current);
  if (!center) return null;
  const points = area.rows.filter((r) => r.h.id !== current.id).map((r) => pins.get(r.h.id));
  return areaMap({
    shapes, counties: area.metro ? counties : [], label: t('nbMapAlt'), width: NEARBY_MAP_WIDTH,
    center: { point: center, tip: fill('nbMapThis', { name: current.name }) }, points,
  });
}

// area: figures.area (neighbors-data areaGroups' entry, with the outlines, conditions and year it is drawn from); view:
// hospitalView()'s result; n: the figure's number.
export function neighborsFigure(area, { view, n }) {
  const shared = sharedOf(area, area.nearby.conditions);
  const here = area.rows.find((r) => r.h.id === view.ccn);
  const where = area.metro ? fill('nbAreaMetro', { name: area.name }) : fill('nbAreaOutside', { state: area.name });
  const words = { n: fmtInt(area.rows.length), area: where };
  const takeaway = !area.nCut ? fill('nbTakeawayNone', words)
    : area.nCut === area.rows.length ? fill('nbTakeawayAll', words)
      : area.nCut === 1 ? fill('nbTakeawayOne', words) : fill('nbTakeaway', { ...words, cut: fmtInt(area.nCut) });
  const map = nearbyMap(area, here.h, shared.pins);
  const csvHref = csvPath(area.nearby.fy, area.csvName);
  const hereAt = area.pages.findIndex((page) => page.includes(here));
  const bodies = shared.tbodies.map((body, i) => (i === hereAt ? shared.marked(i, here) : body));
  const pager = area.pages.length > 1 ? pagerNav({ cls: 'nb', label: t('nbPager'), pages: area.pages }) : '';
  const chart = html`<div class="nb" data-nb>
<div>
${printout(html`<table class="gb nb__table" data-page-size="${PAGE_SIZE}">
<caption class="vh">${t('nbCaption')}</caption>
<thead><tr><th scope="col" class="num">${t('nbColRank')}</th><th scope="col">${t('nbColHospital')}</th><th scope="col" class="num">${t('nbColCut')}</th><th scope="col" class="num">${t('nbColDollars')}</th><th scope="col" class="num">${t('nbColPeer')}</th><th scope="col">${t('nbColConds')}</th></tr></thead>
${bodies}</table>`)}
${pager}
<p class="fig__actions"><a class="fig__btn nb__csv" href="${csvHref}" download>${t('nbCsv')}</a></p>
</div>
${map ? html`<div class="nb__map">${map}<p class="small muted">${t('nbNote')}</p></div>` : ''}
</div>`;
  return figure({
    n, takeaway, source: fill('nbSource', { edition: view.edition }), claimLevel: 'estimate',
    csvName: `hrrp-${view.ccn.toLowerCase()}-nearby`, chart, table: shared.table,
  });
}
