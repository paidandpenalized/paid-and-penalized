// The program page's "Map" Part: the state map in the family's choropleth (web/charts/geo.js usMap, as HACRP draws it) with
// four measures, each drawn at build time (the first shown, the others hidden for the browser's switch) and a layer of hospital
// dots, off by default, then "Every state" (a table of 15 to a page with its CSV) and "Browse by region". Nothing here needs a
// browser script to read: without one the first measure shows, every row of the table shows and the links work.
// Shares are of the hospitals measured on at least one condition, except the share cut 1% or more, which is over all the
// state's hospitals (figures/map-data.js). The dot layer is drawn once, over whichever measure shows.
import { US_MAP_CODES, usMap, usMapHeight, usPaths } from '../../../../web/charts/geo.js';
import { dotsPath } from '../../../../web/charts/dots.js';
import { figure, imagePair, num } from '../../../../web/charts/figure.js';
import { WIDTH } from '../../../../web/charts/svg.js';
import { noun } from '../../../../web/render/format.js';
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { GE_CUT_PCT, STATES_PAGE_SIZE } from '../constants.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { DOT_TIERS } from './map-data.js';

// The wide drawing's width: about the page's content on a wide screen. The dots are drawn on it only; a phone shows the shading.
export const MAP_WIDE = 1180;
// The largest dot's diameter on the wide drawing, in its units; dot area follows base payments (map-data.js dotPoints).
const DOT_MAX = 11;
const DOT_CLASS = { cut: 'chart-dots--pen', kept: 'chart-dots--ring', none: 'chart-dots--faint' };
// Drawn from the faint to the cut, so a cut hospital sits on top.
const DOT_ORDER = ['none', 'kept', 'cut'];

const MILLION = 1e6;
const pct = (v, dp) => fmtPct(v, dp);

// How each measure is written: its switch label, legend title, a threshold, and a state's tooltip.
const WORDS = {
  avg: {
    switch: () => t('mapMeasureAvg'), legend: () => t('mapLegendAvg'), edge: (x) => pct(x, 2), alt: () => t('mapMeasureAvg').toLowerCase(),
    tip: (r, c) => fill('mapTipAvg', { value: pct(c.value, 2), hospitals: noun(r.s.n, 'hospital') }),
  },
  share: {
    switch: () => t('mapMeasureShare'), legend: () => t('mapLegendShare'), edge: (x) => pct(x, 0), alt: () => t('mapMeasureShare').toLowerCase(),
    tip: (r, c) => fill('mapTipShare', { value: pct(c.value, 0), nPen: fmtInt(r.s.nPen), nMeasured: fmtInt(r.s.nMeasured) }),
  },
  dollars: {
    switch: () => t('mapMeasureDollars'), legend: () => t('mapLegendDollars'), edge: (x) => fmtMoney(x * MILLION), alt: () => t('mapMeasureDollars').toLowerCase(),
    tip: (r, c) => fill('mapTipDollars', { value: fmtMoney(c.raw * MILLION), hospitals: noun(r.nEstimated, 'hospital') }),
  },
  ge1: {
    switch: () => fill('mapMeasureGe1', { pct: String(GE_CUT_PCT) }), legend: () => fill('mapLegendGe1', { pct: String(GE_CUT_PCT) }), edge: (x) => pct(x, 0),
    alt: () => fill('mapMeasureGe1', { pct: String(GE_CUT_PCT) }).toLowerCase(),
    tip: (r, c) => fill('mapTipGe1', { value: pct(c.value, 0), pct: String(GE_CUT_PCT), k: fmtInt(r.s.nGe1), n: fmtInt(r.s.n) }),
  },
};
const NO_VALUE = { avg: 'mapNoMeasured', share: 'mapNoMeasured', dollars: 'mapNoEstimate', ge1: 'mapNoMeasured' };

// The states entries usMap takes for a measure: a state in the file is shaded (or, with nothing to measure, left plain with
// its reason); the state the program leaves out is hatched; any other state without a hospital is plain, "no hospitals in
// the program". Every code the map draws is given.
function entriesOf(measure, { rows, notInProgram }) {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const words = WORDS[measure.key];
  return Object.fromEntries(US_MAP_CODES.map((code) => {
    const row = byCode.get(code);
    if (!row) return [code, code === notInProgram ? { hatched: true, label: t('mapNotInProgram') } : { empty: true, label: t('mapNoHospitals') }];
    const cell = row.m[measure.key];
    // A shown zero that takes a bin (dollars) is passed as the smallest positive number, so usMap shades it, not plain.
    return [code, cell ? { value: cell.value === 0 && cell.bin > 0 ? Number.EPSILON : cell.value, label: words.tip(row, cell) } : { empty: true, label: t(NO_VALUE[measure.key]) }];
  }));
}

// The hospital dots over the map: one path for each kind and size, the largest first so a small dot is not hidden. A layer of
// the wide drawing's width that CSS shows when the dots are on (class chart-us__points, as HACRP's).
function dotLayer(shapes, dots, width) {
  const { projection } = usPaths(shapes, width);
  const groups = new Map();
  for (const d of dots) {
    const at = projection(d.point);
    if (!at) continue;
    const key = `${d.kind}:${d.tier}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(at);
  }
  const paths = [];
  for (const kind of DOT_ORDER) {
    for (let tier = DOT_TIERS; tier >= 1; tier--) {
      paths.push(dotsPath(groups.get(`${kind}:${tier}`) ?? [], DOT_CLASS[kind], (tier / DOT_TIERS) * DOT_MAX));
    }
  }
  return html`<g class="chart-us__points">${paths}</g>`;
}

const dotKey = () => html`<ul class="usmap__key" role="list"><li><span class="usmap__sw usmap__sw--pen"></span>${t('mapDotsCut')}</li><li><span class="usmap__sw usmap__sw--ring"></span>${t('mapDotsKept')}</li><li><span class="usmap__sw usmap__sw--faint"></span>${t('mapDotsNone')}</li></ul>`;

// The map figure, or '' when the page has no outlines or no state has a value to shade (and then no figure number is used).
// data: view.map; nextFigure: the page's figure counter.
function mapFigure(data, { nextFigure, edition }) {
  const { rows, shapes, dots, measures } = data;
  const [first] = measures;
  const shaded = rows.filter((r) => r.m[first.key] && US_MAP_CODES.includes(r.code));
  if (!shapes || !shaded.length) return '';
  const n = nextFigure();
  const draw = (measure) => {
    const states = entriesOf(measure, data);
    const values = Object.values(states).filter((s) => s.value !== undefined).map((s) => s.value);
    const words = WORDS[measure.key];
    const legend = { title: words.legend(), high: words.edge(Math.max(...values)), zero: t('mapZero') };
    const one = (id, width, over) => usMap({ id, shapes, states, ramp: [...measure.ramp], format: words.edge, width, legend, overlay: over });
    return imagePair({ svg: one(`map-${measure.key}`, WIDTH, ''), svgWide: one(`map-${measure.key}-wide`, MAP_WIDE, '') }, fill('mapAlt', { measure: words.alt() }));
  };
  const chart = html`<div class="usmap" data-measure="${first.key}" data-dots="off">
<div class="usmap__controls" hidden>
<div class="mtoggle usmap__modes" role="group" aria-label="${t('mapMeasures')}">${measures.map((m) => html`<button type="button" class="mtoggle__b" data-measure="${m.key}" aria-pressed="${m.key === first.key ? 'true' : 'false'}">${WORDS[m.key].switch()}</button>`)}</div>
<div class="mtoggle usmap__dotsbtn"><button type="button" class="mtoggle__b" data-dots aria-pressed="false">${t('mapDotsToggle')}</button></div>
</div>
<div class="usmap__stage">
${measures.map((m) => html`<div class="usmap__m" data-measure="${m.key}"${m.key === first.key ? '' : html` hidden`}>${draw(m)}</div>
`)}<svg class="usmap__dots" viewBox="0 0 ${MAP_WIDE} ${usMapHeight(MAP_WIDE)}" aria-hidden="true" focusable="false">${dotLayer(shapes, dots, MAP_WIDE)}</svg>
</div>
${dotKey()}
</div>`;
  const hi = shaded.reduce((a, b) => (b.s.meanRed > a.s.meanRed ? b : a));
  const lo = shaded.reduce((a, b) => (b.s.meanRed < a.s.meanRed ? b : a));
  const takeaway = shaded.length === 1
    ? fill('mapTakeawayOne', { state: hi.name, value: pct(hi.m.avg.value, 2) })
    : fill('mapTakeaway', { lo: pct(lo.m.avg.value, 2), loState: lo.name, hi: pct(hi.m.avg.value, 2), hiState: hi.name });
  const cell = (row, key, text) => { const c = row.m[key]; return c ? num(text(c), c.raw) : num('—', null); };
  const byName = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return figure({
    n, takeaway, chart, source: fill('mapSource', { edition }), claimLevel: 'estimate', csvName: 'hrrp-map-states', note: fill('mapNote', { pct: String(GE_CUT_PCT) }),
    table: {
      columns: [
        { name: t('mapColState') }, { name: t('mapColHospitals'), numeric: true }, { name: t('mapColAvg'), numeric: true }, { name: t('mapColShare'), numeric: true },
        { name: t('mapColDollars'), numeric: true }, { name: fill('mapColGe1', { pct: String(GE_CUT_PCT) }), numeric: true },
      ],
      rows: byName.map((r) => [
        r.name, num(fmtInt(r.s.n), r.s.n), cell(r, 'avg', (c) => pct(c.value, 2)), cell(r, 'share', (c) => pct(c.value, 0)),
        cell(r, 'dollars', (c) => fmtMoney(c.raw * MILLION)), cell(r, 'ge1', (c) => pct(c.value, 0)),
      ]),
    },
  });
}

// "Every state": the average cut, highest first, STATES_PAGE_SIZE to a page: one tbody for each page (all showing until a
// script pages them), a pager the script shows, and the CSV.
function everyStateBlock(data) {
  const ge = fill('statesColGe1', { pct: String(GE_CUT_PCT) });
  return html`<div class="states">
<h3 class="part__sub" id="map-states-h">${t('statesHeading')}</h3>
<p class="small muted">${fill('statesIntro', { size: String(STATES_PAGE_SIZE) })}</p>
${printout(html`<table class="gb states__table" data-page-size="${STATES_PAGE_SIZE}" aria-labelledby="map-states-h">
<thead><tr><th scope="col">${t('statesColState')}</th><th scope="col" class="num">${t('statesColHospitals')}</th><th scope="col" class="num" title="${t('statesPenalizedTitle')}">${t('statesColPenalized')}</th><th scope="col" class="num">${t('statesColAvg')}</th><th scope="col" class="num">${ge}</th><th scope="col" class="num">${t('statesColDollars')}</th></tr></thead>
${data.pages.map((page, i) => html`<tbody data-page="${i + 1}">${page.map((r) => html`<tr><th scope="row"><a href="${r.path}">${r.name}</a></th><td class="num">${fmtInt(r.s.n)}</td><td class="num">${r.s.pctPen == null ? '—' : pct(r.s.pctPen, 0)}</td><td class="num">${pct(r.s.meanRed, 2)}</td><td class="num">${fmtInt(r.s.nGe1)}</td><td class="num">${r.nEstimated ? fmtMoney(r.s.penTotal) : '—'}</td></tr>`)}</tbody>
`)}</table>`)}
<nav class="states__pager" aria-label="${t('statesPager')}" hidden>${data.pages.map((_, i) => html`<button type="button" class="mtoggle__b" data-to-page="${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}">${fill('statesPage', { n: String(i + 1) })}</button>`)}</nav>
<p class="small states__csv"><a href="${data.csvHref}" download>${t('statesDownload')}</a></p>
</div>`;
}

// "Browse by region": each region, its divisions and each division's states, every one a link to its page.
function browseBlock({ regions }) {
  return html`<nav class="browse" aria-labelledby="map-browse-h">
<h3 class="part__sub" id="map-browse-h">${t('browseHeading')}</h3>
<p class="small muted">${t('browseIntro')}</p>
<ul class="browse__regions" role="list">${regions.map(({ place, divisions }) => html`<li><a class="browse__region" href="${place.path}">${place.name}</a>
<ul class="browse__divs" role="list">${divisions.map((d) => html`<li><a class="browse__div" href="${d.place.path}">${d.place.name}</a> <span class="browse__states">${d.states.map((s, i) => html`${i ? ', ' : ''}<a href="${s.path}">${s.name}</a>`)}</span></li>`)}</ul></li>`)}</ul>
</nav>`;
}

// map: view.map (map-data.js mapData with csvHref); figure: the page's figure counter; edition: the edition's label.
export function mapPart(map, { figure: nextFigure, edition }) {
  const drawn = mapFigure(map, { nextFigure, edition });
  return html`<p class="part__intro">${fill('mapIntro', { pct: String(GE_CUT_PCT) })} ${map.notInProgram ? t('mapMaryland') : ''}</p>
${drawn}
${map.rows.length ? everyStateBlock(map) : ''}
${map.rows.length ? browseBlock(map) : ''}`;
}
