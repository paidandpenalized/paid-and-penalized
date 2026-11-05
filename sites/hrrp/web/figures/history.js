// The program page's History Part, so far: its lede, the timeline (dated entries with their sources, years not yet in effect
// marked) and the data windows (the kit's periods chart: for each fiscal year the care its ratios are worked out from and the
// year its payments change). The small multiples and the roll call are not drawn yet; figures/history-data.js holds their
// numbers.
import { drawn, figure } from '../../../../web/charts/figure.js';
import { periodsChart } from '../../../../web/charts/periods.js';
import { isoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { externalLink } from '../../../../web/render/layout.js';
import { fyLabel } from '../copy.js';
import { fill, t } from '../program/copy.js';

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

// rows: history-data.js windowRows() (newest first); n: the figure's number.
export function windowsFigure(rows, { n }) {
  if (!rows.length) return '';
  const spans = rows.map((r) => ({ label: fyLabel(r.fy), spans: [...(r.perf ? [span('perf', r.fy, r.perf)] : []), span('pay', r.fy, r.pay)] }));
  const draw = (width) => periodsChart({ rows: spans, kinds: ['perf', 'pay'], width });
  const newest = rows[0];
  return figure({
    n, source: t('winSource'), csvName: 'hrrp-data-windows', alt: t('winAlt'), note: t('winKey'),
    takeaway: newest.perf
      ? fill('winTakeaway', { fy: fyLabel(newest.fy), end: isoDate(newest.perf[1]), start: isoDate(newest.pay[0]) })
      : fill('winTakeawayNone', { fy: fyLabel(newest.fy) }),
    ...drawn(draw, 1040),
    table: {
      columns: [{ name: t('winColFy') }, { name: t('winColPerf') }, { name: t('winColPay') }],
      rows: rows.map((r) => [fyLabel(r.fy), r.perf ? range(r.perf) : t('winNone'), range(r.pay)]),
    },
  });
}

// history: view.history ({ timeline, windows }); figure: the page's figure counter.
export function historyPart(history, { figure: nextFigure }) {
  return html`<p class="part__intro">${t('historyIntro')}</p>
${windowsFigure(history.windows, { n: nextFigure() })}
${timeline(history.timeline)}`;
}
