// The year map's inks (history-figures.js draws it; client/explore.js redraws it), kept apart so the browser loads
// only these. A hospital's record is one character a year (engine/js/hacrp/trends.js): cut, not cut, no decision.
import { CUT, NOT_CUT } from '../../../engine/js/hacrp/trends.js';

export const YEAR_CLASSES = Object.freeze({ clear: 'chart-dots--years-clear', scar: 'chart-dots--years-scar', now: 'chart-dots--pen' });

// A hospital's ink on the year map in year i: cut that year, cut in an earlier year, never cut so far, or no dot (no
// decision yet).
export function yearClass(rec, i) {
  if (rec[i] === CUT) return 'now';
  const before = rec.slice(0, i);
  if (before.includes(CUT)) return 'scar';
  return before.includes(NOT_CUT) || rec[i] === NOT_CUT ? 'clear' : null;
}
