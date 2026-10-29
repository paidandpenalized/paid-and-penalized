// Where the what-if's "drag me" hint stands on its strip (hub/client/hospital/strips.js hintSpot), on invented dots: clear
// of the dots where a spot by the handle is, never on the handle's capsule, and inside the strip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintSpot } from '../client/hospital/strips.js';

const W = 600;
const f = { H: 186, top: 8, bot: 158, base: 164 };
const half = 34;
const s = 4;
// The handle: its middle, its capsule's half width and half height (strips.js HANDLE_R + HANDLE_REACH, HANDLE_R).
const HANDLE = { x: 300, y: 90 };
const CAPSULE = { w: 26, h: 12 };
// The hint's box at a spot (its middle and baseline): 14 px over the baseline and 4 under.
const boxOf = (at) => ({ left: at.x - half, right: at.x + half, top: at.y - 14, bottom: at.y + 4 });
const covered = (at, dots) => dots.filter((p) => Math.abs(p.x - at.x) < half + s / 2 && p.y + s / 2 > at.y - 14 && p.y - s / 2 < at.y + 4).length;
const column = (x, y0, y1) => Array.from({ length: Math.floor((y1 - y0) / s) + 1 }, (_, i) => ({ x, y: y0 + i * s }));
const row = (y, x0, x1) => Array.from({ length: Math.floor((x1 - x0) / s) + 1 }, (_, i) => ({ x: x0 + i * s, y }));
const place = (dots, at = HANDLE) => hintSpot({ ...at, half, W, f, dots, s });

function assertInside(at, what) {
  const b = boxOf(at);
  assert.ok(b.left >= 0 && b.right <= W, `${what}: inside the strip across`);
  assert.ok(b.top >= 0 && b.bottom <= f.base, `${what}: between the strip's top and its axis`);
  const onCapsule = b.left < HANDLE.x + CAPSULE.w && b.right > HANDLE.x - CAPSULE.w && b.top < HANDLE.y + CAPSULE.h && b.bottom > HANDLE.y - CAPSULE.h;
  assert.ok(!onCapsule, `${what}: never on the capsule`);
}

test('with nothing over the handle, the hint stands just over it', () => {
  const dots = row(HANDLE.y, 200, 400);
  const at = place(dots);
  assert.deepEqual([at.x, at.y], [HANDLE.x, HANDLE.y - 21]);
  assert.equal(covered(at, dots), 0);
});

test('a pile over the handle: the hint stands beside it, level with it, left first', () => {
  const dots = [...column(HANDLE.x, 50, HANDLE.y), ...column(HANDLE.x + 4, 54, HANDLE.y)];
  const at = place(dots);
  assert.ok(at.x < HANDLE.x - CAPSULE.w, 'left of the handle');
  assert.equal(at.y, HANDLE.y + 4, 'level with it');
  assert.equal(covered(at, dots), 0);
  assertInside(at, 'beside the handle');
});

test('a row of dots through the handle: the hint steps up or down beside it, on the clearer side', () => {
  const dots = [...column(HANDLE.x, f.top + 2, f.bot), ...row(HANDLE.y, HANDLE.x - 140, HANDLE.x + 140), ...row(HANDLE.y + 4, HANDLE.x + 30, HANDLE.x + 140), ...row(HANDLE.y - 4, HANDLE.x + 30, HANDLE.x + 140)];
  const at = place(dots);
  assert.ok(at.x < HANDLE.x - CAPSULE.w, 'left: the right side is a block of dots');
  assert.notEqual(at.y, HANDLE.y + 4, 'off the row through the handle');
  assert.equal(covered(at, dots), 0);
  assertInside(at, 'beside the handle');
});

test('dots on both sides of the handle and under it, a clear sky over the pile: the hint stands over the pile', () => {
  const block = (x0, x1, y0, y1) => column(0, y0, y1).flatMap((p) => row(p.y, x0, x1));
  const dots = [...column(HANDLE.x, 60, HANDLE.y + 40), ...block(HANDLE.x - 160, HANDLE.x - 20, 60, f.bot), ...block(HANDLE.x + 20, HANDLE.x + 160, 60, f.bot), ...block(HANDLE.x - 20, HANDLE.x + 20, HANDLE.y + 14, f.bot)];
  const at = place(dots);
  assert.equal(at.x, HANDLE.x, 'over the handle');
  assert.ok(at.y < 60 - s / 2 - 4, 'over the pile');
  assert.equal(covered(at, dots), 0);
  assertInside(at, 'over the pile');
});

test('dots everywhere: the spot that covers the fewest, inside the strip and off the capsule, wherever the handle is', () => {
  const dots = [];
  for (let x = 4; x < W; x += 6) for (let y = f.top + 2; y < f.bot; y += 6) if ((x * 7 + y * 13) % 5) dots.push({ x, y });
  for (const at of [HANDLE, { x: 20, y: 30 }, { x: W - 10, y: f.bot - 10 }]) {
    const spot = hintSpot({ ...at, half, W, f, dots, s });
    const b = boxOf(spot);
    assert.ok(b.left >= 0 && b.right <= W && b.top >= 0, `a handle at ${at.x}, ${at.y}: the hint inside the strip`);
  }
});
