// A small column chart of counts over value bins, for setting shapes side by side (a sliding scale, a seesaw, a
// cliff). Each column is a mark with its tooltip; its class gives its ink (the caller's: chart-col for ink,
// chart-col--pen for a cut, chart-col--rew for a bonus). The axis carries the caller's ticks.
//   bins     [{ x0, x1, n, cls, tip }]: x0 < x1 in the axis's units; n a count
//   domain   [lo, hi] of the axis; ticks: values to label; format: value -> text
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { columnPath, frame, mark, r2 } from './svg.js';

const M = { left: 6, right: 6, top: 8, bottom: 26 };

export function columns({ bins, domain, ticks, format, width, height }) {
  const x = scaleLinear().domain(domain).range([M.left, width - M.right]);
  const max = Math.max(...bins.map((b) => b.n), 1);
  const base = height - M.bottom;
  const y = (n) => base - (n / max) * (base - M.top);
  const cols = bins.filter((b) => b.n > 0).map((b) => {
    const x0 = x(b.x0) + 0.5;
    const w = Math.max(1, x(b.x1) - x(b.x0) - 1);
    return mark({ tip: b.tip, value: b.n, hit: null, body: html`<path class="${b.cls}" d="${columnPath(x0, w, base, Math.min(base - 1, y(b.n)))}"/>` });
  });
  return frame({
    kind: 'columns', width, height, body: html`${cols}
<line class="chart-baseline" x1="${M.left}" x2="${width - M.right}" y1="${r2(base)}" y2="${r2(base)}"/>
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, ticks, format })}</g>`,
  });
}
