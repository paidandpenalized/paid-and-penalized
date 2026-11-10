// Step 1's figure, H4's three strips: every hospital in a scenario state drawn as a dot at the share of its patient
// revenue it could lose, once in each case (low, middle and high), on one square-root axis, the selected case's strip
// tall. Shared by the build (the server SVG, web/program/finding.js) and the browser (client/page.js redraws it for a
// group, the Find's matches and the page's hospital), so the two place every dot with the same arithmetic. Pure: no DOM,
// file or clock.
//
// Rows: each hospital in the emitted file as the strips need it (hospitalRows), and the browser's copy of them (the
// asset stripsAsset writes and decodeStrips reads), in the file's order, which is the order dots stack in.
import { rowToBase, scenario } from '../../../../engine/js/medicaid/scenario.js';
import { dotsD } from '../../../../web/charts/dots.js';
import { isNarrow, r2 } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { count, decimal, money, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { BEDS, GROUPS, REF_SHARE, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';

// ---------- the rows ----------

// A hospital's groups as the emitted file's roll-ups define them (pipeline/py/pp_pipeline/medicaid/build.py `groups`),
// for the chips: a bit per GROUPS entry.
const GROUP_TESTS = {
  critical_access: (b) => b.kind === 'critical_access',
  rural: (b) => b.kind === 'critical_access' || b.urban === false,
  safety_net: (b) => Array.isArray(b.safety_net) && b.safety_net.length > 0,
  public: (b) => b.own === 'Government',
  nonprofit: (b) => b.own === 'Nonprofit',
  forprofit: (b) => b.own === 'For-profit',
  beds_lt50: (b) => b.beds !== null && b.beds < BEDS.small,
  beds_300plus: (b) => b.beds !== null && b.beds >= BEDS.large,
};
export const groupsOf = (base) => GROUPS.reduce((bits, key, i) => (GROUP_TESTS[key](base) ? bits | (1 << i) : bits), 0);
export const inGroup = (row, key) => Boolean(row.groups & (1 << GROUPS.indexOf(key)));

// Shares are kept to 7 places (a tenth of a basis point) in the build and in the asset, so both lay the dots out from the
// same numbers.
const SHARE_PLACES = 1e7;
const shareOf = (lost, npr) => Math.round((lost / npr) * SHARE_PLACES) / SHARE_PLACES;

// Each hospital in the file: { ccn, name, city, state, cls, groups, share }, share being [low, middle, high], the share of
// its patient revenue it could lose in each case at the default use rate, or null when it is not drawn: outside a scenario
// state, or with no loss to draw (no Medicaid revenue, or a loss under SHARE_PLACES's last place; a filing error screened
// out; or no patient revenue to measure against; the caption counts these). data: loadMedicaid()'s result.
export function hospitalRows(data) {
  const { columns, states } = data;
  return [...data.hospitals.values()].map((row) => {
    const b = rowToBase(columns, row);
    let share = null;
    if (b.cls === 'scenario' && b.scored && b.net_patient_revenue > 0) {
      const shares = SCENARIOS.map((s) => shareOf(scenario(b, b.share, states[b.state].declines[s]).lost, b.net_patient_revenue));
      if (shares.every((v) => v > 0)) share = shares;
    }
    return { ccn: b.ccn, name: b.name, city: b.city, state: b.state, cls: b.cls, groups: groupsOf(b), share };
  });
}

// The browser's copy: the rows as arrays in COLS order, the axis's top (top) and the words the strips' headers print
// (words: { fy, lost, enrollees }: the cost reports' year, and each case's national dollars lost and Urban's enrollment
// decline in thousands).
const COLS = ['ccn', 'name', 'city', 'state', 'cls', 'groups', 'low', 'middle', 'high'];
export const stripsAsset = (rows, { top, words }) => ({
  cols: COLS,
  top,
  words,
  rows: rows.map((r) => [r.ccn, r.name, r.city, r.state, r.cls, r.groups, ...(r.share ?? [null, null, null])]),
});
export function decodeStrips(asset) {
  if (!asset || !Array.isArray(asset.rows) || asset.cols?.join() !== COLS.join() || !(asset.top > 0) || !asset.words) throw new TypeError('strips asset: not what the build wrote');
  const rows = asset.rows.map(([ccn, name, city, state, cls, groups, lo, mid, hi]) => ({ ccn, name, city, state, cls, groups, share: lo === null ? null : [lo, mid, hi] }));
  return { top: asset.top, words: asset.words, rows };
}

// The axis's top: the largest high-case share at the what-if's top use rate (useMax, the file's params.use_max), up to the
// next whole percent, so a reader moving the use rate never pushes a dot off the drawing.
export const axisTop = (rows, useMax) => Math.ceil(Math.max(...rows.filter((r) => r.share).map((r) => r.share[2])) * useMax * 100) / 100;

// The hospitals the strips draw, in the rows' order.
export const drawn = (rows) => rows.filter((r) => r.share);

// The median of sorted numbers.
const medianOf = (sorted) => {
  const n = sorted.length;
  if (!n) return null;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
export const median = (values) => medianOf([...values].sort((a, b) => a - b));

// ---------- the layout ----------

// The two drawings: the phone's (the kit's 300 across) and the wide one, at about the stage's width at 1280 and 1440. L,
// R: the strips' margins; head: a strip's header rows; strips: the three strips' height together; axis: the room under
// them; dot: the pitch range a strip's dots may take.
export const DRAWINGS = Object.freeze({
  narrow: { width: 300, L: 6, R: 6, head: 32, strips: 420, axis: 52, dot: [0.9, 3] },
  wide: { width: 680, L: 8, R: 8, head: 34, strips: 380, axis: 50, dot: [1, 5] },
});
// The selected strip's share of the strips' height; the other two split the rest.
const TALL = 0.46;
const DOT_STEP = 0.1;
// The labeled ticks (shares), those under the axis's top.
const TICKS = [0, 0.005, 0.01, 0.02, 0.04, 0.08, 0.12, 0.16, 0.2];
export const tickText = (v) => (v === 0 ? '0' : pct(v, v < REF_SHARE ? 1 : 0));

// The square-root axis across a drawing.
export const axisOf = (drawing, top) => (v) => drawing.L + Math.sqrt(Math.max(0, Math.min(v, top)) / top) * (drawing.width - drawing.L - drawing.R);

// A column's dots stack out from the strip's middle line: the first on it, then one above, one below, and so on.
const offset = (k) => (k === 0 ? 0 : k % 2 ? -(k + 1) / 2 : k / 2);

// Stacks values (shares) in columns of pitch d across from L: each value's column is its x's, and the values in a
// column take their places in order of value (then of their order given). Returns each value's [x, y] and the columns'
// counts.
function stack(values, { x, L, d, mid }) {
  const cols = values.map((v) => Math.floor((x(v) - L) / d));
  const order = values.map((_, i) => i).sort((a, b) => cols[a] - cols[b] || values[a] - values[b] || a - b);
  const counts = new Map();
  const at = new Array(values.length);
  for (const i of order) {
    const k = counts.get(cols[i]) ?? 0;
    counts.set(cols[i], k + 1);
    at[i] = [L + (cols[i] + 0.5) * d, mid + offset(k) * d];
  }
  return { at, counts };
}

// The widest pitch (down to the drawing's least) at which the tallest column fits the room.
function pitchFor(values, { x, L, room, dot: [lo, hi] }) {
  for (let d = hi; d > lo; d = Math.round((d - DOT_STEP) * 10) / 10) {
    const counts = new Map();
    let tall = 0;
    for (const v of values) {
      const c = Math.floor((x(v) - L) / d);
      const n = (counts.get(c) ?? 0) + 1;
      counts.set(c, n);
      if (n > tall) tall = n;
    }
    if (tall * d <= room) return d;
  }
  return lo;
}

// The three strips for a drawing: items, the hospitals drawn (drawn(rows)); top, the axis's top; selected, the tall case;
// use, the use rate's multiple of each share (1 at the default); only, a test for the hospitals a group keeps (null: all).
// Each strip: { s, y0, h, top, bot, mid, d, at (each item's [x, y], null for one a group leaves out), counts (every
// hospital's columns, for the group's gray outline), median (every hospital's), groupMedian (the group's, or null) }.
export function stripsLayout({ items, drawing, top, selected, use = 1, only = null }) {
  const geo = DRAWINGS[drawing];
  const x = axisOf(geo, top);
  const k = SCENARIOS.indexOf(selected);
  let y = 0;
  const strips = SCENARIOS.map((s, i) => {
    const h = geo.strips * (i === k ? TALL : (1 - TALL) / 2);
    const y0 = y;
    y += h;
    const room = h - geo.head - 6;
    const mid = y0 + geo.head + room / 2;
    const values = items.map((r) => r.share[i] * use);
    const d = pitchFor(values, { x, L: geo.L, room, dot: geo.dot });
    const all = stack(values, { x, L: geo.L, d, mid });
    let at = all.at;
    let groupMedian = null;
    if (only) {
      const keep = items.map((r) => only(r));
      const kept = values.filter((_, j) => keep[j]);
      const group = stack(kept, { x, L: geo.L, d, mid });
      at = new Array(items.length).fill(null);
      let n = 0;
      keep.forEach((on, j) => { if (on) at[j] = group.at[n++]; });
      groupMedian = median(kept);
    }
    return { s, y0, h, top: y0 + geo.head, bot: y0 + geo.head + room, mid, d, at, counts: all.counts, median: median(values), groupMedian };
  });
  return { geo, x, top, selected, strips, height: geo.strips + geo.axis };
}

// ---------- the drawing ----------

// A strip's dot diameter at pitch d.
const dotSize = (d) => Math.max(0.9, d * 0.9);

// The gray outline of every hospital behind a group's dots: each column's stack as one bar.
// A column of n dots reaches ceil((n - 1) / 2) pitches above the middle line (offset).
const outlineD = (counts, { L, d, mid }) => [...counts].map(([c, n]) => `M${r2(L + c * d)} ${r2(mid - (Math.ceil((n - 1) / 2) + 0.5) * d)}h${r2(d)}v${r2(n * d)}h${r2(-d)}z`).join('');

const scenWord = (s) => t(`scen${s[0].toUpperCase()}${s.slice(1)}`);

// A strip's header: its case and Urban's enrollment decline under it, the case's dollars lost a year at the right, and
// under them the state mitigation the case assumes (the phone's drawing moves the decline down to that line).
function header(st, { geo, on, words, narrow }) {
  const enrollees = fill('stripEnrollees', { n: decimal(words.enrollees[st.s] / 1000, 1) });
  const mitigation = t(`stripMit_${st.s}`);
  const y = r2(st.y0 + 16);
  return html`<text x="${geo.L}" y="${y}"><tspan class="wr-strip__name${on ? ' wr-strip__name--on' : ''}">${scenWord(st.s)}</tspan>${narrow ? '' : html`<tspan class="chart-label" dx="6">· ${enrollees}</tspan>`}</text>
<text x="${geo.width - geo.R}" y="${y}" text-anchor="end"><tspan class="wr-strip__money${on ? ' wr-strip__money--on' : ''}">${money(words.lost[st.s])}</tspan><tspan class="chart-note" dx="4">${t('stripLost')}</tspan></text>
<text class="chart-note" x="${geo.L}" y="${r2(st.y0 + 29)}">${narrow ? `${enrollees} · ${mitigation}` : mitigation}</text>`;
}

// One strip: its rule, the selected one's pen edge, the 1% line, the median (and in a group, the group's own and the gray
// outline of every hospital), the dots, its header.
function strip(st, { layout, words, group, narrow }) {
  const { geo, x } = layout;
  const on = st.s === layout.selected;
  const ref = r2(x(REF_SHARE));
  const placed = st.at.filter(Boolean);
  const dots = html`<path class="chart-dots wr-dots${group || on ? ' wr-dots--on' : ''}" stroke-width="${r2(dotSize(st.d))}" d="${dotsD(placed)}"/>`;
  const mx = r2(x(st.median));
  const medians = group
    ? html`<line class="wr-median wr-median--all" x1="${mx}" x2="${mx}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>${st.groupMedian === null ? '' : html`<line class="wr-median" x1="${r2(x(st.groupMedian))}" x2="${r2(x(st.groupMedian))}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>`}`
    : html`<line class="wr-median${on ? '' : ' wr-median--off'}" x1="${mx}" x2="${mx}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>`;
  let label = '';
  if (on && !group) label = html`<text class="chart-label chart-label--halo wr-median__label" x="${r2(mx + 5)}" y="${r2(st.top + 10)}">${fill('stripMedian', { share: pct(st.median, 2) })}</text>`;
  if (on && group) {
    label = html`<text class="chart-note chart-label--halo wr-median__label" x="${r2(mx + 5)}" y="${r2(st.top + 10)}">${fill('stripMedianAll', { share: pct(st.median, 2) })}</text>${st.groupMedian === null ? '' : html`<text class="chart-label chart-label--halo wr-median__label" x="${r2(x(st.groupMedian) + 5)}" y="${r2(st.top + 24)}">${fill('stripMedianGroup', { group: group.name, share: pct(st.groupMedian, 2) })}</text>`}`;
  }
  return html`<g class="wr-strip${on ? ' wr-strip--on' : ''}" data-scen="${st.s}">
<line class="wr-strip__rule${st.s === 'low' ? ' wr-strip__rule--top' : ''}" x1="0" x2="${geo.width}" y1="${r2(st.y0 + 0.5)}" y2="${r2(st.y0 + 0.5)}"/>${on ? html`<rect class="wr-strip__edge" x="0" y="${r2(st.y0 + 2)}" width="3" height="${r2(st.h - 2)}"/>` : ''}
${group ? html`<path class="wr-outline" d="${outlineD(st.counts, { L: geo.L, d: st.d, mid: st.mid })}"/>` : ''}<line class="chart-ref" x1="${ref}" x2="${ref}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>
${dots}
${medians}${label}
${header(st, { geo, on, words, narrow })}
</g>`;
}

// The axis under the strips: the hairline, the labeled ticks, its title and the scale's note.
function axisBlock(layout, words) {
  const { geo, x, top } = layout;
  const y = geo.strips + 4;
  const ticks = TICKS.filter((v) => v <= top);
  let last = -Infinity;
  const labels = ticks.map((v) => {
    const at = r2(x(v));
    const show = at - last >= 26;
    if (show) last = at;
    return html`<line class="chart-grid" x1="${at}" x2="${at}" y1="0" y2="${r2(y)}"/><line class="chart-axis__tick" x1="${at}" x2="${at}" y1="${r2(y)}" y2="${r2(y + 4)}"/>${show ? html`<text class="chart-axis__label" x="${at}" y="${r2(y + 16)}" text-anchor="middle">${tickText(v)}</text>` : ''}`;
  });
  const right = geo.width - geo.R;
  return html`<g class="chart-axis"><line class="chart-axis__line" x1="${geo.L}" x2="${r2(right)}" y1="${r2(y)}" y2="${r2(y)}"/>${labels}</g>
<text class="chart-axis__title" x="${r2(right)}" y="${r2(y + 31)}" text-anchor="end">${fill('stripAxis', { fy: String(words.fy) })}</text>
<text class="chart-note" x="${geo.L}" y="${r2(y + 45)}">${fill('stripScale', { line: pct(REF_SHARE, 0) })}</text>`;
}

// The thread's name label's type size (styles.css .wr-thread__name).
const NAME_PX = 13;

// The page's hospital (index i in the items) threaded through its three dots, named at the selected strip; nothing when
// it is not drawn (a group that leaves it out).
function thread(layout, i, name) {
  const pts = layout.strips.map((st) => st.at[i]);
  if (pts.some((p) => !p)) return '';
  const k = SCENARIOS.indexOf(layout.selected);
  const [ax, ay] = pts[k];
  const right = layout.geo.width - layout.geo.R;
  const toLeft = ax + 8 + textWidth(name, NAME_PX) > right;
  return html`<g class="wr-thread"><path class="wr-thread__line" d="M${pts.map(([px, py]) => `${r2(px)} ${r2(py)}`).join('L')}"/>${pts.map(([px, py]) => html`<circle class="wr-thread__dot" cx="${r2(px)}" cy="${r2(py)}" r="4"/>`)}<text class="chart-label chart-label--halo wr-thread__name" x="${r2(toLeft ? ax - 8 : ax + 8)}" y="${r2(ay - 8)}"${toLeft ? html` text-anchor="end"` : ''}>${name}</text></g>`;
}

// The drawing's body: the strips, the hospitals the Find matches (lit: item indexes) drawn larger in ink, the page's hospital's
// thread (hospital: { i, name }, or null), the axis. group: { name } while a group is lit, else null.
export function stripsBody(layout, { words, group = null, lit = null, hospital = null }) {
  const narrow = isNarrow(layout.geo.width);
  const litDots = lit && lit.length
    ? layout.strips.map((st) => html`<path class="chart-dots wr-dots--lit" stroke-width="${r2(dotSize(st.d) + 3)}" d="${dotsD(lit.map((i) => st.at[i]).filter(Boolean))}"/>`)
    : '';
  return html`${layout.strips.map((st) => strip(st, { layout, words, group, narrow }))}
${litDots}${hospital ? thread(layout, hospital.i, hospital.name) : ''}
${axisBlock(layout, words)}`;
}

// ---------- the group's readout ----------

// One line on a group against every hospital drawn, in the selected case: how many it holds, its median loss against all
// hospitals' median, and how many of its hospitals lose REF_SHARE or more. members: the group's drawn hospitals; all: every
// drawn hospital; k: the case's index; use: the use rate's multiple.
export function groupReadout({ name, members, all, k, use = 1 }) {
  const values = members.map((r) => r.share[k] * use);
  const words = {
    group: name,
    median: pct(median(values), 2),
    all: pct(median(all.map((r) => r.share[k] * use)), 2),
    scenario: scenWord(SCENARIOS[k]).toLowerCase(),
  };
  if (values.length === 1) return fill('chipReadoutOne', words);
  return fill('chipReadout', { ...words, n: count(values.length), big: count(values.filter((v) => v >= REF_SHARE).length), line: pct(REF_SHARE, 0) });
}
