// The calculator band's evidence, as the "why?" (program/calc.js calcStatics) and Methods #band (pages/methods.js) print
// it: how far hospitals' years in CJR, Medicare's joint-replacement bundle, ended from target. This site's count from
// CMS's reconciliation file, made in the emitter (engine/py/pp_engine/team/cjr.py) and read from the TEAM file's
// method.cjrSpread, never typed. The narrower width counted is the calculator's default band, or this throws, so the
// two can't drift apart. Pure.
//   n, rows, censored, small   the results counted; of the counted years' results, all, the hiding zeros and the
//                              results under the episode floor left out
//   near, far                  { width, n, share }: the results within the default band, and within the wider width
//   years, floor, targets      the counted performance years, the episode floor, each year's average target (in order)
import { BAND_DEFAULT } from '../../../engine/js/team/params.js';

export function bandEvidence(team) {
  const s = team?.method?.cjrSpread;
  if (!s || !Array.isArray(s.within) || !(s.n > 0)) throw new TypeError('TEAM: the file has no CJR spread (method.cjrSpread)');
  const at = (w) => ({ width: w.width, n: w.n, share: w.n / s.n });
  const near = s.within.find((w) => w.width === BAND_DEFAULT);
  const far = s.within.filter((w) => w.width > BAND_DEFAULT).at(-1);
  if (!near || !far) throw new RangeError('TEAM: the CJR spread does not count the default band and a wider width');
  return {
    n: s.n, rows: s.rows, censored: s.censored, small: s.small, near: at(near), far: at(far),
    years: [...s.years], floor: s.minEpisodes, targets: s.years.map((py) => s.targets[py]),
  };
}
