// Several groups' distributions on one shared axis, a row each (small multiples): each row's columns count its
// members per bin, scaled to its own tallest column so a small group's shape still shows, the columns at or past the
// line in the penalty ink; a short ink tick at the row's median; the row's name and size at its left and its share
// past the line at its right. CMS's line and this hospital's score run through every row; the ▲ and its label sit
// under the shared axis, the label kept inside the drawing. On a narrow viewBox (under WIDE_FROM) each row's words sit
// over its plot instead of beside it. Words never overlap (their widths estimated: text.js): a name too long for its
// place wraps onto more lines, and its row grows to hold them. Wide, the name wraps within the column left of the
// plot, its size under it; narrow, a name and size that would run into the share go on lines of their own over the
// plot, the size beside the share on the line under them.
//   edges    the shared bin edges; rows [{ label, sub, counts, median, share, tip }] (share: text; tip: the row's
//            tooltip); band [highestNo, lowestYes]; actual: this score; labels { actual, actualValue, line }
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt, lineScore } from '../whatif/marks.js';
import { axis } from './axis.js';
import { LABEL_PX, NOTE_PX, frame, mark, r2, text, triangle } from './svg.js';
import { fitLabel, textWidth, wrapText } from './text.js';

const WIDE_FROM = 400;
const PLOT_H = 26;
const GAP = 10;
// The narrow drawing's room over each plot for one line of words; a line's height; the room kept between a narrow row's
// words and its share (the labels and the sizes at svg.js LABEL_PX and NOTE_PX). A wide row's name may run to its plot's
// start: its width is estimated over (text.js), so it ends short of the first column.
const HEAD = 20;
const LINE = 13;
const ROOM = 8;

// A label's lines as one text, each line under the last.
const lines = (x, y, cls, list) => html`<text class="${cls}" x="${x}" y="${r2(y)}">${list.map((line, i) => html`<tspan x="${x}"${i ? html` dy="${LINE}"` : ''}>${line}</tspan>`)}</text>`;

// A row's words: { wrapped (null: the one-line words), head (its height over the plot) }. Wide, the name in the column
// left of the plot (left wide); narrow, the name and size beside the share when all three fit across, else the name in
// lines across the plot.
function wordsOf(row, wide, left, right) {
  if (wide) {
    const wrapped = wrapText(row.label, left, LABEL_PX);
    return { wrapped: wrapped.length > 1 ? wrapped : null, head: (wrapped.length - 1) * LINE };
  }
  const across = textWidth(`${row.label} `, LABEL_PX) + textWidth(row.sub, NOTE_PX) + ROOM + textWidth(row.share, LABEL_PX, { mono: true });
  if (across <= right - left) return { wrapped: null, head: HEAD };
  const wrapped = wrapText(row.label, right - left, LABEL_PX);
  return { wrapped, head: HEAD + wrapped.length * LINE };
}

export function ridges({ edges, rows, band: [highestNo, lowestYes], actual, labels, width = 560 }) {
  const wide = width >= WIDE_FROM;
  const left = wide ? 150 : 4;
  const right = wide ? width - 56 : width - 4;
  const scale = scaleLinear().domain([edges[0], edges[edges.length - 1]]).range([left, right]);
  const x = (v) => r2(scale(v));
  const top = 18;
  const line = lineScore({ highestNo, lowestYes });
  let next = top;
  const drawn = rows.map((row) => {
    const { wrapped, head } = wordsOf(row, wide, left, right);
    const y0 = next + head;
    next = y0 + PLOT_H + GAP;
    const base = y0 + PLOT_H;
    const most = Math.max(...row.counts, 1);
    // The columns as two paths, those short of the line and those at or past it, each column a box up from the base.
    const paths = { below: '', above: '' };
    row.counts.forEach((c, j) => {
      if (!c) return;
      const side = edges[j] >= lowestYes ? 'above' : 'below';
      paths[side] += `M${r2(scale(edges[j]) + 0.5)} ${r2(base)}v${r2(-(PLOT_H * c) / most)}h${r2(Math.max(scale(edges[j + 1]) - scale(edges[j]) - 1, 0.5))}V${r2(base)}z`;
    });
    const cols = html`${paths.below && html`<path class="chart-col" d="${paths.below}"/>`}${paths.above && html`<path class="chart-col chart-col--pen" d="${paths.above}"/>`}`;
    const share = (y, cls) => text({ x: wide ? width : right, y, anchor: 'end', cls, body: row.share });
    let words;
    if (wide) {
      const name = wrapped ? lines(0, base - 14 - head, 'chart-label', wrapped) : text({ x: 0, y: base - 14, anchor: 'start', cls: 'chart-label', body: row.label });
      words = html`${name}${text({ x: 0, y: base - 1, anchor: 'start', cls: 'chart-note', body: row.sub })}${share(base - 8, 'chart-value')}`;
    } else if (wrapped) {
      words = html`${lines(left, y0 - 6 - wrapped.length * LINE, 'chart-label chart-label--halo', wrapped)}${text({ x: left, y: y0 - 6, anchor: 'start', cls: 'chart-label chart-label--halo', body: html`<tspan class="chart-note">${row.sub}</tspan>` })}${share(y0 - 6, 'chart-value chart-label--halo')}`;
    } else {
      words = html`${text({ x: left, y: y0 - 6, anchor: 'start', cls: 'chart-label chart-label--halo', body: html`${row.label} <tspan class="chart-note">${row.sub}</tspan>` })}${share(y0 - 6, 'chart-value chart-label--halo')}`;
    }
    return html`${mark({
      tip: row.tip, value: row.median, hit: { x: 0, y: y0 - head, width, height: head + PLOT_H + GAP - 2 },
      body: html`<line class="chart-baseline" x1="${left}" x2="${right}" y1="${base}" y2="${base}"/>${cols}${row.median === null ? '' : html`<line class="chart-median" x1="${x(row.median)}" x2="${x(row.median)}" y1="${base - 6}" y2="${base + 4}"/>`}${words}`,
    })}
`;
  });
  const bottom = next - GAP + 4;
  const xa = x(actual);
  const place = fitLabel(xa, textWidth(`${labels.actual} `, LABEL_PX) + textWidth(labels.actualValue, LABEL_PX, { mono: true }), labelAt((scale(actual) - left) / (right - left)), [0, width]);
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
${text({ x: place.x, y: bottom + 47, anchor: place.anchor, dx: place.dx, cls: 'chart-label', body: html`${labels.actual} <tspan class="chart-value">${labels.actualValue}</tspan>` })}`,
  });
}
