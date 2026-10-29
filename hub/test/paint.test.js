// What the hub's canvases share (hub/client/paint.js) and the colors and fonts they paint with (colors.js): the dots
// painted in one path per ink and opacity, small ones as squares on the device's grid; a code's ink; the curves' ends.
// A stand-in canvas context records what is drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INK, NEUTRAL, PEN, REW, inkColor, readFonts, signCode } from '../client/colors.js';
import { ease, outCubic, paintDots, smooth } from '../client/paint.js';

// A context that records each path: its fill color and opacity, and its squares and circles.
function recorder() {
  const paths = [];
  let path = null;
  return {
    paths,
    ctx: {
      fillStyle: '', globalAlpha: 1,
      beginPath() { path = { squares: [], circles: [] }; },
      rect(x, y, w, h) { path.squares.push([x, y, w, h]); },
      moveTo() {},
      arc(x, y, r) { path.circles.push([x, y, r]); },
      fill() { paths.push({ color: this.fillStyle, alpha: this.globalAlpha, ...path }); },
    },
  };
}

test('paintDots: one path per ink and opacity (tenths); an unseen dot skipped; a small dot a square on the device\'s grid', () => {
  const { ctx, paths } = recorder();
  const x = [10, 20, 30, 40, 50.3];
  const y = [5, 5, 5, 5, 5.3];
  const r = [3, 3, 3, 3, 0.4];
  const a = [1, 0.96, 0.5, 0.01, 1];
  const codes = [PEN, PEN, REW, PEN, PEN];
  paintDots(ctx, { count: 5, x, y, r, a, code: (s) => codes[s], ink: (c) => `ink${c}`, dpr: 2 });
  assert.equal(paths.length, 2, 'the two full-ink cuts and the small one share a path; the bonus at half has its own');
  const [cuts, bonus] = paths;
  assert.deepEqual([cuts.color, cuts.alpha, cuts.circles.length, cuts.squares.length], [`ink${PEN}`, 1, 2, 1]);
  assert.deepEqual([bonus.color, bonus.alpha, bonus.circles], [`ink${REW}`, 0.5, [[30, 5, 3]]]);
  // The small dot: 1.6 device pixels across, a one-pixel square on the device's grid (half a CSS pixel at 2x).
  const [sx, sy, sw] = cuts.squares[0];
  assert.equal(sw, 0.5);
  assert.ok(Number.isInteger(sx * 2) && Number.isInteger(sy * 2), 'on the device\'s grid');
  assert.equal(ctx.globalAlpha, 1, 'the opacity is put back');
});

test('the ink codes: a value\'s by its sign, and each code\'s color', () => {
  assert.deepEqual([-1, 0, 2].map(signCode), [PEN, NEUTRAL, REW]);
  const colors = { pen: 'p', rew: 'r', ink2: 'i', neutral: 'n' };
  assert.deepEqual([PEN, REW, INK, NEUTRAL].map((c) => inkColor(colors, c)), ['p', 'r', 'i', 'n']);
});

test('readFonts reads the body and mono faces from the root\'s computed style, trimmed', () => {
  const root = {};
  globalThis.getComputedStyle = (el) => ({ getPropertyValue: (prop) => (el === root ? ` face${prop} ` : '') });
  try {
    assert.deepEqual(readFonts(root), { body: 'face--font-body', type: 'face--font-type' });
  } finally {
    delete globalThis.getComputedStyle;
  }
});

test('the curves run from 0 to 1, through the middle at half', () => {
  for (const f of [ease, smooth]) assert.deepEqual([f(0), f(0.5), f(1)], [0, 0.5, 1]);
  assert.deepEqual([outCubic(0), outCubic(1)], [0, 1]);
  assert.ok(outCubic(0.5) > 0.5, 'fast out');
});
