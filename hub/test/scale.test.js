// The share axis the hub's dot charts share (hub/client/scale.js): the domain every hospital's percents fit in, the split
// scale that keeps exactly $0 in a gutter of its own, an axis part way through a move, and which axis a hospital page's
// strips draw as the reader opens and resets the what-if. Synthetic hospitals, plus one check on the real data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHub } from '../data.js';
import { hubHospitals } from '../model.js';
import { mixScale, shareDomain, shareScale, stripAxis, ticksBetween, whatIfAxis, wholePercents } from '../client/scale.js';

// An invented estimated hospital with these percents of its pay (and one with no estimate, which the domain skips).
const est = (hrrp, hac, hvbp) => ({ est: { pct: { hrrp, hac, hvbp, net: hrrp + hac + hvbp } } });

test('shareDomain: the lowest and highest percent of any program or the net, padded a tenth of a point, to the tenth outside', () => {
  assert.deepEqual(shareDomain([est(-2.78, -1, 0.5), est(0, 0, 3.09), { est: null }]), [-3.4, 3.2]);
  // A value already on a tenth still gains its padding (floating error does not push it a tenth further).
  assert.deepEqual(shareDomain([est(-3.8, 0, 0), est(0, 0, 1.9)]), [-3.9, 2]);
  // The domain always holds $0, even when every hospital is on one side.
  assert.deepEqual(shareDomain([est(-1, 0, 0)]), [-1.1, 0.1]);
  assert.deepEqual(shareDomain([est(0, 0, 0.42)]), [-0.1, 0.6]);
});

test('shareDomain holds extra values too (a hospital page\'s what-if figures), padded and rounded the same way', () => {
  assert.deepEqual(shareDomain([est(-1, 0, 0.5)], [-4.95, 2.01]), [-5.1, 2.2]);
  // Extra values inside the hospitals' own span change nothing.
  assert.deepEqual(shareDomain([est(-2.78, -1, 0.5), est(0, 0, 3.09)], [-1, 1]), [-3.4, 3.2]);
  assert.deepEqual(shareDomain([est(0, 0, 0.42)], []), [-0.1, 0.6]);
});

test('shareDomain on the real data holds every program\'s percent and the net of every estimated hospital', () => {
  const hospitals = hubHospitals(loadHub()).filter((h) => h.est);
  const [lo, hi] = shareDomain(hospitals);
  for (const { est: { pct } } of hospitals) for (const v of Object.values(pct)) assert.ok(v >= lo && v <= hi, `${v} in [${lo}, ${hi}]`);
  assert.ok(lo < 0 && hi > 0);
  assert.equal(Math.round(lo * 10), lo * 10);
  assert.equal(Math.round(hi * 10), hi * 10);
});

test('shareScale: $0 sits mid-gutter, cuts left of it and bonuses right, linear on each side with one slope, never in the gutter', () => {
  const s = shareScale({ x0: 40, x1: 640, gutter: 24, domain: [-4, 2] });
  assert.equal(s.k, (640 - 40 - 24) / 6);
  assert.equal(s.zL, 40 + 4 * s.k);
  assert.equal(s.zR, s.zL + 24);
  assert.equal(s.zM, s.zL + 12);
  assert.equal(s.xs(0), s.zM);
  assert.equal(s.xs(-4), 40);
  assert.equal(s.xs(2), 640);
  assert.equal(s.xs(-1), s.zL - s.k);
  assert.equal(s.xs(1), s.zR + s.k);
  // The tiniest cut and bonus stay out of the gutter, on their own sides.
  assert.ok(s.xs(-1e-9) <= s.zL && s.xs(-1e-9) > s.zL - 1e-6);
  assert.ok(s.xs(1e-9) >= s.zR && s.xs(1e-9) < s.zR + 1e-6);
  // Beyond the domain clamps to its ends.
  assert.equal(s.xs(-9), 40);
  assert.equal(s.xs(9), 640);
  // The inverse: each value back from its pixel, $0 anywhere in the gutter, the domain's ends past the plot.
  for (const v of [-4, -1, -0.25, 0.5, 2]) assert.ok(Math.abs(s.invert(s.xs(v)) - v) < 1e-9, `${v}`);
  for (const x of [s.zL, s.zM, s.zR]) assert.equal(s.invert(x), 0);
  assert.deepEqual([s.invert(0), s.invert(700)], [-4, 2]);
});

test('whatIfAxis: a chart keeps its own axis until a hypothetical lies past it, then the wide one until the what-if ends', () => {
  const actual = [-3.9, 3.2];
  const wide = [-5.8, 4.4];
  const at = (pct, now) => whatIfAxis(pct, { actual, wide, now });
  assert.equal(at(null, actual), actual, 'no what-if');
  assert.equal(at(-2, actual), actual, 'a value on its own axis');
  assert.equal(at(-3.9, actual), actual, 'its end is on it');
  assert.equal(at(-4.5, actual), wide, 'past its cut end');
  assert.equal(at(4, actual), wide, 'past its bonus end');
  assert.equal(at(-2, wide), wide, 'back on the own axis mid-what-if: still wide, no back and forth');
  assert.equal(at(null, wide), actual, 'the what-if ends: its own again');
});

test('wholePercents: the whole percents in the domain, in order', () => {
  assert.deepEqual(wholePercents([-3.4, 3.2]), [-3, -2, -1, 0, 1, 2, 3]);
  assert.deepEqual(wholePercents([-1, 0.6]), [-1, 0]);
  assert.deepEqual(wholePercents([0.2, 0.8]), []);
});

test('shareScale with a device pixel: the gutter\'s edges land on whole device pixels, the slope unchanged', () => {
  for (const px of [1, 1 / 2, 1 / 3]) {
    const s = shareScale({ x0: 12.3, x1: 377.7, gutter: 12, domain: [-3.9, 3.2], px });
    assert.ok(Math.abs(s.zL / px - Math.round(s.zL / px)) < 1e-6, `zL ${s.zL} at ${px}`);
    assert.ok(Math.abs(s.zR / px - Math.round(s.zR / px)) < 1e-6, `zR ${s.zR} at ${px}`);
    assert.equal(s.k, (377.7 - 12.3 - 12) / 7.1);
    assert.ok(s.xs(-3.9) >= 12.3 - px && s.xs(3.2) <= 377.7 + px);
  }
});

test('shareScale states its domain, and line() continues its line past the ends (where a tick that comes or goes stands)', () => {
  const s = shareScale({ x0: 40, x1: 640, gutter: 24, domain: [-4, 2] });
  assert.deepEqual([s.lo, s.hi], [-4, 2]);
  for (const v of [-4, -1.5, 0, 0.5, 2]) assert.equal(s.line(v), s.xs(v), `${v} inside`);
  assert.equal(s.line(-5), s.zL - 5 * s.k, 'past the cut end: on the line, not clamped');
  assert.equal(s.line(3), s.zR + 3 * s.k, 'past the bonus end');
  assert.ok(s.line(-5) < s.xs(-5) && s.line(3) > s.xs(3));
});

test('mixScale: an axis part way between two, each place on a straight line from one to the other, as a dot moves', () => {
  const a = shareScale({ x0: 6, x1: 606, gutter: 20, domain: [-3.9, 3.2] });
  const b = shareScale({ x0: 6, x1: 606, gutter: 26, domain: [-5.7, 4.3] });
  for (const q of [0, 0.25, 0.5, 1]) {
    const m = mixScale(a, b, q);
    for (const v of [-3.9, -2, -0.01, 0, 0.3, 3.2]) {
      // A dot placed at v on each axis, moved q of the way, stands where the part-way axis puts v.
      const dot = a.xs(v) + (b.xs(v) - a.xs(v)) * q;
      assert.ok(Math.abs(m.xs(v) - dot) < 1e-9, `${v} at ${q}`);
    }
    assert.ok(Math.abs(m.zL - (a.zL + (b.zL - a.zL) * q)) < 1e-9 && Math.abs(m.zR - (a.zR + (b.zR - a.zR) * q)) < 1e-9, 'the gutter too');
    assert.ok(Math.abs(m.lo - (a.lo + (b.lo - a.lo) * q)) < 1e-9 && Math.abs(m.hi - (a.hi + (b.hi - a.hi) * q)) < 1e-9);
  }
  // A value past the narrow axis (a hypothetical net) starts pinned at its end and glides to its place.
  assert.equal(mixScale(a, b, 0).xs(-5), a.xs(-3.9));
  assert.equal(mixScale(a, b, 1).xs(-5), b.xs(-5));
  // Part way between part-way axes (a move that starts again mid-move) is still a scale.
  const again = mixScale(mixScale(a, b, 0.4), a, 0.5);
  assert.ok(Math.abs(again.xs(-2) - ((a.xs(-2) + (b.xs(-2) - a.xs(-2)) * 0.4) * 0.5 + a.xs(-2) * 0.5)) < 1e-9);
});

test('ticksBetween: the ticks of an axis part way between two; those both show move on a line, the rest fade', () => {
  const a = shareScale({ x0: 6, x1: 606, gutter: 20, domain: [-3.9, 3.2] });
  const b = shareScale({ x0: 6, x1: 606, gutter: 20, domain: [-5.7, 4.3] });
  const at = (q) => ticksBetween(a, b, q);
  // At rest, each end's own ticks, opaque, where its scale puts them.
  assert.deepEqual(at(0).map((t) => [t.v, t.x, t.alpha]), wholePercents([-3.9, 3.2]).map((v) => [v, a.xs(v), 1]));
  assert.deepEqual(at(1).map((t) => [t.v, t.x, t.alpha]), wholePercents([-5.7, 4.3]).map((v) => [v, b.xs(v), 1]));
  assert.deepEqual(ticksBetween(a, a, 1).map((t) => t.v), wholePercents([-3.9, 3.2]), 'no move: the axis\'s own ticks');
  const mid = at(0.5);
  for (const t of mid) {
    assert.ok(Math.abs(t.x - (a.line(t.v) + b.line(t.v)) / 2) < 1e-9, `${t.v} half way`);
    // -5, -4 and +4 are the wide axis's alone: they come in from where the narrow axis's line would put them, half seen.
    assert.equal(t.alpha, [-5, -4, 4].includes(t.v) ? 0.5 : 1, `${t.v} opacity`);
  }
  assert.deepEqual(mid.map((t) => t.v), [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]);
  // Going back, the wide axis's own ticks fade out the same way.
  assert.ok(ticksBetween(b, a, 0.75).filter((t) => t.v === -5).every((t) => t.alpha === 0.25));
  // Their order never changes on the way, so no two labels cross.
  for (const q of [0, 0.1, 0.5, 0.9, 1]) {
    const xs = at(q).map((t) => t.x);
    assert.deepEqual(xs, [...xs].sort((p, r) => p - r), `in order at ${q}`);
  }
});

test('stripAxis: the strips stay tight until the what-if opens, widen once, and are tight again after a reset; never in a drag', () => {
  const run = (events, s = { open: false, held: 0, wide: false }) => events.map((e) => (s = stripAxis(s, e)).wide);
  assert.deepEqual(run([]), [], 'at rest: nothing asked');
  assert.equal(stripAxis({ open: false, held: 0, wide: false }, 'release').wide, false, 'tight before the what-if opens');
  assert.deepEqual(run(['open']), [true], 'wide once it opens (the button, a link to it, a control\'s focus or input)');
  assert.deepEqual(run(['open', 'open', 'open']), [true, true, true], 'more input while open changes nothing');
  assert.deepEqual(run(['open', 'reset']), [true, false], 'tight again after a reset');
  assert.deepEqual(run(['open', 'reset', 'open']), [true, false, true], 'and wide when the reader opens it again');
  // A drag begun on the tight axis keeps it while held (the handle's focus and the drag's input open the what-if), and
  // the strips widen once it ends.
  assert.deepEqual(run(['press', 'open', 'open', 'release']), [false, false, false, true], 'a first drag: tight until released');
  // A reset (Escape) during a drag waits for its end too.
  assert.deepEqual(run(['open', 'press', 'reset', 'open', 'reset', 'release']), [true, true, true, true, true, false]);
  assert.deepEqual(run(['open', 'press', 'release']), [true, true, true], 'a drag on the wide axis keeps it');
  // Two pointers on two handles: one letting go leaves the other's axis alone; the change waits for the last.
  assert.deepEqual(run(['press', 'press', 'open', 'release', 'release']), [false, false, false, false, true]);
  assert.deepEqual(run(['open', 'press', 'press', 'reset', 'release', 'release']), [true, true, true, true, true, false]);
  assert.deepEqual(run(['release', 'release', 'press', 'open', 'release']), [false, false, false, false, true], 'a stray release counts nothing');
  const s = stripAxis({ open: false, held: 0, wide: false }, 'open');
  assert.deepEqual(s, { open: true, held: 0, wide: true });
  assert.deepEqual(stripAxis(s, 'unknown'), s, 'anything else changes nothing');
});
