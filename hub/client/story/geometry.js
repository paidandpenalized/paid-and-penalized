// The story stage's geometry (the home page's sticky chart): where the share axis runs, where the programs' gates stand,
// and where the scale bar's and the map's drawings sit, so the canvas's dots land exactly on them. Pure: the stage
// measures the page (its size, the device pixel, the two drawings' boxes) and hands the numbers in.
import { NARROW_BELOW } from '../pile.js';
import { shareScale } from '../scale.js';
import { BAR } from './bar-frame.js';

// The plot's margins in CSS pixels: its left and right insets, the $0 gutter, the room at the top (more where the step's
// name sits there, when the rail is hidden), the room under the axis for its ticks and words, the gates' spacing, and the
// space a gate's label needs above a pile.
const WIDE = { x0: 40, right: 26, gutter: 24, top: 22, topLabel: 40, bottom: 62, pitch: 30, label: 24 };
const NARROW = { x0: 12, right: 12, gutter: 12, top: 26, topLabel: 26, bottom: 34, pitch: 18, label: 14 };
// The gates: the three programs, then the floor the last pile rests on.
export const GATES = 4;

// The stage's frame: { W, H, narrow, px, x0, x1, top, bottom, pitch, label, gutter, scale, boxes }.
//   W, H        the stage's size; narrow: a phone's layout (W under pile.js NARROW_BELOW unless given)
//   railHidden  the step's name sits in the stage's top left (no rail beside it)
//   px          a device pixel in CSS pixels (1 / devicePixelRatio): piles and the $0 gutter snap to it
//   domain      the share axis's [lo, hi] (scale.js shareDomain)
//   boxes       the drawings' boxes in stage coordinates, as measured ({ bar, map }: { x, y, w, h }), when on a page
export function stageGeometry({ W, H, narrow = W < NARROW_BELOW, railHidden = false, px = 0, domain, boxes = {} }) {
  const m = narrow ? NARROW : WIDE;
  const x0 = m.x0;
  const x1 = W - m.right;
  const scale = shareScale({ x0, x1, gutter: m.gutter, domain, px });
  return {
    W, H, narrow, px, x0, x1, top: railHidden ? m.topLabel : m.top, bottom: H - m.bottom, pitch: m.pitch, label: m.label,
    gutter: m.gutter, scale, boxes,
  };
}

// A gate's line when passed (stacked at the top, in order) and when still waiting (stacked above the axis).
export const gateTop = (g, k) => g.top + 16 + (k - 1) * g.pitch;
export const gateBottom = (g, k) => g.bottom - (GATES - k) * g.pitch;

// The four lines' heights after the first s gates have been passed (s from 0 to 3): passed ones at the top, the rest at
// the bottom. The pile rests on line s (index s, the next gate, or the floor after the third).
export const gateLines = (g, s) => Array.from({ length: GATES }, (_, i) => (i + 1 <= s ? gateTop(g, i + 1) : gateBottom(g, i + 1)));

// The box an SVG's drawing fills inside its element's box (rect: { x, y, w, h }) for a viewBox vbW by vbH, as the browser
// fits it (preserveAspectRatio's default: scaled to fit whole, centered).
export function fitBox(rect, vbW, vbH) {
  const k = Math.min(rect.w / vbW, rect.h / vbH);
  return { x: rect.x + (rect.w - vbW * k) / 2, y: rect.y + (rect.h - vbH * k) / 2, w: vbW * k, h: vbH * k };
}

// The scale bar on the stage: { x, y, k, r, point(vx, vy) -> [x, y] }: its drawing's top left and scale (stage pixels per
// viewBox unit), a dot's radius, and a point of the drawing on the stage. From the measured box of the bar's SVG, or,
// with none, a bar across the plot a third of the way down.
export function barGeometry(g) {
  const box = g.boxes.bar ?? (() => {
    const w = (g.x1 - g.x0) * (g.narrow ? 1 : 0.9);
    return { x: g.x1 - w, y: g.H * 0.3 - BAR.Y * (w / BAR.W), w };
  })();
  const k = box.w / BAR.W;
  return { x: box.x, y: box.y, k, r: (BAR.DOT / 2) * k, point: (vx, vy) => [box.x + vx * k, box.y + vy * k] };
}

// The US map on the stage: { k, ox, oy, w, h }, so a hospital at (x, y) in the asset's projection (mapW by mapH) is at
// (ox + x k, oy + y k). From the measured box of the map's SVG, or, with none, the map fitted between margins.
export function mapGeometry(g, mapW, mapH) {
  const box = g.boxes.map;
  if (box) {
    const k = box.w / mapW;
    return { k, ox: box.x, oy: box.y, w: box.w, h: mapH * k };
  }
  const padT = g.narrow ? 44 : 50;
  const padB = g.narrow ? 96 : 150;
  const padX = g.narrow ? 6 : 24;
  const k = Math.min((g.W - 2 * padX) / mapW, (g.H - padT - padB) / mapH);
  return { k, ox: (g.W - mapW * k) / 2, oy: padT + (g.H - padT - padB - mapH * k) / 2, w: mapW * k, h: mapH * k };
}
