// The numbers behind the program page's "The FY2027 picture" Part, as plain data (no markup): the lede's three counts, the largest-penalties
// table and the five figures, drawn by figures/picture.js and picture-draw.js; each figure's data is a
// pure function returning its items or rows, its takeaway as data and its figure-table rows. Shares are fractions (0-1) unless
// a name says percent (cuts, avgCut, share and vsNation in typeDots, and cut sizes are in percent); "cut" is a payment
// reduction above zero; "measured" means measured on at least one condition (only those can be cut). Each function's header
// names the denominator of every share it returns. Pure.
import { CAP_PCT, CONDS, PEERS, condState, contrib, isMeasured } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL, bedBand } from '../../../../engine/js/hrrp/filters.js';
import { measuredAny, summarize } from '../../../../engine/js/hrrp/summary.js';
import { median } from '../../../../engine/js/stats.js';
import { r2 } from '../../../../web/charts/svg.js';
import { GE_CUT_PCT } from '../constants.js';
import { csvPath } from '../links.js';
import { binIndex, byId, countBy } from '../numbers.js';

// ---------- the lede ----------

// n: all hospitals; nMeasured: those measured on a condition; nCut: those cut (of the measured); medianCut: the median cut
// (percent) among the hospitals cut; nOnePlus and nCap: counts of hospitals (cut GE_CUT_PCT percent or more; at the cap).
export function pictureLede(hospitals) {
  const s = summarize(hospitals);
  return { n: s.n, nMeasured: s.nMeasured, nCut: s.nPen, medianCut: s.medianRedPen, nOnePlus: s.nGe1, nCap: s.nMax, onePlus: GE_CUT_PCT, cap: CAP_PCT };
}

// ---------- the size of the cuts  ----------

// A cut's bins are this wide (percentage points); a bin holds [lo, hi), the last one holds the cap too.
export const CUT_BIN = 0.25;
const CUT_BINS = CAP_PCT / CUT_BIN;
const binOf = (red) => Math.min(binIndex(red, 0, CUT_BIN), CUT_BINS - 1);
// The bins of the cuts above zero: [{ lo, hi, n }], the empty ones left out.
function cutBins(reds) {
  return [...countBy(reds.filter((red) => red > 0), binOf).entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => ({ lo: r2(i * CUT_BIN), hi: r2((i + 1) * CUT_BIN), n }));
}

// One item for each hospital (red: its cut in percent, cut: above zero, measured: measured on at least one condition; a
// hospital measured on nothing cannot be cut and is not part of the picture's denominator). The zero pile is split:
// zeroMeasured (measured, not cut) and zeroUnmeasured (measured on nothing); zero is both. table: a row with lo = hi = 0 for
// each part of the pile (measured: true/false), then the bins of the cuts above it (percent). takeaway: the numbers its
// sentence uses, over the measured (nMeasured) hospitals.
export function sizeSwarm(hospitals, lede = pictureLede(hospitals)) {
  const items = hospitals.map((h) => ({ id: h.id, red: h.red, peer: h.peer, cut: h.red > 0, measured: measuredAny(h) }));
  const zeroMeasured = items.filter((i) => !i.cut && i.measured).length;
  const zeroUnmeasured = items.filter((i) => !i.cut && !i.measured).length;
  return {
    items,
    zero: zeroMeasured + zeroUnmeasured,
    zeroMeasured,
    zeroUnmeasured,
    table: [
      { lo: 0, hi: 0, n: zeroMeasured, measured: true },
      ...(zeroUnmeasured ? [{ lo: 0, hi: 0, n: zeroUnmeasured, measured: false }] : []),
      ...cutBins(hospitals.map((h) => h.red)),
    ],
    takeaway: { median: lede.medianCut, nOnePlus: lede.nOnePlus, onePlus: lede.onePlus, cap: lede.cap, nCut: lede.nCut, zero: zeroMeasured, nMeasured: lede.nMeasured, n: lede.n, nCap: lede.nCap },
  };
}

// ---------- more conditions measured (CF-11) ----------

// The 95% Wilson score interval for a share of n (z = 1.96), as fractions; null for an empty group.
export function wilson(nCut, n, z = 1.96) {
  if (!n) return null;
  const p = nCut / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

// For each k = 1..6 the hospitals measured on exactly k conditions (so every share is over measured hospitals, none over
// hospitals measured on nothing): n, nCut, share (a fraction: nCut / n; null for an empty group) and interval ([lo, hi], the
// 95% Wilson interval of that share). A group with no hospital has no share and no interval; the figure leaves its row out.
// The words never claim the conditions are independent and say nothing of chance: they report the shares.
export function moreConditions(hospitals) {
  const measuredCount = hospitals.map((h) => CONDS.filter((c) => isMeasured(h.c[c])).length);
  const rows = CONDS.map((_, i) => {
    const k = i + 1;
    const group = hospitals.filter((_h, j) => measuredCount[j] === k);
    const nCut = group.filter((h) => h.red > 0).length;
    return { k, n: group.length, nCut, share: group.length ? nCut / group.length : null, interval: wilson(nCut, group.length) };
  });
  const filled = rows.filter((r) => r.n > 0);
  return {
    rows,
    table: filled.map((r) => ({ k: r.k, n: r.n, nCut: r.nCut, share: r.share, interval: r.interval })),
    // first, last: the fewest-conditions and most-conditions groups that hold a hospital; one group alone has no "last".
    takeaway: filled.length ? { first: filled[0], last: filled.length > 1 ? filled[filled.length - 1] : null } : null,
  };
}

// ---------- which conditions cost the most (PB-02) ----------

// For each condition: measured (hospitals measured on it), flags (CMS flagged it), shareFlagged (flags / measured on that
// condition), shareOfFlags (its share of all flags; adds to one), dollars (the modeled penalty dollars it adds: each cut
// hospital's dollars split by its conditions' parts of the cut; hospitals without a dollar estimate leave out), shareOfDollars (over those dollars; adds to one) and dollarsPerFlag (null without a flag). Rows
// run from the largest share of dollars down (ties: program order).
export function pairedBars(hospitals, meta) {
  const dollars = Object.fromEntries(CONDS.map((k) => [k, 0]));
  for (const h of hospitals) {
    if (h.pen == null || !(h.red > 0)) continue;
    const { byCond, sum } = contrib(h, meta);
    if (sum > 0) for (const k of CONDS) dollars[k] += (h.pen * byCond[k]) / sum;
  }
  const totalDollars = CONDS.reduce((s, k) => s + dollars[k], 0);
  const raw = CONDS.map((k) => {
    const measured = hospitals.filter((h) => isMeasured(h.c[k]));
    return { cond: k, measured: measured.length, flags: measured.filter((h) => h.c[k].flag === 1).length, dollars: dollars[k] };
  });
  const totalFlags = raw.reduce((s, r) => s + r.flags, 0);
  const rows = raw.map((r) => ({
    ...r,
    shareFlagged: r.measured ? r.flags / r.measured : null,
    shareOfFlags: totalFlags ? r.flags / totalFlags : null,
    shareOfDollars: totalDollars ? r.dollars / totalDollars : null,
    dollarsPerFlag: r.flags ? r.dollars / r.flags : null,
  }));
  rows.sort((a, b) => b.shareOfDollars - a.shareOfDollars || CONDS.indexOf(a.cond) - CONDS.indexOf(b.cond));
  // The pair the figure draws is shareOfFlags against shareOfDollars (both add to one, so like is compared with like; each
  // condition flags about half its own measured hospitals by construction, so shareFlagged is no finding). takeaway: the
  // condition whose dollar share runs furthest above its flag share (up) and the one furthest below (down); null when there
  // are no flags or no dollars, and each side null when no condition lies on it.
  const gap = (r) => r.shareOfDollars - r.shareOfFlags;
  const up = rows.filter((r) => gap(r) > 0).sort((a, b) => gap(b) - gap(a))[0] ?? null;
  const down = rows.filter((r) => gap(r) < 0).sort((a, b) => gap(a) - gap(b))[0] ?? null;
  return {
    rows, totalDollars, totalFlags, takeaway: totalFlags && totalDollars ? { up, down } : null,
    table: rows.map((r) => ({ cond: r.cond, measured: r.measured, flags: r.flags, shareOfFlags: r.shareOfFlags, dollars: r.dollars, shareOfDollars: r.shareOfDollars })),
  };
}

// ---------- penalties by peer group (the old site's strip plot) ----------

// A row for each of the five peer groups: lo, hi (CMS's cutoffs of the dual share, fractions; null when the edition lists none),
// n (hospitals in it), nMeasured (those measured on a condition), nCut, shareCut (a fraction: nCut / nMeasured, not / n; null when
// none is measured), median (percent, among the hospitals cut; null without one) and reds (the cuts, in percent, of the
// measured hospitals: each is a dot on the strip, the unmeasured ones, which cannot be cut, are left out). takeaway: the groups
// with a share, ordered by group: low (the least-cut group), min and max (shares over those groups) and others (the min and
// max over the groups but the lowest-dual one, group 1), or null with fewer than two such groups.
export function peerGroups(hospitals, meta) {
  const rows = PEERS.map((peer, i) => {
    const group = hospitals.filter((h) => h.peer === peer);
    const s = summarize(group);
    const reds = group.filter((h) => measuredAny(h)).map((h) => h.red);
    const cuts = reds.filter((r) => r > 0);
    const cutoff = meta.peerCutoffs?.[i];
    return { peer, lo: cutoff?.[0] ?? null, hi: cutoff?.[1] ?? null, n: group.length, nMeasured: s.nMeasured, nCut: s.nPen, shareCut: s.nMeasured ? s.nPen / s.nMeasured : null, median: cuts.length ? median(cuts) : null, reds };
  });
  const withShare = rows.filter((r) => r.shareCut !== null);
  const shares = (list) => list.map((r) => r.shareCut);
  const rest = withShare.filter((r) => r.peer !== PEERS[0]);
  const low = withShare.length ? withShare.reduce((a, b) => (b.shareCut < a.shareCut ? b : a)) : null;
  return {
    rows,
    takeaway: withShare.length > 1 ? {
      low, min: Math.min(...shares(withShare)), max: Math.max(...shares(withShare)),
      others: rest.length ? { min: Math.min(...shares(rest)), max: Math.max(...shares(rest)) } : null,
      lowestDual: withShare.some((r) => r.peer === PEERS[0]),
    } : null,
    table: rows.map((r) => ({ peer: r.peer, lo: r.lo, hi: r.hi, n: r.n, nMeasured: r.nMeasured, shareCut: r.shareCut, median: r.median })),
  };
}

// ---------- type dots ----------

const OWNERSHIP = ['Nonprofit', 'For-profit', 'Government'];
const BLOCKS = [
  { block: 'teaching', keys: ['none', 'minor', 'major'], label: (k) => TEACH_LABEL[k], of: (h) => h.teach },
  { block: 'beds', keys: BED_BANDS, label: (k) => k, of: (h) => bedBand(h.beds) },
  { block: 'setting', keys: ['urban', 'rural'], label: (k) => k, of: (h) => (h.urban == null ? null : h.urban ? 'urban' : 'rural') },
  { block: 'ownership', keys: OWNERSHIP, label: (k) => k, of: (h) => h.own },
];

// Four blocks (teaching, bed bands, urban or rural, ownership), a row for each group of hospitals that has any measured
// ones: n, nMeasured, nCut, share (percent: nCut / nMeasured, not / n), avgCut (average cut in percent among those cut; null
// without one) and vsNation (share less the national share, in points). national: the same two numbers over every hospital.
export function typeDots(hospitals) {
  const nat = summarize(hospitals);
  const national = { share: nat.pctPen, avgCut: nat.meanRedPen };
  const blocks = BLOCKS.map(({ block, keys, label, of }) => ({
    block,
    rows: keys.map((key) => {
      const group = hospitals.filter((h) => of(h) === key);
      const s = summarize(group);
      return { key, label: label(key), n: group.length, nMeasured: s.nMeasured, nCut: s.nPen, share: s.pctPen, avgCut: s.nPen ? s.meanRedPen : null, vsNation: s.pctPen == null ? null : s.pctPen - national.share };
    }).filter((r) => r.nMeasured > 0),
  }));
  return { blocks, national, table: blocks.flatMap((b) => b.rows.map((r) => ({ block: b.block, key: r.key, n: r.n, share: r.share, avgCut: r.avgCut }))) };
}

// The traits' ranges for the type figure [TD-10]: for each block with at least two groups, the groups from the lowest share cut
// to the highest (lo, hi: the rows, with their share in percent), and spread (hi.share less lo.share, in points); the blocks
// run from the widest spread down (ties: block order). takeaway: the widest and the narrowest block, null with fewer than
// two blocks (then widest alone, or null with none).
export function typeSpread(hospitals) {
  const { blocks, national } = typeDots(hospitals);
  const traits = blocks
    .map((b, i) => {
      const groups = b.rows.filter((r) => r.share !== null);
      if (groups.length < 2) return null;
      const sorted = [...groups].sort((x, y) => x.share - y.share);
      const [lo, hi] = [sorted[0], sorted[sorted.length - 1]];
      return { block: b.block, order: i, groups, lo, hi, spread: hi.share - lo.share };
    })
    .filter(Boolean)
    .sort((a, b) => b.spread - a.spread || a.order - b.order);
  return {
    traits, national,
    takeaway: traits.length ? { widest: traits[0], narrowest: traits.length > 1 ? traits[traits.length - 1] : null } : null,
    table: traits.flatMap((t) => t.groups.map((g) => ({ block: t.block, label: g.label, n: g.n, nMeasured: g.nMeasured, share: g.share }))),
  };
}

// ---------- the largest penalties (drawn) ----------

export const LARGEST_N = 10;
export const LARGEST_CSV = 'largest-penalties';

// The hospitals with the largest cuts, LARGEST_N at most: by cut, then modeled dollars (none last), then CCN. Each: the
// hospital row (h) and states, each condition's state in program order (condState: counted, below, few or none).
export function largestPenalties(hospitals, meta, n = LARGEST_N) {
  const dollars = (h) => h.pen ?? -1;
  return hospitals.filter((h) => h.red > 0)
    .sort((a, b) => b.red - a.red || dollars(b) - dollars(a) || byId(a.id, b.id))
    .slice(0, n)
    .map((h) => {
      const { byCond } = contrib(h, meta);
      return { h, states: CONDS.map((k) => condState(h, k, meta, byCond)) };
    });
}

// ---------- the Part ----------

// ctx: the page's context (view.js areaContext, with edition). The lede and the table are drawn; the five figures hang
// off the result as functions, computed when asked.
export function pictureData(ctx) {
  const { hospitals, meta } = ctx;
  const lede = pictureLede(hospitals);
  return {
    lede,
    largest: largestPenalties(hospitals, meta),
    csvHref: csvPath(meta.fy, LARGEST_CSV),
    conditions: ctx.edition.conditions,
    size: () => sizeSwarm(hospitals, lede),
    measured: () => moreConditions(hospitals),
    bars: () => pairedBars(hospitals, meta),
    peers: () => peerGroups(hospitals, meta),
    types: () => typeSpread(hospitals),
  };
}
