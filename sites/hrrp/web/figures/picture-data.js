// The numbers behind the program page's "The FY2027 picture" Part, as plain data (no markup): the lede's three counts, the largest-penalties
// table and the five figures, drawn by figures/picture.js and picture-draw.js; each figure's data is a
// pure function returning its items or rows, its takeaway as data and its figure-table rows. Shares are fractions (0-1) unless
// a name says percent (cuts, avgCut, share and vsNation in typeDots, and cut sizes are in percent); "cut" is a payment
// reduction above zero; "measured" means measured on at least one condition (only those can be cut). Each function's header
// names the denominator of every share it returns. Pure.
import { CAP, CAP_PCT, CONDS, PEERS, contrib, isMeasured, peerMedian } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL, bedBand } from '../../../../engine/js/hrrp/filters.js';
import { measuredAny, summarize } from '../../../../engine/js/hrrp/summary.js';
import { clamp, median, percentileInc } from '../../../../engine/js/stats.js';
import { r2 } from '../../../../web/charts/svg.js';
import { GE_CUT_PCT } from '../constants.js';
import { csvPath } from '../links.js';
import { perStep } from './hospital-data.js';
import { statesOf } from './neighbors-data.js';
import { binIndex, byId, countBy, roundTo } from '../numbers.js';

// ---------- the lede ----------

// The fewest hospitals whose modeled dollars (pen) reach half of all hospitals' modeled dollars, largest first: their count, or
// null when no hospital has modeled dollars.
export function dollarHalf(hospitals) {
  const pens = hospitals.map((h) => h.pen ?? 0).filter((v) => v > 0).sort((a, b) => b - a);
  const total = pens.reduce((a, v) => a + v, 0);
  if (!total) return null;
  let sum = 0;
  for (let i = 0; i < pens.length; i++) {
    sum += pens[i];
    if (sum >= total / 2) return i + 1;
  }
  return pens.length;
}

// n: all hospitals; nMeasured: those measured on a condition; nCut: those cut (of the measured); medianCut: the median cut
// (percent) among the hospitals cut; nOnePlus and nCap: counts of hospitals (cut GE_CUT_PCT percent or more; at the cap);
// nHalf: dollarHalf's count (the Part's lede), or null.
export function pictureLede(hospitals) {
  const s = summarize(hospitals);
  return { n: s.n, nMeasured: s.nMeasured, nCut: s.nPen, medianCut: s.medianRedPen, nOnePlus: s.nGe1, nCap: s.nMax, onePlus: GE_CUT_PCT, cap: CAP_PCT, nHalf: dollarHalf(hospitals) };
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
  return [clamp(centre - half, 0, 1), clamp(centre + half, 0, 1)];
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
// none is measured), median (percent: the median cut over every hospital in the group, those with no cut and those measured on
// nothing included, as the old site's strip plot had it; null for an empty group) and reds (every hospital's cut, in percent: a dot
// on the strip each, as the old site plotted the full list). takeaway: the groups
// with a share, ordered by group: low (the least-cut group), min and max (shares over those groups) and others (the min and
// max over the groups but the lowest-dual one, group 1), or null with fewer than two such groups.
export function peerGroups(hospitals, meta) {
  const rows = PEERS.map((peer, i) => {
    const group = hospitals.filter((h) => h.peer === peer);
    const s = summarize(group);
    const reds = group.map((h) => h.red);
    const cutoff = meta.peerCutoffs?.[i];
    return { peer, lo: cutoff?.[0] ?? null, hi: cutoff?.[1] ?? null, n: group.length, nMeasured: s.nMeasured, nCut: s.nPen, shareCut: s.nMeasured ? s.nPen / s.nMeasured : null, median: reds.length ? median(reds) : null, reds };
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

// ---------- what did peer grouping change? ----------

// Shared rule for this section: a hospital's condition is "over" a line when err - line > 0 (strictly; a tie is not over), the
// rule of formula.js conditionContribution. Only measured conditions count (isMeasured); a condition whose peer median is null is
// skipped.
// For each peer group (PEERS order): lo, hi (CMS's dual-share cutoffs, null when missing), measured (hospital-conditions measured
// in the group with a peer median), now (over against the group's peer median: flags as graded), alone (over against the national
// median of this file's measured errs for that condition, one median for every hospital, so only the grouping changes), added (now and not alone: flags peer
// grouping puts on), removed (alone and not now: flags it takes off) and net (added - removed). national: { [cond]: median } of
// err over every hospital measured on it; this file's median, not CMS's (CMS's peer medians are not this file's medians), so words
// say "about". totals: { measured, added, removed, flips: added + removed } over all groups (the figure's words come from the rows and
// totals). Counts of hospital-conditions, no dollars. table: the rows.
export function peerFlips(hospitals, meta) {
  const national = {};
  for (const k of CONDS) {
    const errs = hospitals.filter((h) => isMeasured(h.c[k])).map((h) => h.c[k].err);
    if (errs.length) national[k] = median(errs);
  }
  const rows = PEERS.map((peer, i) => {
    const cutoff = meta.peerCutoffs?.[i];
    const row = { peer, lo: cutoff?.[0] ?? null, hi: cutoff?.[1] ?? null, measured: 0, now: 0, alone: 0, added: 0, removed: 0, net: 0 };
    const medians = Object.fromEntries(CONDS.map((k) => [k, peerMedian(meta, peer, k)]));
    for (const h of hospitals) {
      if (h.peer !== peer) continue;
      for (const k of CONDS) {
        const c = h.c[k];
        const med = medians[k];
        if (!isMeasured(c) || med == null) continue;
        const now = c.err - med > 0;
        const alone = c.err - national[k] > 0;
        row.measured += 1;
        if (now) row.now += 1;
        if (alone) row.alone += 1;
        if (now && !alone) row.added += 1;
        if (alone && !now) row.removed += 1;
      }
    }
    row.net = row.added - row.removed;
    return row;
  });
  const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
  const totals = { measured: sum('measured'), added: sum('added'), removed: sum('removed'), flips: sum('added') + sum('removed') };
  return { rows, totals, national, table: rows };
}

// Whether the program page draws each new figure (and Methods explains it): the same test in both places.
export const drawsFlips = (f) => f.totals.measured > 0;
export const drawsWorth = (w) => w.rows.some((r) => r.median !== null);
export const drawsBands = (b) => b.conditions.some((c) => c.first);
export const drawsPeers = (p) => p.rows.some((r) => r.nMeasured > 0);

// ---------- what is 0.01 of ratio worth? ----------

// For each condition (rows run from the largest median down; nulls last; ties in CONDS order): measured (hospitals measured on it),
// priced (those with a dollar value per 0.01 of ratio, $0 included: hospital-data.js perStep), blank (measured - priced: weight or
// base payment missing), capped (priced at $0 because the hospital's cut is at the cap) and p25, median, p75 (of the priced
// values, PERCENTILE.INC; null with none). Modeled dollars, not CMS's. takeaway: null with fewer than two rows with a median, else
// { hi (the first row), lo (the last row with a median), times (hi.median / lo.median) }. table: the rows.
export function dollarsPerStep(hospitals, meta) {
  const capped = new Map(hospitals.map((h) => [h, contrib(h, meta).sum > CAP]));
  const rows = CONDS.map((cond) => {
    const measured = hospitals.filter((h) => isMeasured(h.c[cond]));
    const vals = measured.map((h) => ({ h, v: perStep(h, cond, meta, capped.get(h)) })).filter((x) => x.v !== null);
    const sorted = vals.map((x) => x.v).sort((a, b) => a - b);
    const q = (p) => (sorted.length ? percentileInc(sorted, p) : null);
    return {
      cond, measured: measured.length, priced: sorted.length, blank: measured.length - sorted.length,
      capped: vals.filter((x) => capped.get(x.h)).length, p25: q(0.25), median: q(0.5), p75: q(0.75),
    };
  });
  rows.sort((a, b) => (b.median ?? -Infinity) - (a.median ?? -Infinity) || CONDS.indexOf(a.cond) - CONDS.indexOf(b.cond));
  const withMedian = rows.filter((r) => r.median !== null);
  return {
    rows,
    takeaway: withMedian.length > 1 ? { hi: rows[0], lo: withMedian[withMedian.length - 1], times: rows[0].median / withMedian[withMedian.length - 1].median } : null,
    table: rows,
  };
}

// ---------- are small hospitals let off? ----------

// Bands of a condition's eligible cases (c.n); a band holds lo..hi inclusive.
export const SIZE_BANDS = [
  { lo: 25, hi: 49, label: '25–49' }, { lo: 50, hi: 99, label: '50–99' }, { lo: 100, hi: 199, label: '100–199' },
  { lo: 200, hi: 399, label: '200–399' }, { lo: 400, hi: 799, label: '400–799' }, { lo: 800, hi: Infinity, label: '800+' },
];
// A band with fewer measured hospitals than this is not shown.
export const MIN_BAND = 20;

// For each condition (CONDS order): bands, one per SIZE_BANDS entry: label, lo, hi, n (hospitals measured on it in the band),
// over (of those, the count over their peer median: err - median > 0, strictly; a null median is skipped), share (over / n; null
// when n is 0), p25, median, p75 (of gap = err - peer median, PERCENTILE.INC, null when empty) and shown (n >= MIN_BAND).
// p25-p75 is the middle half of the hospitals as observed, not a confidence interval. first, last: the first and last shown
// bands (null if none). takeaway: { lower (conditions whose first shown band has a lower share over than the last), higher
// (the reverse), compared (how many conditions have two or more shown bands to compare) }. table: one row per condition and
// band, shown or not.
export function sizeBands(hospitals, meta) {
  const conditions = CONDS.map((cond) => {
    // Each measured hospital's gap, into its band, in one pass.
    const byBand = SIZE_BANDS.map(() => []);
    for (const h of hospitals) {
      const c = h.c[cond];
      const med = peerMedian(meta, h.peer, cond);
      if (!isMeasured(c) || med == null) continue;
      const i = SIZE_BANDS.findIndex((b) => c.n >= b.lo && c.n <= b.hi);
      if (i >= 0) byBand[i].push(roundTo(c.err - med, 6));
    }
    const bands = SIZE_BANDS.map((b, i) => {
      const gaps = byBand[i].sort((x, y) => x - y);
      const q = (p) => (gaps.length ? percentileInc(gaps, p) : null);
      const over = gaps.filter((g) => g > 0).length;
      return { label: b.label, lo: b.lo, hi: b.hi, n: gaps.length, over, share: gaps.length ? over / gaps.length : null, p25: q(0.25), median: q(0.5), p75: q(0.75), shown: gaps.length >= MIN_BAND };
    });
    const shown = bands.filter((b) => b.shown);
    return { cond, bands, first: shown[0] ?? null, last: shown[shown.length - 1] ?? null };
  });
  const multi = conditions.filter((r) => r.first && r.first !== r.last);
  const lower = multi.filter((r) => r.first.share < r.last.share).map((r) => r.cond);
  const higher = multi.filter((r) => r.first.share > r.last.share).map((r) => r.cond);
  return {
    conditions,
    takeaway: { lower, higher, compared: multi.length },
    table: conditions.flatMap((r) => r.bands.map((b) => ({ cond: r.cond, ...b }))),
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
    table: traits.flatMap((t) => t.groups.map((g) => ({ block: t.block, key: g.key, label: g.label, n: g.n, nMeasured: g.nMeasured, share: g.share }))),
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
    .map((h) => ({ h, states: statesOf(h, meta) }));
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
    flips: () => peerFlips(hospitals, meta),
    worth: () => dollarsPerStep(hospitals, meta),
    bands: () => sizeBands(hospitals, meta),
  };
}
