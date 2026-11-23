// The calculator band's evidence, as the "why?" (program/calc.js calcStatics) and Methods #band (pages/methods.js) print
// it: how far hospitals' years in CJR, Medicare's joint-replacement bundle, ended from target. This site's count from
// CMS's reconciliation file, made in the emitter (engine/py/pp_engine/team/cjr.py) and read from the TEAM file's
// method.cjrSpread, never typed. The narrower width counted is the calculator's default band, or this throws, so the
// two can't drift apart; so does a count that doesn't add up (a year without a whole-dollar target, a width's count
// over n, rows left out that don't add up to it). Pure.
//   n, rows, censored, rural,  the results counted; of the counted years' results, all, then what is left out in turn:
//   small                      the hiding zeros, the years at rural hospitals and the results under the episode floor
//   near, far                  { width, n, share }: the results within the default band, and within the widest width
//                              counted past it
//   years, euc, floor, targets the counted performance years, the year left out for CMS's COVID-19 policy, the episode
//                              floor, each counted year's average target (in order)
//   shares                     the copy's {band, wide, near, far, years}: the two widths as "±5%", the two shares as
//                              "47%" and the counted years as a list ("4, 6, and 7")
import { BAND_DEFAULT } from '../../../engine/js/team/params.js';
import { listText, pct } from '../../../web/render/format.js';

const refuse = (why) => { throw new RangeError(`TEAM: the CJR spread (method.cjrSpread) ${why}`); };

export function bandEvidence(team) {
  const s = team?.method?.cjrSpread;
  if (!s || !Array.isArray(s.within) || !Array.isArray(s.years) || !(Number.isInteger(s.n) && s.n > 0)) {
    throw new TypeError('TEAM: the file has no CJR spread (method.cjrSpread)');
  }
  if (typeof s.eucYear !== 'string') refuse('does not name the performance year it leaves out (eucYear)');
  for (const py of s.years) if (!(Number.isInteger(s.targets?.[py]) && s.targets[py] > 0)) refuse(`has no whole-dollar average target for performance year ${py}`);
  if (![s.rows, s.censored, s.rural, s.small].every((x) => Number.isInteger(x) && x >= 0) || s.rows - s.censored - s.rural - s.small !== s.n) {
    refuse(`leaves out results that don't add up: ${s.rows} less ${s.censored}, ${s.rural} and ${s.small} is not its n of ${s.n}`);
  }
  for (const w of s.within) if (!(Number.isInteger(w.n) && w.n >= 0 && w.n <= s.n)) refuse(`counts ${w.n} within ±${pct(w.width, 0)}, not a whole number from 0 to its n of ${s.n}`);
  const at = (w) => ({ width: w.width, n: w.n, share: w.n / s.n });
  const nearW = s.within.find((w) => w.width === BAND_DEFAULT);
  const farW = s.within.filter((w) => w.width > BAND_DEFAULT).reduce((a, w) => (a && a.width >= w.width ? a : w), null);
  if (!nearW || !farW) refuse('does not count the default band and a wider width');
  const near = at(nearW), far = at(farW);
  return {
    n: s.n, rows: s.rows, censored: s.censored, rural: s.rural, small: s.small, near, far,
    years: [...s.years], euc: s.eucYear, floor: s.minEpisodes, targets: s.years.map((py) => s.targets[py]),
    shares: { band: `±${pct(near.width, 0)}`, wide: `±${pct(far.width, 0)}`, near: pct(near.share, 0), far: pct(far.share, 0), years: listText(s.years) },
  };
}
