// The figures' drawings that the browser also makes (client/explore.js): one measure's panel of stacked dots, of the
// floor and cap, of the slide rule; the swarm of every hospital's score (and where its dots sit); and the scatter of
// a pair of measures. The build draws the first measure's panels and the default states into the page; the page script
// draws the rest from the explore asset, with these same functions. Kept apart from program-figures.js so the page
// scripts never carry the build's map code.
import { cmsText, count, decimal } from '../../../web/render/format.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { drawn } from '../../../web/charts/figure.js';
import { pullIn, stackedDots } from '../../../web/charts/measureDots.js';
import { slideRule } from '../../../web/charts/slideRule.js';
import { scoreSwarm, swarmLayout } from '../../../web/charts/scoreSwarm.js';
import { agreeScatter } from '../../../web/charts/agree.js';
import { MEASURE_IDS, isSir } from '../../../engine/js/hacrp/measures.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { SHORT_NAMES, SIR_EXPECTED, SIR_EXPECTED_TEXT } from './constants.js';
import { fill, t } from './explore/copy.js';
import { edgesAround } from './compare.js';

// The page's wide drawings, about the content width on a wide screen.
export const PAGE_WIDE = 1180;

// A step figure's wide drawing, about its column on a wide screen.
export const STEP_WIDE = 640;
const shortsOf = (ids) => ids.map((id) => SHORT_NAMES[id]);
export const setName = (ids) => shortsOf(ids).reduce((a, b) => fill('setJoin', { a, b }));
export const fmtOf = (id, model) => (v) => decimal(v, model.params[id].decimals);
// A step figure drawn twice, phone-narrow and at the step's width, as figure() takes them.
export const both = (draw) => drawn(draw, STEP_WIDE);

// Each measure's dot-plot axis: the SIRs from zero, PSI 90 around one; and the bins' width.
const STACK = { sir: { domain: [0, 3], step: 0.05 }, psi: { domain: [0.4, 2], step: 0.025 } };
export const PER = 10;
export const stackOf = (id) => STACK[isSir(id) ? 'sir' : 'psi'];
export const binCounts = (values, { domain: [lo, hi], step }) => {
  const counts = new Array(Math.round((hi - lo) / step)).fill(0);
  for (const v of values) if (v <= hi) counts[Math.min(counts.length - 1, Math.max(0, Math.floor((v - lo) / step + 1e-9)))] += 1;
  return counts;
};

// One measure's stacked dots: its panel (both drawings, its words). m: measureSummary(); rows: the plot's height in
// dots, shared by every measure. The browser calls it for a measure first picked there.
export function stackPanel(id, m, { rows }) {
  const p = m.params;
  const fmt = (v) => decimal(v, p.decimals);
  const { domain, step: binStep } = stackOf(id);
  const over = m.values.filter((v) => v > domain[1]).length;
  const sir = isSir(id);
  const one = SIR_EXPECTED_TEXT;
  const above = m.values.filter((v) => v > SIR_EXPECTED).length;
  const labels = {
    one: fill(sir ? 'fig2OneSir' : 'fig2OnePsi', { one }), median: fill('fig2Median', { median: fmt(m.median) }), per: fill('fig2Per', { per: count(PER) }),
    zero: sir && m.zero ? fill('fig2Zero', { zero: count(m.zero) }) : null, over: fill('fig2Over', { over: count(over), hi: decimal(domain[1], 1) }),
  };
  const tip = ({ from, to, count: c }) => fill('fig2Tip', { from: fmt(from), to: fmt(to), count: count(c) });
  const draw = (width) => stackedDots({ values: m.values, domain, step: binStep, per: PER, rows, refs: { one: SIR_EXPECTED, median: m.median }, labels, tip, format: (v) => decimal(v, 1), width });
  return { id, short: SHORT_NAMES[id], ...both(draw), alt: fill('fig2Alt', { short: SHORT_NAMES[id] }), take: stackTake(id, m) };
}
export const stackTake = (id, m) => (isSir(id)
  ? fill('fig2TakeSir', { zero: count(m.zero), n: count(m.n), short: SHORT_NAMES[id], median: decimal(m.median, m.params.decimals) })
  : fill('fig2TakePsi', { short: SHORT_NAMES[id], one: SIR_EXPECTED_TEXT, median: decimal(m.median, m.params.decimals), above: count(m.values.filter((v) => v > SIR_EXPECTED).length), n: count(m.n) }));

// One measure as reported and as scored: its panel. m: measureSummary().
export function pullPanel(id, m) {
  const p = m.params;
  const fmt = (v) => decimal(v, p.decimals);
  const lo = Math.min(0, Math.floor(m.values[0] * 10) / 10);
  // The axis stops at a few times the cap (a lone far value would crush the rest); values past it sit at the edge.
  const hi = Math.min(Math.ceil(m.values[m.values.length - 1]), Math.max(2, Math.ceil(p.cap * 2.5)));
  const pulled = m.atCap + (p.floor > 0 ? m.atFloor : 0);
  const labels = { reported: t('fig3Reported'), scored: t('fig3Scored'), floor: fill('fig3Floor', { value: fmt(p.floor) }), cap: fill('fig3Cap', { value: fmt(p.cap) }), pulled: fill('fig3Pulled', { n: count(pulled) }), beyond: (k) => fill('fig3Beyond', { n: count(k), hi: decimal(hi, 0) }) };
  const draw = (width) => pullIn({ values: m.values, floor: p.floor, cap: p.cap, domain: [lo, hi], labels, format: (v) => decimal(v, 0), width });
  return { id, short: SHORT_NAMES[id], ...both(draw), alt: fill('fig3Alt', { short: SHORT_NAMES[id] }), take: pullTake(id, m) };
}
export const pullTake = (id, m) => {
  const p = m.params;
  const fmt = (v) => decimal(v, p.decimals);
  return p.floor > 0
    ? fill('fig3TakeBoth', { cap: count(m.atCap), capValue: fmt(p.cap), short: SHORT_NAMES[id], floor: count(m.atFloor), floorValue: fmt(p.floor) })
    : fill('fig3TakeCap', { cap: count(m.atCap), capValue: fmt(p.cap), short: SHORT_NAMES[id] });
};

// One measure's slide rule: its panel (both drawings, its words, and data-slide's numbers for the page script). p:
// the measure's fitted values; median: its national median. The browser calls it for a measure first picked there.
export function slidePanel(id, m) {
  const p = m.params;
  const fmt = (v) => decimal(v, p.decimals);
  const sir = isSir(id);
  const lo = sir ? 0 : Math.floor((p.floor - 0.12) * 20) / 20;
  const hi = Math.ceil((p.cap + (p.cap - Math.max(lo, 0)) * 0.22) * 10) / 10;
  const vStep = sir ? (hi > 2 ? 0.5 : 0.25) : 0.1;
  const valueTicks = Array.from({ length: Math.floor((hi - lo) / vStep + 1e-9) + 1 }, (_, i) => Math.round((lo + i * vStep) * 1000) / 1000);
  const zTicks = [-2, -1, 0, 1, 2, 3].filter((z) => p.mean + z * p.sd >= lo && p.mean + z * p.sd <= hi);
  const labels = { value: t('fig4Value'), z: t('fig4Z'), mean: t('fig4Mean') };
  const tickFmt = (v) => decimal(v, sir ? 2 : 1);
  const draw = (width) => slideRule({ p, domain: [lo, hi], value: m.median, labels, format: fmt, tickFormat: tickFmt, zFormat: (z) => cmsText(decimal(z, 2)), zTickFormat: (z) => (z > 0 ? `+${z}` : cmsText(String(z))), width, valueTicks, zTicks });
  return { id, short: SHORT_NAMES[id], ...both(draw), alt: fill('fig4Alt', { short: SHORT_NAMES[id] }), take: slideTake(id, p), data: JSON.stringify({ floor: p.floor, cap: p.cap, mean: p.mean, sd: p.sd, lo, hi, dp: p.decimals, value: m.median }) };
}
export const slideTake = (id, p) => fill('fig4TakeOne', { short: SHORT_NAMES[id], mean: decimal(p.mean, p.decimals), sd: decimal(p.sd, p.decimals) });

// The swarm's bins: a twentieth of a point on a wide screen, a tenth on a phone, with CMS's line as an edge.
const SWARM = { wide: { bin: 0.05, pitch: 4.2, cols: 3 }, narrow: { bin: 0.1, pitch: 2.3, cols: 3 } };
export const swarmEdges = (scores, line, bin) => edgesAround(Math.min(...scores), Math.max(...scores), line, Math.round((Math.max(...scores) - Math.min(...scores)) / bin));
const LOUPE = { from: -0.02, to: 0.02, step: 0.001 };

// The swarm's drawing for the browser and the build. items [{ score, yes, hl }]; hlOn: a group is lifted out.
export function swarmChart({ items, band, width, hlOn = false }) {
  const wide = width > WIDTH;
  const s = SWARM[wide ? 'wide' : 'narrow'];
  const edges = swarmEdges(items.map((i) => i.score), band[1], s.bin);
  const yes = items.filter((i) => i.yes).length;
  const labels = {
    below: fill('swarmBelow', { n: count(items.length - yes) }), above: fill('swarmAbove', { n: count(yes) }), loupe: t(wide ? 'swarmLoupe' : 'swarmLoupeShort'),
    highestNo: fill('swarmHighestNo', { score: cmsText(decimal(band[0], DP)) }), lowestYes: fill('swarmLowestYes', { score: cmsText(decimal(band[1], DP)) }),
  };
  const loupe = { from: band[1] + LOUPE.from, to: band[1] + LOUPE.to, step: LOUPE.step };
  return scoreSwarm({ items, edges, band, labels, width, pitch: s.pitch, cols: s.cols, loupe, place: wide ? 'inset' : 'below', hlOn, format: (v) => cmsText(decimal(v, 1)) });
}
export const SWARM_WIDE = PAGE_WIDE;
// Where each item's dot sits in swarmChart's drawing at that width (for the page script's pointer).
export function swarmPositions({ items, band, width, hlOn = false }) {
  const s = SWARM[width > WIDTH ? 'wide' : 'narrow'];
  const edges = swarmEdges(items.map((i) => i.score), band[1], s.bin);
  return { ...swarmLayout({ items, edges, width, pitch: s.pitch, cols: s.cols, top: 40, hlOn }), pitch: s.pitch };
}

// The agreement scatter's points for a pair, from programData rows (both values published).
export const pairPoints = (rows, a, b, valuesOf = (r) => r.values) => {
  const [i, j] = [MEASURE_IDS.indexOf(a), MEASURE_IDS.indexOf(b)];
  return rows.map(valuesOf).filter((v) => v[i] !== null && v[j] !== null).map((v) => [v[i], v[j]]);
};
export const AGREE_MAX = 3;
// The scatter's one drawing: about its column's width beside the grid, and a phone's.
export const SCATTER_W = 360;
export function agreeScatterOf(points, a, b, width) {
  return agreeScatter({ points, max: AGREE_MAX, labels: { x: fill('agreeScatterX', { short: SHORT_NAMES[a] }), y: fill('agreeScatterY', { short: SHORT_NAMES[b] }) }, width, format: (v) => decimal(v, 1) });
}

