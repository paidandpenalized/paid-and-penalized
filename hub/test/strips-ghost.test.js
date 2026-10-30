// Where the "actual" label stands by the hospital's ring once a row is hypothetical (hub/client/hospital/strips.js
// ghostSpot), on invented boxes: over the ring, unless that would meet what marks the what-if (the net's "What if" mark
// and its label, or a handle's capsule); then beside the ring on the side away from the mark, then under it; always inside
// the strip and above its axis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostSpot, labelBox } from '../client/hospital/strips.js';

const W = 600;
const f = { top: 8, bot: 98, base: 104, H: 134 };
const half = 20;
const ring = { x: 300, y: 53, r: 6 };
// The net's "What if" mark at x on the plot's middle line: its ring and its label over it.
const mark = (x, y = 53, labelHalf = 22) => [
  { left: x - 10, right: x + 10, top: y - 10, bottom: y + 10 },
  { left: x - labelHalf, right: x + labelHalf, top: y - 25, bottom: y - 11 },
];
const meets = (a, b) => a.left < b.right + 2 && a.right > b.left - 2 && a.top < b.bottom + 2 && a.bottom > b.top - 2;
const clear = (spot, avoid) => !avoid.some((b) => meets(labelBox(spot, half), b));

test('ghostSpot: over the ring when nothing marks the what-if near it', () => {
  const spot = ghostSpot({ ring, half, avoid: mark(450), W, f, markX: 450 });
  assert.deepEqual(spot, { x: 300, y: 53 - 6 - 8, anchor: 'middle' });
});

test('ghostSpot: a "What if" mark close by: beside the ring, away from the mark, clear of it', () => {
  for (const dx of [-30, -12, 0, 12, 30]) {
    const avoid = mark(300 + dx);
    const spot = ghostSpot({ ring, half, avoid, W, f, markX: 300 + dx });
    assert.ok(clear(spot, avoid), `mark ${dx} px off: ${JSON.stringify(spot)}`);
    const box = labelBox(spot, half);
    assert.ok(box.left >= 0 && box.right <= W && box.top >= 0 && box.bottom <= f.base, `inside the strip: ${JSON.stringify(box)}`);
  }
  // A mark to the right sends the label to the left of the ring, and the other way round.
  assert.equal(ghostSpot({ ring, half, avoid: mark(312), W, f, markX: 312 }).anchor, 'end');
  assert.equal(ghostSpot({ ring, half, avoid: mark(288), W, f, markX: 288 }).anchor, 'start');
});

test('ghostSpot: at the strip\'s side the label turns to the room there is, or goes under the ring; never off the strip', () => {
  const edge = { x: 12, y: 53, r: 6 };
  const avoid = mark(30);
  const spot = ghostSpot({ ring: edge, half, avoid, W, f, markX: 30 });
  const box = labelBox(spot, half);
  assert.ok(clear(spot, avoid) && box.left >= 0, JSON.stringify(spot));
  // A handle's capsule (wider than a mark) over the ring and both sides: under the ring.
  const capsule = [{ left: 300 - 31, right: 300 + 31, top: 53 - 17, bottom: 53 + 17 }];
  const under = ghostSpot({ ring, half, avoid: capsule, W, f, markX: 300 });
  assert.ok(clear(under, capsule), JSON.stringify(under));
  assert.ok(labelBox(under, half).bottom <= f.base, 'above the axis');
});

test('ghostSpot: with nowhere clear, over the ring as before', () => {
  const all = [{ left: 0, right: W, top: 0, bottom: f.H }];
  assert.deepEqual(ghostSpot({ ring, half, avoid: all, W, f, markX: 300 }), { x: 300, y: 39, anchor: 'middle' });
});
