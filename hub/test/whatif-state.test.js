// The hospital page's factor what-if, as pure state (hub/client/hospital/whatif-state.js): the ranges a reader may set,
// the actions, the scenario's dollars, and the URL fragment a shared link carries. Synthetic hospitals (99xxxx), plus
// one sweep over every estimated hospital of the data (by property, none named): the actual state reproduces its dollars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programDollars } from '../../engine/js/dollars/whatif.js';
import { loadHub } from '../data.js';
import { hubHospitals } from '../model.js';
import { BIG_STEP, STEP, changed, fromHash, initial, outcome, ranges, reduce, toHash } from '../client/hospital/whatif-state.js';

const BASE = 48_000_000;
const TOTAL = 70_000_000;
// A synthetic hospital whose dollars follow from its factors and cut, as the dollar file's would.
function make(ccn, { hrrpFactor = 1, vbpFactor = 1, cut = false, hrrpListed = true, vbpListed = true } = {}) {
  const row = { base: BASE, total: TOTAL, hrrpFactor: 1, vbpFactor: 1, cut: false, hrrp: 0, hvbp: 0, hac: 0, net: 0, after: TOTAL, atStake: TOTAL / 100 };
  const out = programDollars(row, { hrrpFactor, vbpFactor, cut });
  return { ccn, est: { ...row, hrrpFactor, vbpFactor, cut, ...out, hrrpListed, vbpListed, share: out.net / TOTAL } };
}

const VBP_MAX = 1.0452822242;
const H = make('990001', { hrrpFactor: 0.9988, vbpFactor: 1.0021821642 });
const peers = [
  H,
  make('990002', { hrrpFactor: 0.995, vbpFactor: 1.004, cut: true }),
  make('990003', { hrrpFactor: 0.99, vbpFactor: 0.999, cut: true }),
  make('990004', { hrrpFactor: 1, vbpFactor: 1, vbpListed: false }),
  make('990005', { hrrpFactor: 1, hrrpListed: false, vbpFactor: 1.01 }),
];
const ctx = { h: H, vbpMax: VBP_MAX, peers };

test('the ranges: HRRP to its cap, HVBP from the whole withhold to the highest factor; none for a program it is not in', () => {
  assert.deepEqual(ranges(H, { vbpMax: VBP_MAX }), { hrrp: [0.97, 1], hvbp: [0.98, 1.0452] });
  assert.deepEqual(ranges(make('990006', { hrrpListed: false, vbpListed: false }), { vbpMax: VBP_MAX }), { hrrp: null, hvbp: null });
});

test('the actual state reproduces every estimated hospital\'s dollars exactly, and is unchanged', () => {
  const all = hubHospitals(loadHub()).filter((h) => h.est);
  assert.ok(all.length > 1000);
  for (const h of all) {
    const { hrrp, hvbp, hac, net } = h.est;
    const out = outcome(initial(h), h);
    assert.deepEqual({ hrrp: out.hrrp, hvbp: out.hvbp, hac: out.hac, net: out.net }, { hrrp, hvbp, hac, net }, h.ccn);
    assert.equal(changed(initial(h), h), false);
  }
  assert.deepEqual(initial(H), { hrrp: 0.9988, hvbp: 1.0021821642, hac: false });
});

test('set clamps to the range, keeps four decimals, and refuses a program the hospital is not in', () => {
  const s0 = initial(H);
  assert.equal(reduce(s0, { type: 'set', id: 'hrrp', value: 0.5 }, ctx).hrrp, 0.97);
  assert.equal(reduce(s0, { type: 'set', id: 'hrrp', value: 1.2 }, ctx).hrrp, 1);
  assert.equal(reduce(s0, { type: 'set', id: 'hrrp', value: 0.99123 }, ctx).hrrp, 0.9912);
  assert.equal(reduce(s0, { type: 'set', id: 'hvbp', value: 2 }, ctx).hvbp, 1.0452);
  assert.equal(reduce(s0, { type: 'set', id: 'hrrp', value: Number.NaN }, ctx), s0);
  const out = make('990007', { hrrpListed: false, vbpListed: false });
  const so = initial(out);
  const octx = { ...ctx, h: out };
  assert.equal(reduce(so, { type: 'set', id: 'hrrp', value: 0.98 }, octx), so);
  assert.equal(reduce(so, { type: 'step', id: 'hvbp', dir: 1 }, octx), so);
  assert.equal(reduce(so, { type: 'median', id: 'hvbp' }, octx), so);
});

test('a value that reads as the actual factor is the actual factor: unchanged', () => {
  const s0 = initial(H);
  const back = reduce(s0, { type: 'set', id: 'hvbp', value: 1.0022 }, ctx);
  assert.equal(back, s0, 'the same state');
  assert.equal(changed(back, H), false);
  const there = reduce(reduce(s0, { type: 'step', id: 'hrrp', dir: -1 }, ctx), { type: 'step', id: 'hrrp', dir: 1 }, ctx);
  assert.equal(there.hrrp, 0.9988);
  assert.equal(changed(there, H), false);
});

test('the highest factor in the data, past the range\'s four-decimal end: typed as shown, it stays the actual', () => {
  const top = make('990011', { vbpFactor: VBP_MAX });
  const s0 = initial(top);
  const tctx = { ...ctx, h: top };
  assert.equal(reduce(s0, { type: 'set', id: 'hvbp', value: 1.0453 }, tctx), s0);
  assert.equal(reduce(s0, { type: 'step', id: 'hvbp', dir: 1 }, tctx), s0, 'no step up past it');
  assert.equal(reduce(s0, { type: 'set', id: 'hvbp', value: 1.05 }, tctx).hvbp, 1.0452, 'past it clamps to the range');
});

test('step: a small step, a bigger one with Shift, clamped at the range\'s ends', () => {
  const s0 = initial(H);
  assert.equal(STEP, 0.0005);
  assert.equal(BIG_STEP, 0.005);
  assert.equal(reduce(s0, { type: 'step', id: 'hrrp', dir: -1 }, ctx).hrrp, 0.9983);
  assert.equal(reduce(s0, { type: 'step', id: 'hrrp', dir: 1, big: true }, ctx).hrrp, 1);
  assert.equal(reduce(s0, { type: 'step', id: 'hrrp', dir: -1, big: true }, ctx).hrrp, 0.9938);
  assert.equal(reduce(s0, { type: 'step', id: 'hvbp', dir: 1 }, ctx).hvbp, 1.0027);
  const top = reduce(s0, { type: 'set', id: 'hrrp', value: 1 }, ctx);
  assert.equal(reduce(top, { type: 'step', id: 'hrrp', dir: 1 }, ctx), top, 'nothing past the end');
});

test('median: HRRP and HVBP among the peers the program lists; HAC by whether most peers are cut', () => {
  const s0 = initial(H);
  // HVBP among listed peers: 1.0021821642, 1.004, 0.999, 1.01 (990004 is not listed) -> mean of the middle two.
  assert.equal(reduce(s0, { type: 'median', id: 'hvbp' }, ctx).hvbp, Math.round(((1.0021821642 + 1.004) / 2) * 1e4) / 1e4);
  // HRRP among listed peers: 0.9988, 0.995, 0.99, 1 (990005 is not listed).
  assert.equal(reduce(s0, { type: 'median', id: 'hrrp' }, ctx).hrrp, Math.round(((0.9988 + 0.995) / 2) * 1e4) / 1e4);
  // Two of five cut: most are not.
  assert.equal(reduce(s0, { type: 'median', id: 'hac' }, ctx), s0);
  const cutPeers = [...peers, make('990008', { cut: true }), make('990009', { cut: true })];
  assert.equal(reduce(s0, { type: 'median', id: 'hac' }, { ...ctx, peers: cutPeers }).hac, true);
  const all = reduce(s0, { type: 'medianAll' }, { ...ctx, peers: cutPeers });
  assert.equal(all.hac, true);
  assert.notEqual(all.hrrp, s0.hrrp);
  assert.notEqual(all.hvbp, s0.hvbp);
});

test('hac and reset: the toggle, then back to the actual state', () => {
  const s0 = initial(H);
  const cut = reduce(s0, { type: 'hac', cut: true }, ctx);
  assert.equal(cut.hac, true);
  assert.equal(changed(cut, H), true);
  assert.equal(outcome(cut, H).hac, -outcome(s0, H).atStake);
  assert.equal(reduce(s0, { type: 'hac', cut: 'yes' }, ctx), s0);
  const moved = reduce(cut, { type: 'step', id: 'hrrp', dir: -1 }, ctx);
  assert.deepEqual(reduce(moved, { type: 'reset' }, ctx), initial(H));
  assert.equal(reduce(s0, { type: 'reset' }, ctx), s0);
  assert.equal(reduce(s0, { type: 'nonsense' }, ctx), s0);
});

test('toHash writes only the changed values, in the page\'s order; fromHash reads them back', () => {
  const s0 = initial(H);
  assert.equal(toHash(s0, H), '');
  let s = reduce(s0, { type: 'set', id: 'hvbp', value: 1.0022 + 0.0005 }, ctx);
  s = reduce(s, { type: 'hac', cut: true }, ctx);
  s = reduce(s, { type: 'set', id: 'hrrp', value: 0.9978 }, ctx);
  const hash = toHash(s, H);
  assert.equal(hash, '#whatif&hrrp=0.9978&hac=1&hvbp=1.0027');
  assert.deepEqual(fromHash(hash, H, ctx), { state: s, rejected: [] });
  assert.deepEqual(fromHash('', H, ctx), { state: s0, rejected: [] });
  assert.deepEqual(fromHash('#whatif', H, ctx), { state: s0, rejected: [] });
});

test('a shared link with junk: every bad part is dropped, the first valid value per id loads', () => {
  const { state, rejected } = fromHash('#whatif&hrrp=2&hrrp=0.99&hvbp=abc&hac=7', H, ctx);
  assert.deepEqual(state, { ...initial(H), hrrp: 0.99 });
  assert.deepEqual([...rejected].sort(), ['hac', 'hrrp', 'hvbp']);
  assert.equal(changed(state, H), true);
  // Junk only: nothing changes.
  for (const junk of ['#whatif&hvbp=abc&hac=7', '#whatif&hrrp=-1&hrrp=1e3&x=1', '#whatif&hac=0.4&hac=1.0', '#whatif&hrrp=0x1', '#whatif&<img src=x>']) {
    const r = fromHash(junk, H, ctx);
    assert.deepEqual(r.state, initial(H), junk);
    assert.equal(changed(r.state, H), false, junk);
    assert.ok(r.rejected.length > 0, junk);
  }
  // A value for a program the hospital is not in.
  const out = make('990010', { vbpListed: false });
  const r = fromHash('#whatif&hvbp=1.01&hrrp=0.995', out, { vbpMax: VBP_MAX, peers });
  assert.deepEqual(r.state, { ...initial(out), hrrp: 0.995 });
  assert.deepEqual(r.rejected, ['hvbp']);
  // The actual values, written out: a valid scenario that changes nothing.
  assert.equal(changed(fromHash('#whatif&hrrp=0.9988&hac=0', H, ctx).state, H), false);
});

test('load: what is valid loads; nothing valid returns the same state', () => {
  const s0 = initial(H);
  assert.equal(reduce(s0, { type: 'load', changes: { hrrp: 3, hac: 7 } }, ctx), s0);
  assert.equal(reduce(s0, { type: 'load', changes: {} }, ctx), s0);
  assert.equal(reduce(s0, { type: 'load', changes: { hrrp: 0.98, hac: 1 } }, ctx).hac, true);
});
