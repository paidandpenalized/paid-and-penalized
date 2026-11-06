// A small column chart of counts over value bins, for setting shapes side by side (a sliding scale, a seesaw, a
// cliff). Each column is a mark with its tooltip; its class gives its ink (the caller's: chart-col for ink,
// chart-col--pen for a cut, chart-col--rew for a bonus). The axis carries the caller's ticks.
//   bins     [{ x0, x1, n, cls, tip }]: x0 < x1 in the axis's units; n a count
//   domain   [lo, hi] of the axis; ticks: values to label; format: value -> text
//   bands    optional: [{ x0, x1, label, short? }] in axis units, shaded behind the columns in turn (the odd ones tinted) with its label
//            across the top, for groups the axis is divided into (a peer group's range); without it the chart is drawn as before.
//            A label is centered in its band and never wider than the band: the label if it fits, else `short` if it fits,
//            else none (the shading stays).
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { capsWidth, columnPath, frame, mark, r2, text } from './svg.js';

const M = { left: 6, right: 6, top: 8, bottom: 26 };
// The room above the columns for the bands' labels.
const BAND_LABEL_H = 14;
// A band label's width in drawing units, estimated from the label's length (svg.js capsWidth: the 10px semibold type) plus a
// unit of room each side; a label is shown only where this fits the band.
const BAND_PAD = 2;
const labelWidth = (s) => capsWidth(s) + BAND_PAD * 2;
const bandLabel = (b, room) => [b.label, b.short].find((s) => s != null && s !== '' && labelWidth(s) <= room) ?? null;

export function columns({ bins, domain, ticks, format, width, height, bands = null }) {
  const x = scaleLinear().domain(domain).range([M.left, width - M.right]);
  const max = Math.max(...bins.map((b) => b.n), 1);
  const base = height - M.bottom;
  const top = bands ? M.top + BAND_LABEL_H : M.top;
  const y = (n) => base - (n / max) * (base - top);
  const cols = bins.filter((b) => b.n > 0).map((b) => {
    const x0 = x(b.x0) + 0.5;
    const w = Math.max(1, x(b.x1) - x(b.x0) - 1);
    return mark({ tip: b.tip, value: b.n, hit: null, body: html`<path class="${b.cls}" d="${columnPath(x0, w, base, Math.min(base - 1, y(b.n)))}"/>` });
  });
  // The shading of every band first, then every label.
  const labels = bands ? bands.map((b) => {
    const label = bandLabel(b, x(b.x1) - x(b.x0));
    return label === null ? '' : text({ x: (x(b.x0) + x(b.x1)) / 2, y: M.top + 10, cls: 'chart-band__label', body: label });
  }) : [];
  const shades = bands ? html`${bands.map((b, i) => html`<rect class="chart-band${i % 2 ? '' : ' chart-band--tint'}" x="${r2(x(b.x0))}" y="${M.top}" width="${r2(x(b.x1) - x(b.x0))}" height="${r2(base - M.top)}"/>`)}${labels}` : '';
  return frame({
    kind: 'columns', width, height, body: html`${shades}${cols}
<line class="chart-baseline" x1="${M.left}" x2="${width - M.right}" y1="${r2(base)}" y2="${r2(base)}"/>
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, ticks, format })}</g>`,
  });
}
