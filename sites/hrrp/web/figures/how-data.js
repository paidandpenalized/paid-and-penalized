// The numbers behind the program page's "How it works" Part, as plain data (no markup, no words): Step 1's sets of
// measured conditions, Step 2's ratio-minus-median dots, Step 3's one-point bins of the dual share and Step 4's peer
// medians, Step 5's worksheet rows (worksheet.js), and the two callouts' facts. Pure; figures/how.js draws and words them.
import { CONDS, PEERS, isMeasured, peerMedian } from '../../../../engine/js/hrrp/formula.js';
import { exampleHospital, withDerived } from '../derive.js';
import { ROUND_COUNT_TO } from '../constants.js';
import { binIndex, byId, roundTo } from '../numbers.js';
import { worksheetRows } from '../worksheet.js';

// ---------- Step 1: which conditions each hospital is measured on ----------

// The hospitals grouped by the set of conditions they are measured on (isMeasured: at least 25 cases and a published
// ratio), the largest set first (ties: the set that comes first in CONDS order). Hospitals measured on none are counted
// apart, so the sets' sizes add up to the hospitals with any measured condition. yes: how many in the set take a cut.
// rows: how many hospitals are measured on each condition.
export function condSets(hospitals) {
  const sets = new Map();
  const rows = Object.fromEntries(CONDS.map((k) => [k, 0]));
  let none = 0;
  for (const h of hospitals) {
    const conds = CONDS.filter((k) => isMeasured(h.c[k]));
    for (const k of conds) rows[k] += 1;
    if (!conds.length) {
      none += 1;
      continue;
    }
    const key = conds.join(',');
    const set = sets.get(key) ?? { conds, n: 0, yes: 0 };
    set.n += 1;
    if (h.red > 0) set.yes += 1;
    sets.set(key, set);
  }
  const list = [...sets.values()].sort((a, b) => b.n - a.n || CONDS.indexOf(a.conds[0]) - CONDS.indexOf(b.conds[0]) || byId(a.conds.join(), b.conds.join()));
  return { sets: list, none, rows, measured: list.reduce((s, c) => s + c.n, 0), yes: list.reduce((s, c) => s + c.yes, 0) };
}

// ---------- Step 2: every measured hospital's ratio minus its peer group's median ----------

// The magnifier's band around zero: ratios within this much of the median.
export const BAND = 0.01;
// The figure table's bins are this wide; a bin holds (lo, hi], so a ratio exactly at its median falls in the bin that ends at 0.
export const SWARM_BIN = 0.05;

// The condition switches' order: heart failure first (the one on when the page opens), then the rest as the program lists them.
export const SWARM_ORDER = ['HF', ...CONDS.filter((k) => k !== 'HF')];

// The example hospital's CCN: the hospital Worksheet R uses (derive.js exampleHospital, over the rows with their derived fields).
export const exampleIdOf = (hospitals, meta) => exampleHospital(hospitals.map((h) => withDerived(h, meta))).id;

// What the swarm for one condition plots, undrawn: one item for each hospital measured on cond, d = its ratio minus the
// median CMS set for the hospital's own peer group (rounded to 6 decimals, the data's precision), flag (CMS counted the
// condition), peer and whether it is the example hospital. over: d above zero; atOrUnder: d at or below it. band: the
// items within BAND of zero (the magnifier's count), split the same way. conds: the six switches, on for cond.
// table: the figure's rows, d binned (SWARM_BIN wide, lo exclusive, hi inclusive) so the table holds a few dozen rows, not
// one for each hospital: { lo, hi, n, flagged }, the empty bins left out.
export function swarmData(hospitals, meta, cond, exampleId = exampleIdOf(hospitals, meta)) {
  const items = [];
  for (const h of hospitals) {
    const c = h.c[cond];
    if (!isMeasured(c)) continue;
    const med = peerMedian(meta, h.peer, cond);
    if (med == null) continue;
    items.push({ id: h.id, d: roundTo(c.err - med, 6), flag: c.flag === 1, peer: h.peer, example: h.id === exampleId });
  }
  const over = items.filter((i) => i.d > 0).length;
  const near = items.filter((i) => Math.abs(i.d) <= BAND);
  const bins = new Map();
  for (const i of items) {
    const k = Math.ceil(roundTo(i.d / SWARM_BIN, 9)) - 1;
    const b = bins.get(k) ?? { lo: roundTo(k * SWARM_BIN, 2), hi: roundTo((k + 1) * SWARM_BIN, 2), n: 0, flagged: 0 };
    b.n += 1;
    if (i.flag) b.flagged += 1;
    bins.set(k, b);
  }
  return {
    cond,
    items,
    over,
    atOrUnder: items.length - over,
    band: { half: BAND, n: near.length, over: near.filter((i) => i.d > 0).length, atOrUnder: near.filter((i) => i.d <= 0).length },
    conds: SWARM_ORDER.map((key) => ({ key, on: key === cond })),
    exampleId,
    table: [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b),
  };
}

// ---------- Step 3: the dual share in one-point bins, and the five peer groups ----------

// The hospitals' dual share (a fraction) in bins one percentage point wide from zero to the top of the data rounded up to
// a multiple of five points; the empty bins stay (the figure draws the others). bands: each group's span of the axis. bins: [{ x0, x1, n }] in points. groups: each
// peer group's CMS cutoffs (meta.peerCutoffs, fractions) and how many hospitals CMS put in it. ticks: the groups'
// upper cutoffs but the last, in points, where one group ends and the next begins.
export function dualBins(hospitals, cutoffs) {
  const duals = hospitals.map((h) => h.dual).filter((d) => d != null);
  const top = Math.max(5, Math.ceil((Math.max(...duals) * 100 - 1e-9) / 5) * 5);
  const bins = Array.from({ length: top }, (_, i) => ({ x0: i, x1: i + 1, n: 0 }));
  for (const d of duals) bins[Math.min(top - 1, binIndex(d * 100, 0, 1))].n += 1;
  const groups = PEERS.map((peer, i) => ({ peer, lo: cutoffs[i][0], hi: cutoffs[i][1], n: hospitals.filter((h) => h.peer === peer).length }));
  const ticks = groups.slice(0, -1).map((g) => roundTo(g.hi * 100, 2));
  // The groups' bands across the axis: from zero to the first cutoff, between cutoffs, and from the last to the axis's end.
  const edges = [0, ...ticks, top];
  const bands = groups.map((g, i) => ({ peer: g.peer, x0: edges[i], x1: edges[i + 1] }));
  return { bins, top, groups, n: duals.length, ticks, bands };
}

// ---------- Step 4: the peer-group medians ----------

// The five peer groups' medians for the six conditions, in the data's order: [{ peer, lo, hi, cells: [{ cond, value }] }].
// value is null where CMS set no median.
export const mediansRows = (meta) => PEERS.map((peer, i) => ({
  peer,
  lo: meta.peerCutoffs[i][0],
  hi: meta.peerCutoffs[i][1],
  cells: CONDS.map((cond) => ({ cond, value: peerMedian(meta, peer, cond) })),
}));

// The lowest and highest median over every group and condition. rows: mediansRows().
export function medianSpan(rows) {
  const values = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v != null);
  return { lo: Math.min(...values), hi: Math.max(...values) };
}

// ---------- the callouts ----------

// The hospital count rounded to the nearest hundred ("about 2,900").
export const roundedCount = (n) => Math.round(n / ROUND_COUNT_TO) * ROUND_COUNT_TO;

// "New for <FY>": the notes, only when they are for this fiscal year (whatsNewFy is the year the content file names).
export const newFor = ({ whatsNew, whatsNewFy, fy }) => (whatsNew?.length && whatsNewFy === fy ? whatsNew : null);

// The Part's data from the area context (view.js areaContext).
export function howData(ctx) {
  const { hospitals, meta } = ctx;
  const exampleId = exampleIdOf(hospitals, meta);
  const example = hospitals.find((h) => h.id === exampleId);
  const medians = mediansRows(meta);
  return {
    exampleId,
    // Step 5's Worksheet R for the example hospital, the one Step 2 marks; payShort is the dollars line's payment year.
    worksheet: worksheetRows(withDerived(example, meta), meta),
    payShort: ctx.edition.payShort,
    // Step 2's swarm for a condition, undrawn: the example is found once for the page, not for each condition.
    swarm: (cond) => swarmData(hospitals, meta, cond, exampleId),
    sets: condSets(hospitals),
    dual: dualBins(hospitals, meta.peerCutoffs),
    medians,
    span: medianSpan(medians),
    n: hospitals.length,
    rounded: roundedCount(hospitals.length),
    newFor: newFor({ whatsNew: ctx.whatsNew, whatsNewFy: ctx.whatsNewFy, fy: meta.fy }),
    conditions: ctx.edition.conditions,
  };
}
