// SVG pieces every chart in the kit shares: the frame, a data mark with its tooltip and hit area, the 45° hatch,
// bar shapes (rounded at the data end, square at the baseline) and the ▲ that marks "this hospital". Build time only;
// colors come from classes in web/styles/charts.css, never from here.
import { cmsText } from '../render/format.js';
import { html } from '../render/html.js';

// Charts are drawn about phone wide, so on a 375px screen their text is near its CSS size.
export const WIDTH = 360;
export const RADIUS = 4;
export const GAP = 2;
export const MAX_THICKNESS = 24;

// Coordinates to 0.01 unit, so the markup is short and stable.
export const r2 = (x) => Math.round(x * 100) / 100;

// A value as the caller gave it: JavaScript's shortest digits (never re-rounded), with a true minus.
export const plain = (v) => cmsText(String(v));

const ID = /^[a-z][a-z0-9-]*$/;
export function checkId(id, who) {
  if (typeof id !== 'string' || !ID.test(id)) throw new RangeError(`${who}: id must be lowercase letters, digits and hyphens, got "${id}"`);
  return id;
}

export const frame = ({ kind, width, height, body }) =>
  html`<svg class="chart chart--${kind}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" width="100%" focusable="false">${body}</svg>`;

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

export const text = ({ x, y, anchor = 'middle', dx = 0, cls, body }) =>
  html`<text class="${cls}" x="${r2(x)}" y="${r2(y)}"${dx ? html` dx="${dx}"` : ''} text-anchor="${anchor}">${body}</text>`;
