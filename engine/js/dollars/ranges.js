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

// A hospital's likely range for one measure ('hac' for its dollars at stake, 'net' for the net of the three programs, 'hrrp'
// or 'hvbp' for one program's dollars; a page's net takes netRangeOf):
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

// The programs whose dollars make a dollar row's net, each named as the row's field and as the back-test's band
// (bands.measures).
const NET_PARTS = ['hrrp', 'hvbp', 'hac'];

// The one program that makes a dollar row's whole net (the other two move nothing), or null when none does or more than
// one does.
export function soleProgram(row) {
  const moving = NET_PARTS.filter((id) => row[id] !== 0);
  return moving.length === 1 ? moving[0] : null;
}

// A dollar row's likely range for its net, so one dollar figure has one range on every page: when one program makes the
// whole net, that program's band over the program's own dollars (as its pages give it: the HACRP pages' range of the
// dollars at stake, for a net that is the HAC cut alone), its ends signed as the net; otherwise the net's band. row: the
// dollar file's (net, stratum and each program's dollars); null for a net of $0.
export function netRangeOf(bands, row) {
  const only = soleProgram(row);
  if (only === null) return rangeOf(bands, 'net', row.stratum, row.net);
  const range = rangeOf(bands, only, row.stratum, Math.abs(row.net));
  return range && row.net < 0 ? [-range[1], -range[0]] : range;
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

// A likely range drawn as a small bar with the estimate's tick: the range's two ends and the estimate as places along
// the bar's span (fractions to three decimals, as a style's custom properties take them), the span stretched to hold
// the estimate; null when it has no width (nothing to draw). range: [low, high]; estimate: dollars.
export function rangeBar([lo, hi], estimate) {
  const from = Math.min(lo, estimate);
  const to = Math.max(hi, estimate);
  if (to === from) return null;
  const at = (x) => ((x - from) / (to - from)).toFixed(3);
  return { lo: at(lo), hi: at(hi), at: at(estimate) };
}
