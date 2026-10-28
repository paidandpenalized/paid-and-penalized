// The dot histogram the hub's charts share (hub/client/pile.js): one dot per hospital, in bins along the share axis, the
// dots shrinking until the tallest bin fits but never below a dot that stays visibly separate as drawn, the bins widening
// past that; exactly $0 wrapped across the gutter's own columns. Synthetic values shaped like the story's steepest pile
// (the Readmissions step: a tall spike just under $0), at a phone's and two desktops' widths and device pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { R_MIN, pileLayout } from '../client/pile.js';
import { drawnDot } from '../client/story/geometry.js';
import { shareScale } from '../client/scale.js';

// A fixed stream of numbers in [0, 1) (a linear congruential generator), so every run lays out the same values.
function stream(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 2,971 values in percent: 671 exactly 0, most of the rest small cuts (an exponential tail out to the 3% cap), a few
// bonuses. key: a stable order within a column.
function values() {
  const r = stream(7);
  return Array.from({ length: 2971 }, (_, id) => {
    let v = 0;
    if (id >= 671) v = id % 9 === 0 ? r() * 3 : -Math.min(3, -Math.log(1 - r()) * 0.3);
    return { id, v, key: r() };
  });
}
const ITEMS = values();

const CASES = [
  // A phone: 390 wide, a 472px stage, device pixels a third of a CSS pixel.
  { name: '390 at 3x', x0: 12, x1: 378, gutter: 12, base: 395, top: 62, dMax: 2.6, dMin: 1, px: 1 / 3 },
  // A desktop: the stage about 600 wide, on a 2x screen.
  { name: '1440 at 2x', x0: 40, x1: 572, gutter: 24, base: 700, top: 110, dMax: 3.8, dMin: 1, px: 1 / 2 },
  // A desktop on a 1x screen with a short window: no dot can be under two device pixels apart, so the tallest bins widen.
  { name: '1366 at 1x', x0: 40, x1: 548, gutter: 24, base: 440, top: 62, dMax: 3.8, dMin: 2, px: 1 },
];

// A dot as the story's stage draws it (geometry.js drawnDot): its size across in device pixels.
const across = (r, px) => drawnDot(r, 1 / px).side;

function check(layout, items, { base, top, mirror, px }, scale) {
  const { d, r, pos, cols } = layout;
  assert.ok(r >= R_MIN - 1e-9, `r ${r}`);
  assert.ok(2 * r <= d + 1e-9, 'a dot is no wider than its column');
  assert.equal(pos.size, items.length, 'every item placed');
  // As drawn: a whole number of device pixels between neighbours' centers, and at least one device pixel of paper
  // between two dots, side by side or one above the other.
  const side = across(r, px);
  assert.ok(Math.abs(d / px - Math.round(d / px)) < 1e-9, `the pitch ${d} is whole device pixels`);
  assert.ok(d / px - side >= 1 - 1e-9, `a ${side} device-pixel dot at a ${d / px} device-pixel pitch touches its neighbour`);
  // By column: the dots one above another at least a pitch apart, the columns at least a pitch apart.
  const byX = new Map();
  for (const { id } of items) {
    const p = pos.get(id);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `item ${id} placed`);
    if (!byX.has(p.x)) byX.set(p.x, []);
    byX.get(p.x).push(p.y);
  }
  const xs = [...byX.keys()].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= d - 1e-9, `columns ${xs[i - 1]} and ${xs[i]} closer than ${d}`);
  for (const ys of byX.values()) {
    ys.sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= d - 1e-9, 'two dots in a column closer than a pitch');
    assert.ok(ys[0] - r >= top - 1e-9, `a column reaches ${ys[0] - r}, above the top ${top}`);
    assert.ok(ys[ys.length - 1] + r <= base + 1e-9, `a column reaches ${ys[ys.length - 1] + r}, below the base ${base}`);
  }
  // The columns' summaries match the dots.
  assert.equal(cols.reduce((n, c) => n + c.n, 0), items.length);
  for (const c of cols) {
    const ys = byX.get(c.x);
    assert.equal(ys.length, c.n);
    assert.ok(c.top <= Math.min(...ys) - r + 1e-9 && c.bottom >= Math.max(...ys) + r - 1e-9);
  }
  // $0 only in the gutter's columns, and only $0 there; every other value on its own side.
  for (const { id, v } of items) {
    const { x } = pos.get(id);
    const col = cols.find((c) => c.x === x);
    if (v === 0) assert.ok(col.zero && x - r >= scale.zL - 1e-9 && x + r <= scale.zR + 1e-9, `a $0 dot outside the gutter at ${x}`);
    else assert.ok(!col.zero && (v < 0 ? x + r <= scale.zL + 1e-9 : x - r >= scale.zR - 1e-9), `a ${v} dot on the wrong side at ${x}`);
  }
  if (mirror) {
    const mid = (base + top) / 2;
    for (const c of cols) assert.ok(Math.abs((c.top + c.bottom) / 2 - mid) <= d / 2 + 1e-9, 'a mirrored column is centered');
  }
}

for (const c of CASES) {
  const scale = shareScale({ x0: c.x0, x1: c.x1, gutter: c.gutter, domain: [-3.9, 3.2], px: c.px });
  const opts = { base: c.base, top: c.top, dMax: c.dMax, dMin: c.dMin, gap: (d) => Math.max(c.px, d * 0.24), px: c.px };

  test(`pileLayout at ${c.name}: every dot placed and separate as drawn, the tallest bin inside, $0 in the gutter`, () => {
    const layout = pileLayout(ITEMS, scale, opts);
    assert.equal(layout.fits, true);
    assert.equal(layout.zeroCount, 671);
    assert.ok(layout.d <= c.dMax && layout.d >= c.dMin);
    check(layout, ITEMS, opts, scale);
  });

  test(`pileLayout at ${c.name}, mirrored: the same, each column centered`, () => {
    const layout = pileLayout(ITEMS, scale, { ...opts, mirror: true });
    assert.equal(layout.fits, true);
    check(layout, ITEMS, { ...opts, mirror: true }, scale);
  });
}

test('pileLayout widens the bins of a pile that cannot fit at its smallest separate dot, never shrinking a dot below it', () => {
  // On a 1x screen and a short room the steep pile needs bins of several dot-wide columns.
  const c = CASES[2];
  const scale = shareScale({ x0: c.x0, x1: c.x1, gutter: c.gutter, domain: [-3.9, 3.2], px: 1 });
  const opts = { base: c.top + 200, top: c.top, dMax: 3.8, dMin: 2, gap: (d) => Math.max(1, d * 0.24), px: 1 };
  const layout = pileLayout(ITEMS, scale, opts);
  assert.ok(layout.fits && layout.m > 1, `bins of ${layout.m}`);
  assert.deepEqual([layout.d, layout.r], [2, 0.5]);
  check(layout, ITEMS, opts, scale);
  check(pileLayout(ITEMS, scale, { ...opts, mirror: true }), ITEMS, { ...opts, mirror: true }, scale);
  // A spike: 300 at one value, room for 100 rows of the smallest dot: three columns side by side, filled a row at a
  // time, centered where the one-column bin would be.
  const spike = Array.from({ length: 300 }, (_, id) => ({ id, v: -1, key: id }));
  const flat = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2], px: 1 });
  const s = pileLayout(spike, flat, { base: 210, top: 10, dMax: 3, dMin: 2, gap: 1, px: 1 });
  assert.deepEqual([s.fits, s.m, s.d], [true, 3, 2]);
  const xs = [...new Set(spike.map(({ id }) => s.pos.get(id).x))].sort((a, b) => a - b);
  assert.deepEqual([xs[1] - xs[0], xs[2] - xs[1]], [2, 2]);
  const binWidth = 3 * 2;
  const bin = Math.floor((flat.zL - flat.xs(-1)) / binWidth);
  assert.equal(xs[1], flat.zL - (bin + 0.5) * binWidth, 'the bin keeps its place on the axis');
  // The first row holds the three lowest keys, left to right, at the base.
  assert.deepEqual([0, 1, 2].map((id) => s.pos.get(id).x), xs);
  assert.ok([0, 1, 2].every((id) => s.pos.get(id).y === 210 - 1));
  assert.equal(s.pos.get(3).y, 210 - 3);
  // A wider bin never reaches into its neighbour or the gutter.
  for (const id of [0, 299]) assert.ok(s.pos.get(id).x + s.r <= flat.zL);
});

test('pileLayout uses the largest pitch that fits, and dMax when every column fits at once', () => {
  const scale = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2] });
  const few = [{ id: 'a', v: -1, key: 0 }, { id: 'b', v: -1, key: 1 }, { id: 'c', v: 0, key: 0 }, { id: 'd', v: 1.5, key: 0 }];
  const big = pileLayout(few, scale, { base: 100, top: 0, dMax: 6, dMin: 1, gap: 1 });
  assert.deepEqual([big.d, big.r, big.m], [6, 2.5, 1]);
  // Two cuts in one column, the older key at the bottom.
  assert.equal(big.pos.get('a').x, big.pos.get('b').x);
  assert.ok(big.pos.get('a').y > big.pos.get('b').y);
  assert.equal(big.pos.get('a').y, 100 - 3);
  // A column of 20 in 50px: the pitch shrinks in tenths until 20 dots fit.
  const tall = Array.from({ length: 20 }, (_, id) => ({ id, v: -1, key: id }));
  const fit = pileLayout(tall, scale, { base: 50, top: 0, dMax: 6, dMin: 1, gap: 0.5 });
  assert.ok(fit.fits && fit.m === 1 && fit.d * 20 <= 50 + 1e-9 && (fit.d + 0.1) * 20 > 50, `pitch ${fit.d}`);
});

test('pileLayout never draws a dot under R_MIN: a pitch whose dot would be smaller is not tried', () => {
  const scale = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2], px: 1 });
  const tall = Array.from({ length: 200 }, (_, id) => ({ id, v: -1, key: id }));
  // At 1px a pitch of 1 leaves no dot beside a 1px gap: the smallest is 2, and the bin widens from there.
  const layout = pileLayout(tall, scale, { base: 100, top: 0, dMax: 3, dMin: 1, gap: 1, px: 1 });
  assert.equal(layout.d, 2);
  assert.ok(layout.r >= R_MIN && layout.m === 4 && layout.fits, `${layout.d} ${layout.r} ${layout.m}`);
  assert.throws(() => pileLayout(tall, scale, { base: 100, top: 0, dMax: 1, dMin: 1, gap: 1, px: 1 }), RangeError);
});

test('pileLayout wraps $0 across the gutter\'s columns, dealt in key order', () => {
  const scale = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2] });
  const zeros = Array.from({ length: 12 }, (_, id) => ({ id, v: 0, key: id }));
  const layout = pileLayout(zeros, scale, { base: 100, top: 0, dMax: 5, dMin: 1, gap: 1 });
  const cols = layout.cols.filter((c) => c.zero);
  assert.equal(cols.length, 4);
  assert.deepEqual(cols.map((c) => c.n), [3, 3, 3, 3]);
  assert.equal(layout.pos.get(0).x, layout.pos.get(4).x);
  assert.ok(layout.pos.get(0).y > layout.pos.get(4).y);
});
