// The Methods page's sensitivities drawn: one row per version of the method (the decided method first), a band from the
// low case's revenue lost to the high case's on one dollar scale, a tick at each end and a dot at the middle case. The
// decided method's middle is a dashed mark through every row's band, so each alternative reads against it. Server SVG on the
// figure kit (web/charts), drawn twice (phone and wide); every plotted value is in the figure's table.
//   rows    [{ label, short, tip, low, middle, high }] (dollars a year, positive; short: the phone's label; tip: the
//           row's tooltip), the decided method first
//   labels  { axis }
import { scaleLinear } from 'd3-scale';
import { money } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { axis } from '../../../../web/charts/axis.js';
import { frame, isNarrow, mark, r2, text } from '../../../../web/charts/svg.js';

const PAD = 10;
const RIGHT = 26; // room past the axis's last label, which centers on its tick
const TOP = 8;
const LABEL = 15; // a row's label, over its band
const BAND = 12;
const GAP = 12;
const AXIS = 30;

export function sensChart({ rows, labels, width }) {
  if (!rows.length) throw new RangeError('sensChart: no rows');
  const top = Math.max(...rows.map((r) => r.high));
  const x = scaleLinear().domain([0, top]).nice(isNarrow(width) ? 3 : 6).range([PAD, width - RIGHT]);
  const base = rows[0];
  let y = TOP;
  const placed = rows.map((row) => {
    const mid = y + LABEL + BAND / 2;
    y = mid + BAND / 2 + GAP;
    return { row, top: mid - LABEL - BAND / 2, mid };
  });
  const axisY = y - GAP + 8;
  const height = axisY + AXIS;
  const xm = x(base.middle);
  const strip = ({ row, top: t, mid }, i) => html`<g class="wr-sens__row${i === 0 ? ' wr-sens__row--base' : ''}">
${text({ x: PAD, y: t + 11, anchor: 'start', cls: 'chart-proof__label chart-label--halo', body: isNarrow(width) ? row.short : row.label })}
<line class="chart-ref" x1="${r2(xm)}" x2="${r2(xm)}" y1="${r2(mid - BAND / 2 - 4)}" y2="${r2(mid + BAND / 2 + 4)}"/>
${mark({ tip: row.tip, value: [row.low, row.middle, row.high], hit: null, body: html`<rect class="wr-sens__band" x="${r2(x(row.low))}" y="${r2(mid - BAND / 2)}" width="${r2(x(row.high) - x(row.low))}" height="${BAND}"/>` })}
${[row.low, row.high].map((v) => html`<line class="wr-sens__tick" x1="${r2(x(v))}" x2="${r2(x(v))}" y1="${r2(mid - BAND / 2 - 2)}" y2="${r2(mid + BAND / 2 + 2)}"/>`)}
<circle class="wr-sens__dot" cx="${r2(x(row.middle))}" cy="${r2(mid)}" r="4.5"/>
</g>`;
  return frame({
    kind: 'sens', width, height, body: html`${placed.map(strip)}
<g transform="translate(0 ${r2(axisY)})">${axis({ scale: x, ticks: isNarrow(width) ? 3 : 6, format: (v) => money(v) })}</g>
${text({ x: width - RIGHT, y: height - 2, anchor: 'end', cls: 'chart-cap', body: labels.axis })}`,
  });
}
