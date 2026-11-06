// The numbers behind a place page's figures (a region, a division, a state or a metro area), as plain data (no markup), after
// Thirty Day Readmissions' state page: the hospitals on the map (each dot's shade by its cut and size by Medicare volume), the
// size of the cuts against all hospitals, which conditions drive the penalties here, the peer groups and the average cut over
// time. The nation's side of each comparison is computed once for a build (nationalSide); a place computes its own. Shares are
// fractions (0-1) unless a name says percent (cuts and averages are percent). "Measured" means measured on at least one
// condition; the like-for-like caution on the conditions is in the figure's words. Pure.
import { CAP_PCT, CONDS, PEERS } from '../../../../engine/js/hrrp/formula.js';
import { mean } from '../../../../engine/js/stats.js';
import { r2 } from '../../../../web/charts/svg.js';
import { PLACE_CUT_BIN, PLACE_DENSE, PLACE_SHADES, PLACE_SIZES, PLACE_ZERO_WIDTH } from '../constants.js';
import { meanCutByYear, pafByYear } from '../derive.js';
import { binIndex } from '../numbers.js';
import { volumeTier, volumeTop } from './map-data.js';
import { pairedBars } from './picture-data.js';

const BINS = Math.round(CAP_PCT / PLACE_CUT_BIN);
const NEAR_DEGREES = 1;

// ---------- the nation's side, once ----------

// hospitals: the file's rows; ctx: the area context's pieces (meta, history). The nation's cuts by bin (cutCounts), its share
// penalized on each condition, its average cut by year (the same hospitals as a place's line: every hospital in the program)
// and the base payment its dots are sized against.
export function nationalSide({ hospitals, meta, history }) {
  const rows = pairedBars(hospitals, meta).rows;
  const pafs = pafByYear({ history, meta });
  return {
    pafs,
    cuts: cutCounts(hospitals.map((h) => h.red)),
    conditionShares: new Map(rows.map((r) => [r.cond, r.shareFlagged])),
    avgCut: meanCutByYear(hospitals, [...history.years, meta.fy], pafs),
    volumeTop: volumeTop(hospitals),
  };
}

// ---------- the size of the cuts ----------

// The histogram's edges (percent): the "no cut" pile just before the scale's zero, then bins up to the cap.
export const cutEdges = () => [-PLACE_ZERO_WIDTH, 0, ...Array.from({ length: BINS }, (_, i) => r2((i + 1) * PLACE_CUT_BIN))];

// Counts for each of cutEdges()'s bins: the hospitals with no cut, then those cut by bin (the last bin holds the cap).
export function cutCounts(reds) {
  const counts = new Array(BINS + 1).fill(0);
  for (const red of reds) counts[red > 0 ? 1 + Math.min(BINS - 1, Math.max(0, binIndex(red, 0, PLACE_CUT_BIN))) : 0] += 1;
  return counts;
}

// n: hospitals; nNone: those with no cut (measured or not: the share is over all of them, as the old site had it); avg: their
// average cut (percent); counts: cutCounts; nationNone: the nation's share with no cut; rows: the table's rows { from, to, n, share,
// nationShare } (the pile has from null).
export function sizeData(list, side) {
  const counts = cutCounts(list.map((h) => h.red));
  const edges = cutEdges();
  const nation = side.cuts;
  const total = (c) => c.reduce((a, b) => a + b, 0) || 1;
  return {
    n: list.length,
    nNone: counts[0],
    avg: list.length ? mean(list.map((h) => h.red)) : 0,
    counts,
    edges,
    nation,
    nationNone: nation[0] / total(nation),
    rows: counts.map((n, i) => ({ from: i === 0 ? null : edges[i], to: i === 0 ? null : edges[i + 1], n, share: n / total(counts), nationShare: nation[i] / total(nation) })),
  };
}

// ---------- which conditions drive the penalties here ----------

// conditions' rows in the data's order, each { cond, measured, flags, share (of those measured; null with none), nationShare,
// dollars, shareOfDollars (null without dollars) }; measuredAny: some condition has a measured hospital; dollars: the total
// modeled dollars the conditions split (0: none); byDollars: the rows with dollars, largest share first.
export function conditionsData(list, meta, side) {
  const b = pairedBars(list, meta);
  const byCond = new Map(b.rows.map((r) => [r.cond, r]));
  const rows = CONDS.map((k) => {
    const r = byCond.get(k);
    return { cond: k, measured: r.measured, flags: r.flags, share: r.shareFlagged, nationShare: side.conditionShares.get(k) ?? null, dollars: r.dollars, shareOfDollars: r.shareOfDollars };
  });
  return {
    rows,
    measuredAny: rows.some((r) => r.measured > 0),
    dollars: b.totalDollars,
    byDollars: b.totalDollars > 0 ? [...rows].sort((a, c) => c.shareOfDollars - a.shareOfDollars || CONDS.indexOf(a.cond) - CONDS.indexOf(c.cond)) : [],
  };
}

// ---------- peer groups ----------

// A row for each of the five groups: n hospitals here and their average cut (percent; null with none).
export function peersData(list) {
  const rows = PEERS.map((peer) => {
    const group = list.filter((h) => h.peer === peer);
    return { peer, n: group.length, avg: group.length ? mean(group.map((h) => h.red)) : null };
  });
  const top = rows.reduce((a, r) => (r.n > a.n ? r : a), rows[0]);
  return { rows, top: top.n ? top : null };
}

// ---------- average cut over time ----------

// One row for each year: the average cut of the place's hospitals that are in that year's file and of every hospital in the
// program, in the same file (null: none of them is in it). ctx: the area context (history, meta, avgCut from nationalSide, lines).
export function trendData(list, ctx) {
  const { history, meta } = ctx;
  const fys = [...history.years, meta.fy];
  const here = meanCutByYear(list, fys, ctx.side.pafs);
  return {
    years: fys.map((fy, i) => ({ fy, here: here[i], all: ctx.side.avgCut[i] })),
    caps: ctx.lines.caps.slice(1),
    covid: ctx.lines.covid,
  };
}

// ---------- the map ----------

// A hospital's cut shade 0..PLACE_SHADES.length + 1: 0 no cut, then one for each range the thresholds make.
export const shadeOf = (red) => (red > 0 ? 1 + PLACE_SHADES.filter((t) => red >= t).length : 0);

// A hospital's dot size step 1..PLACE_SIZES from its base payments, against the nation's top.
export const sizeOf = (h, top) => volumeTier(h, top, PLACE_SIZES);

// The place's map points (hospitals with a location), each { h, shade, size }, and what the map draws around them: the
// place's own, and for a metro area the other hospitals in the states it reaches (faint). dense: a hospital count over PLACE_DENSE.
export function mapData(place, ctx) {
  const placed = (list) => list.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
  const top = ctx.side.volumeTop;
  const own = placed(place.hospitals).map((h) => ({ h, shade: shadeOf(h.red), size: sizeOf(h, top) }));
  const ids = new Set(place.hospitals.map((h) => h.id));
  // Others only near the metro (within about a degree of its hospitals): the map's frame is fitted around them, and a dot far outside
  // it would only add markup.
  const lons = own.map((p) => p.h.lon);
  const lats = own.map((p) => p.h.lat);
  const [west, east, south, north] = [Math.min(...lons) - NEAR_DEGREES, Math.max(...lons) + NEAR_DEGREES, Math.min(...lats) - NEAR_DEGREES, Math.max(...lats) + NEAR_DEGREES];
  const near = (h) => h.lon >= west && h.lon <= east && h.lat >= south && h.lat <= north;
  const around = place.kind === 'metro' && own.length
    ? placed(place.states.flatMap((code) => ctx.places.byKey.get(`state:${code.toLowerCase()}`)?.hospitals ?? [])).filter((h) => !ids.has(h.id) && near(h)).map((h) => ({ h, shade: -1, size: sizeOf(h, top) }))
    : [];
  // The tallies the table and the legend share: hospitals here at each shade (index 0..PLACE_SHADES.length + 1).
  const tally = new Array(PLACE_SHADES.length + 2).fill(0);
  for (const p of own) tally[p.shade] += 1;
  return { own, around, tally, dense: own.length + around.length > PLACE_DENSE, unplaced: place.hospitals.length - own.length };
}
