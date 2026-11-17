// Step 5, exposed on both: in the words column, how many hospitals are exposed on both (a range, low case to high), the
// finding in one sentence, the corner's rule, the corner's dollars and where the page's hospital sits; beside it, Figure 5
// (H7's quadrant): each hospital step 1 draws that has a FY Medicare penalty estimate is a plain dot at the share of its
// patient revenue the case takes (across) and its readmissions and hospital-acquired condition penalties as a share of the
// same revenue (up), both on square-root scales; the corner past both cuts (constants.js BOTH_SHARE, BOTH_QUANTILE) is
// shaded, with its count; the hospitals step 1 draws with no penalty estimate sit in a hatched strip under the plot,
// placed across by their loss alone; the page's hospital is marked. Under them, "Exposed on both, by name": the corner's
// hospitals, collapsed by default, sorted by share lost. Shared by the build (the server draws the middle case at the
// default use rate, for step 4's own hospital) and the browser (client/both.js redraws from the page's state). Pure: no
// DOM, file or clock.
//
// Numbers: a hospital's loss in the middle case at the default use rate is the file's own (middle_lost, as step 4 and the
// hub's band print it); the low and high cases' are step 1's shares times its patient revenue. Every loss is linear in the
// use rate (the engine's lost = at risk × decline × use), so another rate multiplies them. Penalties are the file's
// FY hrrp and hac columns (the hub's estimates; zero or below, null outside the programs), summed and made positive.
import { dotsPath, spread } from '../../../../web/charts/dots.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { frame, hatchDefs, hatchFill, r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { caseShareTexts } from '../../../../web/medicaid/format.js';
import { estTag } from '../../../../web/render/components.js';
import { count, decimal, money, pct, pctExact, placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { SITE, hospitalPathOf } from '../../../../web/site.js';
import { BOTH_QUANTILE, BOTH_SHARE, DEFAULT_SCENARIO, NAMED_FIRST, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { scenTag } from './chain.js';
import { serverPick } from './hospital.js';
import { scenWord } from './ranges.js';
import { labelKit, overlap } from './labels.js';
import { DOT_RUN, axisTop, fitText, inGroup, placeAt } from './strips.js';

const MIDDLE = SCENARIOS.indexOf(DEFAULT_SCENARIO);
const caseWord = (k) => scenWord(SCENARIOS[k]).toLowerCase();

// ---------- the data ----------

// What the browser needs beyond the strips' rows: for each hospital step 1 draws that has a penalty estimate, its patient
// revenue, its penalties (positive dollars), whether /hospital/<ccn>/ exists and the file's middle-case loss.
const COLS = Object.freeze(['ccn', 'npr', 'pen', 'hub', 'mid']);

// The step's input, the same object in the build and (through JSON) in the browser. data: loadMedicaid()'s result; rows:
// hospitalRows(data); hubCcns: the CCNs with a hub page (data.js loadHubCcns).
export function bothInput(data, rows, hubCcns = new Set()) {
  const col = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  const out = [];
  for (const r of rows) {
    if (!r.share) continue;
    const row = data.hospitals.get(r.ccn);
    const hrrp = row[col.hrrp];
    const hac = row[col.hac];
    if (hrrp === null && hac === null) continue;
    out.push([r.ccn, row[col.net_patient_revenue], -((hrrp ?? 0) + (hac ?? 0)) + 0, hubCcns.has(r.ccn) ? 1 : 0, row[col.middle_lost]]);
  }
  return { fy: data.meta.fy, penaltyFy: data.meta.penaltyFy, top: axisTop(rows, data.params.use_max), cols: COLS, rows: out };
}

export function decodeBoth(asset) {
  if (!asset || asset.cols?.join() !== COLS.join() || !Array.isArray(asset.rows) || !(asset.top > 0) || !Number.isInteger(asset.fy) || !Number.isInteger(asset.penaltyFy)) {
    throw new TypeError('exposed-on-both asset: not what the build wrote');
  }
  return asset;
}

// The penalty share's cut: the sorted shares' entry at floor(q × (n − 1)) (constants.js BOTH_QUANTILE).
export const cutOf = (shares, q = BOTH_QUANTILE) => {
  const sorted = [...shares].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))];
};

// The step's model: pts, the plotted hospitals ({ ccn, name, city, state, cah, hub, npr, pen, y (penalty share), lost (by
// case at the default use rate) }); strip, step 1's hospitals with no penalty estimate ({ ccn, share, cah }); at, where a
// CCN sits ({ kind: 'plot' | 'strip', i }); cut, the penalty share's cut; yTop, the up axis's top; top, the across axis's
// (step 1's, the high case at the top use rate); none, the scenario hospitals step 1 doesn't draw. rows: the strips' rows;
// input: bothInput's (or decodeBoth's).
export function bothModel(rows, input) {
  const pen = new Map(input.rows.map(([ccn, npr, p, hub, mid]) => [ccn, { npr, pen: p, hub: hub === 1, mid }]));
  const pts = [];
  const strip = [];
  const at = new Map();
  for (const r of rows) {
    if (!r.share) continue;
    const cah = inGroup(r, 'critical_access');
    const p = pen.get(r.ccn);
    if (!p) {
      at.set(r.ccn, { kind: 'strip', i: strip.length });
      strip.push({ ccn: r.ccn, share: r.share, cah });
      continue;
    }
    if (!(p.npr > 0) || !Number.isFinite(p.mid) || !(p.pen >= 0)) throw new RangeError(`hospital ${r.ccn}: no patient revenue, middle loss or penalty to plot`);
    at.set(r.ccn, { kind: 'plot', i: pts.length });
    pts.push({
      ccn: r.ccn, name: r.name, city: r.city, state: r.state, cah, hub: p.hub, npr: p.npr, pen: p.pen, y: p.pen / p.npr,
      lost: r.share.map((s, k) => (k === MIDDLE ? p.mid : s * p.npr)),
    });
  }
  if (pts.length !== pen.size) throw new RangeError('exposed-on-both input: a penalty row for a hospital step 1 does not draw');
  const ys = pts.map((p) => p.y);
  return {
    fy: input.fy, penaltyFy: input.penaltyFy, top: input.top, cut: cutOf(ys), yTop: Math.max(...ys) * 1.06,
    pts, strip, at, none: rows.filter((r) => r.cls === 'scenario' && !r.share).length,
  };
}

// A plotted hospital's share of patient revenue lost in case k at use rate use.
export const xOf = (p, k, use) => (p.lost[k] * use) / p.npr;
export const isBoth = (model, p, k, use) => xOf(p, k, use) >= BOTH_SHARE && p.y >= model.cut;

// The corner's hospitals in case k at use rate use, by share lost, largest first, then by name (then CCN).
export const exposed = (model, k, use) => model.pts.filter((p) => isBoth(model, p, k, use))
  .sort((a, b) => xOf(b, k, use) - xOf(a, k, use) || a.name.localeCompare(b.name, 'en-US') || (a.ccn < b.ccn ? -1 : 1));
// The corner's count in each case at a use rate.
export const countsAt = (model, use) => SCENARIOS.map((_, k) => model.pts.filter((p) => isBoth(model, p, k, use)).length);
// A list's Medicaid loss (case k at use) and its penalties.
export const sumsOf = (list, k, use) => ({ lost: list.reduce((a, p) => a + p.lost[k] * use, 0), pen: list.reduce((a, p) => a + p.pen, 0) });

// ---------- the layout ----------

// The two drawings: the phone's (the kit's 300 across) and the wide one (about the stage at 1280 and 1440; tall enough to
// fill the stage at 1440 by 900). L, R, T, B: the plot's margins; strip: the hatched strip's top and bottom under the
// plot's bottom (its label on a row of its own under it, so no label covers a strip dot). The across axis's tag is the
// caption's (one scenario tag to a figure).
export const DRAWINGS = Object.freeze({
  narrow: { width: 300, height: 466, L: 38, R: 6, T: 26, B: 100, strip: [54, 80], dot: 3.2, stripDot: 2 },
  wide: { width: 680, height: 470, L: 52, R: 10, T: 26, B: 82, strip: [40, 62], dot: 4.4, stripDot: 2.6 },
});
const X_TICKS = [0, 0.005, 0.01, 0.02, 0.04, 0.08, 0.12, 0.16, 0.2];
const Y_TICKS = [0, 0.0001, 0.0005, 0.001, 0.0025, 0.005, 0.01];

// Each label's type, by class (styles.css sets the same): size in px (a viewBox unit), by drawing where it differs, and
// whether it is the type face (mono). The fit test reads it.
export const LABEL_FONTS = Object.freeze({
  'wr-b__count': { size: { narrow: 14, wide: 17 }, mono: false },
  'wr-b__sub': { size: 11, mono: false },
  'wr-b__cut': { size: 11, mono: false },
  'wr-b__line': { size: 11, mono: false },
  'wr-b__name': { size: 13, mono: false },
  'wr-b__strip': { size: { narrow: 10.5, wide: 11 }, mono: false },
  'wr-axtag__t': { size: 12, mono: false, spacing: 0.08 },
  'chart-axis__label': { size: 11, mono: true },
  'chart-axis__title': { size: 11, mono: false },
});
const { fontOf, labelAt } = labelKit(LABEL_FONTS);

// A share at the fewest places that show it (0.5%, 0.25%, 0.01%).
const shortPct = (v) => pctExact(v, 3);
const cutText = (cut) => pct(cut, 3);

// The layout for a drawing, a case (k) and a use rate; ccn: the page's hospital (null: none).
export function bothLayout({ model, drawing, k, use, ccn = null }) {
  const geo = DRAWINGS[drawing];
  const wide = drawing === 'wide';
  const plot = { x0: geo.L, x1: geo.width - geo.R, y0: geo.T, y1: geo.height - geo.B };
  const sx = (v) => plot.x0 + Math.sqrt(Math.max(0, Math.min(v, model.top)) / model.top) * (plot.x1 - plot.x0);
  const sy = (v) => plot.y1 - Math.sqrt(Math.max(0, Math.min(v, model.yTop)) / model.yTop) * (plot.y1 - plot.y0);
  const strip = { y0: plot.y1 + geo.strip[0], y1: plot.y1 + geo.strip[1] };
  const stripY = (i) => strip.y0 + 3 + spread(i) * (strip.y1 - strip.y0 - 6);
  const on = [];
  const off = [];
  let n = 0;
  for (const p of model.pts) {
    const pt = [sx(xOf(p, k, use)), sy(p.y)];
    if (isBoth(model, p, k, use)) {
      on.push(pt);
      n += 1;
    } else off.push(pt);
  }
  const stripDots = model.strip.map((s, i) => [sx(s.share[k] * use), stripY(i)]);
  const lineX = sx(BOTH_SHARE);
  const cutY = sy(model.cut);
  const pfy = String(model.penaltyFy);

  // The fixed labels: the axes' titles and tags, the line's label and the strip's (on its own row under the strip). The
  // corner's count and the cut's label are placed with the page's hospital (placed), clear of its mark.
  const yTitle = labelAt('chart-axis__title', wide ? fill('bAxisY', { pfy }) : t('bAxisYShort'), wide ? plot.x0 : 2, 12, 'start', drawing);
  // The penalties' tag, in the family's estimate tag's capitals (styles.css .wr-axtag, as .est-tag).
  const yTag = labelAt('wr-axtag__t', t('hEstimate').toUpperCase(), yTitle.box[0] + yTitle.box[2] + 9, 12, 'start', drawing);
  const xTitle = labelAt('chart-axis__title', wide ? fill('bAxisX', { fy: String(model.fy) }) : t('bAxisXShort'), plot.x1, plot.y1 + 31, 'end', drawing);
  const lineLabel = labelAt('wr-b__line', fill('bLine', { line: pct(BOTH_SHARE, 0) }), lineX - 4, plot.y0 + 11, 'end', drawing);
  const nCah = model.strip.filter((s) => s.cah).length;
  const stripLabel = labelAt('wr-b__strip', wide ? fill('bStrip', { n: count(model.strip.length), cah: count(nCah) }) : fill('bStripShort', { n: count(model.strip.length) }), plot.x1, strip.y1 + 13, 'end', drawing);

  // The axes' ticks, those under each top; a label only where it clears the last.
  const xTicks = [];
  let last = -Infinity;
  for (const v of X_TICKS.filter((x) => x <= model.top)) {
    const x = sx(v);
    const text = shortPct(v);
    const w = textWidth(text, fontOf('chart-axis__label', drawing).size, { mono: true });
    const end = x + w / 2 > geo.width - 1;
    const show = x - last >= 26;
    if (show) last = x;
    xTicks.push({ x, label: show ? labelAt('chart-axis__label', text, end ? geo.width - 1 : x, plot.y1 + 15, end ? 'end' : 'middle', drawing) : null });
  }
  const yTicks = [];
  let lastY = Infinity;
  for (const v of Y_TICKS.filter((y) => y <= model.yTop)) {
    const y = sy(v);
    const show = v > 0 && lastY - y >= 12; // 0 is the across axis's own first label
    if (show) lastY = y;
    yTicks.push({ y, label: show ? labelAt('chart-axis__label', shortPct(v), plot.x0 - 5, y + 4, 'end', drawing) : null });
  }

  const layout = { drawing, geo, plot, sx, sy, k, use, n, on, off, stripDots, strip, lineX, cutY, fixed: { yTitle, xTitle, lineLabel, stripLabel }, tags: [yTag], xTicks, yTicks };
  return Object.assign(layout, placed(model, layout, ccn));
}

// The page's hospital's mark ({ x, y, inStrip }), or null when step 1 doesn't draw it.
function markOf(model, layout, ccn) {
  const spot = ccn ? model.at.get(ccn) : null;
  if (!spot) return null;
  const { sx, sy, k, use } = layout;
  if (spot.kind === 'strip') return { x: sx(model.strip[spot.i].share[k] * use), y: layout.stripDots[spot.i][1], inStrip: true, i: spot.i };
  const p = model.pts[spot.i];
  return { x: sx(xOf(p, k, use)), y: sy(p.y), inStrip: false, i: spot.i };
}
// The mark's radius in the plot, and the strip mark's tick past the strip's edges (bothBody draws both).
export const MARK_R = 5;
const TICK_OUT = 3;
// Whether a label's box covers the mark: the plot's dot (with its radius) or the strip's tick (its whole length).
export function covers(box, mark, strip) {
  if (!mark) return false;
  const [y0, y1] = mark.inStrip ? [strip.y0 - TICK_OUT, strip.y1 + TICK_OUT] : [mark.y - MARK_R, mark.y + MARK_R];
  const [x0, x1] = mark.inStrip ? [mark.x - 1, mark.x + 1] : [mark.x - MARK_R, mark.x + MARK_R];
  return x1 > box[0] && x0 < box[0] + box[2] && y1 > box[1] && y0 < box[1] + box[3];
}

// The labels that move for the page's hospital, and its mark: the corner's count (with its case under it) at the corner's
// top right, else its top left, else either a step lower; the cut's label under the cut line at the right, else above it, else the same at the
// left, else a step further off the line at the right (a mark on the line itself); each at its first place inside the plot, clear of the labels already placed and of the mark. Returns { labels
// (in bothBody's order: the up and across titles, the count, its case, the cut's, the line's, the strip's), page }.
export function placed(model, layout, ccn) {
  const { plot, drawing, n, k, use, lineX, cutY, strip, fixed } = layout;
  const wide = drawing === 'wide';
  const mark = markOf(model, layout, ccn);
  const taken = [fixed.lineLabel.box];
  const ok = (l) => l.box[1] >= plot.y0 + 1 && l.box[1] + l.box[3] <= plot.y1 - 1 && l.box[0] >= plot.x0 + 1 && l.box[0] + l.box[2] <= plot.x1 - 1
    && !covers(l.box, mark, strip) && !taken.some((b) => overlap(b, l.box));
  const choose = (cands) => {
    const fit = cands.find((c) => c.every(ok));
    if (!fit) throw new RangeError(`exposed-on-both: no clear place for a label (${drawing}, case ${k}, use ${use})`);
    return fit;
  };
  const countText = fill('bCount', { n: count(n) });
  const subText = use === 1 ? fill('bCountSub', { scenario: caseWord(k) }) : fill('bCountSubUse', { scenario: caseWord(k), use: pct(use, 0) });
  const countY = plot.y0 + (wide ? 20 : 17);
  const block = (x, anchor, dy = 0) => [labelAt('wr-b__count', countText, x, countY + dy, anchor, drawing), labelAt('wr-b__sub', subText, x, countY + dy + 14, anchor, drawing)];
  const [countLabel, sub] = choose([block(plot.x1 - 6, 'end'), block(lineX + 6, 'start'), block(plot.x1 - 6, 'end', 34), block(lineX + 6, 'start', 34)]);
  taken.push(countLabel.box, sub.box);
  const cutWords = fill(wide ? 'bCut' : 'bCutShort', { cut: cutText(model.cut) });
  const [cutLabel] = choose([[plot.x1 - 6, 'end', cutY + 13], [plot.x1 - 6, 'end', cutY - 4], [plot.x0 + 6, 'start', cutY + 13], [plot.x0 + 6, 'start', cutY - 4], [plot.x1 - 6, 'end', cutY + 19], [plot.x1 - 6, 'end', cutY - 10]]
    .map(([x, anchor, y]) => [labelAt('wr-b__cut', cutWords, x, y, anchor, drawing)]));
  const labels = [fixed.yTitle, fixed.xTitle, countLabel, sub, cutLabel, fixed.lineLabel, fixed.stripLabel];
  return { labels, page: mark && pageMark(model, { ...layout, labels }, mark) };
}

// The page's hospital on a layout: { x, y, inStrip, label (in the plot only: its name, clear of the fixed labels and
// inside the plot, with a leader line when moved off the dot's row), leader }. mark: markOf's.
const NAME_STEPS = [-9, 17, -21, 29, -33, 41, -45, 53, -57, 65];
function pageMark(model, layout, mark) {
  const { x, y } = mark;
  if (mark.inStrip) return { x, y, inStrip: true, label: null, leader: null };
  const { plot, drawing } = layout;
  const p = model.pts[mark.i];
  const { size } = fontOf('wr-b__name', drawing);
  const name = fitText(p.name, plot.x1 - plot.x0 - 4, size);
  const w = textWidth(name, size);
  const taken = layout.labels.map((l) => l.box);
  let label = null;
  let leader = null;
  for (const dy of NAME_STEPS) {
    const at = placeAt(x, w, { gap: 8, span: [plot.x0 + 2, plot.x1 - 2] });
    const cand = labelAt('wr-b__name', name, at.x, y + dy, at.anchor, drawing);
    const [, top, , h] = cand.box;
    if (top < plot.y0 + 1 || top + h > plot.y1 - 1 || taken.some((b) => overlap(b, cand.box))) continue;
    label = cand;
    if (Math.abs(dy) > 17) leader = [x, y + Math.sign(dy) * 6, at.anchor === 'start' ? cand.box[0] - 2 : cand.box[0] + cand.box[2] + 2, top + h / 2];
    break;
  }
  return { x, y, inStrip: false, label, leader };
}

// ---------- the drawing ----------

const text = (l, extra = '') => html`<text class="${l.cls}${extra}" x="${r2(l.x)}" y="${r2(l.y)}"${l.anchor === 'start' ? '' : html` text-anchor="${l.anchor}"`}>${l.text}</text>`;
const tag = (l) => html`<g class="wr-axtag"><rect x="${r2(l.box[0] - 3)}" y="${r2(l.box[1] - 1.5)}" width="${r2(l.box[2] + 6)}" height="${r2(l.box[3] + 3)}"/>${text(l)}</g>`;

// The figure's body for a layout (bothLayout).
export function bothBody(layout) {
  const { geo, plot, drawing, on, off, stripDots, strip, lineX, cutY, labels, tags, xTicks, yTicks, page } = layout;
  const id = `wr-b-${drawing}`;
  const [count_, sub, cutLabel, lineLabel, stripLabel] = labels.slice(2);
  const grid = html`${xTicks.map((tk) => html`<line class="chart-grid" x1="${r2(tk.x)}" x2="${r2(tk.x)}" y1="${r2(plot.y0)}" y2="${r2(plot.y1)}"/>`)}${yTicks.map((tk) => html`<line class="chart-grid" x1="${r2(plot.x0)}" x2="${r2(plot.x1)}" y1="${r2(tk.y)}" y2="${r2(tk.y)}"/>`)}`;
  const axes = html`<g class="chart-axis"><line class="chart-axis__line" x1="${r2(plot.x0)}" x2="${r2(plot.x1)}" y1="${r2(plot.y1)}" y2="${r2(plot.y1)}"/><line class="chart-axis__line" x1="${r2(plot.x0)}" x2="${r2(plot.x0)}" y1="${r2(plot.y0)}" y2="${r2(plot.y1)}"/>${xTicks.map((tk) => html`<line class="chart-axis__tick" x1="${r2(tk.x)}" x2="${r2(tk.x)}" y1="${r2(plot.y1)}" y2="${r2(plot.y1 + 4)}"/>${tk.label ? text(tk.label) : ''}`)}${yTicks.map((tk) => html`<line class="chart-axis__tick" x1="${r2(plot.x0 - 4)}" x2="${r2(plot.x0)}" y1="${r2(tk.y)}" y2="${r2(tk.y)}"/>${tk.label ? text(tk.label) : ''}`)}</g>`;
  return html`${hatchDefs(id)}
${grid}
<rect class="wr-b__corner" x="${r2(lineX)}" y="${r2(plot.y0)}" width="${r2(plot.x1 - lineX)}" height="${r2(Math.max(0, cutY - plot.y0))}"/>
${axes}
${dotsPath(off, 'wr-bdots', geo.dot, { run: DOT_RUN })}
${dotsPath(on, 'wr-bdots wr-bdots--on', geo.dot, { run: DOT_RUN })}
<line class="wr-b__cutline" x1="${r2(lineX)}" x2="${r2(lineX)}" y1="${r2(plot.y0)}" y2="${r2(plot.y1)}"/><line class="wr-b__cutline" x1="${r2(plot.x0)}" x2="${r2(plot.x1)}" y1="${r2(cutY)}" y2="${r2(cutY)}"/>
<rect class="wr-gutter wr-b__band" x="${r2(plot.x0)}" y="${r2(strip.y0)}" width="${r2(plot.x1 - plot.x0)}" height="${r2(strip.y1 - strip.y0)}" fill="${hatchFill(id)}"/>
${dotsPath(stripDots, 'wr-bdots wr-bdots--strip', geo.stripDot, { run: DOT_RUN })}
${text(stripLabel)}
${text(labels[0])}${text(labels[1])}${tags.map(tag)}
${text(count_, ' chart-label--halo')}${text(sub, ' chart-label--halo')}${text(cutLabel, ' chart-label--halo')}${text(lineLabel, ' chart-label--halo')}
${page ? html`<g class="wr-b__you">${page.leader ? html`<line class="wr-b__leader" x1="${r2(page.leader[0])}" y1="${r2(page.leader[1])}" x2="${r2(page.leader[2])}" y2="${r2(page.leader[3])}"/>` : ''}${page.inStrip ? html`<line class="wr-b__tick" x1="${r2(page.x)}" x2="${r2(page.x)}" y1="${r2(strip.y0 - TICK_OUT)}" y2="${r2(strip.y1 + TICK_OUT)}"/>` : ''}<circle class="wr-b__dot" cx="${r2(page.x)}" cy="${r2(page.y)}" r="${page.inStrip ? 3.5 : MARK_R}"/>${page.label ? text(page.label, ' chart-label--halo') : ''}</g>` : ''}`;
}

// ---------- the words ----------

// The figure's text alternative for a case and use rate (the browser rewrites it as they move).
export const bothAlt = (model, k, use) => fill('bAlt', {
  n: count(model.pts.length), pfy: String(model.penaltyFy), k: count(countsAt(model, use)[k]), scenario: caseWord(k), line: pct(BOTH_SHARE, 0), cut: cutText(model.cut),
});

// The words column's head: the range of the corner's count, low case to high, at the use rate; the selected case's count;
// and the finding: the selected case's corner, its Medicaid loss and how many times its penalties that loss is.
// list: exposed(model, k, use), when the caller has it.
export function headHtml(model, k, use, list = exposed(model, k, use)) {
  const counts = countsAt(model, use);
  const { lost, pen } = sumsOf(list, k, use);
  const words = { scenario: caseWord(k), line: pct(BOTH_SHARE, 0), lost: money(lost), pen: money(pen), fy: String(model.fy), pfy: String(model.penaltyFy), ratio: pen > 0 ? decimal(lost / pen, 0) : '' };
  const find = list.length === 0 ? fill('bFindNone', { scenario: words.scenario, line: words.line })
    : list.length === 1 ? fill('bFindOne', words) : fill('bFind', { ...words, n: count(list.length) });
  const lab = use === 1 ? fill('bBigLab', { n: count(counts[k]), scenario: caseWord(k) }) : fill('bBigLabUse', { n: count(counts[k]), scenario: caseWord(k), use: pct(use, 0) });
  return html`<p class="wr-both__big"><span>${count(counts[0])}</span> <small>${t('bTo')}</small> <span>${count(counts[SCENARIOS.length - 1])}</span></p>
<p class="wr-both__lab">${lab}</p>
<p class="wr-both__find">${find}</p>`;
}

const estimate = () => estTag({ href: `${SITE.pages.methods}#estimate`, label: t('hEstimateLabel'), text: t('hEstimate') });

// The corner's dollars in the selected case: its Medicaid loss (scenario) and its penalties (estimate), never added. The
// penalties' label names the hospitals they are (the count), and a line under them says a case moves which hospitals
// cross the loss line, not their penalties, so the sum moving with the case is not read as penalties changing.
export function readHtml(model, k, use, list = exposed(model, k, use)) {
  const { lost, pen } = sumsOf(list, k, use);
  // The count is in the words only past one ("the one", "none" say it).
  const which = list.length === 0 ? 'None' : list.length === 1 ? 'One' : '';
  const n = which ? {} : { n: count(list.length) };
  return html`<p class="wr-both__rh">${fill(`bReadHead${which}`, { ...n, scenario: caseWord(k) })}</p>
<dl class="wr-both__dl"><dt>${t('bReadLost')} ${scenTag(model.fy)}</dt><dd>${list.length ? money(-lost) : t('stNoNumber')}</dd>
<dt>${fill(`bReadPen${which}`, { ...n, pfy: String(model.penaltyFy) })} ${estimate()}</dt><dd>${list.length ? money(-pen) : t('stNoNumber')}</dd></dl>
<p class="small muted wr-both__shift">${fill('bReadShift', { line: pct(BOTH_SHARE, 0) })}</p>
<p class="small muted wr-both__never">${t('hPenNote')}</p>`;
}

// Where the page's hospital sits (row: the page state's hospital, or null): in the corner, outside it, in the strip, or
// nowhere (a link to step 4, which gives the reason).
export function youHtml(model, row, k, use) {
  if (!row) return html``;
  const spot = model.at.get(row.ccn);
  if (!spot) return html`<a href="#hospital">${fill('bYouNone', { name: row.name })}</a>`;
  if (spot.kind === 'strip') return html`${fill('bYouStrip', { name: row.name, pfy: String(model.penaltyFy) })}`;
  const p = model.pts[spot.i];
  // The share as step 4 and the hub's band print it (web/medicaid/format.js: one decision over the three cases, "under" a
  // share too small to print), so the hospital reads the same in both steps.
  const share = caseShareTexts(SCENARIOS.map((_, i) => xOf(p, i, use)))[k];
  const words = { name: p.name, share, scenario: caseWord(k), pfy: String(model.penaltyFy) };
  if (isBoth(model, p, k, use)) return html`${fill('bYouIn', { ...words, pshare: pct(p.y, 3) })}`;
  return html`${p.pen > 0 ? fill('bYouOut', { ...words, pshare: pct(p.y, 3) }) : fill('bYouOutZero', words)}`;
}

// ---------- the tables ----------

// Figure 5's table: each case's corner at the use rate, with its Medicaid loss and its penalties. data-b names a number's
// cell for the script: "<case index> <n|lost|pen>".
export function tableRows(model, use = 1) {
  const counts = countsAt(model, use);
  return SCENARIOS.map((s, k) => {
    const { lost, pen } = sumsOf(exposed(model, k, use), k, use);
    return [scenWord(s), { ...num(count(counts[k]), counts[k]), data: { b: `${k} n` } }, { ...num(money(-lost), -lost), data: { b: `${k} lost` } }, { ...num(money(-pen), -pen), data: { b: `${k} pen` } }];
  });
}
// A table cell's text and value, for the script (tableRows' cells by data-b).
// list: exposed(model, k, use).
export function cellOf(list, k, use, kind) {
  const { lost, pen } = sumsOf(list, k, use);
  if (kind === 'n') return { text: count(list.length), value: list.length };
  return kind === 'lost' ? { text: money(-lost), value: -lost } : { text: money(-pen), value: -pen };
}

const tableOf = (model) => ({
  columns: [{ name: t('bColCase') }, { name: t('bColN'), numeric: true }, { name: t('bColLost'), numeric: true }, { name: fill('bColPen', { pfy: String(model.penaltyFy) }), numeric: true }],
  rows: tableRows(model),
});

const kindOf = (p) => t(`stKind_${p.cah ? 'critical_access' : 'acute'}`);
// A hospital's name, linked to its page across the programs only when that page exists.
const nameOf = (p) => {
  const href = p.hub ? hospitalPathOf('hub', p.ccn) : null;
  return href ? html`<a href="${href}">${p.name}</a>` : p.name;
};

// The named table's summary line for the selected case.
export function namedSummary(model, k, use, list = exposed(model, k, use)) {
  const n = list.length;
  const key = n === 0 ? 'bNamedSumNone' : n === 1 ? 'bNamedSumOne' : 'bNamedSum';
  return fill(key, { n: count(n), scenario: caseWord(k) });
}

// The named table's caption (read by a screen reader) for the selected case.
export const namedCaption = (k) => fill('bNamedCaption', { scenario: caseWord(k) });

// The named table's body: the corner's hospitals in order (exposed: by share, then name; no rank column, R28), each linked where its page exists, with its
// place and kind, its share and loss (scenario) and its penalties and their share (estimate). Rows past NAMED_FIRST carry
// a class the script hides until "Show all".
export const namedBody = (model, k, use, list = exposed(model, k, use)) => html`${list.map((p, i) => html`<tr${i >= NAMED_FIRST ? html` class="wr-named__more"` : ''} data-ccn="${p.ccn}"><th scope="row">${nameOf(p)}<small>${fill('stHitPlace', { place: placeText({ city: p.city, state: p.state }), kind: kindOf(p) })}</small></th><td class="num">${pct(-xOf(p, k, use), 2)}</td><td class="num">${money(-p.lost[k] * use)}</td><td class="num">${money(-p.pen)}</td><td class="num">${pct(-p.y, 3)}</td></tr>`)}`;

function named(model, k, use, list = exposed(model, k, use)) {
  const n = list.length;
  const pfy = String(model.penaltyFy);
  return html`<details class="wr-named" data-b-named>
<summary class="wr-named__sum"><span data-b-sum>${namedSummary(model, k, use, list)}</span></summary>
<p class="small muted wr-named__lead">${t('bNamedLead')}</p>
<div class="wr-named__wrap">
<table class="gb wr-named__t">
<caption class="vh" data-b-cap>${namedCaption(k)}</caption>
<thead><tr><th scope="col" rowspan="2">${t('bColHosp')}</th><th scope="colgroup" colspan="2" class="wr-named__grp">${t('bGrpMedicaid')} ${scenTag(model.fy)}</th><th scope="colgroup" colspan="2" class="wr-named__grp">${fill('bGrpMedicare', { pfy })} ${estimate()}</th></tr>
<tr><th scope="col" class="num">${t('bColShareA')}</th><th scope="col" class="num">${t('bColLostA')}</th><th scope="col" class="num">${t('bColPenA')}</th><th scope="col" class="num">${t('bColShareA')}</th></tr></thead>
<tbody data-b-rows>${namedBody(model, k, use, list)}</tbody>
</table>
</div>
<p class="wr-named__all"><button type="button" class="wr-hrand" data-b-all hidden>${fill('bShowAll', { n: count(n) })}</button></p>
</details>`;
}

// ---------- the step ----------

// The step. data: loadMedicaid()'s result; rows: hospitalRows(data); label: its heading; hubCcns: the CCNs with a hub
// page; model: bothModel's (built here when not given).
export function bothStep({ data, rows, label, hubCcns = new Set(), model = bothModel(rows, bothInput(data, rows, hubCcns)) }) {
  const fy = data.meta.fy;
  const k = MIDDLE;
  const use = data.params.use_default;
  const page = serverPick(rows);
  const draw = (drawing) => frame({ kind: 'both', width: DRAWINGS[drawing].width, height: DRAWINGS[drawing].height, body: bothBody(bothLayout({ model, drawing, k, use, ccn: page.ccn })) });
  return html`<section class="step wr-step wr-both" id="both" aria-labelledby="both-h">
<div class="wr-step__words">
<h2 class="wr-sec" id="both-h">${label} ${scenarioTag(fy)}</h2>
<div class="wr-both__head" data-b-head>${headHtml(model, k, use)}</div>
<p class="small muted wr-both__rule">${fill('bRule', { line: pct(BOTH_SHARE, 0), pfy: String(model.penaltyFy), fy: String(fy), n: count(model.pts.length), cut: cutText(model.cut) })}</p>
<div class="wr-both__read" data-b-read>${readHtml(model, k, use)}</div>
<p class="small wr-both__you" data-b-you data-b-default="${page.ccn}">${youHtml(model, page, k, use)}</p>
</div>
<div class="wr-step__stage">
${figure({
    n: 5,
    takeaway: fill('bTakeaway', { n: count(model.pts.length), pfy: String(model.penaltyFy) }),
    svg: draw('narrow'),
    svgWide: draw('wide'),
    alt: bothAlt(model, k, use),
    note: fill('bNote', { strip: count(model.strip.length), cah: count(model.strip.filter((s) => s.cah).length), none: count(model.none) }),
    capTag: scenarioTag(fy),
    source: fill('bSource', { fy: String(fy), pfy: String(model.penaltyFy) }),
    claimLevel: 'hypothetical',
    table: tableOf(model),
    csvName: 'work-requirement-exposed-on-both',
  })}
</div>
${named(model, k, use)}
</section>`;
}
