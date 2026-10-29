// The share axis the hub's dot charts share (the home story, the hospital page's swarm): a hospital's change as a percent
// of its estimated Medicare inpatient pay, on one linear scale, with exactly $0 in a gutter of its own between the cuts
// and the bonuses, so a hospital a program leaves untouched never sits beside one it moves a hair. Pure.
import { clamp } from '../../engine/js/stats.js';
import { pct } from '../../web/render/format.js';

// How far the domain reaches past the data either side, and the step its ends round out to (percentage points).
const PAD = 0.1;
const PER = 10;

// [lo, hi] in percent: the lowest and highest percent of pay of any program or the net among the estimated hospitals
// (est.pct: engine/js/dollars/whatif.js pctOf) and of any extra value (a hospital page's: every percent its what-if can
// show, hospital/whatif-state.js reach), each padded PAD and rounded outward to a tenth. Always holds 0.
export function shareDomain(hospitals, extra = []) {
  let lo = Math.min(0, ...extra);
  let hi = Math.max(0, ...extra);
  for (const h of hospitals) {
    if (!h.est) continue;
    for (const v of Object.values(h.est.pct)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  // The epsilons keep a value already on a tenth from rounding a whole tenth further out on floating error.
  return [Math.floor((lo - PAD) * PER + 1e-9) / PER, Math.ceil((hi + PAD) * PER - 1e-9) / PER];
}

// How far past a hypothetical value an axis widened for it reaches before its end rounds out to a whole percent
// (percentage points), so its mark never sits on the axis's very end.
const HOLD = 0.1;

// The axis a chart draws to show a what-if's figures (values, percent of pay): its own (axis, [lo, hi]: the data's)
// while every value lies on it, the same array; else widened only on the side a value lies past, just enough to hold
// the farthest one with HOLD to spare, out to a whole percent (a tick). Anything not a finite number is no value.
export function holdingAxis(axis, values) {
  let [lo, hi] = axis;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    // The epsilons keep a value whose margin lands on a whole percent from rounding a whole percent further on error.
    if (v < axis[0]) lo = Math.min(lo, Math.floor(v - HOLD + 1e-9));
    if (v > axis[1]) hi = Math.max(hi, Math.ceil(v + HOLD - 1e-9));
  }
  return lo === axis[0] && hi === axis[1] ? axis : [lo, hi];
}

const span = (a, b) => [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Which axis a hospital page's strips (or its swarm) draw as the reader acts: s is { held, want, axis } (how many
// pointers hold a handle in a drag, the axis the what-if's figures need now: holdingAxis, and the axis drawn), event
// { type, want }: 'values' (the figures changed; want: the axis they need), 'press' (a pointer takes a handle) or
// 'release' (it lets go). With nothing held the axis is what the figures need, so opening the what-if changes nothing
// and a reset goes back to the data's own. While a drag lasts it only grows, so a figure is never drawn past its end and
// the axis never goes back and forth under a held pointer; once the last pointer lets go it settles to what the figures
// need then (a reset made during the drag included). The axis keeps its array while its ends stay the same.
export function stripAxis(s, { type, want = s.want }) {
  const held = Math.max(0, s.held + (type === 'press') - (type === 'release'));
  const next = held ? span(s.axis, want) : want;
  return { held, want, axis: same(next, s.axis) ? s.axis : next };
}

// The whole percents in a domain [lo, hi], in order: where an axis's ticks and lines stand; and a tick's label (v in
// percent: "−2%", "0%", "+1%").
export function wholePercents([lo, hi]) {
  const out = [];
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) out.push(v);
  return out;
}
export const tickText = (v) => pct(v / 100, 0, { sign: true });

// The scale from x0 to x1 (pixels) with a gutter for exactly $0: { xs(v), line(v), invert(x), zL, zR, zM, k, lo, hi }
// where k is pixels per percentage point on both sides, the cuts end at zL, the bonuses start at zR and $0 sits at zM,
// mid-gutter. A value outside the domain [lo, hi] clamps to its end; line is the place on the same line without the
// clamp (where a tick off the domain would stand, coming or going in a move); invert is the share at a pixel ($0 across
// the gutter), held to the domain. px: a device pixel, in the same units, when the gutter's edges should land on whole
// device pixels (so dot columns counted from them do too).
export function shareScale({ x0, x1, gutter, domain: [lo, hi], px = 0 }) {
  const k = (x1 - x0 - gutter) / (hi - lo);
  const snap = (v) => (px ? Math.round(v / px) * px : v);
  const zL = snap(x0 - lo * k);
  const zR = zL + snap(gutter);
  const zM = (zL + zR) / 2;
  const line = (v) => (v < 0 ? zL + v * k : v > 0 ? zR + v * k : zM);
  const xs = (v) => line(v < lo ? lo : v > hi ? hi : v);
  const invert = (x) => clamp(x <= zL ? (x - zL) / k : x >= zR ? (x - zR) / k : 0, lo, hi);
  return { xs, line, invert, zL, zR, zM, k, lo, hi };
}

// An axis part way (q: 0 at a, 1 at b) through a move between two scales (shareScale's, or this): every place, the
// gutter's edges and the domain's ends on a straight line from a's to b's, as each dot moves from its place on one to its
// place on the other, so a dot stays on its tick all the way. { xs, line, zL, zR, lo, hi }.
export function mixScale(a, b, q) {
  const mix = (u, v) => u + (v - u) * q;
  return {
    xs: (v) => mix(a.xs(v), b.xs(v)),
    line: (v) => mix(a.line(v), b.line(v)),
    zL: mix(a.zL, b.zL),
    zR: mix(a.zR, b.zR),
    lo: mix(a.lo, b.lo),
    hi: mix(a.hi, b.hi),
  };
}

// The ticks of an axis part way (q) from a to b: [{ v, x, alpha }] for each whole percent either shows, in order, at its
// place on the line between its places on the two (line, so one that only b shows comes in from where a's line would put
// it), seen in full where both show it and fading in (or out) where only b (or a) does.
export function ticksBetween(a, b, q) {
  const on = (s, v) => v >= s.lo - 1e-9 && v <= s.hi + 1e-9;
  const out = [];
  for (const v of wholePercents([Math.min(a.lo, b.lo), Math.max(a.hi, b.hi)])) {
    const alpha = (on(a, v) ? 1 - q : 0) + (on(b, v) ? q : 0);
    if (alpha > 0) out.push({ v, x: a.line(v) + (b.line(v) - a.line(v)) * q, alpha });
  }
  return out;
}
