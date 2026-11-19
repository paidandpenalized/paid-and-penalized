// Values shaded in five even steps from the lowest to the highest (1, the lightest, to 5): a map of a handful of values
// whose spread is the story (the census divisions' prices for one episode type), where the kit's stepped ramp, which
// starts at zero, would put every value on one step. A value exactly on an edge takes the step above; the highest takes
// the top step; values all equal sit on the middle one. Pure and dependency-free, so a page script that redraws the map
// shades it with the same steps the build did.
export const STEPS = 5;

export function evenSteps(values) {
  if (!values.length || !values.every(Number.isFinite)) throw new RangeError('evenSteps: values must be finite numbers, at least one');
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const stepOf = (v) => (hi === lo ? Math.ceil(STEPS / 2) : Math.min(STEPS, 1 + Math.floor(((v - lo) / (hi - lo)) * STEPS)));
  return { lo, hi, stepOf };
}
