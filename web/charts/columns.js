// A small column chart of counts over value bins, for setting shapes side by side (a sliding scale, a seesaw, a
// cliff). Each column is a mark with its tooltip; its class gives its ink (the caller's: chart-col for ink,
// chart-col--pen for a cut, chart-col--rew for a bonus). The axis carries the caller's ticks.
//   bins     [{ x0, x1, n, cls, tip }]: x0 < x1 in the axis's units; n a count
//   domain   [lo, hi] of the axis; ticks: values to label; format: value -> text
//   bands    optional: [{ x0, x1, label, short? }] in axis units, shaded behind the columns in turn (the odd ones tinted) with its label
//            across the top, for groups the axis is divided into (a peer group's range); without it the chart is drawn as before.
//            A label is centered in its band and never wider than the band: the label if it fits, else `short` if it fits,
//            else none (the shading stays). stagger: true instead sets every full label, never the short one: each is centered
//            on its band and sits on the first row where it does not touch a label already there (it may be wider than its
//            band; as many rows as it takes), so every label is shown; the room above the columns grows with the rows.
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { columnPath, frame, mark, r2, text } from './svg.js';

const M = { left: 6, right: 6, top: 8, bottom: 26 };
// The room above the columns for the bands' labels.
const BAND_LABEL_H = 14;
// A band label's width in drawing units, estimated from the label's length (the 10px semibold type, a little over 6 units a
// character) plus a unit of room each side; a label is shown only where this fits the band.
const BAND_CHAR_W = 6.4;
const BAND_PAD = 2;
const labelWidth = (s) => String(s).length * BAND_CHAR_W + BAND_PAD * 2;
const bandLabel = (b, room) => [b.label, b.short].find((s) => s != null && s !== '' && labelWidth(s) <= room) ?? null;

const BAND_GAP = 4;
// The rows of staggered labels: [{ label, row }] for the bands, each label on the first row where it clears the labels
// already there by BAND_GAP (a new row when none does).
function staggered(bands, x) {
  const ends = [];
  return bands.map((b) => {
    const cx = (x(b.x0) + x(b.x1)) / 2;
    const half = labelWidth(b.label) / 2;
    let row = ends.findIndex((end) => cx - half >= end + BAND_GAP);
    if (row < 0) row = ends.length;
    ends[row] = cx + half;
    return { label: b.label, row };
  });
}

export function columns({ bins, domain, ticks, format, width, height, bands = null, stagger = false }) {
  const x = scaleLinear().domain(domain).range([M.left, width - M.right]);
  const max = Math.max(...bins.map((b) => b.n), 1);
  const base = height - M.bottom;
  const rowed = bands && stagger ? staggered(bands, x) : null;
  const top = bands ? M.top + (rowed ? Math.max(...rowed.map((r) => r.row)) + 1 : 1) * BAND_LABEL_H : M.top;
  const y = (n) => base - (n / max) * (base - top);
  const cols = bins.filter((b) => b.n > 0).map((b) => {
    const x0 = x(b.x0) + 0.5;
    const w = Math.max(1, x(b.x1) - x(b.x0) - 1);
    return mark({ tip: b.tip, value: b.n, hit: null, body: html`<path class="${b.cls}" d="${columnPath(x0, w, base, Math.min(base - 1, y(b.n)))}"/>` });
  });
  // The shading of every band first, then every label (a staggered label reaches over its neighbor's band, which must not paint over it).
  const labels = bands ? bands.map((b, i) => {
    const at = rowed?.[i];
    const label = rowed ? at.label : bandLabel(b, x(b.x1) - x(b.x0));
    return label === null ? '' : text({ x: (x(b.x0) + x(b.x1)) / 2, y: M.top + 10 + (at?.row ?? 0) * BAND_LABEL_H, cls: 'chart-band__label', body: label });
  }) : [];
  const shades = bands ? html`${bands.map((b, i) => html`<rect class="chart-band${i % 2 ? '' : ' chart-band--tint'}" x="${r2(x(b.x0))}" y="${M.top}" width="${r2(x(b.x1) - x(b.x0))}" height="${r2(base - M.top)}"/>`)}${labels}` : '';
  return frame({
    kind: 'columns', width, height, body: html`${shades}${cols}
<line class="chart-baseline" x1="${M.left}" x2="${width - M.right}" y1="${r2(base)}" y2="${r2(base)}"/>
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, ticks, format })}</g>`,
  });
}
