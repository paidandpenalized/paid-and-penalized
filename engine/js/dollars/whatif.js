// Cross-program dollars for the what-if: reproduce a hospital's emitted dollar row, and recompute it for changed program
// factors. Pure: data in, result out. It mirrors the whole-dollar row of engine/py/pp_engine/dollars.py (`_chain`,
// `round_dollars`): HRRP and HVBP each adjust the base operating payment B on their own, the HAC cut is 1% of what the
// hospital is paid after both, and every figure is a whole dollar so a reader can add up the row.

// The HAC Reduction Program cuts a flagged hospital's payments by this fraction of what it is paid after HRRP and HVBP
// (42 CFR 412.172; the Python twin's HAC_RATE).
export const HAC_RATE = 0.01;

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

// A program's scenario value: the row's own unless the scenario names one that differs.
const scenarioFactor = (scenario, key, actual) => {
  const wanted = scenario?.[key];
  if (wanted === undefined) return { value: actual, changed: false };
  assertFinite(wanted, key);
  return { value: wanted, changed: Math.abs(wanted - actual) >= SAME_FACTOR };
};

const scenarioCut = (scenario, actual) => {
  const wanted = scenario?.cut;
  if (wanted === undefined) return actual;
  if (typeof wanted !== 'boolean') throw new TypeError(`cut must be true or false, not ${wanted}`);
  return wanted;
};

// One estimated dollar row's program dollars, as emitted or under a scenario. `row` carries `base, total, hrrpFactor,
// vbpFactor, cut, hrrp, hvbp, hac, net, after, atStake`; `scenario` is `{ hrrpFactor?, vbpFactor?, cut? }`, a missing key
// meaning "as it is". A program whose scenario value equals the row's keeps the row's dollars, so no scenario (or one
// equal to the actual values) returns the emitted figures exactly. A changed factor gives round(base x (factor - 1));
// `after` is the total plus both; the at-stake figure is the row's unless a factor changed, else round(1% x after); the
// HAC dollars are minus that when the hospital is cut and a plain 0 when not; the net is the three added.
export function programDollars(row, scenario = null) {
  const hrrpAt = scenarioFactor(scenario, 'hrrpFactor', row.hrrpFactor);
  const vbpAt = scenarioFactor(scenario, 'vbpFactor', row.vbpFactor);
  const cut = scenarioCut(scenario, row.cut);
  const hrrp = hrrpAt.changed ? roundHalfEven(row.base * (hrrpAt.value - 1)) : row.hrrp;
  const hvbp = vbpAt.changed ? roundHalfEven(row.base * (vbpAt.value - 1)) : row.hvbp;
  const after = row.total + hrrp + hvbp;
  const atStake = hrrpAt.changed || vbpAt.changed ? roundHalfEven(HAC_RATE * after) : row.atStake;
  const hac = cut && atStake ? -atStake : 0;
  return { hrrp, hvbp, hac, net: hrrp + hvbp + hac, after, atStake };
}

// A hospital's net dollars as a fraction of its estimated Medicare inpatient pay (the dollar file's `total`), never a sum
// of program percentages. A hospital with no pay has no share.
export function netShare(net, total) {
  if (!(total > 0)) throw new RangeError(`total must be above zero, not ${total}`);
  return net / total;
}
