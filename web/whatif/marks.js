// Where the what-if's marks sit, shared by its build-time HTML (render.js) and the browser (dom.js) so both place
// them the same way: a score on the ramp, a value on a slider's track, a measure's part of the score on its bar;
// and the few values both write the same way (a field's text, the estimate note).
// Plain arithmetic: no DOM. Positions are fractions (0 to 1) or SVG percentages.
import { clamp } from '../../engine/js/stats.js';

// The ramp's side margin, as a percentage of its width, and how much room it leaves past the reachable scores.
const RAMP_MARGIN = 5;
const RAMP_ROOM = 0.04;
// Near an end, a mark's label is anchored to stay inside the figure.
const EDGE = 0.18;

const clamp01 = (t) => clamp(t, 0, 1);

// The ramp's score range. range: { low, high }, the middle of the published scores nationally (the build reads it
// from data); widened to hold the starting score and CMS's line, with a little room. It is fixed per hospital, so
// the axis never rescales; a hypothetical score past it is drawn at the edge with an arrow (rampEdge).
export function rampDomain(range, { actual, highestNo, lowestYes }) {
  const lo = Math.min(range.low, actual, highestNo);
  const hi = Math.max(range.high, actual, lowestYes);
  const room = (hi - lo) * RAMP_ROOM || RAMP_ROOM;
  return [lo - room, hi + room];
}

// -1 below the domain, 1 above it, 0 inside.
export const rampSide = (score, [lo, hi]) => (score < lo ? -1 : score > hi ? 1 : 0);

// The arrow beside a mark clamped to an edge: { t, anchor, dx, text } (text '' when the mark is inside).
export function rampEdge(side) {
  if (side > 0) return { t: 1, anchor: 'start', dx: 9, text: '▶' };
  if (side < 0) return { t: 0, anchor: 'end', dx: -9, text: '◀' };
  return { t: 1, anchor: 'start', dx: 9, text: '' };
}

// A score's place along the ramp (0 to 1, clamped) and that place as an SVG x percentage.
export const rampAt = (score, [lo, hi]) => clamp01((score - lo) / (hi - lo));
// rampPct: as a number (the chart kit's static ramp draws on a viewBox); rampX: as an SVG percentage.
export const rampPct = (t) => RAMP_MARGIN + t * (100 - 2 * RAMP_MARGIN);
export const rampX = (t) => `${rampPct(t).toFixed(2)}%`;
const labelAnchor = (t) => (t < EDGE ? 'start' : t > 1 - EDGE ? 'end' : 'middle');
// A label's nudge (px) off its mark for that anchor, so an end-anchored label still sits beside the mark.
const labelDx = (anchor) => ({ start: -6, middle: 0, end: 6 })[anchor];
// A label under the mark at t, anchored to stay inside the figure: { t, anchor, dx }.
export const labelAt = (t) => ({ t, anchor: labelAnchor(t), dx: labelDx(labelAnchor(t)) });
// The two mark labels (the starting score's, the hypothetical's) share one row and never overlap. Text widths are
// estimated (CHAR_PX per character overstates the 12px labels) and checked on the narrowest ramp the page draws:
// NARROW_PX, a 320px phone less its gutters and the result box's padding.
// Far apart, each label sits under its mark; close together, they sit side by side around the marks' midpoint,
// the left mark's label on the left, kept inside the figure near either end. Each result is { t, anchor, dx }.
const CHAR_PX = 7;
export const NARROW_PX = 260;
const GAP_PX = 8;
const INSET_PX = 12;

// A label's left and right edge (px) on a ramp `width` px wide.
export function labelSpan({ t, anchor, dx }, chars, width) {
  const x = (width * rampPct(t)) / 100 + dx;
  const w = chars * CHAR_PX;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return [left, left + w];
}

export function rampLabels(tStart, tHyp, startText, hypText) {
  const start = labelAt(tStart);
  const hyp = labelAt(tHyp);
  const [a, b] = [labelSpan(start, startText.length, NARROW_PX), labelSpan(hyp, hypText.length, NARROW_PX)];
  if (a[1] + GAP_PX <= b[0] || b[1] + GAP_PX <= a[0]) return { start, hyp };

  const startLeft = tStart <= tHyp;
  const [nl, nr] = (startLeft ? [startText, hypText] : [hypText, startText]).map((s) => s.length);
  const [wl, wr] = [nl * CHAR_PX, nr * CHAR_PX];
  const mid = (tStart + tHyp) / 2;
  const [l0] = labelSpan({ t: mid, anchor: 'end', dx: -GAP_PX / 2 }, nl, NARROW_PX);
  const [, r1] = labelSpan({ t: mid, anchor: 'start', dx: GAP_PX / 2 }, nr, NARROW_PX);
  let left;
  let right;
  if (l0 < 0) {
    left = { t: 0, anchor: 'start', dx: -INSET_PX };
    right = { t: 0, anchor: 'start', dx: -INSET_PX + wl + GAP_PX };
  } else if (r1 > NARROW_PX) {
    right = { t: 1, anchor: 'end', dx: INSET_PX };
    left = { t: 1, anchor: 'end', dx: INSET_PX - wr - GAP_PX };
  } else {
    left = { t: mid, anchor: 'end', dx: -GAP_PX / 2 };
    right = { t: mid, anchor: 'start', dx: GAP_PX / 2 };
  }
  return startLeft ? { start: left, hyp: right } : { start: right, hyp: left };
}

// The width (an SVG percentage) of the ramp from t to its right end.
export const rampWidthFrom = (t) => `${((1 - t) * (100 - 2 * RAMP_MARGIN)).toFixed(2)}%`;

// CMS's line on the ramp: midway between the highest score CMS marked No and the lowest it marked Yes.
export const lineScore = ({ highestNo, lowestYes }) => (highestNo + lowestYes) / 2;

// A value's place on a slider whose track runs from 0 to max.
const trackAt = (value, max) => (max > 0 ? clamp01(value / max) : 0);
export const fraction = (t) => t.toFixed(4);

// A measure's marks on its slider's track (vm input): the floor, the cap and the median, as fractions.
export function trackMarks(input) {
  const at = (value) => fraction(trackAt(value, input.max));
  return { floor: at(input.floor), cap: at(input.cap), median: at(input.median) };
}

// A measure's number field text (blank where there is no value; never thousands separators, which
// <input type=number> refuses) and its slider's value (at its max where there is no value).
export const fieldText = (input) => (input.value === null ? '' : input.value.toFixed(input.decimals));
export const sliderValue = (input) => input.value ?? input.max;

// The result's hypothetical column: a value only where it differs from the start, else the site's "same", so bold only
// ever means changed. The head shows the score as "before → after" once it moves.
export const afterText = (before, after, same) => (after === before ? same : after);
export const headScore = ({ before, after }) => (after === before ? before : `${before} → ${after}`);
// Whether the reader has changed any measure (the head then reads "Hypothetical", not the start's name).
export const anyChanged = (result) => Object.values(result.measures).some((m) => m.changed);

// The estimate note the live sentence carries when a changed measure is a recompute ('' otherwise).
export const estimateNote = (vm, texts) => (vm.estimated ? ` ${texts.estimate.text}` : '');

// A measure CMS assigned, still without a reader's value: its bar is hatched and says so. Once the reader enters a
// value ("had it been submitted"), the bar shows that value like any other.
export const assignedNow = (input) => input.assigned && input.value === null;
export const barClass = (input) => `wi-bars__row${assignedNow(input) ? ' wi-bars__row--assigned' : ''}`;

// A bar from the center line: { at, width } as fractions of the track. Positive parts go right.
export function barSpan(contribution, extent) {
  const width = clamp01(Math.abs(contribution) / extent) / 2;
  return { at: contribution < 0 ? 0.5 - width : 0.5, width };
}
