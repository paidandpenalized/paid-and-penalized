// The numbers behind a hospital page's figures, as plain data (no markup): the rulers ("where the penalty came from") and the
// penalty history. What every hospital shares is built once for the build (hospitalContext in ../view.js): each peer group's
// distribution of ratios on each condition, and each year's cuts across the hospitals in that year's file. Pure.
import { r2 } from '../../../../web/charts/svg.js';
import { CAP, CAP_PCT, CONDS, condState, contrib, cutPct, isMeasured, peerMedian, weightPublished } from '../../../../engine/js/hrrp/formula.js';
import { HISTORY_MARKS } from '../constants.js';
import { fyLabel } from '../copy.js';
import { conditionShort, pafByYear } from '../derive.js';
import { points } from '../numbers.js';

// A ruler's columns, and the step its ends are rounded out to (a ruler spans its peer group's 1st to 99th percentile).
export const RULER_BINS = 40;
export const RULER_STEP = 0.05;
// A ratio's change that the "worth per" column prices.
export const PER_STEP = 0.01;

// Modeled dollars a hospital's penalty moves per PER_STEP of ratio on one condition: null when the condition is not measured, its
// payment weight is not published or the hospital has no base payment; 0 when capped (the cut is already at the cap, so another
// step changes nothing; capped = the hospital's contrib sum is strictly above CAP); else base x weight x NM x PER_STEP.
export function perStep(h, cond, meta, capped) {
  const c = h.c[cond];
  if (!isMeasured(c) || !weightPublished(c) || h.base == null) return null;
  return capped ? 0 : h.base * c.ratio * meta.nm * PER_STEP;
}

const snapDown = (v) => r2(Math.floor(v / RULER_STEP + 1e-9) * RULER_STEP);
const snapUp = (v) => r2(Math.ceil(v / RULER_STEP - 1e-9) * RULER_STEP);
const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

// Hospitals' values counted in RULER_BINS equal columns over [lo, hi]; a value past either end counts in the end column.
export function countBins(values, lo, hi) {
  const counts = new Array(RULER_BINS).fill(0);
  for (const v of values) counts[Math.min(RULER_BINS - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * RULER_BINS + 1e-9)))] += 1;
  return counts;
}

// Each peer group's ratios on each condition, once for a build: Map of "peer:condition" to { values (ascending; the hospitals
// measured on it), lo, hi (its 1st to 99th percentile rounded out to RULER_STEP and made to hold the median), counts }.
export function rulerScales(hospitals, meta) {
  const groups = new Map();
  for (const h of hospitals) {
    for (const k of CONDS) {
      if (!isMeasured(h.c[k])) continue;
      const key = `${h.peer}:${k}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(h.c[k].err);
    }
  }
  const scales = new Map();
  for (const [key, values] of groups) {
    values.sort((a, b) => a - b);
    const [peer, cond] = key.split(':');
    const med = peerMedian(meta, Number(peer), cond);
    let lo = snapDown(Math.min(quantile(values, 0.01), med ?? Infinity));
    let hi = snapUp(Math.max(quantile(values, 0.99), med ?? -Infinity));
    if (hi - lo < RULER_STEP) hi = r2(lo + RULER_STEP);
    scales.set(key, { values, lo, hi, counts: countBins(values, lo, hi) });
  }
  return scales;
}

// One ruler's axis for a hospital: the peer group's, widened (in steps) to hold the hospital's own ratio when it lies past the
// ends, with the columns counted again over the wider axis. A group with no measured hospital gets a span around its median.
function axisOf(scale, med, value) {
  if (!scale) {
    const lo = snapDown(med - 0.1);
    const hi = snapUp(med + 0.1);
    return { domain: [lo, hi], counts: new Array(RULER_BINS).fill(0) };
  }
  if (value === null || (value >= scale.lo && value <= scale.hi)) return { domain: [scale.lo, scale.hi], counts: scale.counts };
  const lo = Math.min(scale.lo, snapDown(value));
  const hi = Math.max(scale.hi, snapUp(value));
  return { domain: [lo, hi], counts: countBins(scale.values, lo, hi) };
}

// The rulers' rows for hospital h, one per condition in the data's order: { cond, short, n, measured, state, err (the ratio the
// ruler draws: a counted condition's only), published (CMS's ratio as its file prints it, under 25 cases too; null where CMS gives
// none), med, gap, over, part, weight, per (modeled dollars per PER_STEP of ratio, null where unknown), cut (this part of the
// modeled cut), domain, counts }.
// Also: top (the row that adds the most, null when none adds), sum (line 7), capped (past the cap), counted (conditions counted).
// ctx: hospitalContext()'s result.
export function rulersData(h, ctx) {
  const { meta, rulers: scales, edition } = ctx;
  const r = contrib(h, meta);
  const capped = r.sum > CAP;
  const priced = h.base != null && h.pen != null;
  const rows = CONDS.map((cond) => {
    const c = h.c[cond];
    const measured = isMeasured(c);
    const med = peerMedian(meta, h.peer, cond);
    const part = r.byCond[cond];
    const gap = measured && med != null ? c.err - med : null;
    const weight = measured && weightPublished(c);
    const axis = axisOf(scales.get(`${h.peer}:${cond}`), med, measured ? c.err : null);
    return {
      cond,
      short: conditionShort(edition.conditions, cond),
      n: c?.n ?? 0,
      measured,
      state: condState(h, cond, meta, r.byCond),
      err: measured ? c.err : null,
      published: c?.err ?? null,
      med,
      gap,
      over: gap !== null && gap > 0,
      part,
      weight: c?.ratio ?? null,
      // $0 once the cut is at the cap: another 0.01 of ratio changes nothing.
      per: perStep(h, cond, meta, capped),
      cut: measured && priced && weight ? (r.sum > 0 ? (h.pen * part) / r.sum : 0) : null,
      ...axis,
    };
  });
  // A part CMS's factor does not carry (it rounds to no cut) is not the one that "costs the most".
  const adding = h.paf < 1 ? rows.filter((row) => row.part > 0) : [];
  return {
    rows,
    top: adding.reduce((best, row) => (best === null || row.part > best.part ? row : best), null),
    sum: r.sum,
    capped,
    counted: rows.filter((row) => row.measured).length,
    anyOver: rows.some((row) => row.over),
    priced,
    // Only where the excess shows at two decimals; a smaller one already reads as the cap.
    capNote: capped && Number(points(r.sum, 2)) > CAP_PCT,
    capPoints: points(r.sum, 2),
  };
}

// ---------- the penalty history ----------

// Each year's cuts across the hospitals in that year's file, once for a build: [{ cuts (ascending, percent), zeros (how many are
// not cut) }] for the history's years and then the file's own.
export function yearRanks(hospitals, history, meta) {
  const years = [...history.years, meta.fy];
  const paf = pafByYear({ history, meta });
  return years.map((_, i) => {
    const cuts = hospitals.map((h) => paf(h, i)).filter((v) => v != null).map(cutPct).sort((a, b) => a - b);
    return { cuts, zeros: cuts.filter((c) => c <= 0).length };
  });
}

const lowerBound = (sorted, v) => {
  let [a, b] = [0, sorted.length];
  while (a < b) {
    const mid = (a + b) >> 1;
    if (sorted[mid] < v) a = mid + 1;
    else b = mid;
  }
  return a;
};

// One year of one hospital's history: { fy, label, cut (percent; null where the hospital is not in the file), avg (all hospitals),
// share (its place among the cuts of that year's file, 0 smallest to 1 largest, ties at their middle; null: not in the file), line
// (the share where the cuts start, null when none was cut), notCut (the share of the file not cut) }.
export function historyYears(h, ctx) {
  const { history, meta } = ctx;
  const paf = pafByYear({ history, meta });
  return [...history.years, meta.fy].map((fy, i) => {
    const base = { fy, label: fyLabel(fy), avg: ctx.avgCut[i], cut: null, share: null, line: null, notCut: null };
    const v = paf(h, i);
    const { cuts, zeros } = ctx.yearRanks[i];
    const n = cuts.length;
    if (!n) return base;
    const line = zeros === n ? null : zeros / n;
    if (v == null) return { ...base, line, notCut: zeros / n };
    const cut = cutPct(v);
    const below = lowerBound(cuts, cut);
    const ties = lowerBound(cuts, cut + 1e-9) - below;
    const share = n > 1 ? (below + (ties - 1) / 2) / (n - 1) : 0.5;
    return { ...base, cut, share: Math.min(1, Math.max(0, share)), line, notCut: zeros / n };
  });
}

// The history's figure data for h: the years, how many have data and how many cut, the cap steps and the pandemic years (the
// program page's), the year the measure changed. ctx.lines: smallLines()'s result.
export function historyData(h, ctx) {
  const years = historyYears(h, ctx);
  const withData = years.filter((y) => y.cut !== null);
  return {
    years,
    nWith: withData.length,
    nCut: withData.filter((y) => y.cut > 0).length,
    caps: ctx.lines.caps.slice(1),
    covid: ctx.lines.covid,
    measureAt: HISTORY_MARKS.find((m) => m.key === 'histMarkMa')?.fy ?? null,
    span: ctx.edition.span,
  };
}
