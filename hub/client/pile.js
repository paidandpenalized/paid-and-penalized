// The dot histogram the hub's charts share (the home story's piles, the hospital page's swarm): one dot per hospital,
// stacked in columns one dot wide along the share axis (scale.js), so a dot never hides another and a pile never turns
// into a solid bar. The dots shrink until the tallest column fits; exactly $0 has the axis's gutter to itself and wraps
// across as many columns as the gutter holds. Pure.

// How much the pitch shrinks per try when no device pixel is given.
const STEP = 0.1;
// The smallest dot radius drawn, in pixels.
const R_MIN = 0.4;

// Each item into its column at pitch d: { cols: Map(key -> { x, list, zero }), max: the tallest column's count in the
// mode's terms (mirror: the rows the taller half needs), zeros }.
function binCols(items, scale, d, mirror) {
  const cols = new Map();
  const zeros = [];
  const { zL, zR, zM } = scale;
  for (const it of items) {
    if (it.v === 0) {
      zeros.push(it);
      continue;
    }
    const x = scale.xs(it.v);
    const c = Math.floor(((it.v < 0 ? zL - x : x - zR) / d) + 1e-9);
    const key = it.v < 0 ? -1 - c : 1 + c;
    let col = cols.get(key);
    if (!col) cols.set(key, (col = { x: it.v < 0 ? zL - (c + 0.5) * d : zR + (c + 0.5) * d, list: [], zero: false }));
    col.list.push(it);
  }
  if (zeros.length) {
    const n = Math.max(1, Math.floor((zR - zL) / d + 1e-9));
    zeros.sort((a, b) => a.key - b.key);
    for (let j = 0; j < n; j++) cols.set(`z${j}`, { x: zM + (j - (n - 1) / 2) * d, list: [], zero: true });
    zeros.forEach((it, k) => cols.get(`z${k % n}`).list.push(it));
  }
  let max = 0;
  for (const col of cols.values()) max = Math.max(max, mirror ? 2 * Math.floor(col.list.length / 2) + 1 : col.list.length);
  return { cols, max, zeros: zeros.length };
}

// The pile of items ({ id, v: percent, key }) on the scale (shareScale), between `top` and `base` (pixels, base below):
//   dMax, dMin  the pitch's range: the largest that fits the tallest column is used, never below dMin;
//   gap         the space between neighbouring dots: a number, or a function of the pitch;
//   mirror      columns centered on the middle line (a swarm) rather than standing on the base;
//   px          a device pixel: the pitch is then a whole number of device pixels, so dots drawn on the device's grid
//               keep equal gaps.
// Within a column, items stack in key order (the lowest key at the base, or at the middle when mirrored, then
// alternating below and above). Returns { d, r, pos: Map(id -> { x, y }), cols: [{ x, n, top, bottom, zero }],
// zeroCount, fits }. When even dMin cannot fit the tallest column, fits is false and the overfull columns are packed
// closer than a pitch (their dots overlap) so the pile stays inside; callers size their piles so that never happens.
export function pileLayout(items, scale, { base, top, dMax, dMin, gap, mirror = false, px = 0 }) {
  const avail = base - top;
  const step = px || STEP;
  const steps = Math.floor(dMax / step + 1e-9);
  let res = null;
  let d = 0;
  for (let i = 0; ; i++) {
    d = px ? (steps - i) * px : Math.round((dMax - i * STEP) * 1e6) / 1e6;
    res = binCols(items, scale, d, mirror);
    const next = px ? (steps - i - 1) * px : dMax - (i + 1) * STEP;
    if (res.max * d <= avail + 1e-9 || next < dMin - 1e-9) break;
  }
  const g = typeof gap === 'function' ? gap(d) : gap;
  const r = Math.max(R_MIN, (d - g) / 2);
  const fits = res.max * d <= avail + 1e-9;
  const mid = (base + top) / 2;
  const pos = new Map();
  const cols = [];
  for (const col of res.cols.values()) {
    const n = col.list.length;
    const rows = mirror ? 2 * Math.floor(n / 2) + 1 : n;
    // An overfull column (only when nothing fits) packs its dots closer, keeping them inside.
    const sp = rows * d <= avail + 1e-9 || rows < 2 ? d : (avail - d) / (rows - 1);
    col.list.sort((a, b) => a.key - b.key);
    col.list.forEach((it, k) => {
      const y = mirror ? mid + (k % 2 ? (k + 1) / 2 : -k / 2) * sp : base - d / 2 - k * sp;
      pos.set(it.id, { x: col.x, y });
    });
    cols.push(mirror
      ? { x: col.x, n, top: mid - Math.floor((n - 1) / 2) * sp - d / 2, bottom: mid + Math.floor(n / 2) * sp + d / 2, zero: col.zero }
      : { x: col.x, n, top: base - n * sp, bottom: base, zero: col.zero });
  }
  return { d, r, pos, cols, zeroCount: res.zeros, fits };
}
