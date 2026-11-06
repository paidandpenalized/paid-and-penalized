// The numbers behind the program page's "Map" Part, as plain data (no markup): each state's four measures with the bin it is
// shaded in, the hospital dots, the "Every state" rows and the regions to browse. Pure.
//
// Denominators (the same as the picture Part's: "measured" means measured on at least one condition, because only those
// hospitals can be cut):
//   avg      average cut over ALL the state's hospitals (summarize().meanRed; a hospital measured on nothing counts as 0)
//   share    hospitals cut / hospitals MEASURED          (null where none is measured: no color)
//   dollars  modeled penalties summed over the hospitals with a dollar estimate (null where none has one: no color)
//   ge1      hospitals cut GE_CUT_PCT percent or more / ALL the state's hospitals, as Thirty Day Readmissions had it (the
//            old site's printed numbers are the floor). This one share differs from the picture Part's shares, which
//            are over hospitals measured on at least one condition.
import { CONDS, isMeasured } from '../../../../engine/js/hrrp/formula.js';
import { summarize } from '../../../../engine/js/hrrp/summary.js';
import { csvPath } from '../links.js';
import { MAP_RAMPS, NOT_IN_PROGRAM_STATE, STATES_PAGE_SIZE } from '../constants.js';

export const MILLION = 1e6;

// The four measures in the order the map's switch lists them: ramp, the decimals a value is shown to (it is binned at that
// precision), value(row), the unrounded value in the measure's unit (null: nothing to measure), and zeroBin: the bin a shown
// zero takes (Thirty Day Readmissions put a state with $0 modeled in the first step; the other measures draw a zero plain).
export const MEASURES = Object.freeze([
  { key: 'avg', ramp: MAP_RAMPS.avg, dp: 2, value: (r) => r.s.meanRed },
  { key: 'share', ramp: MAP_RAMPS.share, dp: 0, value: (r) => r.s.pctPen },
  { key: 'dollars', ramp: MAP_RAMPS.dollars, dp: 1, zeroBin: 1, value: (r) => (r.nEstimated ? r.s.penTotal / MILLION : null) },
  { key: 'ge1', ramp: MAP_RAMPS.ge1, dp: 0, value: (r) => (r.s.n ? (100 * r.s.nGe1) / r.s.n : 0) },
]);

// A value as the map prints it.
export const shownValue = (measure, v) => Number(v.toFixed(measure.dp));

// The bin (1 to 5, light to dark) of a value as shown: a value at a threshold takes the bin above. A shown zero has no bin
// (0: the map draws it plain), as no value has none (null).
export function binOf(measure, v) {
  if (v == null) return null;
  const s = shownValue(measure, v);
  return s === 0 ? (measure.zeroBin ?? 0) : 1 + measure.ramp.filter((c) => s >= c).length;
}

// One row for each state (and DC) in the file: its place, summarize()'s result, the count of its hospitals with a dollar
// estimate, and for each measure { value (as shown), raw (unrounded), bin } (null: nothing to measure).
export function stateRows({ places, stateSummaries }) {
  return places.list.filter((p) => p.kind === 'state').map((place) => {
    const row = { code: place.key.toUpperCase(), name: place.name, path: place.path, s: stateSummaries.get(place.key) ?? summarize(place.hospitals), nEstimated: place.hospitals.filter((h) => h.pen != null).length };
    row.m = Object.fromEntries(MEASURES.map((m) => {
      const v = m.value(row);
      return [m.key, v == null ? null : { value: shownValue(m, v), raw: v, bin: binOf(m, v) }];
    }));
    return row;
  });
}

// The "Every state" rows: average cut, highest first (ties by name), cut into pages of STATES_PAGE_SIZE.
export function everyState(rows, size = STATES_PAGE_SIZE) {
  const sorted = [...rows].sort((a, b) => b.s.meanRed - a.s.meanRed || a.name.localeCompare(b.name));
  return Array.from({ length: Math.ceil(sorted.length / size) }, (_, i) => sorted.slice(i * size, (i + 1) * size));
}

// The states' CSV rows (csv.js placeCsv) in the table's order: the label and summarize()'s fields.
export const statesCsvRows = (pages) => pages.flat().map((r) => ({ label: r.name, ...r.s }));
export const STATES_CSV = 'states';

// ---------- the hospital dots ----------

export const DOT_TIERS = 6;
// A hospital's dot kind: cut, measured and not cut, or measured on nothing.
export const dotKind = (h) => (h.red > 0 ? 'cut' : CONDS.some((k) => isMeasured(h.c?.[k])) ? 'kept' : 'none');

// The base payment a hospital's dot size is measured against: the 99th percentile (so one very large hospital does not
// shrink the rest).
export function volumeTop(hospitals) {
  const bases = hospitals.map((h) => h.base).filter((b) => b > 0).sort((a, b) => a - b);
  return bases.length ? bases[Math.min(bases.length - 1, Math.floor(0.99 * bases.length))] : 1;
}

// A hospital's dot tier 1..DOT_TIERS from the square root of its base over that of the top; no base takes the smallest.
export const volumeTier = (h, top, tiers = DOT_TIERS) => (h.base > 0 ? Math.min(tiers, Math.max(1, Math.ceil(Math.sqrt(h.base / top) * tiers))) : 1);

// Dot area follows base payments (volumeTier; the diameter at a tier is tier / DOT_TIERS of the largest). Returns
// [{ id, point: [lon, lat], kind, tier }], hospitals without a location left out.
export function dotPoints(hospitals) {
  const top = volumeTop(hospitals);
  return hospitals.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon)).map((h) => ({
    id: h.id,
    point: [h.lon, h.lat],
    kind: dotKind(h),
    tier: volumeTier(h, top),
  }));
}

// ---------- the regions to browse ----------

// Regions, each with its divisions, each with its states: [{ place, divisions: [{ place, states: [place] }] }], in name order.
export function regionTree(places) {
  return places.list.filter((p) => p.kind === 'region').map((region) => ({
    place: region,
    divisions: region.children.map((division) => ({ place: division, states: division.children })),
  }));
}

// ---------- the Part ----------

// ctx: the page's context (view.js areaContext). Which states the map shades and which it hatches or leaves plain.
export function mapData(ctx) {
  const rows = stateRows(ctx);
  const inFile = new Set(rows.map((r) => r.code));
  return {
    rows,
    measures: MEASURES,
    pages: everyState(rows),
    regions: regionTree(ctx.places),
    dots: dotPoints(ctx.hospitals),
    shapes: ctx.shapes ?? null,
    csvHref: csvPath(ctx.meta.fy, STATES_CSV),
    // The state HRRP-01 leaves out, when the file has none of its hospitals (hatched).
    notInProgram: inFile.has(NOT_IN_PROGRAM_STATE) ? null : NOT_IN_PROGRAM_STATE,
  };
}
