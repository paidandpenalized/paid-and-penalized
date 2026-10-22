// Small multiples of one line each: a panel per series on a shared scale, the years along the bottom, a reference
// line across every panel (e.g. an SIR of 1, as predicted), each year a dot with its tooltip, and the change from the
// first point to the last printed in the panel's corner. A year with no value breaks the line.
//   panels  [{ label, points: [{ x, y, tip }], change, pen, under }]: y null for no value; change: the corner's text;
//           pen: draw the line in the penalty ink; under: optional points of a second, gray line drawn beneath (e.g.
//           the nation's), with underLabel printed under its last point
//   xs      every x the panels share, in order (their ticks)
//   cols    panels per row; tall: a taller panel (a figure of one)
//   labels  { x(v): a tick's text, ref: the reference line's name (first panel), point(v): a labeled point's text,
//           xTitle: the axis's name }; a panel's labelAt: point indexes to print values at (both lines);
//           underSolid: draw the second line solid gray (a comparison, set apart from the dashed reference)
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
  // A narrow panel puts its corner text on a line of its own under the title.
  const twoLine = pw < 230 && panels.some((p) => p.change);
  const top = TOP + (twoLine ? 12 : 0);
  const below = labels.xTitle ? 30 : 0;
  const height = rows * (top + ph + GAP_Y + below);
  const body = panels.map((p, k) => {
    const ox = (k % cols) * (pw + GAP_X);
    const oy = Math.floor(k / cols) * (top + ph + GAP_Y + below) + top;
    const x0 = ox + left;
    const x1 = ox + pw - 14;
    const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([x0, x1]);
    const y = scaleLinear().domain([0, yMax]).range([oy + ph, oy + 4]);
    const d = lineD(p.points, x, y);
    const every = width < 400 ? 3 : 2;
    const valueAt = (pts, i, dy) => (pts[i]?.y == null ? '' : text({ x: x(pts[i].x), y: y(pts[i].y) + dy, cls: 'chart-value chart-value--mark chart-label--halo', body: labels.point(pts[i].y) }));
    return html`<g>
${text({ x: ox, y: oy - (twoLine ? 18 : 6), anchor: 'start', cls: 'chart-label', body: p.label })}
${p.change ? text({ x: twoLine ? ox : ox + pw, y: oy - 6, anchor: twoLine ? 'start' : 'end', cls: 'chart-value chart-value--mark', body: p.change }) : ''}
<line class="chart-axis__line" x1="${r2(x0)}" x2="${r2(ox + pw)}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>
${ref === null ? '' : html`<line class="chart-ref" x1="${r2(x0)}" x2="${r2(ox + pw)}" y1="${r2(y(ref))}" y2="${r2(y(ref))}"/>${text({ x: x0 - 4, y: y(ref) + 4, anchor: 'end', cls: 'chart-tick', body: format(ref) })}${k === 0 && labels.ref ? text({ x: x0 + 2, y: y(ref) - 4, anchor: 'start', cls: 'chart-cap chart-label--halo', body: labels.ref }) : ''}`}
${text({ x: x0 - 4, y: y(0) + 4, anchor: 'end', cls: 'chart-tick', body: format(0) })}
${ref === null ? text({ x: x0 - 4, y: y(yMax) + 4, anchor: 'end', cls: 'chart-tick', body: format(yMax) }) : ''}
${xs.map((v, i) => ((xs.length - 1 - i) % every === 0 ? text({ x: x(v), y: oy + ph + 14, anchor: i === xs.length - 1 ? 'end' : 'middle', dx: i === xs.length - 1 ? 6 : 0, cls: 'chart-tick', body: labels.x(v) }) : ''))}
${labels.xTitle ? text({ x: (x0 + x1) / 2, y: oy + ph + 32, cls: 'chart-cap', body: labels.xTitle }) : ''}
${p.under ? html`<path class="chart-lines__under${p.underSolid ? ' chart-lines__under--solid' : ''}" d="${lineD(p.under, x, y)}"/>` : ''}
${p.underLabel ? (() => { const at = p.under.filter((u) => u.y !== null); const u = at[Math.floor(at.length * 0.6)]; return u ? text({ x: x(u.x), y: y(u.y) + 14, cls: 'chart-cap chart-label--halo', body: p.underLabel }) : ''; })() : ''}
<path class="chart-lines__line${p.pen ? ' chart-lines__line--pen' : ''}" d="${d}"/>
${p.points.filter((pt) => pt.y !== null).map((pt) => mark({ tip: pt.tip, value: pt.y, hit: { x: x(pt.x) - 8, y: oy, width: 16, height: ph }, body: html`<circle class="chart-lines__dot${p.pen ? ' chart-lines__dot--pen' : ''}" cx="${r2(x(pt.x))}" cy="${r2(y(pt.y))}" r="3"/>` }))}
${(p.labelAt ?? []).map((i) => html`${valueAt(p.points, i, -9)}${p.under ? valueAt(p.under, i, 16) : ''}`)}
</g>`;
  });
  return frame({ kind: 'lines', width, height, body: html`${body}` });
}
