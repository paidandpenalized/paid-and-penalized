// Several groups' distributions on one shared axis, a row each (small multiples): each row's columns count its
// members per bin, scaled to its own tallest column so a small group's shape still shows, the columns at or past the
// line in the penalty ink; a short ink tick at the row's median; the row's name and size at its left and its share
// past the line at its right. CMS's line and this hospital's score run through every row; the ▲ and its label sit
// under the shared axis. On a narrow viewBox (under WIDE_FROM) each row's words sit over its plot instead of beside
// it.
//   edges    the shared bin edges; rows [{ label, sub, counts, median, share, tip }] (share: text; tip: the row's
//            tooltip); band [highestNo, lowestYes]; actual: this score; labels { actual, actualValue, line }
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { frame, mark, r2, text, triangle } from './svg.js';

const WIDE_FROM = 400;
const PLOT_H = 26;
const GAP = 10;

export function ridges({ edges, rows, band: [highestNo, lowestYes], actual, labels, width = 560 }) {
  const wide = width >= WIDE_FROM;
  const left = wide ? 150 : 4;
  const right = wide ? width - 56 : width - 4;
  const head = wide ? 0 : 20;
  const rowH = head + PLOT_H + GAP;
  const scale = scaleLinear().domain([edges[0], edges.at(-1)]).range([left, right]);
  const x = (v) => r2(scale(v));
  const top = 18;
  const line = (highestNo + lowestYes) / 2;
  const drawn = rows.map((row, i) => {
    const y0 = top + i * rowH + head;
    const base = y0 + PLOT_H;
    const most = Math.max(...row.counts, 1);
    const cols = row.counts.map((c, j) => {
      if (!c) return '';
      const h = (PLOT_H * c) / most;
      const pen = edges[j] >= lowestYes;
      return html`<rect class="${pen ? 'chart-col chart-col--pen' : 'chart-col'}" x="${r2(scale(edges[j]) + 0.5)}" y="${r2(base - h)}" width="${r2(Math.max(scale(edges[j + 1]) - scale(edges[j]) - 1, 0.5))}" height="${r2(h)}"/>`;
    });
    const words = wide
      ? html`${text({ x: 0, y: base - 14, anchor: 'start', cls: 'chart-label', body: row.label })}${text({ x: 0, y: base - 1, anchor: 'start', cls: 'chart-note', body: row.sub })}${text({ x: width, y: base - 8, anchor: 'end', cls: 'chart-value', body: row.share })}`
      : html`${text({ x: left, y: y0 - 6, anchor: 'start', cls: 'chart-label chart-label--halo', body: html`${row.label} <tspan class="chart-note">${row.sub}</tspan>` })}${text({ x: right, y: y0 - 6, anchor: 'end', cls: 'chart-value chart-label--halo', body: row.share })}`;
    return html`${mark({
      tip: row.tip, value: row.median, hit: { x: 0, y: y0 - head, width, height: rowH - 2 },
      body: html`<line class="chart-baseline" x1="${left}" x2="${right}" y1="${base}" y2="${base}"/>${cols}${row.median === null ? '' : html`<line class="chart-median" x1="${x(row.median)}" x2="${x(row.median)}" y1="${base - 6}" y2="${base + 4}"/>`}${words}`,
    })}
`;
  });
  const bottom = top + rows.length * rowH - GAP + 4;
  const xa = x(actual);
  const place = labelAt((scale(actual) - left) / (right - left));
  return frame({
    kind: 'ridges', width, height: bottom + 54, body: html`${drawn}
${mark({
    tip: labels.lineTip, value: [highestNo, lowestYes], hit: { x: x(line) - 6, y: 0, width: 12, height: bottom },
    body: html`<line class="chart-line" x1="${x(line)}" x2="${x(line)}" y1="${top - 12}" y2="${bottom}"/>`,
  })}
${text({ x: x(line) + 4, y: top - 8, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.line })}
<line class="chart-needle chart-needle--dotted" x1="${xa}" x2="${xa}" y1="${top - 4}" y2="${bottom}"/>
<g transform="translate(0 ${bottom})">${axis({ scale, orient: 'bottom', ticks: wide ? 6 : 4 })}</g>
${mark({ tip: `${labels.actual}: ${labels.actualValue}`, value: actual, hit: { x: xa - 9, y: bottom + 21, width: 18, height: 15 }, body: triangle(xa, bottom + 22, 'chart-this') })}
${text({ x: xa, y: bottom + 47, anchor: place.anchor, dx: place.dx, cls: 'chart-label', body: html`${labels.actual} <tspan class="chart-value">${labels.actualValue}</tspan>` })}`,
  });
}
