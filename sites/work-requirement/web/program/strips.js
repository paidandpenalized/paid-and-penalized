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
import { pathNumbers } from '../../../../web/charts/pathd.js';
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

// The browser's copy: the rows as arrays in COLS order, the axis's top (top), the words the strips' headers print
// (words: { fy, lost, enrollees }: the cost reports' year, and each case's national dollars lost and Urban's enrollment
// decline in thousands), and what the other steps draw at the default use rate (totals: model.js serverTotals; how:
// how.js howModel; states: states.js statesAsset; hosp: step 4's asset for each state, its address by code; away: the
// hub's hospitals the file leaves out, data.js loadAway's rows; both: step 5's penalties, both.js bothInput).
const COLS = ['ccn', 'name', 'city', 'state', 'cls', 'groups', 'low', 'middle', 'high'];
export const stripsAsset = (rows, { top, words, totals, how, states, hosp, away, both }) => ({
  cols: COLS,
  top,
  words,
  totals,
  how,
  states,
  hosp,
  away,
  both,
  rows: rows.map((r) => [r.ccn, r.name, r.city, r.state, r.cls, r.groups, ...(r.share ?? [])]), // an undrawn row ends at its groups: no three nulls
});
export function decodeStrips(asset) {
  if (!asset || !Array.isArray(asset.rows) || asset.cols?.join() !== COLS.join() || !(asset.top > 0) || !asset.words || !asset.totals || !asset.how || !asset.states
    || !asset.hosp || typeof asset.hosp !== 'object' || !Array.isArray(asset.away) || !asset.both) {
    throw new TypeError('strips asset: not what the build wrote');
  }
  const rows = asset.rows.map(([ccn, name, city, state, cls, groups, lo, mid, hi]) => ({ ccn, name, city, state, cls, groups, share: lo === undefined ? null : [lo, mid, hi] }));
  return { top: asset.top, words: asset.words, totals: asset.totals, how: asset.how, states: asset.states, hosp: asset.hosp, away: asset.away, both: asset.both, rows };
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
// R: the strips' margins; head: a strip's header rows; strips: the three strips' height together; tall: the selected
// strip's share of it (the other two split the rest); axis: the room under them (the wide drawing sets its title and the
// scale's note on one row); dot: the pitch range a strip's dots may take. The wide drawing's selected strip has the room
// for a pitch near 2.7 units in the middle case, so its dots draw about 2 px across with a gap at 1440 by 900.
export const DRAWINGS = Object.freeze({
  narrow: { width: 300, L: 6, R: 6, head: 32, strips: 420, tall: 0.46, axis: 52, dot: [0.9, 3] },
  wide: { width: 680, L: 8, R: 8, head: 34, strips: 430, tall: 0.58, axis: 36, dot: [1, 5] },
});
const DOT_STEP = 0.1;
// Each dot's run (dots.js dotsD): the stage scales its figures with CSS zoom, under which Firefox streaks a zero-length dot.
export const DOT_RUN = 1;
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
// hospital's columns, for the group's gray outline), shown (the columns of the dots drawn: every hospital's, or the
// group's), median (every hospital's), groupMedian (the group's, or null) }.
export function stripsLayout({ items, drawing, top, selected, use = 1, only = null }) {
  const geo = DRAWINGS[drawing];
  const x = axisOf(geo, top);
  const k = SCENARIOS.indexOf(selected);
  let y = 0;
  const strips = SCENARIOS.map((s, i) => {
    const h = geo.strips * (i === k ? geo.tall : (1 - geo.tall) / 2);
    const y0 = y;
    y += h;
    const room = h - geo.head - 6;
    const mid = y0 + geo.head + room / 2;
    const values = items.map((r) => r.share[i] * use);
    const d = pitchFor(values, { x, L: geo.L, room, dot: geo.dot });
    const all = stack(values, { x, L: geo.L, d, mid });
    let at = all.at;
    let shown = all.counts;
    let groupMedian = null;
    if (only) {
      const keep = items.map((r) => only(r));
      const kept = values.filter((_, j) => keep[j]);
      const group = stack(kept, { x, L: geo.L, d, mid });
      at = new Array(items.length).fill(null);
      let n = 0;
      keep.forEach((on, j) => { if (on) at[j] = group.at[n++]; });
      shown = group.counts;
      groupMedian = median(kept);
    }
    return { s, y0, h, top: y0 + geo.head, bot: y0 + geo.head + room, mid, d, at, counts: all.counts, shown, median: median(values), groupMedian };
  });
  return { geo, x, top, selected, strips, height: geo.strips + geo.axis };
}

// ---------- the drawing ----------

// The medians' labels' type size (styles.css .wr-median__label: the type face).
const MEDIAN_PX = 11;

// text cut to max units wide at size (the kit's estimate, an upper bound), ending in an ellipsis; whole when it fits.
export function fitText(text, max, size, { mono = false } = {}) {
  if (textWidth(text, size, { mono }) <= max) return text;
  const chars = [...text];
  while (chars.length && textWidth(`${chars.join('').trimEnd()}…`, size, { mono }) > max) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

// A label beside a mark at x, kept inside span ([lo, hi], the strips' margins): right of it (gap away) where it fits,
// else left of it, else set against the end the mark is nearer (the label then sits over the mark, which a halo keeps
// readable), and cut with an ellipsis (fitText) when it is wider than the span itself. Returns { x, anchor, text }.
export function markLabel(x, text, { size, mono = false, gap, span }) {
  const fitted = fitText(text, span[1] - span[0], size, { mono });
  return { ...placeAt(x, textWidth(fitted, size, { mono }), { gap, span }), text: fitted };
}

// markLabel's rule for a label w units wide (a block of lines: its widest): { x, anchor }.
export function placeAt(x, w, { gap, span: [lo, hi] }) {
  if (x + gap + w <= hi) return { x: x + gap, anchor: 'start' };
  if (x - gap - w >= lo) return { x: x - gap, anchor: 'end' };
  return x - lo > hi - x ? { x: hi, anchor: 'end' } : { x: lo, anchor: 'start' };
}

// The selected strip's dot diameter at pitch d: a little under the pitch, so each dot stands apart from the next. The
// other two strips' pitch is too small for dots to stand apart (they drew as a moiré of slivers), so each of their columns
// is drawn as the one bar its dots make (columnsD).
export const DOT_GAP = 0.82;
export const dotSize = (d) => Math.max(0.9, d * DOT_GAP);

// A strip's columns of dots as one path of vertical strokes, each a stroke the pitch wide (stroke-width d, so the columns
// meet edge to edge) from its top dot's top to its bottom dot's bottom: counts, the columns ([column, dots]); a column
// of n dots reaches ceil((n - 1) / 2) pitches above the middle line (offset). In tenths of a unit, each stroke after the
// first moved to relative to the last one's end, so the moves add up exactly.
export function columnsD(counts, { L, d, mid }) {
  const cols = [...counts].sort((a, b) => a[0] - b[0]).map(([c, n]) => [Math.round((L + (c + 0.5) * d) * 10), Math.round((mid - (Math.ceil((n - 1) / 2) + 0.5) * d) * 10), Math.round(n * d * 10)]);
  let out = '';
  let end = null;
  for (const [x, y, len] of cols) {
    out += end ? `m${pathNumbers((x - end[0]) / 10, (y - end[1]) / 10)}v${pathNumbers(len / 10)}` : `M${pathNumbers(x / 10, y / 10)}v${pathNumbers(len / 10)}`;
    end = [x, y + len];
  }
  return out;
}

// The gray outline of every hospital behind a group's dots: each column's stack as one bar.
// A column of n dots reaches ceil((n - 1) / 2) pitches above the middle line (offset).
const outlineD = (counts, { L, d, mid }) => [...counts].map(([c, n]) => `M${r2(L + c * d)} ${r2(mid - (Math.ceil((n - 1) / 2) + 0.5) * d)}h${r2(d)}v${r2(n * d)}h${r2(-d)}z`).join('');

const scenWord = (s) => t(`scen${s[0].toUpperCase()}${s.slice(1)}`);

// A strip's header, drawn over everything else on a paper halo so neither a thread nor a dot runs through its words: its
// case and Urban's enrollment decline under it (the low case's with the small note that CMS's count sits there), the
// case's dollars lost a year at the right, and under them the state mitigation the case assumes (the phone's drawing
// moves the decline down to that line).
function header(st, { geo, on, words, narrow }) {
  const enrollees = fill('stripEnrollees', { n: decimal(words.enrollees[st.s] / 1000, 1) });
  const mitigation = t(`stripMit_${st.s}`);
  const y = r2(st.y0 + 16);
  const note = st.s === 'low' ? html`<tspan class="chart-label wr-strip__note" dx="10">${t('stripOfficial')}</tspan>` : '';
  return html`<g class="wr-head chart-label--halo" data-scen="${st.s}"><text x="${geo.L}" y="${y}"><tspan class="wr-strip__name${on ? ' wr-strip__name--on' : ''}">${scenWord(st.s)}</tspan>${narrow ? '' : html`<tspan class="chart-label" dx="6">· ${enrollees}</tspan>`}${note}</text>
<text x="${geo.width - geo.R}" y="${y}" text-anchor="end"><tspan class="wr-strip__money${on ? ' wr-strip__money--on' : ''}">${money(words.lost[st.s])}</tspan><tspan class="chart-note" dx="4">${t('stripLost')}</tspan></text>
<text class="chart-note" x="${geo.L}" y="${r2(st.y0 + 29)}">${narrow ? `${enrollees} · ${mitigation}` : mitigation}</text></g>`;
}

// One strip: its rule, the selected one's pen edge, the 1% line, the median (and in a group, the group's own and the gray
// outline of every hospital) and the dots. Its header is drawn last (header).
function strip(st, { layout, group }) {
  const { geo, x } = layout;
  const on = st.s === layout.selected;
  const ref = r2(x(REF_SHARE));
  const placed = st.at.filter(Boolean);
  const dots = on
    ? html`<path class="chart-dots wr-dots wr-dots--on" stroke-width="${r2(dotSize(st.d))}" d="${dotsD(placed, { run: DOT_RUN })}"/>`
    : html`<path class="wr-cols${group ? ' wr-cols--on' : ''}" stroke-width="${r2(st.d)}" d="${columnsD(st.shown, { L: geo.L, d: st.d, mid: st.mid })}"/>`;
  const mx = r2(x(st.median));
  const medians = group
    ? html`<line class="wr-median wr-median--all" x1="${mx}" x2="${mx}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>${st.groupMedian === null ? '' : html`<line class="wr-median" x1="${r2(x(st.groupMedian))}" x2="${r2(x(st.groupMedian))}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>`}`
    : html`<line class="wr-median${on ? '' : ' wr-median--off'}" x1="${mx}" x2="${mx}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>`;
  const span = [geo.L, geo.width - geo.R];
  // A median's label, beside its line (markLabel) at row y; cls: its ink.
  const medianLabel = (cls, at, y, text) => {
    const p = markLabel(at, text, { size: MEDIAN_PX, mono: true, gap: 5, span });
    return html`<text class="${cls} chart-label--halo wr-median__label" x="${r2(p.x)}" y="${r2(y)}"${p.anchor === 'end' ? html` text-anchor="end"` : ''}>${p.text}</text>`;
  };
  let label = '';
  if (on && !group) label = medianLabel('chart-label', mx, st.top + 10, fill('stripMedian', { share: pct(st.median, 2) }));
  if (on && group) {
    label = medianLabel('chart-note', mx, st.top + 10, fill('stripMedianAll', { share: pct(st.median, 2) }));
    if (st.groupMedian !== null) {
      // The group's name gives way first: shortened so its median still shows in full (the chips' readout names it whole).
      const share = pct(st.groupMedian, 2);
      const room = span[1] - span[0] - textWidth(fill('stripMedianGroup', { group: '', share }), MEDIAN_PX, { mono: true });
      label = html`${label}${medianLabel('chart-label', x(st.groupMedian), st.top + 24, fill('stripMedianGroup', { group: fitText(group.name, room, MEDIAN_PX, { mono: true }), share }))}`;
    }
  }
  return html`<g class="wr-strip${on ? ' wr-strip--on' : ''}" data-scen="${st.s}">
<line class="wr-strip__rule${st.s === 'low' ? ' wr-strip__rule--top' : ''}" x1="0" x2="${geo.width}" y1="${r2(st.y0 + 0.5)}" y2="${r2(st.y0 + 0.5)}"/>${on ? html`<rect class="wr-strip__edge" x="0" y="${r2(st.y0 + 2)}" width="3" height="${r2(st.h - 2)}"/>` : ''}
${group ? html`<path class="wr-outline" d="${outlineD(st.counts, { L: geo.L, d: st.d, mid: st.mid })}"/>` : ''}<line class="chart-ref" x1="${ref}" x2="${ref}" y1="${r2(st.top)}" y2="${r2(st.bot)}"/>
${dots}
${medians}${label}
</g>`;
}

// The axis's labeled ticks, those under its top.
const ticksOf = (top) => TICKS.filter((v) => v <= top);

// The gridlines at the labeled ticks, drawn first, under the strips.
const gridOf = ({ geo, x, top }) => html`<g class="wr-grid">${ticksOf(top).map((v) => html`<line class="chart-grid" x1="${r2(x(v))}" x2="${r2(x(v))}" y1="0" y2="${r2(geo.strips + 4)}"/>`)}</g>`;

// The axis under the strips: the hairline, the labeled ticks, its title and the scale's note.
function axisBlock(layout, words) {
  const { geo, x, top } = layout;
  const y = geo.strips + 4;
  let last = -Infinity;
  const labels = ticksOf(top).map((v) => {
    const at = r2(x(v));
    const show = at - last >= 26;
    if (show) last = at;
    return html`<line class="chart-axis__tick" x1="${at}" x2="${at}" y1="${r2(y)}" y2="${r2(y + 4)}"/>${show ? html`<text class="chart-axis__label" x="${at}" y="${r2(y + 16)}" text-anchor="middle">${tickText(v)}</text>` : ''}`;
  });
  const right = geo.width - geo.R;
  const oneRow = !isNarrow(geo.width);
  return html`<g class="chart-axis"><line class="chart-axis__line" x1="${geo.L}" x2="${r2(right)}" y1="${r2(y)}" y2="${r2(y)}"/>${labels}</g>
<text class="chart-axis__title" x="${r2(right)}" y="${r2(y + 31)}" text-anchor="end">${fill('stripAxis', { fy: String(words.fy) })}</text>
<text class="chart-note" x="${geo.L}" y="${r2(y + (oneRow ? 31 : 45))}">${fill('stripScale', { line: pct(REF_SHARE, 0) })}</text>`;
}

// The thread's name label's type size (styles.css .wr-thread__name).
const NAME_PX = 13;

// The page's hospital (index i in the items) threaded through its three dots, named at the selected strip; nothing when
// it is not drawn (a group that leaves it out). Exported for the fit test.
export function thread(layout, i, name) {
  const pts = layout.strips.map((st) => st.at[i]);
  if (pts.some((p) => !p)) return '';
  const k = SCENARIOS.indexOf(layout.selected);
  const [ax, ay] = pts[k];
  const { geo } = layout;
  const p = markLabel(ax, name, { size: NAME_PX, gap: 8, span: [geo.L, geo.width - geo.R] });
  return html`<g class="wr-thread"><path class="wr-thread__line" d="M${pts.map(([px, py]) => `${r2(px)} ${r2(py)}`).join('L')}"/>${pts.map(([px, py]) => html`<circle class="wr-thread__dot" cx="${r2(px)}" cy="${r2(py)}" r="4"/>`)}<text class="chart-label chart-label--halo wr-thread__name" x="${r2(p.x)}" y="${r2(ay - 8)}"${p.anchor === 'end' ? html` text-anchor="end"` : ''}>${p.text}</text></g>`;
}

// The drawing's body: the gridlines, the strips, the hospitals the Find matches (lit: item indexes) drawn larger in ink, the page's hospital's
// thread (hospital: { i, name }, or null), the strips' headers, the axis. group: { name } while a group is lit, else null.
export function stripsBody(layout, { words, group = null, lit = null, hospital = null }) {
  const narrow = isNarrow(layout.geo.width);
  const litDots = lit && lit.length
    ? layout.strips.map((st) => html`<path class="chart-dots wr-dots--lit" stroke-width="${r2(dotSize(st.d) + 3)}" d="${dotsD(lit.map((i) => st.at[i]).filter(Boolean), { run: DOT_RUN })}"/>`)
    : '';
  return html`${gridOf(layout)}
${layout.strips.map((st) => strip(st, { layout, group }))}
${litDots}${hospital ? thread(layout, hospital.i, hospital.name) : ''}
${layout.strips.map((st) => header(st, { geo: layout.geo, on: st.s === layout.selected, words, narrow }))}
${axisBlock(layout, words)}`;
}

// The figure's text alternative at a use rate (each case's median share lost; client/page.js rewrites it as the use rate
// moves). items: the hospitals drawn.
export const stripsAlt = (items, use = 1) => {
  const [low, middle, high] = SCENARIOS.map((_, k) => pct(median(items.map((r) => r.share[k] * use)), 2));
  return fill('figAlt', { low, middle, high });
};

// ---------- the figure's table ----------

// The table's bins of share lost, up to the axis's top: each bin holds [from, to), the last [from, top].
const BIN_EDGES = [0, 0.0025, 0.005, 0.01, 0.02, 0.04, 0.08];
// Figure 1's table at a use rate: the bins' edges, each case's count of hospitals in each bin, and each case's median.
// The build writes it at the default rate; client/page.js rewrites the cells (data-bin) as the rate moves.
export function binsOf(items, top, use = 1) {
  const edges = [...BIN_EDGES.filter((e) => e < top), top];
  // The last bin whose start the share reaches (findLastIndex is newer than the bundles' ES2020).
  const binOf = (v) => {
    let b = 0;
    for (let i = 1; i < edges.length - 1; i += 1) if (v >= edges[i]) b = i;
    return b;
  };
  const counts = SCENARIOS.map((_, k) => {
    const c = new Array(edges.length - 1).fill(0);
    for (const r of items) c[binOf(r.share[k] * use)] += 1;
    return c;
  });
  return { edges, counts, medians: SCENARIOS.map((_, k) => median(items.map((r) => r.share[k] * use))) };
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
