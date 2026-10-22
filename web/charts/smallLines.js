// Small multiples of one line each: a panel per series on a shared scale, the years along the bottom, a reference
// line across every panel (e.g. an SIR of 1, as predicted), each year a dot with its tooltip, and the change from the
// first point to the last printed in the panel's corner. A year with no value breaks the line.
//   panels  [{ label, points: [{ x, y, tip }], change, pen, under }]: y null for no value; change: the corner's text;
//           pen: draw the line in the penalty ink; under: optional points of a second, gray line drawn beneath (e.g.
//           the nation's), with underLabel printed under its last point
//   xs      every x the panels share, in order (their ticks)
//   cols    panels per row; tall: a taller panel (a figure of one)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { frame, mark, r2, text } from './svg.js';

const PANEL_H = 120;
const GAP_X = 18;
const GAP_Y = 30;
const TOP = 18;

// A line through the points with a value; a point without one breaks it.
function lineD(points, x, y) {
  let d = '';
  let open = false;
  for (const pt of points) {
    if (pt.y === null) { open = false; continue; }
    d += `${open ? 'L' : 'M'}${r2(x(pt.x))} ${r2(y(pt.y))}`;
    open = true;
  }
  return d;
}

export function smallLines({ panels, xs, yMax, ref = null, labels, width, format, cols = width < 400 ? 2 : 3, tall = false }) {
  const rows = Math.ceil(panels.length / cols);
  const pw = (width - GAP_X * (cols - 1)) / cols;
  const ph = tall ? PANEL_H * 1.7 : PANEL_H;
  const left = 28;
  const height = rows * (TOP + ph + GAP_Y);
  const body = panels.map((p, k) => {
    const ox = (k % cols) * (pw + GAP_X);
    const oy = Math.floor(k / cols) * (TOP + ph + GAP_Y) + TOP;
    const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([ox + left, ox + pw - 6]);
    const y = scaleLinear().domain([0, yMax]).range([oy + ph, oy + 4]);
    const d = lineD(p.points, x, y);
    const every = width < 400 ? 3 : 2;
    return html`<g>
${text({ x: ox, y: oy - 6, anchor: 'start', cls: 'chart-label', body: p.label })}
${p.change ? text({ x: ox + pw, y: oy - 6, anchor: 'end', cls: `chart-value chart-value--mark${p.pen ? ' chart-label--pen' : ''}`, body: p.change }) : ''}
<line class="chart-axis__line" x1="${r2(ox + left)}" x2="${r2(ox + pw)}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>
${ref === null ? '' : html`<line class="chart-ref" x1="${r2(ox + left)}" x2="${r2(ox + pw)}" y1="${r2(y(ref))}" y2="${r2(y(ref))}"/>${text({ x: ox + left - 4, y: y(ref) + 4, anchor: 'end', cls: 'chart-tick', body: format(ref) })}${k === 0 ? text({ x: ox + pw, y: y(ref) - 4, anchor: 'end', cls: 'chart-cap', body: labels.ref }) : ''}`}
${text({ x: ox + left - 4, y: y(0) + 4, anchor: 'end', cls: 'chart-tick', body: format(0) })}
${ref === null ? text({ x: ox + left - 4, y: y(yMax) + 4, anchor: 'end', cls: 'chart-tick', body: format(yMax) }) : ''}
${xs.map((v, i) => ((xs.length - 1 - i) % every === 0 ? text({ x: x(v), y: oy + ph + 14, cls: 'chart-tick', body: labels.x(v) }) : ''))}
${p.under ? html`<path class="chart-lines__under" d="${lineD(p.under, x, y)}"/>` : ''}
${p.underLabel ? (() => { const end = [...p.under].reverse().find((u) => u.y !== null); return end ? text({ x: x(end.x), y: y(end.y) + 14, anchor: 'end', cls: 'chart-cap', body: p.underLabel }) : ''; })() : ''}
<path class="chart-lines__line${p.pen ? ' chart-lines__line--pen' : ''}" d="${d}"/>
${p.points.filter((pt) => pt.y !== null).map((pt) => mark({ tip: pt.tip, value: pt.y, hit: { x: x(pt.x) - 8, y: oy, width: 16, height: ph }, body: html`<circle class="chart-lines__dot${p.pen ? ' chart-lines__dot--pen' : ''}" cx="${r2(x(pt.x))}" cy="${r2(y(pt.y))}" r="3"/>` }))}
</g>`;
  });
  return frame({ kind: 'lines', width, height, body: html`${body}` });
}
