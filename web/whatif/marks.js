// Where the what-if's marks sit, shared by its build-time HTML (render.js) and the browser (dom.js) so both place
// them the same way: a score on the ramp, a value on a slider's track, a measure's part of the score on its bar.
// Plain arithmetic: no DOM, no dependencies. Positions are fractions (0 to 1) or SVG percentages.

// The ramp's side margin, as a percentage of its width, and how much room it leaves past the reachable scores.
const RAMP_MARGIN = 5;
const RAMP_ROOM = 0.04;
// Near an end, a mark's label is anchored to stay inside the figure.
const EDGE = 0.12;

const clamp01 = (t) => Math.min(1, Math.max(0, t));

// The ramp's score range: the hospital's reachable scores, widened to hold CMS's line, with a little room.
export function rampDomain({ min, max, highestNo, lowestYes }) {
  const lo = Math.min(min, highestNo);
  const hi = Math.max(max, lowestYes);
  const room = (hi - lo) * RAMP_ROOM || RAMP_ROOM;
  return [lo - room, hi + room];
}

// A score's place along the ramp (0 to 1, clamped) and that place as an SVG x percentage.
export const rampAt = (score, [lo, hi]) => clamp01((score - lo) / (hi - lo));
export const rampX = (t) => `${(RAMP_MARGIN + t * (100 - 2 * RAMP_MARGIN)).toFixed(2)}%`;
export const labelAnchor = (t) => (t < EDGE ? 'start' : t > 1 - EDGE ? 'end' : 'middle');
// A label's nudge (px) off its mark for that anchor, so an end-anchored label still sits beside the mark.
export const labelDx = (anchor) => ({ start: -6, middle: 0, end: 6 })[anchor];
// The width (an SVG percentage) of the ramp from t0 to t1.
export const rampWidth = (t0, t1) => `${((t1 - t0) * (100 - 2 * RAMP_MARGIN)).toFixed(2)}%`;

// CMS's line on the ramp: midway between the highest score CMS marked No and the lowest it marked Yes.
export const lineScore = ({ highestNo, lowestYes }) => (highestNo + lowestYes) / 2;

// A value's place on a slider whose track runs from 0 to max.
export const trackAt = (value, max) => (max > 0 ? clamp01(value / max) : 0);
export const fraction = (t) => t.toFixed(4);

// The widest part any measure could add or take away for this hospital (its z-score over n, at CMS's bounds or
// at the value CMS published), so the bars keep one scale while the reader changes values.
export function barExtent(result, model) {
  let extent = 0;
  for (const [id, m] of Object.entries(result.measures)) {
    const p = model.params[id];
    extent = Math.max(extent, Math.abs(p.zMin), Math.abs(p.zMax), Math.abs(m.beforeZ));
  }
  return extent / result.n || 1;
}

// A bar from the center line: { at, width } as fractions of the track. Positive parts go right.
export function barSpan(contribution, extent) {
  const width = clamp01(Math.abs(contribution) / extent) / 2;
  return { at: contribution < 0 ? 0.5 - width : 0.5, width };
}
