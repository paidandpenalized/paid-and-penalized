// The periods chart: for each row (a fiscal year), the stretches of care its measures cover and the year its
// payments change, as bars on one calendar axis, so the lag between the care and the cut reads as a staircase.
//   rows   [{ label, spans: [{ kind, start, end, tip }] }]: start and end as [year, month (1-12), day]; kind names
//          the bar's class (chart-periods__<kind>)
//   kinds  the span kinds in the order their bars stack within a row
// The axis runs over whole calendar years, each labeled at its middle (every other one on a phone).
import { html } from '../render/html.js';
import { frame, isNarrow, mark, r2, text } from './svg.js';

const LABEL = 58;
const ROW = 22;
const BAR = 5;
const TOP = 8;
const AXIS = 22;

// Days since 1 January 1970 (UTC), as a number on the axis.
const day = ([y, m, d]) => Date.UTC(y, m - 1, d) / 86400000;

export function periodsChart({ rows, kinds, width }) {
  if (!rows.length || !kinds.length) throw new RangeError('periodsChart: rows and kinds');
  const all = rows.flatMap((r) => r.spans.flatMap((s) => [day(s.start), day(s.end)]));
  const y0 = new Date(Math.min(...all) * 86400000).getUTCFullYear();
  const y1 = new Date(Math.max(...all) * 86400000).getUTCFullYear() + 1;
  const lo = day([y0, 1, 1]);
  const hi = day([y1, 1, 1]);
  const x = (d) => LABEL + ((d - lo) / (hi - lo)) * (width - LABEL);
  const height = TOP + rows.length * ROW + AXIS;
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  const every = isNarrow(width) ? 2 : 1;
  const grid = years.map((yr) => html`<line class="chart-grid" x1="${r2(x(day([yr, 1, 1])))}" x2="${r2(x(day([yr, 1, 1])))}" y1="${TOP - 4}" y2="${r2(TOP + rows.length * ROW)}"/>`);
  const tickLabels = years.slice(0, -1).filter((_, i) => i % every === 0)
    .map((yr) => text({ x: (x(day([yr, 1, 1])) + x(day([yr + 1, 1, 1]))) / 2, y: TOP + rows.length * ROW + 15, cls: 'chart-tick', body: String(yr).slice(isNarrow(width) ? 2 : 0) }));
  const body = rows.map((r, i) => {
    const mid = TOP + i * ROW + ROW / 2;
    const bars = r.spans.map((s) => {
      const k = kinds.indexOf(s.kind);
      const yb = mid - ((kinds.length - 1) * (BAR + 1)) / 2 + k * (BAR + 1) - BAR / 2;
      const xa = x(day(s.start));
      const xb = x(day(s.end) + 1);
      return mark({
        tip: s.tip, hit: { x: xa, y: mid - ROW / 2, width: xb - xa, height: ROW },
        body: html`<rect class="chart-periods__${s.kind}" x="${r2(xa)}" y="${r2(yb)}" width="${r2(xb - xa)}" height="${BAR}"/>`,
      });
    });
    return html`<g>${text({ x: 0, y: mid + 4, anchor: 'start', cls: 'chart-proof__label', body: r.label })}${bars}</g>`;
  });
  return frame({ kind: 'periods', width, height, body: html`${grid}${body}${tickLabels}` });
}
