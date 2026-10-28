// The masthead's trip into the header (hub/client/story/dock.js): the pure path its two words take as the page scrolls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockPath } from '../client/story/dock.js';

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} is not ${b}`);
const ps = Array.from({ length: 101 }, (_, i) => i / 100);

// Invented geometry, about a 1440px desktop: the header's bottom at 104, its wordmark at 23px in the bar; the hero's
// words on one line at 142px, 34px under the header; the trip is 164px of scroll. The hero's words scroll with the page,
// so at p their tops are 164p higher.
const BIG = 142;
const SMALL = 23;
const TRIP = 164;
const line = (p) => ({
  big: BIG, small: SMALL, park: 112, stacked: false, compact: false,
  from: { m1: box(104, 138 - p * TRIP, 400, BIG), m2: box(540, 138 - p * TRIP, 690, BIG) },
  to: { w1: box(104, 21, 66, SMALL), w2: box(176, 21, 112, SMALL) },
});
// About a 390px phone: the hero's words stacked at 70px; the header's compact P&P box.
const PHONE_BIG = 70;
const phone = (p) => ({
  big: PHONE_BIG, small: 18, park: 100, stacked: true, compact: true,
  from: { m1: box(16, 112 - p * 142, 196, PHONE_BIG), m2: box(16, 176 - p * 142, 300, PHONE_BIG) },
  to: { mark: box(16, 9, 50, 33) },
});
// Stacked words with the full wordmark in the bar (the mockup's middle widths).
const stacked = (p) => ({ ...line(p), stacked: true, from: { m1: box(24, 138 - p * TRIP, 300, BIG), m2: box(24, 268 - p * TRIP, 520, BIG) } });

for (const [name, at] of [['one line', line], ['stacked', stacked], ['compact', phone]]) {
  test(`${name}: at p = 0 each word is where the hero sets it, at full size`, () => {
    const o = at(0);
    const d = dockPath(0, o);
    near(d.x1, o.from.m1.left, 'x1');
    near(d.y1, o.from.m1.top, 'y1');
    near(d.x2, o.from.m2.left, 'x2');
    near(d.y2, o.from.m2.top, 'y2');
    near(d.s, 1, 's');
    near(d.sx1, 1, 'sx1');
    near(d.sx2, 1, 'sx2');
    near(d.fade, 0, 'fade');
  });

  test(`${name}: the scale only shrinks and the words only rise as the page scrolls`, () => {
    let last = null;
    for (const p of ps) {
      const o = at(p);
      const d = dockPath(p, o);
      // Each word's middle, the height it draws at this scale.
      const mid1 = d.y1 + (o.big * d.s) / 2;
      const mid2 = d.y2 + (o.big * d.s) / 2;
      if (last) {
        assert.ok(d.s <= last.s + 1e-9, `the scale grows at p = ${p}`);
        assert.ok(mid1 <= last.mid1 + 1e-9, `the first word sinks at p = ${p}`);
        assert.ok(mid2 <= last.mid2 + 1e-9, `the second word sinks at p = ${p}`);
      }
      last = { s: d.s, mid1, mid2 };
    }
  });
}

test('one line: the line\'s middle only sweeps left', () => {
  let last = Infinity;
  for (const p of ps) {
    const o = line(p);
    const d = dockPath(p, o);
    const mid = (d.x1 + d.x2 + o.from.m2.width * d.sx2) / 2;
    assert.ok(mid <= last + 1e-9, `the line moves right at p = ${p}`);
    last = mid;
  }
});

for (const [name, at] of [['one line', line], ['stacked', stacked]]) {
  test(`${name}: at p = 1 the words sit on the header's wordmark, at its size and width`, () => {
    const o = at(1);
    const d = dockPath(1, o);
    near(d.x1, o.to.w1.left, 'x1');
    near(d.y1, o.to.w1.top, 'y1');
    near(d.x2, o.to.w2.left, 'x2');
    near(d.y2, o.to.w2.top, 'y2');
    near(d.s, SMALL / BIG, 's');
    near(o.from.m1.width * d.sx1, o.to.w1.width, 'the first word\'s width');
    near(o.from.m2.width * d.sx2, o.to.w2.width, 'the second word\'s width');
    near(d.fade, 0, 'fade');
  });
}

test('compact: the stacked words end small, inside the P&P mark, and hand over to it', () => {
  const o = phone(1);
  const d = dockPath(1, o);
  const { mark } = o.to;
  const h = PHONE_BIG * d.s;
  assert.ok(d.x1 > mark.left && d.x2 > mark.left && d.x1 < mark.right, 'the words start inside the mark');
  assert.ok(d.y1 > mark.top && d.y2 + h < mark.bottom, 'both lines inside the mark');
  assert.ok(d.y2 > d.y1, 'still stacked');
  near(d.fade, 1, 'fade');
  // The handover starts late in the trip and only grows.
  near(dockPath(0.5, phone(0.5)).fade, 0, 'fade at p = 0.5');
  let last = 0;
  for (const p of ps) {
    const { fade } = dockPath(p, phone(p));
    assert.ok(fade >= last, `the handover goes back at p = ${p}`);
    last = fade;
  }
});

test('compact with the hero on one line: the line stays one line, starts in the mark, centred in its height', () => {
  const o = { ...line(1), compact: true, to: { mark: box(16, 9, 50, 33) } };
  const d = dockPath(1, o);
  const { mark } = o.to;
  near(d.y1, d.y2, 'one line');
  assert.ok(d.x1 > mark.left && d.x1 < d.x2 && d.x2 < mark.right, 'both words start inside the mark, in order');
  near(d.y1 + (BIG * d.s) / 2, mark.top + mark.height / 2, 'centred');
  near(d.fade, 1, 'fade');
});

test('p outside 0 to 1 is held at the ends', () => {
  assert.deepEqual(dockPath(-0.5, line(0)), dockPath(0, line(0)));
  assert.deepEqual(dockPath(3, line(1)), dockPath(1, line(1)));
});
