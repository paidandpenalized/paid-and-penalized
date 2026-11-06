// The program page's History Part: its lede, the small multiples, the years cut of today's hospitals beside the data windows (the
// kit's periods chart: for each fiscal year the care its ratios are worked out from and the year its payments change), and the
// timeline (dated entries with their sources, years not yet in effect marked). figures/history-data.js holds their numbers.
import { drawn, figure, num } from '../../../../web/charts/figure.js';
import { periodsChart } from '../../../../web/charts/periods.js';
import { isoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { externalLink } from '../../../../web/render/layout.js';
import { fyLabel } from '../copy.js';
import { fill, t } from '../program/copy.js';
import { fmtInt, fmtPct } from '../numbers.js';
import { hospitals } from '../wording.js';
import { drawHistory, drawYearsCut, usdM } from './history-draw.js';
import { FULL, HALF, pic } from './layout.js';

const ymd = (iso) => iso.split('-').map(Number);
const span = (kind, fy, [start, end]) => ({ kind, start: ymd(start), end: ymd(end), tip: fill('winTip', { label: t(kind === 'perf' ? 'winPerf' : 'winPay'), fy: fyLabel(fy), start: isoDate(start), end: isoDate(end) }) });
const range = ([start, end]) => `${isoDate(start)} – ${isoDate(end)}`;

// The source line of an entry: a link when the address is https, else the label as plain text.
const sourceOf = ({ label, url }) => (url ? externalLink(url, label) : label);


// entries: history-data.js timelineData().
export function timeline(entries) {
  if (!entries.length) return '';
  return html`<h3 class="part__sub" id="history-timeline-h">${t('timelineHeading')}</h3>
<ol class="tl" aria-labelledby="history-timeline-h">
${entries.map((e) => html`<li class="tl__item${e.future ? ' tl__item--future' : ''}">
<p class="tl__date"><time datetime="${e.date}">${isoDate(e.date)}</time>${e.fy != null ? html` <span class="tl__fy">${fyLabel(e.fy)}</span>` : ''}${e.future ? html` <span class="tl__tag">${t('timelineFuture')}</span>` : ''}</p>
<h4 class="tl__title">${e.title}</h4>
<p class="tl__body">${e.body}</p>
<p class="small tl__src">${t('timelineSource')}: ${sourceOf(e.src)}</p>
</li>
`)}</ol>`;
}

// rows: history-data.js windowRows() (newest first); n: the figure counter, called only when the figure draws.
// The data windows' drawing at a width (null with no rows).
const windowsDraw = (rows) => (rows.length ? (width) => periodsChart({ rows: rows.map((r) => ({ label: fyLabel(r.fy), spans: [...(r.perf ? [span('perf', r.fy, r.perf)] : []), span('pay', r.fy, r.pay)] })), kinds: ['perf', 'pay'], width }) : null);
const heightOf = (svg) => Number(String(svg).match(/viewBox="0 0 \d+ (\d+)"/)[1]);

export function windowsFigure(rows, { n }) {
  const draw = windowsDraw(rows);
  if (!draw) return '';
  const newest = rows[0];
  return figure({
    n: n(), source: t('winSource'), csvName: 'hrrp-data-windows', alt: t('winAlt'), note: t('winKey'),
    takeaway: newest.perf
      ? fill('winTakeaway', { fy: fyLabel(newest.fy), end: isoDate(newest.perf[1]), start: isoDate(newest.pay[0]) })
      : fill('winTakeawayNone', { fy: fyLabel(newest.fy) }),
    ...drawn(draw, HALF),
    table: {
      columns: [{ name: t('winColFy') }, { name: t('winColPerf') }, { name: t('winColPay') }],
      rows: rows.map((r) => [fyLabel(r.fy), r.perf ? range(r.perf) : t('winNone'), range(r.pay)]),
    },
  });
}

// "Has this hospital ever escaped?" [#6]: today's hospitals in the file every year, by how many of those years they were cut. e:
// history-data.js yearsCut(); n: the figure counter, called only when the figure draws. Its words always say "of today's hospitals";
// the hospitals in the file fewer years are counted in the note (a year out of the file is never "not cut").
// height: the wide drawing's height (the data windows' beside it), or null for its own.
export function escapesFigure(e, { n, height = null }) {
  if (!e?.full) return '';
  const years = String(e.nYears);
  const counts = e.counts.map((c) => ({ ...c, tip: fill('escTip', { hospitals: hospitals(c.n), k: String(c.cut), years }) }));
  const draw = (width) => drawYearsCut({ counts, width, height, labels: { never: t('escNever'), every: t('escEvery'), axis: fill('escAxis', { years }) } });
  const { every, never, share } = e.takeaway;
  const { partial } = e;
  return figure({
    n: n(), source: t('winSource'), claimLevel: 'recomputed', csvName: 'hrrp-years-cut', alt: fill('escAlt', { years }),
    takeaway: fill('escTakeaway', { full: fmtInt(e.full), years, every: fmtInt(every), share: fmtPct(share * 100, 0), never: fmtInt(never) }),
    note: partial.n ? fill('escNote', { partial: fmtInt(partial.n), every: fmtInt(partial.everyYear) }) : null,
    ...drawn(draw, HALF),
    table: {
      columns: [{ name: fill('escColK', { years }) }, { name: t('escColN'), numeric: true }],
      rows: [
        ...e.counts.map((c) => [String(c.cut), num(fmtInt(c.n), c.n)]),
        [t('escRowPartEvery'), num(fmtInt(partial.everyYear), partial.everyYear)],
        [t('escRowPartNever'), num(fmtInt(partial.never), partial.never)],
        [t('escRowPartRest'), num(fmtInt(partial.n - partial.everyYear - partial.never), partial.n - partial.everyYear - partial.never)],
      ],
    },
  });
}

// The small multiples' figure [HI-09]. lines: history-data.js smallLines(); n: the figure counter, called only when the figure draws. Its takeaway is the latest year's
// share of hospitals cut; the pandemic note and the years with no total are said under it; the table has every plotted value.
export function historyFigure(lines, { n }) {
  const known = lines.share.filter((s) => s.value !== null);
  if (!known.length) return '';
  const latest = known[known.length - 1];
  const prose = [t('histBasis'), lines.covid.fys.length ? lines.covid.note : null].filter(Boolean).join(' ');
  const note = lines.noTotalText ? html`${prose}<span class="hist-note__none">${lines.noTotalText}</span>` : prose;
  const sourceOf = (r) => r.total && (r.total.label ?? t(r.total.kind === 'KFF' ? 'histSourceKff' : 'histSourceCms'));
  return figure({
    n: n(), takeaway: fill('histTakeaway', { share: fmtPct(latest.value, 1), fy: fyLabel(latest.fy) }), source: t('histSource'), claimLevel: 'estimate', csvName: 'hrrp-history',
    alt: t('histAlt'), note: note || null,
    key: [{ swatch: 'bar-dark', label: t('histKeyCms') }, { swatch: 'bar-light', label: t('histKeyKff') }],
    ...drawn((width) => drawHistory({ lines, width }), FULL),
    table: {
      columns: [{ name: t('histColFy') }, { name: t('histColN'), numeric: true }, { name: t('histColShare'), numeric: true }, { name: t('histColAvgPen'), numeric: true },
        { name: t('histColAvgAll'), numeric: true }, { name: t('histColTotal'), numeric: true }, { name: t('histColSource') }],
      rows: lines.table.map((r) => [
        fyLabel(r.fy), num(fmtInt(r.n), r.n), r.share === null ? num('–', null) : num(fmtPct(r.share, 1), r.share),
        r.avgPen === null ? num('–', null) : num(fmtPct(r.avgPen, 2), r.avgPen), r.avgAll === null ? num('–', null) : num(fmtPct(r.avgAll, 2), r.avgAll),
        r.total ? num(usdM(r.total.value), r.total.value) : num(t('histCellNone'), null), sourceOf(r) ?? '',
      ]),
    },
  });
}

// Two figures side by side where there is room (one alone takes the row).
const pair = (a, b) => (a || b ? html`<div class="picpair picpair--rows">${a}${b}</div>` : '');

// history: view.history ({ lines, escapes (a function; none: no years-cut figure), timeline, windows }); figure: the page's figure counter. The small multiples, then the years
// cut beside the data windows, then the timeline.
export function historyPart(history, { figure: nextFigure }) {
  // The years cut stand as tall as the data windows beside them, their charts starting level (.picpair--rows), so the two axes share a line.
  const winDraw = windowsDraw(history.windows);
  const winH = winDraw ? heightOf(winDraw(HALF)) : null;
  return html`<p class="part__intro">${t('historyIntro')}</p>
${pic(historyFigure(history.lines, { n: nextFigure }))}
${pair(pic(escapesFigure(history.escapes?.(), { n: nextFigure, height: winH })), pic(windowsFigure(history.windows, { n: nextFigure })))}
${timeline(history.timeline)}`;
}
