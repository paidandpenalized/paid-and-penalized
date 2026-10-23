// Across the line: the hospitals nearest CMS's line, each a dot at its score, its area its dollars, packed up and
// down from the axis so none overlap. Filled in the penalty ink past the line (the cut it took), hollow before it (the
// cut it would have taken). Scores a hair apart, money all or nothing. Each dot names itself only in its tooltip.
//   dots     [{ x (score), value (dollars, > 0), over (past the line), tip, mine }]: mine marks a place's own hospitals
//            (the rest are drawn faint when any is mine); tip null draws the dot plain, with no tooltip
//   domain   [lo, hi] scores; line: CMS's line (a score)
//   labels   { under: [line 1, line 2], over: [line 1, line 2], line, axis }: two lines of words over each side, the
//            line's name and the axis's
//   values   { under, over }: each side's dollars, plotted on its label (for the figure's table)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { frame, mark, r2, text } from './svg.js';

const PAD = 10;
const TOP = 58;

// Each dot's y (its center, as an offset from the axis's middle), placed in x order at the smallest offset that
// overlaps no dot placed before it: a beeswarm with dots of their own sizes.
export function dodge(dots) {
  const placed = [];
  const out = new Array(dots.length);
  const order = dots.map((d, i) => i).sort((a, b) => dots[a].cx - dots[b].cx || a - b);
  for (const i of order) {
    const d = dots[i];
    const near = placed.filter((p) => Math.abs(p.cx - d.cx) < p.r + d.r);
    // The offsets that would touch each near dot from above or below, plus the axis itself; the first one free wins.
    const tries = [0, ...near.flatMap((p) => {
      const dx = p.cx - d.cx;
      const dy = Math.sqrt(Math.max(0, (p.r + d.r + 0.6) ** 2 - dx * dx));
      return [p.cy + dy, p.cy - dy];
    })].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const free = tries.find((y) => near.every((p) => (p.cx - d.cx) ** 2 + (p.cy - y) ** 2 >= (p.r + d.r) ** 2 - 1e-6));
    const cy = free ?? 0;
    placed.push({ cx: d.cx, cy, r: d.r });
    out[i] = cy;
  }
  return out;
}

// Two lines of words over one side of the line, the second in the body weight.
const two = (x, anchor, cls, [a, b]) => html`<text class="${cls}" x="${r2(x)}" y="${TOP - 24}" text-anchor="${anchor}">${a}<tspan class="chart-across__sub" x="${r2(x)}" dy="14">${b}</tspan></text>`;

export function acrossLine({ dots, domain, line, labels, values, width, rMax }) {
  const x = scaleLinear().domain(domain).range([PAD, width - PAD]);
  const max = Math.max(...dots.map((d) => d.value));
  const sized = dots.map((d) => ({ ...d, cx: x(d.x), r: Math.max(1.2, Math.sqrt(d.value / max) * rMax) }));
  const ys = dodge(sized);
  const spread = Math.max(...sized.map((d, i) => Math.abs(ys[i]) + d.r), rMax);
  const mid = TOP + spread;
  const axisY = mid + spread + 10;
  const height = axisY + 34;
  const xl = x(line);
  const anyMine = dots.some((d) => d.mine);
  const cls = (d) => `chart-across__dot${d.over ? ' chart-across__dot--over' : ''}${anyMine && !d.mine ? ' chart-across__dot--faint' : ''}`;
  return frame({
    kind: 'across', width, height, body: html`<rect class="chart-zone" x="${r2(xl)}" y="${TOP - 6}" width="${r2(width - PAD - xl)}" height="${r2(axisY - TOP + 6)}"/>
<line class="chart-line" x1="${r2(xl)}" x2="${r2(xl)}" y1="${TOP - 44}" y2="${r2(axisY)}"/>
${text({ x: xl, y: TOP - 48, anchor: 'middle', cls: 'chart-cap chart-cap--pen', body: labels.line })}
${mark({ tip: labels.under.join(' '), value: values.under, hit: null, body: two(xl - 10, 'end', 'chart-label', labels.under) })}
${mark({ tip: labels.over.join(' '), value: values.over, hit: null, body: two(xl + 10, 'start', 'chart-label chart-label--pen', labels.over) })}
${sized.map((d, i) => (d.tip ? mark({ tip: d.tip, hit: null, body: html`<circle class="${cls(d)}" cx="${r2(d.cx)}" cy="${r2(mid + ys[i])}" r="${r2(d.r)}"/>` }) : html`<circle class="${cls(d)}" cx="${r2(d.cx)}" cy="${r2(mid + ys[i])}" r="${r2(d.r)}"/>`))}
<g transform="translate(0 ${r2(axisY)})">${axis({ scale: x, ticks: 5 })}</g>
${text({ x: width - PAD, y: height - 2, anchor: 'end', cls: 'chart-cap', body: labels.axis })}`,
  });
}
