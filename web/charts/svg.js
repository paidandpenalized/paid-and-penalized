// SVG pieces every chart in the kit shares: the frame, a data mark with its tooltip and hit area, the 45° hatch,
// bar shapes (rounded at the data end, square at the baseline) and the ▲ that marks "this hospital". Build time only;
// colors come from classes in web/styles/charts.css, never from here.
import { cmsText } from '../render/format.js';
import { html } from '../render/html.js';

// Charts are drawn narrower than a phone (300 units across a 288px column at 320 and 343px at 375), so their 12-unit
// labels and 11-unit ticks read at about 11.5px and up on any phone (charts.css caps the drawn width at about 22rem).
export const WIDTH = 300;
// The labels' and the notes' type sizes (charts.css: .chart's 12px, its notes' 11px), for a chart that measures its words
// (text.js).
export const LABEL_PX = 12;
export const NOTE_PX = 11;
const RADIUS = 4;
export const GAP = 2;
export const MAX_THICKNESS = 24;

// Coordinates to 0.01 unit (or 0.1), so the markup is short and stable.
export const r2 = (x) => Math.round(x * 100) / 100;
export const r1 = (x) => Math.round(x * 10) / 10;

// A drawing this narrow is the phone's (the kit's WIDTH, not a wide variant): it sets its labels and marks smaller.
export const isNarrow = (width) => width < 400;

// A caption's width in viewBox units, estimated at the caps' 6.4 units a character.
export const capsWidth = (text) => String(text).length * 6.4;

// A line through points [{ x, y }] as a path's d, at (x(p.x), y(p.y)); a point with y null breaks it.
export function lineD(points, x, y) {
  let d = '';
  let open = false;
  for (const pt of points) {
    if (pt.y === null) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${r2(x(pt.x))} ${r2(y(pt.y))}`;
    open = true;
  }
  return d;
}

// A silhouette of sorted scores, ranks a to b (b exclusive), as one closed path: up from the base at the run's left
// edge x0, along the scores (rank i's hairline at x(i), thinned to about one point per SILHOUETTE_THIN units, the ends
// always kept), and down to the base at its right edge x1. y(score): the score's height, rounded; '' for no ranks.
const SILHOUETTE_THIN = 1.5;
export function silhouette(scores, a, b, { x, x0, x1, y, base }) {
  if (b <= a) return '';
  const pts = [];
  let last = -Infinity;
  for (let i = a; i < b; i++) {
    const xi = x(i);
    if (i === a || i === b - 1 || xi - last >= SILHOUETTE_THIN) {
      pts.push([r2(xi), y(scores[i])]);
      last = xi;
    }
  }
  return `M${r2(x0)} ${r2(base)}L${r2(x0)} ${pts[0][1]}L${pts.map(([px, py]) => `${px} ${py}`).join('L')}L${r2(x1)} ${pts[pts.length - 1][1]}L${r2(x1)} ${r2(base)}Z`;
}

// A value as the caller gave it: JavaScript's shortest digits (never re-rounded), with a true minus.
export const plain = (v) => cmsText(String(v));

const ID = /^[a-z][a-z0-9-]*$/;
export function checkId(id, who) {
  if (typeof id !== 'string' || !ID.test(id)) throw new RangeError(`${who}: id must be lowercase letters, digits and hyphens, got "${id}"`);
  return id;
}

// --vb: the viewBox's width, from which charts.css caps the drawn width.
export const frame = ({ kind, width, height, body }) =>
  html`<svg class="chart chart--${kind}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" width="100%" focusable="false" style="--vb: ${Math.round(width)}">${body}</svg>`;

// The hatch for no data, not in the program, or a CMS-assigned value: a pattern in currentColor, so its ink comes
// from .chart-hatch and forced-colors can repaint it. One per SVG, named by the caller's id.
const hatchId = (id) => `chart-${id}-hatch`;
export const hatchFill = (id) => `url(#${hatchId(id)})`;
export const hatchDefs = (id) => html`<defs><pattern id="${hatchId(id)}" class="chart-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="1.5" height="6" fill="currentColor"/></pattern></defs>`;

// One data mark: its tooltip (an SVG <title>: the browser's own tooltip without JavaScript; web/client/figure.js
// shows it on hover and from the keyboard), its plotted value or values (figure() checks the table holds each), a
// transparent hit area larger than the mark (hit null: the mark is big enough to be its own), then the mark.
// data: extra data-* attributes.
export function mark({ tip, value = null, data = {}, hit, body }) {
  const values = value === null ? [] : [value].flat();
  const attrs = Object.entries(data).map(([k, v]) => html` data-${k}="${v}"`);
  const area = hit === null ? '' : html`<rect class="chart-hit" x="${r2(hit.x)}" y="${r2(hit.y)}" width="${r2(hit.width)}" height="${r2(hit.height)}"/>`;
  return html`<g class="chart-mark" data-mark${attrs}${values.length ? html` data-value="${values.join(' ')}"` : ''}><title>${tip}</title>${area}${body}</g>`;
}

// A horizontal bar from x0 (the baseline) to x1 (the data end), rounded only at the data end. '' when it has no length.
export function barPath(x0, x1, y, h) {
  const len = Math.abs(x1 - x0);
  if (len === 0) return '';
  const dir = x1 > x0 ? 1 : -1;
  const r = Math.min(RADIUS, len, h / 2);
  const sweep = dir > 0 ? 1 : 0;
  return `M${r2(x0)} ${r2(y)}H${r2(x1 - dir * r)}A${r2(r)} ${r2(r)} 0 0 ${sweep} ${r2(x1)} ${r2(y + r)}V${r2(y + h - r)}A${r2(r)} ${r2(r)} 0 0 ${sweep} ${r2(x1 - dir * r)} ${r2(y + h)}H${r2(x0)}Z`;
}

// A column from the baseline yb up to yt, rounded only at the top. '' when it has no height.
export function columnPath(x, w, yb, yt) {
  const len = yb - yt;
  if (len <= 0) return '';
  const r = Math.min(RADIUS, len, w / 2);
  return `M${r2(x)} ${r2(yb)}V${r2(yt + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + r)} ${r2(yt)}H${r2(x + w - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + w)} ${r2(yt + r)}V${r2(yb)}Z`;
}

// The ▲ with its apex at (x, y): solid for this hospital, hollow for a hypothetical.
export const triangle = (x, y, cls) => html`<path class="${cls}" d="M${r2(x)} ${r2(y)}l6 11h-12z"/>`;

// anchor null: the class's CSS sets text-anchor (for text repeated many times, such as a tile map's codes).
export const text = ({ x, y, anchor = 'middle', dx = 0, cls, body }) =>
  html`<text class="${cls}" x="${r2(x)}" y="${r2(y)}"${dx ? html` dx="${dx}"` : ''}${anchor ? html` text-anchor="${anchor}"` : ''}>${body}</text>`;
