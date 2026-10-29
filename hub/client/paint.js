// What the hub's canvases share (the home story's stage, the hospital page's swarm): the curves their dots move on (the
// front page's masthead moves on them too), the device pixel they snap to, a font from the tokens' faces, and the dots
// painted in batches. Colors, fonts and the ink codes are colors.js's; a dot's drawn size is pile.js's.
import { clamp } from '../../engine/js/stats.js';
import { drawnDot } from './pile.js';

export const TAU = Math.PI * 2;
export const clamp01 = (v) => clamp(v, 0, 1);
// A glide's length (ms): the swarm's moves and the hospital page's strips' (hub/styles.css .st--live's transitions),
// which move together on a what-if's change of axis.
export const GLIDE_MS = 700;
// From 0 to 1 over 0 to 1: in and out (cubic), smoothstep, and fast out (cubic).
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const smooth = (x) => x * x * (3 - 2 * x);
export const outCubic = (x) => 1 - (1 - x) ** 3;

// Device pixels to a CSS pixel, held between 1 and 3: a page zoomed out below 1 lays out and draws as at 1.
export const deviceRatio = () => clamp(window.devicePixelRatio || 1, 1, 3);

// A canvas font: size in CSS pixels, its weight, and the mono face or the body face (fonts: colors.js readFonts).
export const fontOf = (fonts, size, weight = 400, mono = false) => `${weight} ${size}px ${mono ? fonts.type : fonts.body}`;

// Dots 0 to count - 1, each at (x[s], y[s]) with radius r[s] and opacity a[s] (unseen under 0.02) in the color of its
// code (code(s); ink: code to color), batched by ink and opacity (tenths), one path each. A small dot is a square on the
// device's grid (dpr: device pixels to a CSS pixel; pile.js drawnDot), so a pile never turns into a solid bar.
export function paintDots(ctx, { count, x, y, r, a, code, ink, dpr }) {
  const buckets = new Map();
  for (let s = 0; s < count; s++) {
    if (a[s] < 0.02) continue;
    const k = code(s) * 16 + Math.round(a[s] * 10);
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(s);
  }
  for (const [k, list] of buckets) {
    ctx.fillStyle = ink(k >> 4);
    ctx.globalAlpha = (k & 15) / 10;
    ctx.beginPath();
    for (const s of list) {
      const { square, side } = drawnDot(r[s], dpr);
      if (square) ctx.rect(Math.round(x[s] * dpr - side / 2) / dpr, Math.round(y[s] * dpr - side / 2) / dpr, side / dpr, side / dpr);
      else {
        ctx.moveTo(x[s] + r[s], y[s]);
        ctx.arc(x[s], y[s], r[s], 0, TAU);
      }
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
