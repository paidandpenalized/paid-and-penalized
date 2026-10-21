// How many values fall in each bin, as columns: bins at or above the boundary in --pen, the rest neutral, the
// boundary drawn and annotated with markLabel. The bins are equal widths with the boundary as an edge,
// so no bin straddles the line, and span the boundary even when the data don't; each value lands in exactly one
// bin (histogramBins).
//   bins     about how many bins (d3-array's tickStep picks a round width)
//   binned   histogramBins(values, bins, boundary), when the caller already has them for its table (values and bins
//            are then not read), so the chart and the table share one binning
//   format   a bin edge -> text; tip(bin) -> a column's tooltip (default: "lo – hi: count")
//   markTip  the boundary's tooltip, and markValue the value or values it stands for (the caller's table holds them):
//            the boundary is then a mark; without markTip it is drawn but is not one
//   xTitle, yTitle   optional axis titles: under the x axis, and over the top of the y axis
//   groups   optional { below, above }: a direct label for each side of the boundary (e.g. its count), set inside the
//            plot beside the boundary where the columns leave room, else at the plot's outer edge, on a paper halo
import { bin, tickStep } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { count } from '../render/format.js';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { GAP, MAX_THICKNESS, WIDTH, columnPath, frame, mark, plain, r2, text } from './svg.js';

const PLOT_H = 200;
const M = { top: 30, right: 12, bottom: 26, left: 36 };
// Room under the x axis for its title.
const TITLE_H = 16;
// Group labels: their estimated width per character (12px, semibold) and the clearance kept over a column.
const CHAR_W = 7;
const CLEAR = 6;
// Edges are boundary + k × step; rounding to 12 places drops float noise such as 0.30000000000000004.
const edge = (x) => Number(x.toFixed(12));

// [{ x0, x1, count, above }], in order; x1 of one bin is x0 of the next. above: the bin is at or past the boundary.
export function histogramBins(values, bins, boundary) {
  if (!values.length || !values.every(Number.isFinite)) throw new RangeError('histogramBins: values must be finite numbers');
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // The edges span the boundary too, so the line always sits on the chart (as its first or last edge when the
  // data are all on one side); a value at or past the boundary always lands in a bin above it.
  const [from, to] = [Math.min(lo, boundary), Math.max(hi, boundary)];
  const step = tickStep(from, to, bins) || 1;
  const kLo = Math.floor((from - boundary) / step);
  const kHi = Math.max(kLo + 1, Math.ceil((to - boundary) / step), hi >= boundary ? 1 : 0);
  const edges = [];
  for (let k = kLo; k <= kHi; k++) edges.push(edge(boundary + k * step));
  // Float error can leave lo or hi a hair outside the outer edges; widen them so no value drops out.
  edges[0] = Math.min(edges[0], lo);
  edges[edges.length - 1] = Math.max(edges[edges.length - 1], hi);
  const out = bin().domain([edges[0], edges[edges.length - 1]]).thresholds(edges.slice(1, -1))(values);
  return out.map((b) => ({ x0: b.x0, x1: b.x1, count: b.length, above: b.x0 >= boundary }));
}

// Where a group label goes: the first candidate span whose columns leave room under it, else the last candidate.
// Each candidate is { x, anchor }; returns { x, y, anchor }.
function placeGroup(text, candidates, columns, top) {
  const w = text.length * CHAR_W;
  let pick = null;
  for (const c of candidates) {
    const [l, r] = c.anchor === 'end' ? [c.x - w, c.x] : [c.x, c.x + w];
    const under = columns.filter((col) => col.x1 > l && col.x0 < r);
    const highest = Math.min(...under.map((col) => col.top), Infinity);
    const y = Math.min(highest - CLEAR, top + 40);
    pick = { ...c, y: Math.max(y, top + 12) };
    if (y >= top + 12) return pick;
  }
  return pick;
}

export function histogram({ values, bins = 20, binned = null, boundary, markLabel, markTip = null, markValue = null, width = WIDTH, format = plain, tip, xTitle = null, yTitle = null, groups = null }) {
  const data = binned ?? histogramBins(values, bins, boundary);
  const tipOf = tip ?? ((b) => `${format(b.x0)} – ${format(b.x1)}: ${count(b.count)}`);
  const x = scaleLinear().domain([data[0].x0, data[data.length - 1].x1]).range([M.left, width - M.right]);
  const most = Math.max(...data.map((b) => b.count));
  const y = scaleLinear().domain([0, most]).nice().range([PLOT_H - M.bottom, M.top]);
  const yTicks = y.ticks(Math.min(4, most)).filter(Number.isInteger);
  const base = PLOT_H - M.bottom;
  const height = PLOT_H + (xTitle ? TITLE_H : 0);
  const bx = r2(x(boundary));
  const t = (x(boundary) - M.left) / (width - M.left - M.right);
  const { anchor, dx } = labelAt(t);
  const line = html`<line class="chart-boundary" x1="${bx}" x2="${bx}" y1="${M.top - 12}" y2="${base}"/>`;
  const columns = data.map((b) => ({ x0: x(b.x0), x1: x(b.x1), top: y(b.count), above: b.above }));
  const [left, right] = [M.left + 4, width - M.right - 4];
  const groupLabel = (body, candidates) => {
    const p = placeGroup(body, candidates, columns, M.top);
    return text({ x: p.x, y: p.y, anchor: p.anchor, cls: 'chart-label chart-label--halo', body });
  };

  return frame({
    kind: 'histogram', width, height, body: html`<g transform="translate(${M.left} 0)">${axis({ scale: y, orient: 'left', ticks: yTicks, format: count, grid: width - M.left - M.right })}</g>
${data.map((b) => {
    const slot = x(b.x1) - x(b.x0);
    const w = Math.max(1, Math.min(MAX_THICKNESS, slot - GAP));
    const left = x(b.x0) + (slot - w) / 2;
    const d = columnPath(left, w, base, y(b.count));
    return html`${mark({
      tip: tipOf(b), value: b.count, hit: { x: x(b.x0), y: M.top, width: slot, height: base - M.top },
      body: d ? html`<path class="${b.above ? 'chart-col chart-col--pen' : 'chart-col'}" d="${d}"/>` : '',
    })}
`;
  })}<g transform="translate(0 ${base})">${axis({ scale: x, orient: 'bottom', ticks: 5 })}</g>
${markTip === null ? line : mark({ tip: markTip, value: markValue, hit: { x: bx - 6, y: M.top - 12, width: 12, height: base - M.top + 12 }, body: line })}
${text({ x: bx, y: M.top - 16, anchor, dx, cls: 'chart-label', body: markLabel })}${yTitle ? html`
${text({ x: 0, y: M.top - 16, anchor: 'start', cls: 'chart-axis__title', body: yTitle })}` : ''}${xTitle ? html`
${text({ x: (M.left + width - M.right) / 2, y: base + 34, cls: 'chart-axis__title', body: xTitle })}` : ''}${groups ? html`
${groupLabel(groups.below, [{ x: bx - CLEAR, anchor: 'end' }, { x: left, anchor: 'start' }])}
${groupLabel(groups.above, [{ x: bx + CLEAR, anchor: 'start' }, { x: right, anchor: 'end' }])}` : ''}`,
  });
}
