// The dot histogram the hub's charts share (the home story's piles, the hospital page's swarm and strips): one dot per hospital,
// stacked in bins along the share axis (scale.js), so a dot never hides another and a pile never turns into a solid bar.
// The dots shrink until the tallest bin fits, but never below a dot a reader can still tell apart (R_MIN across, and a
// gap of at least a device pixel). When even those dots cannot fit, the bins widen instead: each holds m dot-wide
// sub-columns side by side (m = 1, 2, 3, ... the smallest that fits), filled a row at a time, so a spike stands as a
// wider, shorter block of separate dots and no hospital is hidden or overlapped. Exactly $0 has the axis's gutter to
// itself and wraps across as many columns as the gutter holds. Pure.

// A chart narrower than this (CSS pixels) lays out as a phone's.
export const NARROW_BELOW = 520;

// A dot as the charts draw it on a screen of dpr device pixels to a CSS pixel: under SQUARE_BELOW device pixels across,
// a square of whole device pixels (at least one) on the device's grid, so the smallest piles keep a clear device pixel
// between dots instead of blurring into a bar; larger, a circle. side: its size across in device pixels.
export const SQUARE_BELOW = 2.5;
export function drawnDot(r, dpr) {
  const across = 2 * r * dpr;
  return across < SQUARE_BELOW ? { square: true, side: Math.max(1, Math.floor(across)) } : { square: false, side: across };
}

// A hospital's stable spread in [0, 1), by its CCN: its place in a pile's stacking order, never the asset's order.
export function hashOf(text) {
  let s = 2166136261;
  for (let i = 0; i < text.length; i++) s = Math.imul(s ^ text.charCodeAt(i), 16777619);
  return ((s >>> 0) % 100003) / 100003;
}

// The space between dots at a device pixel px (CSS pixels; 0 for none): gap, a function of the pitch, at least a device
// pixel so even the smallest dots stay apart on the screen; and dMin, the smallest pitch, a CSS pixel and two device pixels
// (a dot and a gap).
export const pileSpacing = (px) => ({ gap: (d) => Math.max(px || 0.25, d * 0.24), dMin: Math.max(1, 2 * (px || 0)) });

// A peer group's largest pitch by its size, narrow or wide: a small group's dots can be larger.
export const peerPitch = (n, narrow) => (n < 160 ? (narrow ? 5 : 8.5) : n < 700 ? (narrow ? 3.4 : 5.6) : narrow ? 2.6 : 4.2);

// A pile's (pileLayout's) top and bottom: [the highest column's top, the lowest column's bottom].
export const pileExtent = (pile) => pile.cols.reduce((e, c) => [Math.min(e[0], c.top), Math.max(e[1], c.bottom)], [Infinity, -Infinity]);

// How much the pitch shrinks per try when no device pixel is given.
const STEP = 0.1;
// The smallest dot radius drawn, in pixels: a pitch whose dot would be smaller does not fit.
export const R_MIN = 0.4;
// The most sub-columns a bin widens to before the pile gives up on fitting (never reached by the story's piles).
const M_MAX = 64;

// Each item into its bin at pitch d, m sub-columns a bin (so bins are m·d wide, and their centers are where a column of
// that width would be): { bins: [{ x, m, list, zero }], height: the tallest bin's rows times d in the mode's terms
// (mirror: the rows its taller half needs), zeros }. $0's columns stay one dot wide, wrapped across the gutter.
function binItems(items, scale, d, m, mirror) {
  const byKey = new Map();
  const zeros = [];
  const { zL, zR, zM } = scale;
  const w = m * d;
  for (const it of items) {
    if (it.v === 0) {
      zeros.push(it);
      continue;
    }
    const x = scale.xs(it.v);
    const c = Math.floor(((it.v < 0 ? zL - x : x - zR) / w) + 1e-9);
    const key = it.v < 0 ? -1 - c : 1 + c;
    let bin = byKey.get(key);
    if (!bin) byKey.set(key, (bin = { x: it.v < 0 ? zL - (c + 0.5) * w : zR + (c + 0.5) * w, m, list: [], zero: false }));
    bin.list.push(it);
  }
  const bins = [...byKey.values()];
  if (zeros.length) {
    const n = Math.max(1, Math.floor((zR - zL) / d + 1e-9));
    const cols = Array.from({ length: n }, (_, j) => ({ x: zM + (j - (n - 1) / 2) * d, m: 1, list: [], zero: true }));
    zeros.sort((a, b) => a.key - b.key);
    zeros.forEach((it, k) => cols[k % n].list.push(it));
    bins.push(...cols);
  }
  let rows = 0;
  let rest = 0;
  for (const bin of bins) {
    const r = Math.ceil(bin.list.length / bin.m);
    const need = mirror ? 2 * Math.floor(r / 2) + 1 : r;
    rows = Math.max(rows, need);
    if (!bin.zero) rest = Math.max(rest, need);
  }
  // height: the tallest bin's; rest: the tallest but $0's (which widening cannot shorten).
  return { bins, height: rows * d, rest: rest * d, zeros: zeros.length };
}

// The pile of items ({ id, v: percent, key }) on the scale (shareScale), between `top` and `base` (pixels, base below):
//   dMax, dMin  the pitch's range: the largest that fits is used, never below dMin, nor where its dot would be under
//               R_MIN across (when no pitch in the range keeps both, the smallest above it that does);
//   gap         the space between neighbouring dots: a number, or a function of the pitch;
//   mirror      bins centered on the middle line (a swarm) rather than standing on the base;
//   px          a device pixel: the pitch is then a whole number of device pixels, so dots drawn on the device's grid
//               keep equal gaps;
//   byValue     a widened bin's sub-columns hold slices of its values, lowest on the left (each slice stacked in key
//               order), so an item stands within its slice of the bin rather than anywhere across it: what a chart that
//               rings one item at its value needs (the hospital page's strips). Off by default (the home story's look).
//   ranked      mirrored, each dot-wide column stacks top to bottom in key order, over the same rows the alternating
//               order fills, so an item keeps its place in its column's order when the scale changes and two layouts'
//               places can be glided between without the stacks folding through their middle line (a change of axis on
//               the hospital page's strips and swarm). Off by default.
// Within a bin, items stack in key order (the lowest key at the base, or at the middle when mirrored, then alternating
// below and above), a row of m at a time, left to right. Returns { d, r, m, pos: Map(id -> { x, y }), cols: [{ x, n,
// top, bottom, zero }] (one per dot-wide column), zeroCount, fits }. fits is false only when $0's columns, which cannot
// widen past the gutter, overflow even at the smallest pitch, or M_MAX sub-columns are not enough; the overfull bins are
// then packed closer than a pitch so the pile stays inside. No input the story can reach does either.
export function pileLayout(items, scale, { base, top, dMax, dMin, gap, mirror = false, px = 0, byValue = false, ranked = false }) {
  const avail = base - top;
  const gapOf = (d) => (typeof gap === 'function' ? gap(d) : gap);
  // The pitches to try, largest first: whole device pixels (or tenths) from dMax down to dMin, while a dot keeps R_MIN.
  const pitches = [];
  const steps = Math.floor(dMax / (px || STEP) + 1e-9);
  for (let i = 0; ; i++) {
    const d = px ? (steps - i) * px : Math.round((dMax - i * STEP) * 1e6) / 1e6;
    if (d < dMin - 1e-9 || (d - gapOf(d)) / 2 < R_MIN - 1e-9) break;
    pitches.push(d);
  }
  // None in that range (a device pixel so large that dMin passes dMax, or a gap that leaves no dot): the smallest pitch at
  // or above dMin, on the grid, whose dot keeps R_MIN; the bins widen from there as they need to.
  if (!pitches.length) {
    const unit = px || STEP;
    let d = Math.max(unit, Math.ceil(dMin / unit - 1e-9) * unit);
    while ((d - gapOf(d)) / 2 < R_MIN - 1e-9) d += unit;
    pitches.push(d);
  }
  let res = null;
  let d = 0;
  let m = 1;
  // The first layout where everything but $0 fits: when $0's own columns overflow, widening further cannot help, so the
  // search stops there.
  let rest = null;
  search: for (; m <= M_MAX; m++) {
    for (const pitch of pitches) {
      d = pitch;
      res = binItems(items, scale, d, m, mirror);
      if (res.height <= avail + 1e-9) break search;
      if (!rest && res.rest <= avail + 1e-9) rest = { res, d, m };
    }
    if (rest) {
      ({ res, d, m } = rest);
      break;
    }
  }
  if (m > M_MAX) m = M_MAX;
  const fits = res.height <= avail + 1e-9;
  const r = (d - gapOf(d)) / 2;
  const mid = (base + top) / 2;
  const pos = new Map();
  const cols = new Map();
  for (const bin of res.bins) {
    const rows = Math.ceil(bin.list.length / bin.m);
    const need = mirror ? 2 * Math.floor(rows / 2) + 1 : rows;
    // An overfull bin (only when nothing fits) packs its rows closer, keeping them inside.
    const sp = need * d <= avail + 1e-9 || need < 2 ? d : (avail - d) / (need - 1);
    // Each item's row and sub-column: a row of m at a time in key order, or (byValue) a value slice per sub-column.
    let at;
    if (byValue && bin.m > 1) {
      at = [];
      const sorted = bin.list.slice().sort((a, b) => a.v - b.v || a.key - b.key);
      for (let j = 0; j < bin.m; j++) {
        sorted.slice(j * rows, (j + 1) * rows).sort((a, b) => a.key - b.key).forEach((it, row) => at.push([it, row, j]));
      }
    } else {
      bin.list.sort((a, b) => a.key - b.key);
      at = bin.list.map((it, k) => [it, Math.floor(k / bin.m), k % bin.m]);
    }
    // Mirrored, a row's place from the middle line: alternating below and above, or (ranked) the column's rows in order
    // from its top, over the same places (a column of n stands from floor((n - 1) / 2) rows above the line).
    const n = new Array(bin.m).fill(0);
    for (const [, , j] of at) n[j] += 1;
    const step = (row, j) => (ranked ? row - Math.floor((n[j] - 1) / 2) : row % 2 ? (row + 1) / 2 : -row / 2);
    at.forEach(([it, row, j]) => {
      const x = bin.x + (j - (bin.m - 1) / 2) * d;
      const y = mirror ? mid + step(row, j) * sp : base - d / 2 - row * sp;
      pos.set(it.id, { x, y });
      const col = cols.get(x);
      if (col) {
        col.n += 1;
        col.top = Math.min(col.top, y - d / 2);
        col.bottom = Math.max(col.bottom, y + d / 2);
      } else cols.set(x, { x, n: 1, top: y - d / 2, bottom: y + d / 2, zero: bin.zero });
    });
  }
  return { d, r, m, pos, cols: [...cols.values()], zeroCount: res.zeros, fits };
}
