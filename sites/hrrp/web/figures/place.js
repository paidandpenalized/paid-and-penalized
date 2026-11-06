// A place page's figures, ported from Thirty Day Readmissions' state page (web/src/js/views/scope.js and national.js at 33d1959)
// in its look: the hospitals on the map (dots sized by Medicare volume, shaded by cut), the size of the cuts (the place as bars,
// all hospitals as an outline, both as shares), which conditions drive the penalties here (left: the share of measured hospitals
// penalized on each condition against all hospitals' tick; right: the share of the estimated dollars), the peer groups and the
// average cut over time. Each is a function of figures/place-data.js's data and returns the figure's markup, or '' when the place
// has nothing to draw (the page then gives the figure no number). Words: place/copy.js.
import { scaleLinear } from 'd3-scale';
import { CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { barRows } from '../../../../web/charts/barRows.js';
import { compareHist } from '../../../../web/charts/compareHist.js';
import { WIDE, drawn, figure, imagePair, num } from '../../../../web/charts/figure.js';
import { countiesOf, placeMap } from '../../../../web/charts/geo.js';
import { WIDTH, frame, isNarrow, lineD, mark, r2, text } from '../../../../web/charts/svg.js';
import { html } from '../../../../web/render/html.js';
import { placeText } from '../../../../web/render/format.js';
import { PLACE_MAP_WIDE, PLACE_SHADES } from '../constants.js';
import { conditionShort } from '../derive.js';
import { hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct, roundTo } from '../numbers.js';
import { fill as placeFill, t as placeT } from '../place/copy.js';
import { fyLabel } from '../copy.js';
import { hospitals as hospitalsText } from '../wording.js';
import { yearAxis } from './year-axis.js';

const pct0 = (share) => fmtPct(share * 100, 0);

// ---------- the map ----------

// A dot's radius on each size step, drawn at the phone's width or the wide one's (units of the drawing).
const RADII = { narrow: [2.4, 3.3, 4.3, 5.4], wide: [3, 4.2, 5.4, 6.8] };
const radius = (size, width) => RADII[isNarrow(width) ? 'narrow' : 'wide'][size - 1];

// A dot's class: faint (an other hospital), the ring (no cut) or a cut's shade; a dense map's dots are strokes (chart-dots), the others' circles.
const shadeName = (shade) => (shade < 0 ? 'faint' : shade === 0 ? 'ring' : `cut-${shade}`);
const shadeClass = (shade, dense) => `${dense ? 'chart-dots' : 'chart-place__dot'}--${shadeName(shade)}`;

// The words of shade k's range, as the old site's legend had them ("Under 0.25%", "0.25%–0.49%", "2.00%–3.00%").
function shadeWords(shade) {
  if (shade === 0) return placeT('mapKeyNone');
  const last = PLACE_SHADES.length + 1;
  if (shade === 1) return placeFill('mapKeyUnder', { to: fmtPct(PLACE_SHADES[0]) });
  const from = PLACE_SHADES[shade - 2];
  return placeFill('mapKeyBand', { from: fmtPct(from), to: fmtPct(shade === last ? CAP_PCT : PLACE_SHADES[shade - 1] - 0.01) });
}

const keyOf = ({ dense, around }) => html`<div class="place__keybox"><p class="place__keytitle">${placeT('mapKeyTitle')}</p>
<ul class="usmap__lg place__key${dense ? ' place__key--dense' : ''}" role="list" aria-label="${placeT('mapKeyTitle')}">${Array.from({ length: PLACE_SHADES.length + 2 }, (_, shade) => html`<li><span class="usmap__sw ${shade === 0 ? 'usmap__sw--ring' : `place__sw--cut-${shade}`}" aria-hidden="true"></span>${shadeWords(shade)}</li>`)}${around ? html`<li><span class="usmap__sw usmap__sw--faint" aria-hidden="true"></span>${placeT('mapKeyAround')}</li>` : ''}</ul></div>`;

// The map's dots, by draw order: the others (faint) first, then no cut, then the cuts from the smallest to the largest, big dots under small.
const drawOrder = (a, b) => a.shade - b.shade || b.size - a.size;

// place: buildPlaces() entry; md: place-data mapData(); ctx: the area context (shapes, counties, edition); nextFigure: the page's
// counter, called only when the figure draws (a place with nothing to draw takes no number).
export function mapFigure(place, md, ctx, nextFigure) {
  const { shapes } = ctx;
  if (!shapes || !md.own.length) return '';
  const metro = place.kind === 'metro';
  const around = md.around.length > 0;
  const codes = metro ? [] : place.states;
  const lines = place.kind === 'state' ? countiesOf(ctx.counties ?? [], place.states[0]) : metro ? ctx.counties ?? [] : [];
  const cutTip = (h) => (h.red > 0 ? placeFill('mapTipCut', { cut: fmtPct(h.red) }) : placeT('mapTipNone'));
  const dot = (p, width) => ({
    point: [p.h.lon, p.h.lat], r: radius(p.size, width), cls: shadeClass(p.shade, false),
    tip: placeFill('mapTip', { name: p.h.name, place: placeText({ city: p.h.city, state: p.h.st }), cut: cutTip(p.h) }), href: hospitalPath(p.h.id),
  });
  const all = [...md.around, ...md.own].sort(drawOrder);
  const alt = around ? placeFill('mapAltAround', { name: place.name, where: placeT(place.states.length > 1 ? 'mapAroundMany' : 'mapAroundOne') }) : placeFill('mapAlt', { name: place.name });
  const draw = (width) => {
    let points;
    let dense = null;
    if (md.dense) {
      points = all.map((p) => ({ point: [p.h.lon, p.h.lat], cls: `${shadeClass(p.shade, true)} pt-${p.size}` }));
      // The dense map's paths, one for each shade and size, each stroke as wide as the dot is.
      dense = {};
      for (const p of all) dense[`${shadeClass(p.shade, true)} pt-${p.size}`] = 2 * radius(p.size, width);
    } else points = all.map((p) => dot(p, width));
    return placeMap({
      variant: width > WIDTH ? 'wide' : 'narrow', shapes, counties: lines, codes, fit: metro ? 'points' : 'states', points, label: alt, width,
      aspect: place.kind === 'state' || metro ? 0.8 : 0.62, dense,
    });
  };
  const [narrow, wide] = [draw(WIDTH), draw(PLACE_MAP_WIDE)];
  if (!narrow || !wide) return '';
  const top = md.own.reduce((a, p) => (p.h.red > a.h.red ? p : a), md.own[0]);
  const nCut = place.hospitals.filter((h) => h.red > 0).length;
  const cut = fmtPct(top.h.red);
  const hospitals = hospitalsText(place.hospitals.length);
  const takeaway = place.hospitals.length === 1 ? (nCut ? placeFill('mapTakeawayOneCut', { cut }) : placeT('mapTakeawayOneNone'))
    : !nCut ? placeFill('mapTakeawayNone', { hospitals }) : placeFill(nCut === 1 ? 'mapTakeawayOnly' : 'mapTakeaway', { nCut: fmtInt(nCut), hospitals, cut, name: top.h.name });
  const note = [
    placeT(md.dense ? 'mapNoteDense' : 'mapNote'),
    around && placeFill('mapNoteAround', { where: placeT(place.states.length > 1 ? 'mapAroundMany' : 'mapAroundOne') }),
    md.unplaced > 0 && placeFill('mapNoteUnplaced', { hospitals: hospitalsText(md.unplaced), them: placeT(md.unplaced === 1 ? 'mapThemOne' : 'mapThemMany') }),
  ].filter(Boolean).join('');
  const table = md.dense ? {
    columns: [{ name: placeT('mapColRange') }, { name: placeT('mapColCount'), numeric: true }],
    rows: md.tally.map((count, shade) => [shadeWords(shade), num(fmtInt(count), count)]),
  } : {
    columns: [{ name: placeT('mapColHospital') }, { name: placeT('mapColCity') }, { name: placeT('mapColCut'), numeric: true }, { name: placeT('mapColBase'), numeric: true }],
    rows: [...place.hospitals].sort((a, b) => b.red - a.red || a.name.localeCompare(b.name, 'en')).map((h) => [
      h.name, h.city ?? '\u2014', num(fmtPct(h.red), h.red), h.base > 0 ? num(fmtMoney(h.base), h.base) : num('—', null),
    ]),
  };
  return figure({
    n: nextFigure(), takeaway, source: placeFill('mapSource', { edition: ctx.edition.label }), csvName: `hrrp-${place.kind}-${place.key}-map`,
    chart: html`${narrow}
${wide}
${keyOf({ dense: md.dense, around })}`, note, table,
  });
}

// ---------- the size of the cuts ----------

// sd: place-data sizeData(); edition: the edition's label; name: the place's.
export function sizeFigure(sd, { name, id, edition, n }) {
  const tip = (i) => {
    const r = sd.rows[i];
    const words = { n: fmtInt(r.n), share: pct0(r.share), nation: pct0(r.nationShare) };
    return i === 0 ? placeFill('sizeTipNone', words) : placeFill('sizeTip', { ...words, from: fmtPct(r.from, 1), to: fmtPct(r.to, 1) });
  };
  const avg = sd.avg > 0 ? { at: sd.avg, label: placeFill('sizeAverage', { pct: fmtPct(sd.avg) }) } : null;
  const draw = (width) => compareHist({
    edges: sd.edges, place: sd.counts, nation: sd.nation, line: 0, labels: { line: '' }, tip, width, avg, first: placeT('sizeNoneWord'),
    format: (v) => (v === 0 ? '' : `${v}%`),
  });
  const [key, words] = sd.n === 1
    ? (sd.nNone ? ['sizeTakeawayOneNone', {}] : ['sizeTakeawayOneCut', { cut: fmtPct(sd.avg) }])
    : sd.nNone === sd.n ? ['sizeTakeawayNone', { hospitals: hospitalsText(sd.n) }]
      : sd.nNone === 0 ? ['sizeTakeawayAll', { hospitals: hospitalsText(sd.n), average: fmtPct(sd.avg) }]
        : ['sizeTakeaway', { hospitals: hospitalsText(sd.n), zero: fmtInt(sd.nNone), average: fmtPct(sd.avg) }];
  return figure({
    n, takeaway: placeFill(key, { nation: pct0(sd.nationNone), ...words }), source: placeFill('sizeSource', { edition }), csvName: `hrrp-${id}-cuts`,
    ...drawn(draw, WIDE), alt: placeFill('sizeAlt', { name }), note: placeFill('sizeNote', { name }),
    table: {
      columns: [{ name: placeT('sizeColFrom'), numeric: true }, { name: placeT('sizeColTo'), numeric: true }, { name: placeT('sizeColN'), numeric: true }, { name: placeT('sizeColShare'), numeric: true }, { name: placeT('sizeColNation'), numeric: true }],
      rows: sd.rows.map((r) => [
        r.from === null ? placeT('sizeRowNone') : num(fmtPct(r.from, 1), r.from), r.to === null ? '—' : num(fmtPct(r.to, 1), r.to),
        num(fmtInt(r.n), r.n), num(pct0(r.share), roundTo(r.share * 100, 2)), num(pct0(r.nationShare), roundTo(r.nationShare * 100, 2)),
      ]),
    },
  });
}

// ---------- which conditions drive the penalties here ----------

// The label column's width for these labels in the rows' type (bold, mono, 11 units).
const labelWidth = (labels) => Math.ceil(Math.max(...labels.map((l) => [...l].length)) * 6.6) + 12;
const nameAt = (conditions, width) => (cond) => conditionShort(conditions, cond, { narrow: isNarrow(width) });

// cd: place-data conditionsData(); conditions: the edition's condition list.
export function conditionsFigure(cd, { conditions, id, edition, n }) {
  if (!cd.measuredAny) return '';
  const measured = cd.rows.filter((r) => r.measured > 0);
  // One panel's bars: rows { label, sub, value, valueText, pen, tip, tick? }, the label column as wide as its longest label or sub line.
  const panelBars = (rows, width) => barRows({ width, max: 100, labelW: labelWidth(rows.flatMap((r) => [r.label, r.sub])), rows });
  const left = (width) => {
    const name = nameAt(conditions, width);
    return panelBars(measured.map((r) => ({
      label: name(r.cond), sub: placeFill(isNarrow(width) ? 'condLeftSubShort' : 'condLeftSub', { nPen: fmtInt(r.flags), n: fmtInt(r.measured) }),
      value: r.share * 100, valueText: pct0(r.share), pen: true, tick: r.nationShare === null ? null : r.nationShare * 100,
      tip: placeFill('condTipLeft', { cond: conditionShort(conditions, r.cond), nPen: fmtInt(r.flags), n: fmtInt(r.measured), share: pct0(r.share), nation: r.nationShare === null ? '—' : pct0(r.nationShare) }),
    })), width);
  };
  const right = (width) => {
    const name = nameAt(conditions, width);
    return panelBars(cd.byDollars.map((r) => ({
      label: name(r.cond), sub: placeFill('condRightSub', { dollars: fmtMoney(r.dollars) }), value: r.shareOfDollars * 100, valueText: pct0(r.shareOfDollars), pen: true,
      tip: placeFill('condTipRight', { cond: conditionShort(conditions, r.cond), dollars: fmtMoney(r.dollars), share: pct0(r.shareOfDollars) }),
    })), width);
  };
  const panel = (title, draw, alt) => html`<div class="hosphist__panel"><h3 class="hosphist__title">${title}</h3>${imagePair(drawn(draw, WIDE), alt)}</div>`;
  const hasDollars = cd.byDollars.length > 0;
  const chart = html`<div class="hosphist">
${panel(placeT('condTitleLeft'), left, placeT('condAltLeft'))}
${hasDollars ? panel(placeT('condTitleRight'), right, placeT('condAltRight')) : html`<div class="hosphist__panel"><h3 class="hosphist__title">${placeT('condTitleRight')}</h3><p class="small muted">${placeT('condNoDollars')}</p></div>`}
</div>`;
  const lead = cd.byDollars[0];
  const takeaway = hasDollars ? placeFill('condTakeaway', { cond: conditionShort(conditions, lead.cond), share: pct0(lead.shareOfDollars) }) : placeT('condTakeawayNoDollars');
  return figure({
    n, takeaway, source: placeFill('condSource', { edition }), claimLevel: 'estimate', csvName: `hrrp-${id}-conditions`,
    chart, key: [{ swatch: 'median', label: placeT('condKeyAll') }], note: placeT('condNote'),
    table: {
      columns: [{ name: placeT('condColCond') }, { name: placeT('condColMeasured'), numeric: true }, { name: placeT('condColPen'), numeric: true }, { name: placeT('condColShare'), numeric: true },
        { name: placeT('condColNation'), numeric: true }, { name: placeT('condColDollars'), numeric: true }, { name: placeT('condColDollarShare'), numeric: true }],
      rows: cd.rows.map((r) => [
        conditionShort(conditions, r.cond), num(fmtInt(r.measured), r.measured), num(fmtInt(r.flags), r.flags),
        r.share === null ? num('—', null) : num(pct0(r.share), roundTo(r.share * 100, 2)),
        r.nationShare === null ? num('—', null) : num(pct0(r.nationShare), roundTo(r.nationShare * 100, 2)),
        hasDollars ? num(fmtMoney(r.dollars), r.dollars) : num('—', null),
        r.shareOfDollars === null ? num('—', null) : num(pct0(r.shareOfDollars), roundTo(r.shareOfDollars * 100, 2)),
      ]),
    },
  });
}

// ---------- peer groups ----------

export function peersFigure(pd, { id, edition, total, n }) {
  const draw = (width) => {
    const labels = pd.rows.map((r) => placeFill('peerGroup', { n: String(r.peer) }));
    const wide = labelWidth([...labels, placeFill('peerSub', { pct: '0.00%' })]);
    return barRows({
      width, max: Math.max(1, ...pd.rows.map((r) => r.n)), labelW: wide,
      rows: pd.rows.map((r, i) => ({
        label: labels[i], sub: r.n ? placeFill('peerSub', { pct: fmtPct(r.avg) }) : placeT('peerNone'), value: r.n, valueText: fmtInt(r.n),
        tip: r.n ? placeFill('peerTip', { peer: String(r.peer), hospitals: hospitalsText(r.n), pct: fmtPct(r.avg) }) : placeFill('peerTipNone', { peer: String(r.peer) }),
      })),
    });
  };
  const top = pd.top;
  const group = String(top.peer);
  const takeaway = total === 1 ? placeFill('peerTakeawayOne', { group })
    : top.n * 2 > total ? placeFill('peerTakeaway', { hospitals: hospitalsText(total), group })
      : placeFill('peerTakeawayLargest', { group, n: fmtInt(top.n), hospitals: hospitalsText(total) });
  return figure({
    n, takeaway, source: placeFill('peerSource', { edition }), csvName: `hrrp-${id}-peer-groups`,
    ...drawn(draw, WIDE), alt: placeT('peerAlt'),
    note: placeFill('peerNote', { first: String(pd.rows[0].peer), last: String(pd.rows[pd.rows.length - 1].peer) }),
    table: {
      columns: [{ name: placeT('peerColGroup') }, { name: placeT('peerColN'), numeric: true }, { name: placeT('peerColAvg'), numeric: true }],
      rows: pd.rows.map((r) => [placeFill('peerGroup', { n: String(r.peer) }), num(fmtInt(r.n), r.n), r.avg === null ? num(placeT('peerNone'), null) : num(fmtPct(r.avg), roundTo(r.avg, 4))]),
    },
  });
}

// ---------- average cut over time ----------

const BAR = { top: 26, bottom: 26, left: 40, right: 12, h: 150 };

// The place's average cut as a line with a dot for each year, every hospital's as a dashed line, the cap's steps as dashed rules and the
// pandemic years shaded. A year with no hospital of the place in its file breaks the line.
function trendChart({ td, width }) {
  const { years, caps, covid } = td;
  const M = BAR;
  const k = years.length;
  const narrow = isNarrow(width);
  const x = scaleLinear().domain([0, k - 1]).range([M.left, width - M.right]);
  const seen = years.flatMap((yr) => [yr.here, yr.all]).filter((v) => v !== null);
  const top = Math.max(0.5, Math.ceil(Math.max(...seen, 0) * 2 - 1e-9) / 2);
  const y = scaleLinear().domain([0, top]).range([M.top + M.h, M.top]);
  const ticks = scaleLinear().domain([0, top]).ticks(top <= 1 ? 2 : Math.round(top * 2)).filter((v) => v >= 0 && v <= top);
  const every = narrow ? 2 : 1;
  const step = (width - M.left - M.right) / Math.max(1, k - 1);
  const axis = yearAxis({
    M, width, narrow, years, caps, covid, y, ticks, tickText: (v) => `${v}%`, every,
    bandAt: (c0, c1) => ({ x: x(c0) - step / 2, w: (c1 - c0 + 1) * step, mid: (x(c0) + x(c1)) / 2 }),
    xAt: x, ruleAt: x,
  });
  const dots = years.map((yr, i) => {
    const all = yr.all === null ? placeT('trendNa') : fmtPct(yr.all);
    const tip = yr.here === null ? placeFill('trendTipNone', { fy: fyLabel(yr.fy), all }) : placeFill('trendTip', { fy: fyLabel(yr.fy), here: fmtPct(yr.here), all });
    const dot = yr.here === null ? '' : html`<circle class="hist-dot--pen" cx="${r2(x(i))}" cy="${r2(y(yr.here))}" r="${narrow ? 2.4 : 3}"/>`;
    return mark({ tip, value: yr.here === null ? null : roundTo(yr.here, 4), hit: { x: x(i) - step / 2, y: M.top, width: step, height: M.h }, body: dot });
  });
  const last = years[k - 1];
  const lastLabel = last.here === null ? '' : text({ x: x(k - 1), y: y(last.here) + (last.all !== null && last.all > last.here ? 14 : -8), anchor: 'end', cls: 'chart-value chart-value--mark chart-label--halo', body: fmtPct(last.here) });
  const line = (key) => lineD(years.map((yr, i) => ({ x: i, y: yr[key] })), x, y);
  return frame({
    kind: 'trend', width, height: M.top + M.h + M.bottom, body: html`${axis.head}
${axis.rules}
<path class="chart-lines__under" d="${line('all')}"/>
<path class="hist-line hist-line--pen" d="${line('here')}"/>
${dots}${lastLabel}
${axis.yearLabels}`,
  });
}

// td: place-data trendData(); span: the history's span ("FY2013–FY2027").
export function trendFigure(td, { name, id, edition, span, n }) {
  const last = td.years[td.years.length - 1];
  if (last.here === null) return '';
  const cell = (v) => (v === null ? num(placeT('trendNa'), null) : num(fmtPct(v), roundTo(v, 4)));
  return figure({
    n, takeaway: placeFill('trendTakeaway', { fy: fyLabel(last.fy), name, here: fmtPct(last.here), all: fmtPct(last.all) }),
    source: placeFill('trendSource', { span }), claimLevel: 'recomputed', csvName: `hrrp-${id}-average-cut`,
    ...drawn((width) => trendChart({ td, width }), WIDE), alt: placeT('trendAlt'),
    note: `${placeFill('trendNote', { name, edition })}${td.covid.fys.length ? ` ${td.covid.note}` : ''}`,
    table: {
      columns: [{ name: placeT('trendColFy') }, { name: placeT('trendColHere'), numeric: true }, { name: placeT('trendColAll'), numeric: true }],
      rows: td.years.map((yr) => [fyLabel(yr.fy), cell(yr.here), cell(yr.all)]),
    },
  });
}
