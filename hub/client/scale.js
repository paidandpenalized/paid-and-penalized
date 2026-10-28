// The share axis the hub's dot charts share (the home story, the hospital page's swarm): a hospital's change as a percent
// of its estimated Medicare inpatient pay, on one linear scale, with exactly $0 in a gutter of its own between the cuts
// and the bonuses, so a hospital a program leaves untouched never sits beside one it moves a hair. Pure.

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

// The axis a chart under a what-if draws (each a domain [lo, hi]): its own (actual) while there is no hypothetical value
// (pct null) or the value lies on it; wide once a value lies past it, kept (now: the axis drawn so far) until the what-if
// ends, so the axis changes at most twice in a what-if, never back and forth with each value.
export const whatIfAxis = (pct, { actual, wide, now }) => (pct === null ? actual : pct < actual[0] || pct > actual[1] ? wide : now);

// The whole percents in a domain [lo, hi], in order: where an axis's ticks and lines stand.
export function wholePercents([lo, hi]) {
  const out = [];
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) out.push(v);
  return out;
}

// The scale from x0 to x1 (pixels) with a gutter for exactly $0: { xs(v), invert(x), zL, zR, zM, k } where k is pixels per
// percentage point on both sides, the cuts end at zL, the bonuses start at zR and $0 sits at zM, mid-gutter. A value
// outside the domain clamps to its end; invert is the share at a pixel ($0 across the gutter), held to the domain. px: a
// device pixel, in the same units, when the gutter's edges should land on whole device pixels (so dot columns counted
// from them do too).
export function shareScale({ x0, x1, gutter, domain: [lo, hi], px = 0 }) {
  const k = (x1 - x0 - gutter) / (hi - lo);
  const snap = (v) => (px ? Math.round(v / px) * px : v);
  const zL = snap(x0 - lo * k);
  const zR = zL + snap(gutter);
  const zM = (zL + zR) / 2;
  const xs = (v) => {
    const c = v < lo ? lo : v > hi ? hi : v;
    return c < 0 ? zL + c * k : c > 0 ? zR + c * k : zM;
  };
  const invert = (x) => Math.min(hi, Math.max(lo, x <= zL ? (x - zL) / k : x >= zR ? (x - zR) / k : 0));
  return { xs, invert, zL, zR, zM, k };
}
