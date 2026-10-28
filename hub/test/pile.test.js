// The dot histogram the hub's charts share (hub/client/pile.js): one dot per hospital, one dot-wide column per bin of the
// share axis, the dots shrinking until the tallest column fits; exactly $0 wrapped across the gutter's own columns.
// Synthetic values shaped like the story's steepest pile (the Readmissions step: a tall spike just under $0), at a phone's
// and a desktop's width.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pileLayout } from '../client/pile.js';
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
  { name: '390', x0: 12, x1: 378, gutter: 12, base: 395, top: 62, dMax: 2.6, dMin: 1, px: 1 / 3 },
  // A desktop: the stage about 600 wide.
  { name: '1440', x0: 40, x1: 572, gutter: 24, base: 700, top: 110, dMax: 3.8, dMin: 1, px: 1 / 2 },
];

function check(layout, items, { base, top, mirror }, scale) {
  const { d, r, pos, cols } = layout;
  assert.ok(r >= 0.4, `r ${r}`);
  assert.ok(2 * r <= d + 1e-9, 'a dot is no wider than its column');
  assert.equal(pos.size, items.length, 'every item placed');
  // By column: the dots one above another at least 2r apart, the columns at least d apart.
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
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 2 * r - 1e-9, 'two dots in a column overlap');
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
  const opts = { base: c.base, top: c.top, dMax: c.dMax, dMin: c.dMin, gap: (d) => Math.max(c.px, d * 0.22), px: c.px };

  test(`pileLayout at ${c.name}: every dot placed and separate, the tallest column inside, $0 in the gutter`, () => {
    const layout = pileLayout(ITEMS, scale, opts);
    assert.equal(layout.fits, true);
    assert.equal(layout.zeroCount, 671);
    assert.ok(Math.abs(layout.d / c.px - Math.round(layout.d / c.px)) < 1e-9, `the pitch ${layout.d} is whole device pixels`);
    assert.ok(layout.d <= c.dMax && layout.d >= c.dMin);
    check(layout, ITEMS, opts, scale);
  });

  test(`pileLayout at ${c.name}, mirrored: the same, each column centered`, () => {
    const layout = pileLayout(ITEMS, scale, { ...opts, mirror: true });
    assert.equal(layout.fits, true);
    check(layout, ITEMS, { ...opts, mirror: true }, scale);
  });
}

test('pileLayout uses the largest pitch that fits, and dMax when every column fits at once', () => {
  const scale = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2] });
  const few = [{ id: 'a', v: -1, key: 0 }, { id: 'b', v: -1, key: 1 }, { id: 'c', v: 0, key: 0 }, { id: 'd', v: 1.5, key: 0 }];
  const big = pileLayout(few, scale, { base: 100, top: 0, dMax: 6, dMin: 1, gap: 1 });
  assert.equal(big.d, 6);
  assert.equal(big.r, 2.5);
  // Two cuts in one column, the older key at the bottom.
  assert.equal(big.pos.get('a').x, big.pos.get('b').x);
  assert.ok(big.pos.get('a').y > big.pos.get('b').y);
  assert.equal(big.pos.get('a').y, 100 - 3);
  // A column of 20 in 50px: the pitch shrinks in tenths until 20 dots fit.
  const tall = Array.from({ length: 20 }, (_, id) => ({ id, v: -1, key: id }));
  const fit = pileLayout(tall, scale, { base: 50, top: 0, dMax: 6, dMin: 1, gap: 0.5 });
  assert.ok(fit.fits && fit.d * 20 <= 50 + 1e-9 && (fit.d + 0.1) * 20 > 50, `pitch ${fit.d}`);
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

test('pileLayout reports a pile that cannot fit at dMin rather than hiding it, and still places every dot', () => {
  const scale = shareScale({ x0: 0, x1: 600, gutter: 20, domain: [-2, 2] });
  const tall = Array.from({ length: 200 }, (_, id) => ({ id, v: -1, key: id }));
  const layout = pileLayout(tall, scale, { base: 100, top: 0, dMax: 3, dMin: 1, gap: 0.2 });
  assert.equal(layout.fits, false);
  assert.equal(layout.d, 1);
  assert.equal(layout.pos.size, 200);
});
