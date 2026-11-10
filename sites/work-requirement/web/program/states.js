// Step 3, state by state: in the words column, the selected state's headline (how exposed it is, and why: the two numbers
// its exposure multiplies), its worksheet card (lines one to seven) and its most exposed hospitals; beside it, Figure 3
// (M3's exposure contours): each state with a scenario a dot at Medicaid's share of its hospitals' patient revenue (up)
// and the share of that Medicaid revenue the case takes (across), so the contour it sits on is the share of patient
// revenue its hospitals could lose; a dot's area is its dollars lost; whiskers run from the low case to the high. States
// without a scenario sit in a hatched gutter at their measured Medicaid share, Maryland starred (not modeled) and
// Wisconsin marked; the territories are listed under the figure. The full state table is the figure's own. Shared by the
// build (the server draws the default state in the middle case at the default use rate) and the browser
// (client/states.js redraws the figure, the headline and the card from the page's state). Pure: no DOM, file or clock.
//
// Numbers: a state's dollars, counts and Medicaid revenue are its own roll-up's (the file's `states[code].rollup`). Its
// share of patient revenue lost is computed here, over the hospitals that report patient revenue (scored, with net
// patient revenue above zero: the hospitals step 1 can draw, with any whose loss is nothing): their loss over their
// patient revenue, so numerator and denominator count the same hospitals (the roll-up's own patient revenue counts only
// the hospitals with usable margins, while its loss counts every hospital). Every dollar here is linear in the use rate
// (the engine's lost = at risk × decline × use), so a use rate other than the default multiplies the file's numbers; at
// the default they are the file's, unmultiplied.
import { rowToBase, scenario } from '../../../../engine/js/medicaid/scenario.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { frame, hatchDefs, hatchFill, r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { count, listText, money, numberWord, ordinal, pct, placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { hospitalPathOf } from '../../../../web/site.js';
import { CONTOURS, DEFAULT_SCENARIO, MOST_EXPOSED, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { lineRow, scenTag } from './chain.js';
import { scenWord } from './ranges.js';
import { fitText, markLabel } from './strips.js';

const MIDDLE = SCENARIOS.indexOf(DEFAULT_SCENARIO);
// A case's word in a sentence (middle, low, high).
const caseWord = (k) => scenWord(SCENARIOS[k]).toLowerCase();
// The classes drawn in the gutter (a measured Medicaid share, no scenario), and the order the table lists every class in.
export const GUTTER = Object.freeze(['not_expansion', 'no_viii_group', 'all_payer']);
const CLASS_ORDER = ['scenario', ...GUTTER, 'territory'];
// The marks a gutter state's code carries, and the footnotes that say what they mean (copy stMark_<cls>, stFn_<cls>).
const MARKED = ['all_payer', 'no_viii_group'];

// ---------- the model ----------

// Each state or territory in the file, as the step draws it: { code, name, cls, n (hospitals with a cost report: the
// roll-up's count for a scenario state), y (Medicaid's share of patient revenue, over the hospitals that report it; null
// with none) } and, for a state with a scenario: nP (those hospitals), viii (CMS-64's expansion share), declines, revenue
// and atRisk (the roll-up's Medicaid revenue and revenue at risk), lost (the roll-up's, by case), lostP (the loss of the
// nP hospitals, by case), revP and nprP (their Medicaid and patient revenue), top (the MOST_EXPOSED hospitals by share
// lost: { ccn, name, city, kind, hub (whether /hospital/<ccn>/ exists), share (by case) }). With the default use rate's
// top (useMax: the file's params.use_max, for the drawing's scales), the cost reports' year and the default state.
// data: loadMedicaid()'s result; rows: hospitalRows(data); hubCcns: the CCNs with a hub page (data.js loadHubCcns).
export function statesModel(data, rows, hubCcns = new Set()) {
  const { columns } = data;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  const sums = new Map(Object.keys(data.states).map((code) => [code, { n: 0, nP: 0, revP: 0, nprP: 0, lostP: SCENARIOS.map(() => 0) }]));
  for (const row of data.hospitals.values()) {
    const st = data.states[row[col.state]];
    const a = sums.get(row[col.state]);
    if (!st || row[col.cls] !== st.cls) continue; // a hospital with no cost report
    a.n += 1;
    const npr = row[col.net_patient_revenue];
    if (!row[col.scored] || !(npr > 0)) continue;
    a.nP += 1;
    a.nprP += npr;
    a.revP += row[col.medicaid_net_revenue] || 0;
    if (st.cls === 'scenario') {
      const b = rowToBase(columns, row);
      SCENARIOS.forEach((s, k) => { a.lostP[k] += scenario(b, b.share, st.declines[s]).lost; });
    }
  }
  const states = Object.entries(data.states).sort(([a], [b]) => (a < b ? -1 : 1)).map(([code, st]) => {
    const a = sums.get(code);
    const out = { code, name: st.name, cls: st.cls, n: a.n, y: a.nprP > 0 ? a.revP / a.nprP : null };
    if (st.cls !== 'scenario') return out;
    const roll = st.rollup;
    const top = rows.filter((r) => r.state === code && r.share).sort((x, y) => y.share[MIDDLE] - x.share[MIDDLE] || (x.ccn < y.ccn ? -1 : 1))
      .slice(0, MOST_EXPOSED)
      .map((r) => ({ ccn: r.ccn, name: r.name, city: r.city, kind: data.hospitals.get(r.ccn)[col.kind], hub: hubCcns.has(r.ccn), share: r.share }));
    return {
      ...out, n: roll.middle.hospitals, nP: a.nP, viii: st.viii_share, declines: SCENARIOS.map((s) => st.declines[s]),
      revenue: roll.middle.medicaid_revenue, atRisk: roll.middle.at_risk, lost: SCENARIOS.map((s) => roll[s].lost),
      lostP: a.lostP, revP: a.revP, nprP: a.nprP, top,
    };
  });
  const model = { fy: data.meta.fy, useMax: data.params.use_max, states, selected: null };
  model.selected = mostExposed(model);
  return model;
}

// The browser's copy (the strips' asset carries it): the model as it is, all plain data.
export const statesAsset = (model) => model;
export function decodeStates(asset) {
  if (!asset || !Array.isArray(asset.states) || !asset.states.length || !(asset.useMax > 0) || !asset.states.some((s) => s.code === asset.selected)) {
    throw new TypeError('states asset: not what the build wrote');
  }
  return asset;
}

// A state's numbers in case k (an index in SCENARIOS) at a use rate: dollars lost (the roll-up's), the nP hospitals' loss,
// their share of patient revenue lost, the share of their Medicaid revenue the case takes (x, across) and Medicaid's share
// of their patient revenue (y, up); x × y is the share.
export function numbersOf(st, k, use) {
  const lostP = st.lostP[k] * use;
  return { lost: st.lost[k] * use, lostP, share: lostP / st.nprP, x: lostP / st.revP, y: st.y };
}

// The states with a scenario, most exposed first in case k (the order is the same at every use rate).
export const ranked = (model, k) => model.states.filter((s) => s.cls === 'scenario')
  .map((s) => [s.code, s.lostP[k] / s.nprP]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([code]) => code);
export const mostExposed = (model, k = MIDDLE) => ranked(model, k)[0];

const stateOf = (model, code) => model.states.find((s) => s.code === code);

// ---------- the drawing ----------

// The two drawings: the phone's (the kit's 300 across) and the wide one (about the stage at 1280 and 1440, with the
// strips'). gut: the gutter's left and right; L, R, T, B: the plot's margins; rMax: the radius of the largest loss the
// drawing can show (the high case at the top use rate). The wide drawing sets the gutter's title and the up axis's on one
// row above the plot, the phone's on two.
export const DRAWINGS = Object.freeze({
  narrow: { width: 300, height: 470, gut: [2, 50], L: 88, R: 8, T: 48, B: 66, rMax: 17 },
  wide: { width: 680, height: 380, gut: [2, 72], L: 116, R: 10, T: 26, B: 58, rMax: 26 },
});
// The smallest dot, as a share of rMax (a dot's area is its dollars above it).
const R_FLOOR = 0.1;
// The scales' steps: across, ticks every 2 points up to the top; up, the range padded to whole 2 points, ticked every 4.
const X_STEP = 0.02;
const Y_GRID = 0.02;
const Y_TICK = 0.04;
const Y_PAD = 0.005;

// Each label's type, by class (styles.css sets the same): size in px (a viewBox unit), by drawing where it differs, and
// whether it is the type face (mono). The fit test reads it.
export const LABEL_FONTS = Object.freeze({
  'wr-st__code': { size: { narrow: 9.5, wide: 10 }, mono: true },
  'wr-st__name': { size: { narrow: 12, wide: 13 }, mono: false },
  'wr-st__gut': { size: { narrow: 9.5, wide: 10 }, mono: true },
  'wr-st__fn': { size: { narrow: 9.5, wide: 10 }, mono: true },
  'wr-st__head': { size: 11, mono: false },
  'wr-iso__label': { size: 10.5, mono: true },
  'wr-iso__title': { size: 11, mono: false },
  'chart-axis__label': { size: 11, mono: true },
  'chart-axis__title': { size: 11, mono: false },
  'chart-note': { size: 11, mono: false },
});
const fontOf = (cls, drawing) => {
  const f = LABEL_FONTS[cls];
  return { size: typeof f.size === 'number' ? f.size : f.size[drawing], mono: f.mono };
};
const widthOf = (text, cls, drawing) => {
  const { size, mono } = fontOf(cls, drawing);
  return textWidth(text, size, { mono });
};

// The scales every case and use rate share, so a dot moves and the axes stay: across up to the largest high-case share
// at the top use rate, up over every drawn state's Medicaid share, and the loss a dot's area reaches rMax at.
function scalesOf(model) {
  const scen = model.states.filter((s) => s.cls === 'scenario');
  const ys = model.states.filter((s) => (s.cls === 'scenario' || GUTTER.includes(s.cls)) && s.y !== null).map((s) => s.y);
  const xMax = Math.max(...scen.map((s) => numbersOf(s, SCENARIOS.length - 1, model.useMax).x));
  return {
    xTop: Math.ceil(xMax / X_STEP - 1e-9) * X_STEP,
    y0: Math.max(0, Math.floor((Math.min(...ys) - Y_PAD) / Y_GRID) * Y_GRID),
    y1: Math.ceil((Math.max(...ys) + Y_PAD) / Y_GRID) * Y_GRID,
    lostTop: Math.max(...scen.map((s) => s.lost[SCENARIOS.length - 1] * model.useMax)),
  };
}

// The loss under which a dot keeps the smallest size (the figure's note says it).
export const floorLost = (model) => scalesOf(model).lostTop * R_FLOOR ** 2;

// A share at the fewest places that show it (0.25%, 0.5%, 1%).
const shortPct = (v) => pct(v, [0, 1, 2].find((dp) => Math.abs(Math.round(v * 10 ** (dp + 2)) - v * 10 ** (dp + 2)) < 1e-9) ?? 2);

const overlap = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
const hitsCircle = (box, c) => {
  const nx = Math.max(box[0], Math.min(c.x, box[0] + box[2]));
  const ny = Math.max(box[1], Math.min(c.y, box[1] + box[3]));
  return (nx - c.x) ** 2 + (ny - c.y) ** 2 < (c.r + 1) ** 2;
};

// The contour x · y = k inside the plot, left to right: from where it comes in at the top to where it leaves at the bottom
// or the right; null when it never enters.
function contour(k, S, at) {
  const xa = k / S.y1;
  if (xa >= S.xTop) return null;
  const xb = S.y0 > 0 ? Math.min(S.xTop, k / S.y0) : S.xTop;
  const N = 36;
  return Array.from({ length: N + 1 }, (_, i) => {
    const x = xa * (xb / xa) ** (i / N);
    return at(x, k / x);
  });
}
const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('');

// Where each state's code goes: beside its dot (right, left, the diagonals, above, below), then further out with a leader
// line, never over another label, another dot or the plot's edge; the selected state first, named in full, then the
// rest by size. Where nothing fits, beside the dot at the side with room (markLabel). Each: { code, cls, text, box: [x,
// y, w, h], leader: [x1, y1, x2, y2] or null }.
const ANGLES = [0, Math.PI, -0.6, 0.6, Math.PI + 0.6, Math.PI - 0.6, -Math.PI / 2, Math.PI / 2];
const RINGS = [0, 6, 14, 24, 36];
function placeLabels(points, { plot, drawing, taken }) {
  const placed = [];
  const boxes = [...taken];
  const order = [...points].sort((a, b) => (a.on ? -1 : b.on ? 1 : b.r - a.r || (a.code < b.code ? -1 : 1)));
  for (const p of order) {
    const cls = p.on ? 'wr-st__name' : 'wr-st__code';
    const { size, mono } = fontOf(cls, drawing);
    const text = p.on ? fitText(p.name, plot.x1 - plot.x0 - 2, size, { mono }) : p.code;
    const w = textWidth(text, size, { mono });
    const h = size;
    let best = null;
    search: for (const dd of RINGS) {
      for (const a of ANGLES) {
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const ax = p.x + cs * (p.r + 3 + dd);
        const ay = p.y + sn * (p.r + 3 + dd);
        const bx = cs < -0.2 ? ax - w : cs > 0.2 ? ax : ax - w / 2;
        const by = Math.abs(cs) > 0.2 ? ay - h / 2 : sn < 0 ? ay - h : ay;
        const box = [bx, by, w, h];
        if (bx < plot.x0 + 1 || bx + w > plot.x1 - 1 || by < plot.y0 + 1 || by + h > plot.y1 - 1) continue;
        if (boxes.some((q) => overlap(q, box))) continue;
        if (points.some((q) => q !== p && hitsCircle(box, q))) continue;
        best = { box, leader: dd ? [p.x + cs * p.r, p.y + sn * p.r, ax, ay] : null };
        break search;
      }
    }
    if (!best) {
      const m = markLabel(p.x, text, { size, mono, gap: p.r + 3, span: [plot.x0 + 1, plot.x1 - 1] });
      const left = m.anchor === 'end' ? m.x - w : m.x;
      const top = Math.min(Math.max(p.y - h / 2, plot.y0 + 1), plot.y1 - 1 - h);
      best = { box: [left, top, w, h], leader: null };
    }
    boxes.push(best.box);
    placed.push({ code: p.code, cls, text, ...best });
  }
  return placed;
}

// The gutter's states, top to bottom by Medicaid share, alternating between its two columns, each column's dots at least
// GAP apart and inside the plot's height.
const GAP = 12;
function gutterOf(model, { geo, plot, sy, selected }) {
  const [g0, g1] = geo.gut;
  const cols = [g0 + 8, g0 + 8 + (g1 - g0) / 2];
  const items = model.states.filter((s) => GUTTER.includes(s.cls) && s.y !== null).sort((a, b) => b.y - a.y || (a.code < b.code ? -1 : 1))
    .map((s, i) => ({ code: s.code, name: s.name, cls: s.cls, col: i % 2, x: cols[i % 2], y: sy(s.y), on: s.code === selected, label: `${s.code}${MARKED.includes(s.cls) ? t(`stMark_${s.cls}`) : ''}` }));
  for (const c of [0, 1]) {
    const column = items.filter((p) => p.col === c);
    let last = -Infinity;
    for (const p of column) {
      p.y = Math.max(p.y, last + GAP, plot.y0 + 6);
      last = p.y;
    }
    let next = Infinity;
    for (const p of [...column].reverse()) {
      p.y = Math.min(p.y, next - GAP, plot.y1 - 6);
      next = p.y;
    }
  }
  return items;
}

// The figure's layout for a drawing, case k, use rate and selected state (any code: one without a scenario is ringed in
// the gutter, a territory nowhere).
export function statesLayout({ model, drawing, k, use, selected }) {
  const geo = DRAWINGS[drawing];
  const S = scalesOf(model);
  const plot = { x0: geo.L, x1: geo.width - geo.R, y0: geo.T, y1: geo.height - geo.B };
  const sx = (v) => plot.x0 + (Math.min(v, S.xTop) / S.xTop) * (plot.x1 - plot.x0);
  const sy = (v) => plot.y1 - ((v - S.y0) / (S.y1 - S.y0)) * (plot.y1 - plot.y0);
  const rOf = (lost) => geo.rMax * Math.max(R_FLOOR, Math.sqrt(lost / S.lostTop));
  const points = model.states.filter((s) => s.cls === 'scenario').map((s) => {
    const n = numbersOf(s, k, use);
    return {
      code: s.code, name: s.name, on: s.code === selected, x: sx(n.x), y: sy(n.y), r: rOf(n.lost), share: n.share, lost: n.lost,
      lo: sx(numbersOf(s, 0, use).x), hi: sx(numbersOf(s, SCENARIOS.length - 1, use).x),
    };
  });
  // The contours' labels, where each comes in at the top, the highest levels first where two would touch.
  const isoLabels = [];
  const lab = fontOf('wr-iso__label', drawing);
  for (const level of [...CONTOURS].reverse()) {
    const xa = level / S.y1;
    if (xa >= S.xTop) continue;
    const text = shortPct(level);
    const x = sx(xa) + 3;
    const w = textWidth(text, lab.size, { mono: true });
    const box = [x, plot.y0 + 2, w, lab.size];
    if (x + w > plot.x1 - 2 || isoLabels.some((l) => overlap(l.box, [box[0] - 4, box[1], box[2] + 8, box[3]]))) continue;
    isoLabels.push({ text, x, y: plot.y0 + 12, box });
  }
  // The contours' title under their labels, at the right (shorter on the phone).
  const isoText = t(drawing === 'wide' ? 'stContours' : 'stContoursShort');
  const isoW = widthOf(isoText, 'wr-iso__title', drawing);
  const isoTitle = { text: isoText, x: plot.x1 - 4, y: plot.y0 + 26, box: [plot.x1 - 4 - isoW, plot.y0 + 16, isoW, 11] };
  const taken = [...isoLabels.map((l) => l.box), isoTitle.box];
  const labels = placeLabels(points, { plot, drawing, taken });
  const gutter = gutterOf(model, { geo, plot, sy, selected });
  return { drawing, geo, S, plot, sx, sy, k, use, selected, points, labels, gutter, isoLabels, isoTitle };
}

const label = (cls, x, y, text, anchor = 'start') => html`<text class="${cls} chart-label--halo" x="${r2(x)}" y="${r2(y)}"${anchor === 'start' ? '' : html` text-anchor="${anchor}"`}>${text}</text>`;

// The contours: the plot's ground, each level's region (x · y at or past it) laid over the last so the ink deepens with
// the share, and each level's dashed line.
function contoursOf({ S, sx, sy, plot }) {
  const at = (x, y) => [sx(x), sy(y)];
  const regions = [];
  const lines = [];
  for (const level of CONTOURS) {
    const pts = contour(level, S, at);
    if (!pts) continue;
    const corner = S.y0 > 0 && level / S.y0 < S.xTop ? [[plot.x1, plot.y1]] : [];
    regions.push(html`<path class="wr-iso" d="${pathOf([...pts, ...corner, [plot.x1, plot.y0]])}Z"/>`);
    lines.push(html`<path class="wr-iso__line" d="${pathOf(pts)}"/>`);
  }
  return html`<rect class="wr-iso" x="${r2(plot.x0)}" y="${r2(plot.y0)}" width="${r2(plot.x1 - plot.x0)}" height="${r2(plot.y1 - plot.y0)}"/>${regions}${lines}`;
}

// The axes: gridlines and ticks, the two hairlines, the labels (an across label that would pass the drawing's right edge
// is set against it) and the titles.
function axesOf({ S, sx, sy, plot, geo, drawing }) {
  const out = [];
  const xs = [];
  for (let i = 0; i * X_STEP <= S.xTop + 1e-9; i += 1) xs.push(i * X_STEP);
  const ys = [];
  for (let i = Math.ceil(S.y0 / Y_TICK - 1e-9); i * Y_TICK <= S.y1 + 1e-9; i += 1) ys.push(i * Y_TICK);
  for (const v of ys) out.push(html`<line class="chart-grid" x1="${r2(plot.x0)}" x2="${r2(plot.x1)}" y1="${r2(sy(v))}" y2="${r2(sy(v))}"/><line class="chart-axis__tick" x1="${r2(plot.x0 - 4)}" x2="${r2(plot.x0)}" y1="${r2(sy(v))}" y2="${r2(sy(v))}"/><text class="chart-axis__label" x="${r2(plot.x0 - 6)}" y="${r2(sy(v) + 4)}" text-anchor="end">${pct(v, 0)}</text>`);
  let last = -Infinity;
  for (const v of xs) {
    const x = sx(v);
    out.push(html`<line class="chart-axis__tick" x1="${r2(x)}" x2="${r2(x)}" y1="${r2(plot.y1)}" y2="${r2(plot.y1 + 4)}"/>`);
    if (x - last < 26) continue;
    last = x;
    const text = pct(v, 0);
    const half = widthOf(text, 'chart-axis__label', drawing) / 2;
    const end = x + half > geo.width - 1;
    out.push(html`<text class="chart-axis__label" x="${r2(end ? geo.width - 1 : x)}" y="${r2(plot.y1 + 15)}" text-anchor="${end ? 'end' : 'middle'}">${text}</text>`);
  }
  const wide = drawing === 'wide';
  return html`<g class="chart-axis">${out}<line class="chart-axis__line" x1="${r2(plot.x0)}" x2="${r2(plot.x1)}" y1="${r2(plot.y1)}" y2="${r2(plot.y1)}"/><line class="chart-axis__line" x1="${r2(plot.x0)}" x2="${r2(plot.x0)}" y1="${r2(plot.y0)}" y2="${r2(plot.y1)}"/></g>
<text class="chart-axis__title" x="${r2(plot.x1)}" y="${r2(plot.y1 + 32)}" text-anchor="end">${t(wide ? 'stAxisX' : 'stAxisXShort')}</text>${wide ? html`<text class="chart-note" x="${r2(plot.x1)}" y="${r2(plot.y1 + 46)}" text-anchor="end">${t('stAxisXSub')}</text>` : ''}
<text class="chart-axis__title" x="${wide ? r2(geo.gut[1] + 12) : 2}" y="12">${t('stAxisY')}</text>`;
}

// What a state's mark says on hover (its native tooltip): its share and dollars, or its status.
const tipOf = (p, k) => fill('stTip', { state: p.name, share: pct(p.share, 2), lost: money(p.lost), scenario: caseWord(k) });

// The figure's body for a layout (statesLayout).
export function statesBody(layout) {
  const { geo, plot, drawing, points, labels, gutter, isoLabels, isoTitle, k } = layout;
  const id = `wr-st-${drawing}`;
  const [g0, g1] = geo.gut;
  const fnRow = drawing === 'wide' ? [plot.y1 + 32, plot.y1 + 46] : [plot.y1 + 47, plot.y1 + 59];
  const notes = MARKED.filter((cls) => gutter.some((p) => p.cls === cls));
  const sel = points.find((p) => p.on);
  return html`${hatchDefs(id)}
${contoursOf(layout)}
${axesOf(layout)}
<rect class="wr-gutter" x="${r2(g0)}" y="${r2(plot.y0)}" width="${r2(g1 - g0)}" height="${r2(plot.y1 - plot.y0)}" fill="${hatchFill(id)}"/>
${label('wr-st__head', g0, drawing === 'wide' ? 12 : plot.y0 - 8, t('stGutter'))}
<g class="wr-st__whiskers">${points.map((p) => html`<path class="wr-st__whisker" d="M${r2(p.lo)} ${r2(p.y)}H${r2(p.hi)}M${r2(p.lo)} ${r2(p.y - 3)}v6M${r2(p.hi)} ${r2(p.y - 3)}v6"/>`)}</g>
${[...points].sort((a, b) => b.r - a.r || (a.code < b.code ? -1 : 1)).map((p) => html`<g class="wr-st${p.on ? ' wr-st--on' : ''}" data-st="${p.code}"><title>${tipOf(p, k)}</title><circle class="wr-st__dot" cx="${r2(p.x)}" cy="${r2(p.y)}" r="${r2(p.r)}"/></g>`)}
${sel ? html`<circle class="wr-st__ring" cx="${r2(sel.x)}" cy="${r2(sel.y)}" r="${r2(sel.r + 3)}"/>` : ''}
${gutter.map((p) => html`<g class="wr-st wr-st--none${p.on ? ' wr-st--on' : ''}" data-st="${p.code}"><title>${p.name}: ${t(`stStatus_${p.cls}`)}</title><circle class="wr-st__hollow" cx="${r2(p.x)}" cy="${r2(p.y)}" r="4"/></g>${label('wr-st__gut', p.x + 6, p.y + 3.5, p.label)}`)}
${labels.map((l) => html`${l.leader ? html`<line class="wr-st__leader" x1="${r2(l.leader[0])}" y1="${r2(l.leader[1])}" x2="${r2(l.leader[2])}" y2="${r2(l.leader[3])}"/>` : ''}${label(l.cls, l.box[0], l.box[1] + l.box[3] * 0.8, l.text)}`)}
${isoLabels.map((l) => label('wr-iso__label', l.x, l.y, l.text))}${label('wr-iso__title', isoTitle.x, isoTitle.y, isoTitle.text, 'end')}
${notes.map((cls, i) => label('wr-st__fn', 2, fnRow[i], t(`stFn_${cls}`)))}`;
}

// ---------- the words ----------


// The selected state's headline: { big (how exposed, or that it has no scenario), why (the two numbers, or the reason) }.
// view: { k (the case's index), use }.
export function headlineOf(model, code, { k, use }) {
  const s = stateOf(model, code);
  if (s.cls !== 'scenario') {
    return { big: fill(s.cls === 'all_payer' || s.cls === 'territory' ? 'stNotModeled' : 'stNone', { state: s.name }), why: t(`stWhy_${s.cls}`) };
  }
  const order = ranked(model, k);
  const rank = order.indexOf(code);
  const n = numbersOf(s, k, use);
  return {
    big: rank === 0 ? fill('stTop', { state: s.name }) : fill('stRank', { state: s.name, rank: ordinal(rank + 1), n: count(order.length) }),
    why: fill('stWhy', { y: pct(n.y, 0), scenario: caseWord(k), x: pct(n.x, 0), share: pct(n.share, 2), lost: money(n.lost) }),
  };
}

const measured = () => html` <span class="wr-tag">${t('wsMeasured')}</span>`;
const kindOf = (kind) => t(`stKind_${kind === 'critical_access' ? 'critical_access' : 'acute'}`);

// A hospital's name, linked to its page across the programs only when that page exists.
const nameOf = (h) => (h.hub ? html`<a href="${hospitalPathOf('hub', h.ccn)}">${h.name}</a>` : h.name);

// The card's body for a state: its worksheet's seven lines and its most exposed hospitals, or for a state without a
// scenario its status and its count of hospitals, with no number of dollars (the headline above it gives the reason).
export function cardBody(model, code, { k, use }) {
  const s = stateOf(model, code);
  if (s.cls !== 'scenario') {
    const words = { fy: String(model.fy) };
    const counted = s.n === 0 ? fill('stCountNone', words) : s.n === 1 ? fill('stCountOne', words) : fill('stCount', { ...words, n: count(s.n) });
    return html`<p class="wr-stcard__why">${t(`stStatus_${s.cls}`)}</p>
<p class="wr-stcard__sub small muted">${counted}</p>`;
  }
  const n = numbersOf(s, k, use);
  const lo = numbersOf(s, 0, use);
  const hi = numbersOf(s, SCENARIOS.length - 1, use);
  const tags = html` ${scenTag(model.fy)}`;
  const row = (line) => lineRow({ ...line, inline: true });
  const range = (f) => fill('wsRange', { low: f(lo), high: f(hi) });
  const decline = s.declines[k];
  const top = s.top;
  const max = top.length ? top[0].share[k] * use : 1;
  return html`<p class="wr-stcard__sub small muted">${fill('stCardSub', { n: count(s.n), fy: String(model.fy), a: count(2), b: count(4) })}</p>
<table class="wr-ws__lines wr-stcard__lines"><thead class="vh"><tr><th scope="col">${t('wsLine')}</th><th scope="col">${t('wsWhat')}</th><th scope="col">${t('wsAmount')}</th></tr></thead>
<tbody>${row({ n: 1, key: 'ws1', note: fill('stL1Note', { fy: String(model.fy) }), tags: measured(), value: money(s.revenue), raw: s.revenue, cls: ' wr-wl--eq' })}
${row({ n: 2, op: '×', key: 'ws2', note: fill('stL2Note', { viii: pct(s.viii, 1) }), tags, value: pct(s.atRisk / s.revenue, 1), raw: s.atRisk / s.revenue })}
${row({ n: 3, op: '=', key: 'ws3', tags, value: money(s.atRisk), raw: s.atRisk, cls: ' wr-wl--eq' })}
${row({ n: 4, op: '×', key: 'ws4', note: fill('stL4Note', { scenario: caseWord(k) }), range: fill('wsRange', { low: pct(s.declines[0], 0), high: pct(s.declines[SCENARIOS.length - 1], 0) }), value: pct(decline, 0), raw: decline })}
${row({ n: 5, op: '=', key: 'stL5', note: use === 1 ? fill('stL5Note', { a: count(3), b: count(4) }) : fill('stL5NoteUse', { a: count(3), b: count(4), use: pct(use, 0) }), range: range((x) => money(-x.lost)), tags, value: money(-n.lost), raw: n.lost, cls: ' wr-wl--eq wr-wl--res' })}
${row({ n: 6, key: 'stL6', note: s.nP < s.n ? fill('stL6NoteLess', { n: count(s.nP), lost: money(n.lostP), a: count(5) }) : fill('stL6Note', { n: count(s.nP) }), tags: measured(), value: money(s.nprP), raw: s.nprP })}
${row({ n: 7, op: '=', key: 'stL7', note: fill('stL7Note', { a: count(6) }), range: range((x) => pct(-x.share, 2)), tags, value: pct(-n.share, 2), raw: n.share, cls: ' wr-wl--eq wr-wl--res' })}</tbody></table>
<p class="wr-stcard__axes small muted">${fill('stAxes', { y: pct(n.y, 1), x: pct(n.x, 1), n: count(7) })}</p>
<div class="wr-hits"><p class="wr-hits__h"><span class="cap">${t('stHitsHead')}</span> <span class="wr-hits__sub">${fill('stHitsSub', { scenario: caseWord(k) })}</span></p>
${top.length ? html`<ol class="wr-hits__list" role="list">${top.map((h) => html`<li class="wr-hit"><span class="wr-hit__name">${nameOf(h)}<small>${fill('stHitPlace', { place: placeText({ city: h.city }), kind: kindOf(h.kind) })}</small></span><span class="wr-hit__bar" aria-hidden="true"><i style="width: ${r2((h.share[k] * use / max) * 100)}%"></i></span><span class="wr-hit__v">${pct(h.share[k] * use, 1)}</span></li>`)}</ol>` : html`<p class="small muted">${t('stHitsNone')}</p>`}
</div>`;
}

// ---------- the table ----------

// Figure 3's table: every state and territory, those with a scenario first and most exposed first (the middle case),
// then the rest by class and name; each with its status, its hospitals, and its dollars and share lost in each case (none
// without a scenario). data-st names a number's cell for the script: "<code> <lost|share> <case index>".
export function tableRows(model) {
  const order = ranked(model, MIDDLE);
  const rest = model.states.filter((s) => s.cls !== 'scenario')
    .sort((a, b) => CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls) || a.name.localeCompare(b.name));
  const none = { text: t('stNoNumber'), value: null };
  return [...order.map((code) => stateOf(model, code)), ...rest].map((s) => [
    s.name,
    t(`stStatus_${s.cls}`),
    num(count(s.n), s.n),
    ...(s.cls === 'scenario'
      ? [...SCENARIOS.map((_, k) => ({ ...num(money(s.lost[k]), s.lost[k]), data: { st: `${s.code} lost ${k}` } })),
        ...SCENARIOS.map((_, k) => { const v = numbersOf(s, k, 1).share; return { ...num(pct(v, 2), v), data: { st: `${s.code} share ${k}` } }; })]
      : SCENARIOS.flatMap(() => [none, none])),
  ]);
}

const tableOf = (model) => ({
  columns: [
    { name: t('stColState') }, { name: t('stColStatus') }, { name: t('stColHospitals'), numeric: true },
    ...SCENARIOS.map((s) => ({ name: fill('stColLost', { scenario: scenWord(s).toLowerCase() }), numeric: true })),
    ...SCENARIOS.map((s) => ({ name: fill('stColShare', { scenario: scenWord(s).toLowerCase() }), numeric: true })),
  ],
  rows: tableRows(model),
});

// ---------- the step ----------

// The headline's inside (the browser rewrites it).
export const headlineHtml = (h) => html`<p class="wr-sthead__big">${h.big}</p>
<p class="wr-sthead__why">${h.why}</p>`;

// The step. data: loadMedicaid()'s result; rows: hospitalRows(data); label: its heading; hubCcns: the CCNs with a hub page;
// model: statesModel's (the generator has it already; built here when not given).
export function statesStep({ data, rows, label: heading, hubCcns = new Set(), model = statesModel(data, rows, hubCcns) }) {
  const fy = data.meta.fy;
  const k = MIDDLE;
  const use = data.params.use_default;
  const code = model.selected;
  const scen = model.states.filter((s) => s.cls === 'scenario');
  const draw = (drawing) => frame({ kind: 'states', width: DRAWINGS[drawing].width, height: DRAWINGS[drawing].height, body: statesBody(statesLayout({ model, drawing, k, use, selected: code })) });
  const top = ranked(model, k).slice(0, 3).map((c) => { const s = stateOf(model, c); return `${s.name} ${pct(numbersOf(s, k, use).share, 2)}`; });
  const territories = model.states.filter((s) => s.cls === 'territory');
  const options = [...model.states].sort((a, b) => a.name.localeCompare(b.name));
  return html`<section class="step wr-step wr-states" id="states" aria-labelledby="states-h">
<div class="wr-step__words">
<h2 class="wr-sec" id="states-h">${heading} ${scenarioTag(fy)}</h2>
<div class="wr-sthead" data-st-head>${headlineHtml(headlineOf(model, code, { k, use }))}</div>
<p class="small muted">${t('stDek')}</p>
<div class="wr-stcard" data-st-default="${code}">
<div class="wr-stcard__top"><p class="cap wr-stcard__h">${t('stCardHead')}</p><p class="wr-stcard__name" data-st-name>${stateOf(model, code).name}</p><select class="wr-stcard__pick" aria-label="${t('stPick')}" hidden>${options.map((s) => html`<option value="${s.code}"${s.code === code ? html` selected` : ''}>${s.name}</option>`)}</select></div>
<div class="wr-stcard__body" data-st-card>${cardBody(model, code, { k, use })}</div><!-- /wr-stcard__body -->
</div>
</div>
<div class="wr-step__stage">
${figure({
    n: 3,
    takeaway: fill('stTakeaway', { n: count(scen.length) }),
    svg: draw('narrow'),
    svgWide: draw('wide'),
    alt: fill('stAlt', { n: count(scen.length), scenario: scenWord(SCENARIOS[k]).toLowerCase(), top: listText(top), m: count(model.states.filter((s) => GUTTER.includes(s.cls)).length) }),
    note: fill('stNote', { floor: money(floorLost(model)), t: numberWord(territories.length), territories: territories.map((s) => s.code).join(', ') }),
    source: html`${fill('figSource', { fy: String(fy) })} ${scenarioTag(fy)}`,
    claimLevel: 'hypothetical',
    table: tableOf(model),
    csvName: 'work-requirement-states',
  })}
</div>
</section>`;
}
