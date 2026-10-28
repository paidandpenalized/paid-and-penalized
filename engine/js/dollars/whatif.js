// Cross-program dollars for the what-if: reproduce a hospital's emitted dollar row, and recompute it for changed program
// factors. Pure: data in, result out. It mirrors the whole-dollar row of engine/py/pp_engine/dollars.py (`_chain`,
// `round_dollars`): HRRP and HVBP each adjust the base operating payment B on their own, the HAC cut is 1% of what the
// hospital is paid after both, and every figure is a whole dollar so a reader can add up the row.

// The HAC Reduction Program cuts a flagged hospital's payments by this fraction of what it is paid after HRRP and HVBP
// (42 CFR 412.172; the Python twin's HAC_RATE).
export const HAC_RATE = 0.01;

// The statuses of a dollar row the pages have words for: the schema lists a fourth, `parhm`, which no hospital has. The
// one list the HACRP loader, the hub model and the hub asset's status codes are checked against.
export const SHOWN_STATUSES = Object.freeze(['estimated', 'maryland', 'no-inputs']);

// Two factors closer than this are the same factor: the dollar file's are printed to ten decimal places.
const SAME_FACTOR = 1e-9;

const assertFinite = (x, name) => {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be a finite number, not ${x}`);
  return x;
};

// Python's `round`: to the nearest whole number, a tie to the even one. Never -0 (a plain 0 prints as "0", not "-0").
// Like Python's, it refuses what is not a finite number.
export function roundHalfEven(x) {
  assertFinite(x, 'roundHalfEven input');
  const low = Math.floor(x);
  const frac = x - low; // exact: a double's fractional part is representable
  let rounded;
  if (frac < 0.5) rounded = low;
  else if (frac > 0.5) rounded = low + 1;
  else rounded = low % 2 === 0 ? low : low + 1;
  return rounded === 0 ? 0 : rounded;
}

// The scenario's factor for a program when it names one that differs from the row's (a closer pair is the same factor),
// else null: the program keeps the row's dollars. A factor is a positive multiplier (1 = no adjustment), as the Python
// twin's `_factor` requires: 0 would take the whole base and a negative one more than the base.
const changedFactor = (scenario, key, actual) => {
  const wanted = scenario?.[key];
  if (wanted === undefined) return null;
  assertFinite(wanted, key);
  if (!(wanted > 0)) throw new RangeError(`${key} must be a positive adjustment factor (1 = none), not ${wanted}`);
  return Math.abs(wanted - actual) >= SAME_FACTOR ? wanted : null;
};

const scenarioCut = (scenario, actual) => {
  const wanted = scenario?.cut;
  if (wanted === undefined) return actual;
  if (typeof wanted !== 'boolean') throw new TypeError(`cut must be true or false, not ${wanted}`);
  return wanted;
};

// What follows from a hospital's two program dollars, the one rule for every caller (this module, the hub asset's build
// check, the browser decoder): `after` is the pay after Readmissions and value-based purchasing, and `atStake` the HAC
// Reduction Program's cut of it. `{ total, hrrp, hvbp }` is a row or any object with those three.
export function derivedDollars({ total, hrrp, hvbp }) {
  const after = total + hrrp + hvbp;
  return { after, atStake: roundHalfEven(HAC_RATE * after) };
}

// One estimated dollar row's program dollars, as emitted or under a scenario. `row` carries `base, total, hrrpFactor,
// vbpFactor, cut, hrrp, hvbp, hac, net, after, atStake`; `scenario` is `{ hrrpFactor?, vbpFactor?, cut? }`, a missing key
// meaning "as it is". A program whose scenario value equals the row's keeps the row's dollars, so no scenario (or one
// equal to the actual values) returns the emitted figures exactly. A changed factor gives round(base x (factor - 1));
// `after` is the total plus both; the at-stake figure is the row's unless a factor changed, else round(1% x after); the
// HAC dollars are minus that when the hospital is cut and a plain 0 when not; the net is the three added. A changed
// factor is applied to the row's whole-dollar `base`, the only base the emitted file holds, so it can differ by up to a
// dollar from what dollars.py would emit at that factor from the unrounded base: a what-if is hypothetical and shown in
// K and M, so the dollar is accepted.
export function programDollars(row, scenario = null) {
  const hrrpTo = changedFactor(scenario, 'hrrpFactor', row.hrrpFactor);
  const vbpTo = changedFactor(scenario, 'vbpFactor', row.vbpFactor);
  const cut = scenarioCut(scenario, row.cut);
  const hrrp = hrrpTo === null ? row.hrrp : roundHalfEven(row.base * (hrrpTo - 1));
  const hvbp = vbpTo === null ? row.hvbp : roundHalfEven(row.base * (vbpTo - 1));
  const derived = derivedDollars({ total: row.total, hrrp, hvbp });
  const atStake = hrrpTo !== null || vbpTo !== null ? derived.atStake : row.atStake;
  const hac = cut && atStake ? -atStake : 0;
  return { hrrp, hvbp, hac, net: hrrp + hvbp + hac, after: derived.after, atStake };
}

// A hospital's net dollars as a fraction of its estimated Medicare inpatient pay (the dollar file's `total`), never a sum
// of program percentages. A hospital with no pay has no share.
export function netShare(net, total) {
  if (!(total > 0)) throw new RangeError(`total must be above zero, not ${total}`);
  return net / total;
}
