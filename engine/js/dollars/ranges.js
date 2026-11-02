// The likely ranges of the dollar estimates: an estimate times the back-test's multipliers (dollars.json `bands`, built
// by pp_pipeline.backtest_dollars). Pure and browser-safe, shared by the HACRP pages and the hub's hospital pages.

// [low, high] in whole dollars, low first: an estimate times two multipliers. A range has two ends: an estimate of $0
// (a net with nothing to net, a hospital no program moves) has none, so null.
function scaled(estimate, a, b) {
  if (!Number.isFinite(estimate)) throw new RangeError(`a likely range needs an estimate, not ${estimate}`);
  if (estimate === 0) return null;
  const [x, y] = [Math.round(estimate * a), Math.round(estimate * b)];
  return x <= y ? [x, y] : [y, x];
}

// The stratum of a hospital the impact file gives no bed count (pp_engine.bands.ALL): its ranges take the whole
// back-test's band, each measure's `overall`.
export const ALL_STRATUM = 'all';

// A hospital's likely range for one measure ('hac' for its dollars at stake, 'net' for the net of the three programs):
// its estimate times its stratum's two multipliers for that measure, from the back-test (each stratum's `low` and
// `high`, exp(-p90) and exp(-p10): the range spans the middle of the misses its group's estimates made against their
// cost reports, the group's own or a wider group's where it had too few; ALL_STRATUM takes every hospital's). bands:
// dollars.json's; stratum: the hospital's row's.
export function rangeOf(bands, measure, stratum, estimate) {
  const m = bands?.measures?.[measure];
  const band = stratum === ALL_STRATUM ? m?.overall : m?.strata.find((s) => s.stratum === stratum);
  if (!band) throw new RangeError(`rangeOf: no ${measure} band for stratum ${stratum}`);
  return scaled(estimate, band.low, band.high);
}

// The national range: a national sum of the cut times the back-test's resampled ratio of what cost reports recorded
// to what the model estimated, its 10th and 90th percentiles (bands.national).
export function nationalRange(bands, estimate) {
  if (!bands?.national) throw new RangeError('nationalRange: the bands have no national ratio');
  return scaled(estimate, bands.national.p10, bands.national.p90);
}

// How much of the back-test's misses a likely range spans: the share between its two percentiles (bands.lowPct and
// bands.highPct), the middle 80%.
export const rangeShare = (bands) => bands.highPct - bands.lowPct;

// A place's range: its hospitals' ranges added up, low ends and high ends, from each hospital's [low, high] (null for
// none). As wide as if every hospital's estimate erred the same way, so wider than a sum's errors usually run (the
// nation's own range, resampled, is narrower). null when no hospital has one.
export function sumRanges(ranges) {
  const some = ranges.filter(Boolean);
  if (!some.length) return null;
  return [some.reduce((a, r) => a + r[0], 0), some.reduce((a, r) => a + r[1], 0)];
}
