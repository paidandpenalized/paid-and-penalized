// Many small dots as one path: each dot a zero-length segment ("M x y h0") drawn with round caps, so a chart of
// thousands of hospitals is a few kilobytes and its dots take one class's ink. The stroke's width is the dot's
// diameter (the caller sets it on the path). Shared by the build and the browser (a page script redraws a set).
import { html } from '../render/html.js';

const r1 = (x) => Math.round(x * 10) / 10;

// [[x, y], ...] -> the path's d.
export const dotsD = (points) => points.map(([x, y]) => `M${r1(x)} ${r1(y)}h0`).join('');

// One path of dots in a class, diameter d (viewBox units); '' when there are none.
export const dotsPath = (points, cls, d) => (points.length ? html`<path class="chart-dots ${cls}" stroke-width="${r1(d)}" d="${dotsD(points)}"/>` : '');

// A stable spread in [0, 1) for item i (a golden-ratio sequence), for jitter that is the same on every build.
export const spread = (i) => ((i * 0.6180339887498949) % 1 + 1) % 1;

// Stacks of dots on equal bins: each bin's count shown as a column of dots, `per` items to a dot (the last dot of a
// column stands for the remainder), from the baseline up. edges: the bins' edges; counts: per bin. Returns, per bin,
// its dots' centers given x(bin's middle) and the pitch between dot centers.
export function stackColumns(counts, { x, base, pitch, per = 1 }) {
  return counts.map((c, i) => {
    const k = Math.ceil(c / per);
    return Array.from({ length: k }, (_, j) => [x(i), base - pitch / 2 - j * pitch]);
  });
}

// A unit histogram: each item a dot in its bin, the bin's dots in rows of `cols` across the bin's width, filled from
// the baseline up in the order given (so a caller can put a subset first, at the bottom). items: [{ bin, ... }] in
// the order to stack; x0(bin), the bin's left edge, and binW, its width. Returns each item's [x, y].
export function unitHistogram(items, { x0, binW, cols, base, pitch }) {
  const filled = new Map();
  return items.map((item) => {
    const k = filled.get(item.bin) ?? 0;
    filled.set(item.bin, k + 1);
    const col = k % cols;
    const row = Math.floor(k / cols);
    const gap = (binW - cols * pitch) / 2;
    return [x0(item.bin) + gap + (col + 0.5) * pitch, base - (row + 0.5) * pitch];
  });
}
