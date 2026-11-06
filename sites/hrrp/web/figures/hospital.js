// A hospital page's figures: where the penalty came from (the kit's ruler for each condition on its own peer group's range, the
// gap, its price and its part of the modeled cut in columns at the right [RU-02]), the penalty history (this hospital's cut each
// year as bars against the average of every hospital, and its place among the year's cuts) and the full worksheet. Data in from
// figures/hospital-data.js (the view's `figures`); the words are in hospital/copy.js.
import { scaleLinear } from 'd3-scale';
import { WIDE, drawn, figure, imageOf, imagePair, num } from '../../../../web/charts/figure.js';
import { rankYears } from '../../../../web/charts/rankYears.js';
import { ruler } from '../../../../web/charts/ruler.js';
import { WIDTH, columnPath, frame, isNarrow, lineD, mark, r2, text } from '../../../../web/charts/svg.js';
import { decimal, pct, pctFloor, roundedDollars } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { fill, t } from '../hospital/copy.js';
import { MIN_DISCHARGES, CAP_PCT } from '../../../../engine/js/hrrp/formula.js';
import { fmtInt, fmtPct, gapText, ratio, roundTo } from '../numbers.js';
import { worksheetHtml } from '../worksheet.js';
import { PER_STEP } from './hospital-data.js';
import { yearAxis, yy } from './year-axis.js';

const RULER_WIDE = 480;
const STEP = ratio(PER_STEP, 2);
const slug = (cond) => cond.toLowerCase().replace(/_/g, '-');

// ---------- where the penalty came from ----------

function takeaway(d) {
  if (!d.counted) return fill('rulersNone', { minCases: String(MIN_DISCHARGES) });
  const lead = d.top;
  if (lead) {
    const gap = gapText(lead.gap);
    const short = lead.short;
    if (!d.priced || lead.per === null || lead.cut === null) return fill('rulersOverNoDollars', { short, gap });
    return d.capped
      ? fill('rulersOverCapped', { short, gap, cut: roundedDollars(lead.cut) })
      : fill('rulersOver', { short, gap, cut: roundedDollars(lead.cut), step: STEP, per: roundedDollars(lead.per) });
  }
  if (d.anyOver) return fill('rulersNoParts');
  const counted = d.rows.filter((r) => r.measured);
  return counted.length === 1 ? fill('rulersBelowOne', { short: counted[0].short }) : fill('rulersBelowMany', { n: String(counted.length) });
}

const gapCell = (row) => {
  if (!row.measured) return t('rowNotCounted');
  if (row.gap === 0) return t('rowAt');
  return fill(row.gap > 0 ? 'rowOver' : 'rowUnder', { gap: gapText(row.gap) });
};

function rowWords(row) {
  if (!row.n) return { cases: t('rowNoCases'), note: t('rulerNoCases') };
  const cases = fill('rowCases', { n: fmtInt(row.n) });
  return { cases, note: row.measured ? null : fill('rulerFew', { n: fmtInt(row.n), min: String(MIN_DISCHARGES) }) };
}

// The text of the "worth per" cell: dollars, "payment weight not published" for a counted condition with none, a dash otherwise.
function perWords(row) {
  if (row.per !== null) return roundedDollars(row.per);
  return row.measured && row.weight === null ? t('rowNoWeight') : t('cellNone');
}

const rulerSvg = (row, width, fit) => imageOf(ruler({
  id: `rul-${slug(row.cond)}-${fit}`, domain: row.domain, counts: row.counts, floor: row.domain[0], cap: row.domain[1], median: row.med, value: row.err,
  labels: { median: fill('rulerMedian', { median: ratio(row.med) }), value: t('rulerThis'), same: t('rulerSame'), note: rowWords(row).note },
  format: ratio, width, pen: row.over, ends: row.domain.map((v) => decimal(v, 2)),
}), null, fit);

// d: figures.rulers; view: hospitalView()'s result (the edition, the CCN); n: the figure's number.
export function rulersFigure(d, { view, n }) {
  const heads = [t('colRatio'), t('headMedian'), t('headGap'), fill('headPer', { step: STEP }), t('colCut')];
  const rows = d.rows.map((row) => {
    const words = rowWords(row);
    const cls = ['rul__row', row.over && 'is-over', !row.measured && 'is-none'].filter(Boolean).join(' ');
    const none = html`<span aria-hidden="true">${t('cellNone')}</span><span class="vh">${t('rowNotCounted')}</span>`;
    const cells = [
      row.measured ? ratio(row.err) : none,
      ratio(row.med),
      html`<span class="${row.over ? 'rul__gap' : ''}">${gapCell(row)}</span>`,
      perWords(row),
      row.cut === null ? t('cellNone') : roundedDollars(row.cut),
    ];
    return html`<li class="${cls}">
<div class="rul__name"><p class="rul__short">${row.short}</p><p class="rul__sub">${words.cases}</p></div>
<div class="rul__ruler">${rulerSvg(row, WIDTH, 'narrow')}${rulerSvg(row, RULER_WIDE, 'wide')}</div>
${cells.map((cell, i) => html`<p class="rul__num"><span class="rul__k">${heads[i]}</span><span>${cell}</span></p>`)}
</li>`;
  });
  const capNote = d.capNote ? ` ${fill('rulersCapNote', { points: d.capPoints, cap: String(CAP_PCT) })}` : '';
  const chart = html`<div class="rul">
<div class="rul__head" aria-hidden="true"><span>${t('colCondition')}</span><span></span>${heads.map((h) => html`<span class="num">${h}</span>`)}</div>
<ol class="rul__rows" role="list">
${rows}
</ol>
</div>`;
  const num4 = (v) => (v === null ? num(t('cellNone'), null) : num(ratio(v), v));
  return figure({
    n,
    takeaway: takeaway(d) + capNote,
    source: fill('rulersSource', { edition: view.edition }),
    claimLevel: 'estimate',
    note: t('rulersNote'),
    csvName: `hrrp-${view.ccn.toLowerCase()}-conditions`,
    key: [{ swatch: 'this', label: t('rulerThis') }, { swatch: 'median', label: t('colMedian') }],
    chart,
    table: {
      columns: [{ name: t('colCondition') }, { name: t('colCases'), numeric: true }, { name: t('colRatio'), numeric: true }, { name: t('colMedian'), numeric: true },
        { name: t('colGap'), numeric: true }, { name: fill('colPer', { step: STEP }), numeric: true }, { name: t('colCut'), numeric: true }],
      rows: d.rows.map((row) => [
        row.short, num(fmtInt(row.n), row.n), num4(row.err), num4(row.med),
        row.gap === null ? num(t('rowNotCounted'), null) : num(gapText(row.gap), roundTo(row.gap, 6)),
        row.per === null ? num(perWords(row), null) : num(roundedDollars(row.per), r2(row.per)),
        row.cut === null ? num(t('cellNone'), null) : num(roundedDollars(row.cut), r2(row.cut)),
      ]),
    },
  });
}

// ---------- the penalty history ----------

// The same plot box as the place panel beside it (web/charts/rankYears.js: top 22, height 150, bottom 26), so the two axes line up.
const BAR = { top: 22, bottom: 26, left: 40, right: 8, h: 150 };

// This hospital's cut in each year as bars, the average cut of every hospital as a dashed line, the cap's steps as dashed rules and
// the pandemic years shaded; a year the hospital is not in the file says "n/a", never a zero bar.
function cutBars({ hd, width }) {
  const { years, caps, covid } = hd;
  const n = years.length;
  const M = BAR;
  const colW = (width - M.left - M.right) / n;
  const cx = (i) => M.left + (i + 0.5) * colW;
  const seen = years.flatMap((y) => [y.cut, y.avg]).filter((v) => v !== null);
  const top = Math.max(1, Math.ceil(Math.max(...seen, 0) - 1e-9));
  const ticks = scaleLinear().domain([0, top]).ticks(top <= 1 ? 2 : top).filter((v) => v >= 0 && v <= top);
  const y = (v) => M.top + M.h - (v / top) * M.h;
  const narrow = isNarrow(width);
  const bw = Math.max(6, colW * 0.62);
  const every = narrow && n > 8 ? 2 : 1;
  const axis = yearAxis({
    M, width, narrow, years, caps, covid, y, ticks, tickText: (v) => `${decimal(v, v % 1 ? 1 : 0)}%`, every,
    bandAt: (c0, c1) => ({ x: M.left + c0 * colW, w: (c1 - c0 + 1) * colW, mid: M.left + ((c0 + c1 + 1) / 2) * colW }),
    xAt: cx, ruleAt: (i) => M.left + i * colW,
  });
  const bars = years.map((yr, i) => {
    const x = cx(i) - bw / 2;
    const hit = { x: M.left + i * colW, y: M.top, width: colW, height: M.h };
    if (yr.cut === null) {
      return mark({ tip: fill('histHospTipAbsent', { fy: yr.label }), hit, body: html`<text class="chart-cap" transform="translate(${r2(cx(i) + 3)} ${r2(M.top + M.h / 2)}) rotate(-90)" text-anchor="middle">${t('cellNa')}</text>` });
    }
    const avgText = yr.avg === null ? t('cellNa') : fmtPct(yr.avg);
    const label = yr.cut > 0 && (!narrow || i === n - 1) ? text({ x: cx(i), y: y(yr.cut) - 4, cls: 'chart-value chart-value--mark', body: decimal(yr.cut, 2) }) : '';
    return mark({
      tip: yr.cut > 0 ? fill('histHospTipBar', { fy: yr.label, cut: fmtPct(yr.cut), avg: avgText }) : fill('histHospTipNone', { fy: yr.label, avg: avgText }), value: yr.cut, hit,
      body: yr.cut > 0 ? html`<path class="chart-col--pen" d="${columnPath(x, bw, y(0), y(yr.cut))}"/>${label}` : '',
    });
  });
  const avg = lineD(years.map((yr, i) => ({ x: i, y: yr.avg })), cx, y);
  const height = M.top + M.h + M.bottom;
  return frame({
    kind: 'cutbars', width, height, body: html`${axis.head}
${axis.rules}
${bars}
<path class="chart-lines__under" d="${avg}"/>
${axis.yearLabels}`,
  });
}

// The place among the year's cuts, by the kit's rankYears: each year's dot, the cut years' zone shaded, a rule where the measure changed.
function placeDots({ hd, width }) {
  const years = hd.years.map((yr) => ({
    label: yy(yr.fy),
    share: yr.share === null ? null : roundTo(yr.share, 4),
    cut: yr.cut !== null && yr.cut > 0,
    line: yr.line,
    tip: yr.cut === null ? fill('histHospTipAbsent', { fy: yr.label })
      : yr.cut > 0 ? fill('histHospTipRankCut', { fy: yr.label, cut: fmtPct(yr.cut), share: pctFloor(yr.share) })
        : fill('histHospTipRankNone', { fy: yr.label, share: pct(yr.notCut, 0) }),
  }));
  const at = hd.measureAt === null ? -1 : hd.years.findIndex((yr) => yr.fy === hd.measureAt);
  return rankYears({
    years, breaks: at > 0 ? [{ at, label: t('histHospMeasure'), left: true }] : [],
    labels: { top: t('histHospTop'), mid: t('histHospMid'), bottom: t('histHospBottom'), none: '' }, width,
  });
}

// hd: figures.history; view: hospitalView()'s result; n: the figure's number.
export function historyFigure(hd, { view, n }) {
  const [takeawayKey, words] = hd.nWith === 1 ? [hd.nCut ? 'histHospOne' : 'histHospOneNone', {}]
    : !hd.nCut ? ['histHospNever', { n: String(hd.nWith) }]
      : hd.nCut === hd.nWith ? ['histHospAll', { n: String(hd.nWith) }] : ['histHospSome', { n: String(hd.nWith), pen: String(hd.nCut) }];
  const chart = html`<div class="hosphist">
<div class="hosphist__panel"><h3 class="hosphist__title">${t('histHospBarsTitle')}</h3>${imagePair(drawn((width) => cutBars({ hd, width }), WIDE), t('histHospBarsAlt'))}<p class="small muted">${fill('histHospNote', { edition: view.edition })}${hd.covid.fys.length ? ` ${hd.covid.note}` : ''}</p></div>
<div class="hosphist__panel"><h3 class="hosphist__title">${t('histHospRankTitle')}</h3>${imagePair(drawn((width) => placeDots({ hd, width }), WIDE), t('histHospRankAlt'))}<p class="small muted">${fill('histHospRankNote', { edition: view.edition })}</p></div>
</div>`;
  return figure({
    n,
    takeaway: fill(takeawayKey, words),
    source: fill('histHospSource', { span: hd.span }),
    claimLevel: 'recomputed',
    csvName: `hrrp-${view.ccn.toLowerCase()}-history`,
    chart,
    table: {
      columns: [{ name: t('histHospColFy') }, { name: t('histHospColCut'), numeric: true }, { name: t('histHospColAvg'), numeric: true }, { name: t('histHospColRank'), numeric: true }],
      rows: hd.years.map((yr) => [
        yr.label,
        yr.cut === null ? num(t('cellNa'), null) : num(fmtPct(yr.cut), yr.cut),
        yr.avg === null ? num(t('cellNa'), null) : num(fmtPct(yr.avg), roundTo(yr.avg, 4)),
        yr.cut === null || !(yr.cut > 0) ? num(yr.cut === null ? t('cellNa') : t('cellNone'), null) : num(pctFloor(yr.share), roundTo(yr.share * 100, 1)),
      ]),
    },
  });
}

// ---------- the full worksheet ----------

// sheet: figures.sheet; edition: the edition's label.
export const worksheetDisclosure = (sheet, edition) => html`<details class="hosp__ws"><summary>${t('worksheetButton')}</summary>
${worksheetHtml(sheet.rows, { compact: true, edition, conditions: sheet.conditions })}
</details>`;
