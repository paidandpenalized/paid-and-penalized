// The hospital page's factor what-if, as pure state (hub/client/hospital/whatif-state.js): the ranges a reader may set,
// the actions, the scenario's dollars, and the URL fragment a shared link carries. Synthetic hospitals (99xxxx), plus
// one sweep over every estimated hospital of the data (by property, none named): the actual state reproduces its dollars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHub } from '../data.js';
import { hubHospitals } from '../model.js';
import { BIG_STEP, STEP, changed, dragAction, extent, factorAt, fromHash, initial, outcome, ranges, reduce, toHash, vbpMaxOf } from '../client/hospital/whatif-state.js';
import { storyFacts, vbpMaxOf as modelVbpMax } from '../model.js';
import { holdingAxis, shareDomain } from '../client/scale.js';
import { BASE, TOTAL, makeHospital as make, whatIfCorners } from './helpers.js';


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
  // Its own factor is the top: a value past it (a drag to the strip's end, a typed 1.05) is its own factor, never the
  // range's end below it (a hypothetical cut).
  assert.equal(reduce(s0, { type: 'set', id: 'hvbp', value: 1.05 }, tctx), s0, 'past it is its own factor');
  const below = reduce(s0, { type: 'set', id: 'hvbp', value: 1.0452 }, tctx);
  assert.equal(below.hvbp, 1.0452, 'the range\'s end below it is a value of its own');
  assert.equal(reduce(below, { type: 'set', id: 'hvbp', value: 1.05 }, tctx).hvbp, VBP_MAX, 'and from there, past it is its own factor again');
  assert.equal(reduce(below, { type: 'step', id: 'hvbp', dir: 1 }, tctx).hvbp, VBP_MAX, 'a step up reaches it');
  assert.equal(reduce(below, { type: 'median', id: 'hvbp' }, { ...tctx, peers: [top] }).hvbp, VBP_MAX, 'a group\'s median at it is it');
});

test('Home and End go to the ends the slider states (extent), never the wrong way, even from the highest factor in the data', () => {
  // The highest factor, past the range's four-decimal end: its own factor is the top the slider states.
  const TOP = 1.00345678;
  const top = make('990012', { vbpFactor: TOP });
  const tctx = { h: top, vbpMax: TOP, peers: [top] };
  assert.deepEqual(ranges(top, tctx).hvbp, [0.98, 1.0034]);
  assert.deepEqual(extent(top, tctx, 'hvbp'), [0.98, TOP]);
  const s0 = initial(top);
  assert.equal(reduce(s0, { type: 'end', id: 'hvbp', dir: 1 }, tctx), s0, 'End at its own factor stays: no hypothetical cut');
  const low = reduce(s0, { type: 'end', id: 'hvbp', dir: -1 }, tctx);
  assert.equal(low.hvbp, 0.98, 'Home: the whole withhold kept');
  assert.equal(reduce(low, { type: 'end', id: 'hvbp', dir: -1 }, tctx), low, 'Home at the bottom stays');
  const back = reduce(low, { type: 'end', id: 'hvbp', dir: 1 }, tctx);
  assert.equal(back.hvbp, TOP, 'End: back to its own factor, not the range\'s end below it');
  assert.equal(changed(back, top), false);
  // A factor inside its range: the range's ends.
  const s1 = initial(H);
  assert.deepEqual(extent(H, ctx, 'hrrp'), [0.97, 1]);
  assert.equal(reduce(s1, { type: 'end', id: 'hrrp', dir: -1 }, ctx).hrrp, 0.97);
  assert.equal(reduce(s1, { type: 'end', id: 'hrrp', dir: 1 }, ctx).hrrp, 1);
  assert.equal(reduce(s1, { type: 'end', id: 'hvbp', dir: 1 }, ctx).hvbp, 1.0452);
  // Nothing for the cut, no direction, or a program the hospital is not in.
  const out = make('990013', { vbpListed: false });
  assert.equal(extent(out, ctx, 'hvbp'), null);
  assert.equal(extent(H, ctx, 'hac'), null);
  const so = initial(out);
  assert.equal(reduce(so, { type: 'end', id: 'hvbp', dir: 1 }, { ...ctx, h: out }), so);
  assert.equal(reduce(s1, { type: 'end', id: 'hac', dir: 1 }, ctx), s1);
  assert.equal(reduce(s1, { type: 'end', id: 'hrrp', dir: 0 }, ctx), s1);
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

test('vbpMaxOf: the highest factor among the hospitals the program lists, the model\'s rule; ranges and factorAt follow it', () => {
  assert.equal(vbpMaxOf([H, ...peers, { est: null }]), 1.01, 'the highest factor among the hospitals the program lists');
  // One rule for the highest factor, the story's facts' and the what-if's, with one empty case: none listed is null.
  assert.equal(vbpMaxOf, modelVbpMax, 'the what-if reads the model\'s rule');
  assert.equal(vbpMaxOf([make('990015', { vbpListed: false }), { est: null }]), null, 'no hospital in the program: no highest factor');
  assert.equal(storyFacts([H, ...peers]).vbpMax, vbpMaxOf([H, ...peers]));
  assert.deepEqual(ranges(H, { vbpMax: vbpMaxOf([]) }).hvbp, null, 'with no highest factor, nothing to adjust');
  assert.equal(factorAt(H, (BASE * -0.03 * 100) / TOTAL), 0.97, 'the factor at a share: the inverse of base x (factor - 1)');
});

test('dragAction: the factor at the share under the pointer; past either end of the strip, that end of the range, as Home or End', () => {
  const hctx = { h: H, vbpMax: VBP_MAX };
  assert.deepEqual(dragAction(H, 'hrrp', { share: (BASE * -0.02 * 100) / TOTAL, past: 0 }), { type: 'set', id: 'hrrp', value: factorAt(H, (BASE * -0.02 * 100) / TOTAL) });
  assert.deepEqual(dragAction(H, 'hvbp', { share: 1, past: 1 }), { type: 'end', id: 'hvbp', dir: 1 });
  assert.deepEqual(dragAction(H, 'hrrp', { share: -1, past: -1 }), { type: 'end', id: 'hrrp', dir: -1 });
  // Past the end reaches the range's end whatever the axis drawn: the same as End, beyond any share the strip shows.
  const end = reduce(initial(H), dragAction(H, 'hvbp', { share: 0.5, past: 1 }), hctx);
  assert.equal(end.hvbp, reduce(initial(H), { type: 'end', id: 'hvbp', dir: 1 }, hctx).hvbp);
  assert.equal(end.hvbp, extent(H, hctx, 'hvbp')[1]);
});

// The strips start on the data's own axis and widen only to hold a hypothetical figure (scale.js holdingAxis); a drag
// past a strip's end reaches its factor's end (dragAction), so no figure the what-if can show is out of reach or past the
// axis drawn for it.
test('on each hospital\'s page, a drag past a strip\'s end lands where Home or End does, and the axis holds every what-if figure', () => {
  const all = hubHospitals(loadHub());
  const est = all.filter((h) => h.est);
  const vbpMax = vbpMaxOf(all);
  const tight = shareDomain(est);
  let ends = 0;
  let wider = 0;
  for (const h of est) {
    const shares = whatIfCorners(h, { vbpMax });
    const axis = holdingAxis(tight, shares);
    for (const v of shares) assert.ok(v >= axis[0] && v <= axis[1], `${h.ccn}: ${v} on [${axis}]`);
    if (axis !== tight) wider += 1;
    if (!(h.est.base > 0)) continue;
    const hctx = { h, vbpMax };
    for (const id of ['hrrp', 'hvbp']) {
      if (!extent(h, hctx, id)) continue;
      for (const dir of [-1, 1]) {
        const dragged = reduce(initial(h), dragAction(h, id, { share: tight[dir < 0 ? 0 : 1], past: dir }), hctx);
        const keyed = reduce(initial(h), { type: 'end', id, dir }, hctx);
        assert.equal(dragged[id], keyed[id], `${h.ccn} ${id} ${dir > 0 ? 'End' : 'Home'}`);
        ends += 1;
      }
    }
  }
  assert.ok(ends > 4000, `${ends} ends checked`);
  assert.ok(wider > 0 && wider < est.length, `${wider} of ${est.length} pages can widen their axis`);
});
