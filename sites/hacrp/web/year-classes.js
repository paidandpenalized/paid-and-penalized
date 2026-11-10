// The year map's inks (history-figures.js draws it; client/explore.js redraws it), kept apart so the browser loads
// only these. A hospital's record is one character a year (engine/js/hacrp/trends.js): cut, not cut, no decision.
import { CUT, NOT_CUT } from '../../../engine/js/hacrp/trends.js';

export const YEAR_CLASSES = Object.freeze({ clear: 'chart-dots--years-clear', scar: 'chart-dots--years-scar', now: 'chart-dots--pen' });

// A cut in an earlier year is a ring, not a second shade of red: a dot RING times as wide, with a dot half its width in
// the land's tone (YEAR_HOLE) over its middle. Its shape alone tells it from that year's solid dot (charts.css sizes
// both at each width; these keep the drawing's own widths in step).
export const YEAR_HOLE = 'chart-dots--years-hole';
const RING = 1.25;

// The year map's paths in drawing order (the last on top): the kinds in YEAR_CLASSES's order, the earlier-year cuts'
// holes right over their rings. points { clear, scar, now }: each kind's [[x, y]]; size: a dot's diameter.
// Returns [{ cls, points, size }].
export const yearGroups = (points, size) => [
  { cls: YEAR_CLASSES.clear, points: points.clear, size },
  { cls: YEAR_CLASSES.scar, points: points.scar, size: size * RING },
  { cls: YEAR_HOLE, points: points.scar, size: (size * RING) / 2 },
  { cls: YEAR_CLASSES.now, points: points.now, size },
];

// A hospital's ink on the year map in year i: cut that year, cut in an earlier year, never cut so far, or no dot (no
// decision yet).
export function yearClass(rec, i) {
  if (rec[i] === CUT) return 'now';
  const before = rec.slice(0, i);
  if (before.includes(CUT)) return 'scar';
  return before.includes(NOT_CUT) || rec[i] === NOT_CUT ? 'clear' : null;
}
