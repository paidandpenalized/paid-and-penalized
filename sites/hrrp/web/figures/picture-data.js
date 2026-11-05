// The numbers behind the program page's "The FY2027 picture" Part, as plain data (no markup): the lede's three counts and
// the largest-penalties table are drawn (figures/picture.js); the five figures below them are not drawn yet, so each is a
// pure function returning its items or rows, its takeaway as data and its figure-table rows. Shares are fractions (0-1) unless
// a name says percent (cuts, avgCut, share and vsNation in typeDots, and cut sizes are in percent); "cut" is a payment
// reduction above zero; "measured" means measured on at least one condition (only those can be cut). Each function's header
// names the denominator of every share it returns. Pure.
import { CAP_PCT, CONDS, condState, contrib, isMeasured } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL, bedBand } from '../../../../engine/js/hrrp/filters.js';
import { measuredAny, summarize } from '../../../../engine/js/hrrp/summary.js';
import { mean, median } from '../../../../engine/js/stats.js';
import { r2 } from '../../../../web/charts/svg.js';
import { noun } from '../../../../web/render/format.js';
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

// ---------- the size of the cuts (swarm, undrawn) ----------

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
    takeaway: { median: lede.medianCut, nCut: lede.nCut, zero: zeroMeasured, nMeasured: lede.nMeasured, n: lede.n, nCap: lede.nCap },
  };
}

// ---------- the coin-flip (undrawn) ----------

// The words the coin-flip may carry. The finding is a gap between what is observed and what a fair coin for each condition
// would give; the words say neither that conditions are independent nor that the whole gap is conditions moving together
// (for one or two conditions the gap is the flag rate itself). No digits: numbers arrive through placeholders.
export const COIN_WORDS = Object.freeze({
  coinLow: 'Of the hospitals measured on {measured}, {observed} take a cut; a fair coin for each condition would give {coin}. With so few conditions, the gap is mostly how often a single condition is flagged.',
  coinAll: 'Of the hospitals measured on all six, {observed} take a cut, against {coin} for a fair coin on each condition and {own} at the flag rates of those same hospitals.',
});

// "1 condition", "2 conditions": the {measured} placeholder of COIN_WORDS.coinLow.
export const coinMeasured = (k) => noun(k, 'condition');

const ks = CONDS.map((_, i) => i + 1);

// For each k = 1..6 the hospitals measured on exactly k conditions (so every share here is over measured hospitals, none over
// hospitals measured on nothing); shares are fractions: n, nCut, observed (share cut), anyFlag (share with a
// condition flagged), coin (1 - 0.5^k), own (the share expected if each condition were flagged at that group's own rate for it,
// 1 - the product of (1 - rate) over the hospital's measured conditions, averaged over the group; no claim that real flags
// behave that way). sixFlags: for the k = 6 group, hospitals by number of flags 0..6.
export function coinFlip(hospitals) {
  const measuredOf = hospitals.map((h) => ({ h, measured: CONDS.filter((c) => isMeasured(h.c[c])) }));
  const groups = ks.map((k) => measuredOf.filter((x) => x.measured.length === k));
  const rows = ks.map((k, i) => {
    const group = groups[i];
    const rate = Object.fromEntries(CONDS.map((c) => {
      const m = group.filter((x) => x.measured.includes(c));
      return [c, m.length ? m.filter((x) => x.h.c[c].flag === 1).length / m.length : 0];
    }));
    const own = group.length ? mean(group.map((x) => 1 - x.measured.reduce((p, c) => p * (1 - rate[c]), 1))) : null;
    const nCut = group.filter((x) => x.h.red > 0).length;
    const nFlag = group.filter((x) => x.measured.some((c) => x.h.c[c].flag === 1)).length;
    return { k, n: group.length, nCut, observed: group.length ? nCut / group.length : null, anyFlag: group.length ? nFlag / group.length : null, coin: 1 - 0.5 ** k, own };
  });
  const sixFlags = Array.from({ length: CONDS.length + 1 }, (_, flags) => ({ flags, n: groups[5].filter((x) => x.measured.filter((c) => x.h.c[c].flag === 1).length === flags).length }));
  return {
    rows,
    sixFlags,
    table: rows.map((r) => ({ k: r.k, n: r.n, nCut: r.nCut, observed: r.observed, coin: r.coin, own: r.own })),
    variants: [{ key: 'coinLow', ks: [1, 2] }, { key: 'coinAll', ks: [6] }],
  };
}

// ---------- paired bars (undrawn) ----------

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
  return { rows, totalDollars, totalFlags, table: rows.map((r) => ({ cond: r.cond, shareFlagged: r.shareFlagged, shareOfDollars: r.shareOfDollars })) };
}

// ---------- ridges by peer group (undrawn) ----------

// A row for each of the five peer groups: n (hospitals in it), nMeasured (those measured on a condition), nCut, shareCut
// (a fraction: nCut / nMeasured, not / n; null when none is measured), median (percent, among the hospitals cut; null
// without one) and bins (the cuts above zero, CUT_BIN wide).
export function ridges(hospitals) {
  const rows = [1, 2, 3, 4, 5].map((peer) => {
    const group = hospitals.filter((h) => h.peer === peer);
    const s = summarize(group);
    const reds = group.map((h) => h.red).filter((r) => r > 0);
    return { peer, n: group.length, nMeasured: s.nMeasured, nCut: s.nPen, shareCut: s.nMeasured ? s.nPen / s.nMeasured : null, median: reds.length ? median(reds) : null, bins: cutBins(reds) };
  });
  return { rows, table: rows.flatMap((g) => g.bins.map((b) => ({ peer: g.peer, ...b }))) };
}

// ---------- type dots (undrawn) ----------

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
    coin: () => coinFlip(hospitals),
    bars: () => pairedBars(hospitals, meta),
    ridges: () => ridges(hospitals),
    types: () => typeDots(hospitals),
  };
}
