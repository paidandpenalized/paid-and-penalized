// The share axis the hub's dot charts share (hub/client/scale.js): the domain every hospital's percents fit in, and the
// split scale that keeps exactly $0 in a gutter of its own. Synthetic hospitals, plus one check on the real data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHub } from '../data.js';
import { hubHospitals } from '../model.js';
import { shareDomain, shareScale, wholePercents } from '../client/scale.js';

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
