// How many values fall in each bin, as columns: bins at or above the boundary (CMS's line) in --pen, the rest
// neutral, the boundary drawn and annotated with markLabel. The bins are equal widths with the boundary as an edge,
// so no bin straddles the line, and span the boundary even when the data don't; each value lands in exactly one
// bin (histogramBins).
//   bins     about how many bins (d3-array's tickStep picks a round width)
//   format   a bin edge -> text; tip(bin) -> a column's tooltip (default: "lo – hi: count")
import { bin, tickStep } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { count } from '../render/format.js';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { GAP, MAX_THICKNESS, WIDTH, columnPath, frame, mark, plain, r2, text } from './svg.js';

const HEIGHT = 200;
const M = { top: 30, right: 12, bottom: 26, left: 36 };
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

export function histogram({ values, bins = 20, boundary, markLabel, width = WIDTH, height = HEIGHT, format = plain, tip }) {
  const data = histogramBins(values, bins, boundary);
  const tipOf = tip ?? ((b) => `${format(b.x0)} – ${format(b.x1)}: ${count(b.count)}`);
  const x = scaleLinear().domain([data[0].x0, data[data.length - 1].x1]).range([M.left, width - M.right]);
  const most = Math.max(...data.map((b) => b.count));
  const y = scaleLinear().domain([0, most]).nice().range([height - M.bottom, M.top]);
  const yTicks = y.ticks(Math.min(4, most)).filter(Number.isInteger);
  const base = height - M.bottom;
  const bx = r2(x(boundary));
  const t = (x(boundary) - M.left) / (width - M.left - M.right);
  const { anchor, dx } = labelAt(t);

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
<line class="chart-boundary" x1="${bx}" x2="${bx}" y1="${M.top - 12}" y2="${base}"/>
${text({ x: bx, y: M.top - 16, anchor, dx, cls: 'chart-label', body: markLabel })}`,
  });
}
