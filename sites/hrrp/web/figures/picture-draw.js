// The drawings of the program page's "The FY2027 picture" Part that the chart kit has no chart for: the size of the cuts (Step 2's
// swarm form, on the cut), the share cut by number of conditions measured with its interval [CF-11], the old site's strip plot of
// the cuts by peer group, and the range bar of each trait of a hospital [TD-10]. Each takes plain rows (figures/picture-data.js,
// with the words already made by figures/picture.js) and a drawing width and returns the SVG. The kit's marks and classes are
// reused wherever one fits (chart-share__*, chart-median, chart-ref); the few new ones are in sites/hrrp/styles.css.
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { html } from '../../../../web/render/html.js';
import { axis } from '../../../../web/charts/axis.js';
import { dotsPath, spread } from '../../../../web/charts/dots.js';
import { scoreSwarm } from '../../../../web/charts/scoreSwarm.js';
import { NOTE_PX, frame, isNarrow, lineD, mark, r2, text } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { clamp } from '../../../../engine/js/stats.js';
import { dotsFor } from './swarm.js';

// ---------- the size of the cuts ----------

// The drawing's margin on each side (scoreSwarm's); the dot layout is Step 2's swarm's (figures/swarm.js dotsFor).
const MARGIN = 8;
// A wide drawing's dots are a little larger than a phone's, which has the height to give.
const DOT_PITCH = { wide: 3.4, narrow: 2.4 };

// items: [{ score: the cut in percent }] of the measured hospitals; the no-cut pile sits in a bin of its own just left of zero.
// edges: the bins' edges, the first one the pile's; cap: the axis's top (percent). labels: { below, above } the counts at the line.
export function drawCuts({ items, edges, cap, labels, width, ticks, format }) {
  const { cols, pitch } = dotsFor(width, edges.length - 1, DOT_PITCH[isNarrow(width) ? 'narrow' : 'wide']);
  return scoreSwarm({
    items: items.map((i) => ({ score: Math.min(cap, i.score), yes: i.score > 0 })), edges, band: [0, 0], line: 0, width, pitch, cols,
    labels, ticks, format,
  });
}

// ---------- the share cut by number of conditions measured ----------

// rows: [{ label, sub, share (0 to 1), lo, hi (the interval), n, tip, valueText }], widest groups first as given.
export function drawMeasured({ rows, width, axisFormat }) {
  const narrow = isNarrow(width);
  const left = narrow ? 8 : 150;
  const right = width - (narrow ? 44 : 56);
  const x = scaleLinear().domain([0, 1]).range([left, right]);
  const most = Math.max(...rows.map((r) => r.n));
  const size = scaleSqrt().domain([0, most]).range([0, narrow ? 7 : 9]);
  const rowH = narrow ? 44 : 34;
  let y = 6;
  const out = rows.map((r) => {
    const cy = y + (narrow ? 30 : 17);
    const [xs, xl, xh] = [r2(x(r.share)), r2(x(r.lo)), r2(x(r.hi))];
    const body = html`<line class="chart-share__track" x1="${left}" x2="${right}" y1="${r2(cy)}" y2="${r2(cy)}"/>
<line class="cond-ci" x1="${xl}" x2="${xh}" y1="${r2(cy)}" y2="${r2(cy)}"/><line class="cond-ci" x1="${xl}" x2="${xl}" y1="${r2(cy - 4)}" y2="${r2(cy + 4)}"/><line class="cond-ci" x1="${xh}" x2="${xh}" y1="${r2(cy - 4)}" y2="${r2(cy + 4)}"/>
<circle class="chart-share__dot chart-share__dot--pen" cx="${xs}" cy="${r2(cy)}" r="${r2(Math.max(2.5, size(r.n)))}"/>
${narrow
    ? text({ x: 0, y: y + 12, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })
    : html`${text({ x: 0, y: cy - 1, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: 0, y: cy + 11, anchor: 'start', cls: 'chart-note', body: r.sub })}`}
${text({ x: width, y: cy + 4, anchor: 'end', cls: 'chart-value chart-label--pen', body: r.valueText })}`;
    const row = mark({ tip: r.tip, value: r.share, hit: { x: 0, y, width, height: rowH }, body });
    y += rowH;
    return row;
  });
  const ticks = narrow ? [0, 0.5, 1] : Array.from({ length: 11 }, (_, i) => r2(i / 10));
  return frame({
    kind: 'share', width, height: y + 30, body: html`${out}
<g transform="translate(0 ${r2(y + 4)})">${axis({ scale: x, orient: 'bottom', ticks, format: axisFormat })}</g>`,
  });
}

// ---------- the cuts by peer group: the old site's strip plot ----------

// The dot's shade by the size of its cut, the old site's bins (no cut, under 0.25%, under 0.5%, under 1%, under 2%, 2% or more).
export const stripShade = (red) => (red <= 0 ? 0 : red < 0.25 ? 1 : red < 0.5 ? 2 : red < 1 ? 3 : red < 2 ? 4 : 5);
const STRIP_DOT = 3.6;
// The strip plot's wide rows: their pitch and the header over the first (drawFlips shares them, so the two drawings' rows line up).
const STRIP_ROW = 46;
const STRIP_TOP = 26;

// rows: [{ label, sub, reds (cuts in percent of each measured hospital), median (percent or null), shareText, tip }];
// cap: the axis's top (percent); labels: { median, shade } for the key.
export function drawStrip({ rows, cap, width, labels, ticks, format }) {
  const narrow = isNarrow(width);
  const left = narrow ? MARGIN : 100;
  const right = width - (narrow ? MARGIN : 74);
  const rowH = narrow ? 56 : STRIP_ROW;
  const top = STRIP_TOP;
  const x = scaleLinear().domain([0, cap]).range([left, right]);
  const shades = Array.from({ length: 6 }, () => []);
  const body = rows.map((r, row) => {
    const y0 = top + row * rowH;
    const pad = narrow ? 22 : 7;
    r.reds.forEach((red, i) => shades[stripShade(red)].push([x(Math.min(cap, red)), y0 + pad + spread(i + 31 * row) * (rowH - pad - 7)]));
    // On a phone the row's words sit over its band; the band and the median tick start under them.
    const bandTop = y0 + (narrow ? 17 : 2);
    return mark({
      tip: r.tip, value: r.median, hit: { x: 0, y: y0, width, height: rowH },
      body: html`${row % 2 ? '' : html`<rect class="strip__band" x="${left}" y="${bandTop}" width="${r2(right - left)}" height="${y0 + rowH - 2 - bandTop}"/>`}
${narrow
    ? html`${text({ x: MARGIN, y: y0 + 13, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })}${text({ x: width - MARGIN, y: y0 + 13, anchor: 'end', cls: 'chart-value', body: r.shareText })}`
    : html`${text({ x: 0, y: y0 + rowH / 2 - 2, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: 0, y: y0 + rowH / 2 + 11, anchor: 'start', cls: 'chart-note', body: r.sub })}${text({ x: width, y: y0 + rowH / 2 + 4, anchor: 'end', cls: 'chart-value', body: r.shareText })}`}
`,
    });
  });
  // Each group's median tick over its dots (drawn after them), on a halo of the page's paper so the dots don't break it.
  const medians = rows.map((r, row) => {
    if (r.median === null) return '';
    const y0 = top + row * rowH;
    const mx = r2(x(Math.min(cap, r.median)));
    const [y1, y2] = [y0 + (narrow ? 17 : 2), y0 + rowH - 2];
    return html`<line class="strip__halo" x1="${mx}" x2="${mx}" y1="${y1}" y2="${y2}"/><line class="chart-median strip__median" x1="${mx}" x2="${mx}" y1="${y1}" y2="${y2}"/>`;
  });
  const dots = shades.map((pts, i) => dotsPath(pts, `strip-dot strip-dot--${i}`, STRIP_DOT));
  const base = top + rows.length * rowH;
  return frame({
    kind: 'strip', width, height: base + 34, body: html`<line class="chart-median strip__median" x1="${left + 4}" x2="${left + 4}" y1="4" y2="18"/>${text({ x: left + 12, y: 15, anchor: 'start', cls: 'chart-note', body: labels.median })}${text({ x: right, y: 15, anchor: 'end', cls: 'chart-note', body: labels.shade })}
${body}${dots}${medians}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks, format })}</g>`,
  });
}

// ---------- what did peer grouping change? ----------

// The flags each peer group gains and loses against one national median, as two bars from a line: those peer grouping takes off
// (grey, to the left) and those it puts on (penalty ink, to the right). The wide drawing shares the strip plot's geometry (its
// header, row pitch and axis), so beside it each group's bars sit level with its strip; a phone's rows carry their own label over
// the bars. rows: [{ label, sub, added, removed, tip }] in group order; labels: { off, on } over the line.
export function drawFlips({ rows, width, labels }) {
  const narrow = isNarrow(width);
  // A phone's row: its label, then its bars just under it, then air before the next row's label.
  const rowH = narrow ? 42 : STRIP_ROW;
  const top = STRIP_TOP;
  // Room at the left for the row labels and the largest number taken off, at the right for the largest put on.
  const left = narrow ? 30 : 100;
  const right = width - (narrow ? 24 : 34);
  const most = (key) => Math.max(1, ...rows.map((r) => r[key]));
  const x = scaleLinear().domain([-most('removed'), most('added')]).range([left, right]);
  const x0 = r2(x(0));
  const barH = narrow ? 12 : 14;
  const body = rows.map((r, row) => {
    const y0 = top + row * rowH;
    const yb = narrow ? y0 + 17 : y0 + rowH / 2 - 2 - barH / 2;
    const [xOff, xOn] = [r2(x(-r.removed)), r2(x(r.added))];
    const value = (v, at, anchor) => (v ? text({ x: at, y: yb + barH / 2 + 4, anchor, cls: 'chart-value', body: String(v) }) : '');
    return mark({
      tip: r.tip, value: [r.added, r.removed], hit: { x: 0, y: y0, width, height: rowH },
      body: html`${narrow || row % 2 ? '' : html`<rect class="strip__band" x="${left}" y="${y0 + 2}" width="${r2(right - left)}" height="${rowH - 4}"/>`}
${narrow
    ? text({ x: 0, y: y0 + 12, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })
    : text({ x: 0, y: y0 + rowH / 2 + 2, anchor: 'start', cls: 'chart-label', body: r.label })}
${r.removed ? html`<rect class="chart-bar" x="${xOff}" y="${r2(yb)}" width="${r2(x0 - xOff)}" height="${barH}"/>` : ''}${r.added ? html`<rect class="chart-col--pen" x="${x0}" y="${r2(yb)}" width="${r2(xOn - x0)}" height="${barH}"/>` : ''}
${value(r.removed, xOff - 5, 'end')}${value(r.added, xOn + 5, 'start')}`,
    });
  });
  const base = top + rows.length * rowH;
  return frame({
    kind: 'flips', width, height: base + 34, body: html`${text({ x: x0 - 6, y: 15, anchor: 'end', cls: 'chart-note', body: labels.off })}${text({ x: x0 + 6, y: 15, anchor: 'start', cls: 'chart-note chart-label--pen', body: labels.on })}
${body}
<line class="flips__zero" x1="${x0}" x2="${x0}" y1="4" y2="${r2(base)}"/>
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks: 4, format: (v) => String(Math.abs(v)) })}</g>`,
  });
}

// ---------- what is 0.01 of ratio worth? ----------

// For each condition, what 0.01 more of its ratio costs in modeled dollars across hospitals: a grey bar over the middle half of hospitals
// (25th to 75th percentile) and a dot in penalty ink at the typical (median) hospital, its value at the right in the same ink (the
// dollars a hospital loses, as the flags-and-dollars figure draws them). The first row names its dot and its bar in place, over them;
// a phone, on a line of their own over the first row. A phone's row sets its name just over its bar and its value at the bar's line. rows: [{ label, median, p25, p75, valueText, tip }]
// in order; labels: { dot, bar } (a phone's bar label is the short one, barShort).
export function drawWorth({ rows, width, labels, format }) {
  const narrow = isNarrow(width);
  const left = narrow ? 6 : 150;
  const right = width - (narrow ? 52 : 70);
  const most = Math.max(1, ...rows.map((r) => r.p75 ?? 0));
  const x = scaleLinear().domain([0, most]).range([left, right]).nice(4);
  const rowH = narrow ? 40 : 32;
  const top = 22;
  const out = rows.map((r, i) => {
    const y0 = top + i * rowH;
    const cy = r2(narrow ? y0 + 22 : y0 + rowH / 2);
    const body = html`<line class="chart-share__track" x1="${left}" x2="${r2(right)}" y1="${cy}" y2="${cy}"/>
${r.p25 === null ? '' : html`<rect class="worth__bar" x="${r2(x(r.p25))}" y="${r2(cy - 5)}" width="${r2(Math.max(1, x(r.p75) - x(r.p25)))}" height="10"/><circle class="worth__dot" cx="${r2(x(r.median))}" cy="${cy}" r="5"/>`}
${text({ x: 0, y: narrow ? y0 + 11 : cy + 4, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: width, y: cy + 4, anchor: 'end', cls: 'chart-value chart-label--pen', body: r.valueText })}`;
    return mark({ tip: r.tip, value: r.p25 === null ? null : [r.median, r.p25, r.p75], hit: { x: 0, y: y0, width, height: rowH }, body });
  });
  // The first priced row's dot and bar named over them: the dot's words ending at the dot, the bar's ending at the bar's end (its short
  // name where the long one would reach back over the dot's).
  const first = rows.find((r) => r.p25 !== null);
  const y = first ? (narrow ? 12 : r2(top + rows.indexOf(first) * rowH + rowH / 2 - 10)) : 0;
  const barName = first && x(first.p75) - textWidth(labels.bar, NOTE_PX) > x(first.median) + 8 ? labels.bar : labels.barShort;
  const named = first ? html`${text({ x: r2(x(first.median) - 4), y, anchor: 'end', cls: 'chart-note', body: labels.dot })}${text({ x: r2(x(first.p75)), y, anchor: 'end', cls: 'chart-note', body: barName })}` : '';
  const base = top + rows.length * rowH + 4;
  return frame({
    kind: 'worth', width, height: base + 30, body: html`${out}${named}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks: narrow ? x.ticks(5).filter((_, i) => i % 2 === 0) : 5, format })}</g>`,
  });
}

// ---------- are small hospitals let off? [FN-08] ----------

// One panel per condition, its bands of cases from fewest to most across: over a strip, the share of each band's hospitals over their
// peer median as a line of dots (penalty ink over half, open at or under; half dashed), and under it the middle half of the band's
// hospitals, ratio minus peer median (a grey bar from the 25th to the 75th percentile, an ink tick at the median, the median at 0),
// every panel on one scale (faint lines every BAND_GRID), so a wider bar is a wider spread. A band too small to show leaves its place
// empty. The wide drawing sets the six panels in a row with the tiers and the scale named in a gutter at the left; a phone's sets two to
// a row under a two-line header, the scale named on its first panel.
//   panels  [{ name, bands: [{ shown, label, share, p25, median, p75, tip }] }]: each panel's end labels name its first and last band drawn
//   labels  { flagged, half, middle, median, cases, headTop, headBottom }; format: share -> text; signed: a ratio gap -> text
// The middle-half tier's scale step: the shared reach rounds up to one, and a faint line marks each.
const BAND_GRID = 0.1;

// An end band's share, written over or under its dot (at x, y), or a line higher still, whichever crosses least: the line to its
// neighbour (next: its x, y) and the neighbour's dot weigh most, then the dashed half line (at half) anywhere in the words' height (a
// dash run into the number reads as a minus sign), then the wrong side of half (a share over half written under the half line reads
// as under it), then the farther spot. The label runs about 24 units from its dot, to the right (anchor 'start') or the left.
const FARTHER = 1.5;
function endLabelY({ x, y, share, next, half, anchor }) {
  const dir = anchor === 'start' ? 1 : -1;
  const span = [x + dir * 2, x + dir * 26].sort((a, c) => a - c);
  const segY = (at) => (next ? y + ((next.y - y) * (at - x)) / (next.x - x) : null);
  const score = (ly) => {
    const hits = (v) => v !== null && v >= ly - 10 && v <= ly + 2;
    const onDot = next && next.x + 4 >= span[0] && next.x - 4 <= span[1] && next.y + 4 >= ly - 10 && next.y - 4 <= ly + 2;
    const crosses = Array.from({ length: 7 }, (_, k) => span[0] + (k * (span[1] - span[0])) / 6).some((at) => hits(segY(at)));
    return (crosses || onDot ? 10 : 0) + (half >= ly - 12 && half <= ly + 4 ? 4 : 0) + (share > 0.5 && ly > half ? 3 : 0) + (share < 0.5 && ly < half ? 1 : 0);
  };
  const spots = [r2(y - 8), r2(y + 15), r2(y - 20)];
  return spots.map((ly, i) => ({ ly, cost: score(ly) + (i === 2 ? FARTHER : 0) })).reduce((a, b) => (b.cost < a.cost ? b : a)).ly;
}

export function drawSizeBands({ panels, width, labels, format, signed }) {
  const narrow = isNarrow(width);
  const cols = narrow ? 2 : panels.length;
  const gutter = narrow ? 0 : 96;
  const gap = narrow ? 18 : 16;
  const pw = (width - gutter - gap * (cols - 1)) / cols;
  const head = narrow ? 34 : 0;
  // A panel's rows: its name, the share tier, the middle-half tier, the band labels.
  const T = narrow
    ? { name: 12, top: 30, topH: 72, mid: 114, midH: 56, ends: 186, h: 204 }
    : { name: 12, top: 32, topH: 96, mid: 144, midH: 60, ends: 220, h: 234 };
  // The share tier spans the shares shown, rounded out to the tenth (half always inside it): a line, so it needn't start at zero.
  const shown = (p) => p.bands.map((b, j) => ({ ...b, j })).filter((b) => b.shown);
  const shares = panels.flatMap((p) => shown(p).map((b) => b.share));
  const hiShare = Math.min(1, Math.ceil(Math.max(0.5, ...shares) * 10 - 1e-9) / 10);
  const loShare = Math.max(0, Math.floor(Math.min(0.5, ...shares) * 10 + 1e-9) / 10);
  const reach = Math.max(0.01, ...panels.flatMap((p) => shown(p).flatMap((b) => [Math.abs(b.p25), Math.abs(b.p75)])));
  const m = Math.ceil(reach / BAND_GRID - 1e-9) * BAND_GRID;
  const grid = Array.from({ length: Math.round(m / BAND_GRID) * 2 + 1 }, (_, k) => r2(-m + k * BAND_GRID)).filter((v) => Math.abs(v) > 1e-9);
  const n = panels[0]?.bands.length ?? 0;
  const ysAt = (py) => scaleLinear().domain([loShare, hiShare]).range([py + T.top + T.topH, py + T.top]);
  // The strip's scale sits 4 px inside its edges, so a bar that reaches the scale's end doesn't read as cut off.
  const ygAt = (py) => scaleLinear().domain([-m, m]).range([py + T.mid + T.midH - 4, py + T.mid + 4]);
  const out = panels.map((p, i) => {
    const px = gutter + (i % cols) * (pw + gap);
    const py = head + Math.floor(i / cols) * T.h;
    const step = (pw - 16) / Math.max(1, n - 1);
    const xs = (j) => r2(px + 8 + j * step);
    const [ys, yg] = [ysAt(py), ygAt(py)];
    const drawn = shown(p);
    const pts = drawn.map((b) => ({ x: xs(b.j), y: r2(ys(b.share)) }));
    const [first, last] = [drawn[0], drawn[drawn.length - 1]];
    const valueAt = (b, next, anchor) => text({
      x: xs(b.j) + (anchor === 'start' ? 2 : -2), anchor, cls: `chart-value bands__value${b.share > 0.5 ? ' chart-label--pen' : ''}`, body: format(b.share),
      y: endLabelY({ x: xs(b.j), y: ys(b.share), share: b.share, next: next && { x: xs(next.j), y: ys(next.share) }, half: ys(0.5), anchor }),
    });
    const marks = drawn.map((b) => mark({
      tip: b.tip, value: [b.share, b.p25, b.p75], hit: { x: xs(b.j) - step / 2, y: py + T.top - 6, width: step, height: T.mid + T.midH - T.top + 12 },
      body: html`<rect class="bands__mid" x="${r2(xs(b.j) - 3.5)}" y="${r2(yg(b.p75))}" width="7" height="${r2(Math.max(1, yg(b.p25) - yg(b.p75)))}"/><line class="bands__med" x1="${r2(xs(b.j) - 6)}" x2="${r2(xs(b.j) + 6)}" y1="${r2(yg(b.median))}" y2="${r2(yg(b.median))}"/>
<circle class="chart-share__dot${b.share > 0.5 ? ' chart-share__dot--pen' : ''}" cx="${xs(b.j)}" cy="${r2(ys(b.share))}" r="3.5"/>`,
    }));
    return html`${text({ x: px, y: py + T.name, anchor: 'start', cls: 'chart-label', body: p.name })}
<line class="bands__half" x1="${r2(px)}" x2="${r2(px + pw)}" y1="${r2(ys(0.5))}" y2="${r2(ys(0.5))}"/>
${grid.map((v) => html`<line class="bands__grid" x1="${r2(px)}" x2="${r2(px + pw)}" y1="${r2(yg(v))}" y2="${r2(yg(v))}"/>`)}<line class="bands__zero" x1="${r2(px)}" x2="${r2(px + pw)}" y1="${r2(yg(0))}" y2="${r2(yg(0))}"/>
${pts.length > 1 ? html`<path class="bands__line" d="${lineD(pts, (v) => v, (v) => v)}"/>` : ''}${marks}
${first ? valueAt(first, drawn[1], 'start') : ''}${last && last !== first ? valueAt(last, drawn[drawn.length - 2], 'end') : ''}
${first ? text({ x: xs(first.j) - 4, y: py + T.ends, anchor: 'start', cls: 'chart-axis__label', body: first.label }) : ''}${last && last !== first ? text({ x: xs(last.j) + 4, y: py + T.ends, anchor: 'end', cls: 'chart-axis__label', body: last.label }) : ''}
${narrow && i === 0 ? text({ x: px, y: r2(yg(m) + 4), anchor: 'start', cls: 'chart-axis__label bands__value', body: signed(m) }) : ''}`;
  });
  const rows = Math.ceil(panels.length / cols);
  const [ys0, yg0] = [ysAt(head), ygAt(head)];
  const gutterText = narrow ? '' : html`${text({ x: 0, y: head + T.top + 10, anchor: 'start', cls: 'chart-note bands__tier', body: labels.flagged })}${text({ x: gutter - 8, y: r2(ys0(0.5) + 4), anchor: 'end', cls: 'chart-note', body: labels.half })}
${text({ x: 0, y: head + T.mid - 6, anchor: 'start', cls: 'chart-note bands__tier', body: labels.middle })}${text({ x: gutter - 8, y: r2(yg0(m) + 9), anchor: 'end', cls: 'chart-axis__label', body: signed(m) })}${text({ x: gutter - 8, y: r2(yg0(0) + 4), anchor: 'end', cls: 'chart-note', body: labels.median })}${text({ x: gutter - 8, y: r2(yg0(-m) + 4), anchor: 'end', cls: 'chart-axis__label', body: signed(-m) })}
${text({ x: gutter - 8, y: head + T.ends, anchor: 'end', cls: 'chart-note', body: labels.cases })}`;
  const header = narrow ? html`${text({ x: 0, y: 11, anchor: 'start', cls: 'chart-note', body: labels.headTop })}${text({ x: 0, y: 25, anchor: 'start', cls: 'chart-note', body: labels.headBottom })}` : '';
  return frame({ kind: 'bands', width, height: head + rows * T.h, body: html`${header}${gutterText}${out}` });
}

// ---------- the traits' ranges [TD-10] ----------

// traits: [{ name, groups: [{ label, share (percent), tip }], lo, hi (percent), spreadText }], widest first; national: { share (percent),
// text }; format: percent -> axis text. A trait is one row under its own heading and rule: set vertically in the left gutter
// on the wide drawing, over the row on a phone.
export function drawSpread({ traits, national, width, format, head }) {
  const narrow = isNarrow(width);
  const shares = traits.flatMap((t) => t.groups.map((g) => g.share)).concat(national.share);
  const lo = Math.max(0, Math.floor((Math.min(...shares) - 4) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...shares) + 4) / 10) * 10);
  const gutter = narrow ? 0 : 30;
  const x = scaleLinear().domain([lo, hi]).range([gutter + (narrow ? 22 : 20), width - (narrow ? 22 : 100)]);
  const rowH = narrow ? 100 : 80;
  // Label rows around the dots: on a phone the rows above (and below) sit a full line apart, so stacked labels never touch.
  const SLOTS = narrow ? [-9, 22, -23, 36] : [-10, 19, -22, 31];
  // The national line, drawn under the labels (their paper halo breaks it where one crosses); a label keeps off it when a free row allows.
  const nx = x(national.share);
  let y = 8;
  const blocks = traits.map((t) => {
    const cy = y + (narrow ? 58 : 40);
    const taken = SLOTS.map(() => []);
    const dots = [...t.groups].sort((a, b) => a.share - b.share).map((g) => {
      const w = textWidth(g.label, NOTE_PX) + 16;
      // The label's span where it is drawn (kept inside the drawing), so a label pushed in from an edge is checked where it sits.
      const center = clamp(x(g.share), w / 2, width - w / 2);
      // Off the line (wide drawing): shift the label to its dot's side of the line when it would cross it and still covers its dot.
      // A phone's dots sit too close for that (a shifted label lands over a neighbor), so its labels stay on their dots, over the line.
      const off = !narrow && nx > center - w / 2 + 2 && nx < center + w / 2 - 2 ? (x(g.share) < nx ? nx - 3 - w / 2 : nx + 3 + w / 2) : center;
      const at = Math.abs(off - x(g.share)) < w / 2 - 4 ? clamp(off, w / 2, width - w / 2) : center;
      const [a0, a1] = [at - w / 2, at + w / 2];
      const free = (spans) => spans.every(([b0, b1]) => a1 < b0 || a0 > b1);
      const k = taken.findIndex(free);
      const slot = k < 0 ? 0 : k;
      taken[slot].push([a0, a1]);
      return mark({
        tip: g.tip, value: g.share, hit: null,
        body: html`<circle class="chart-share__dot chart-share__dot--pen" cx="${r2(x(g.share))}" cy="${r2(cy)}" r="4.5"/>${text({ x: at, y: cy + SLOTS[slot] + 3, cls: 'chart-note chart-label--halo', body: g.label })}`,
      });
    });
    const heading = narrow
      ? html`<line class="spread__rule" x1="0" x2="${width}" y1="${y + 2}" y2="${y + 2}"/>${text({ x: 0, y: y + 18, anchor: 'start', cls: 'chart-cap', body: t.name })}`
      : html`<line class="spread__rule" x1="${gutter - 6}" x2="${gutter - 6}" y1="${y + 4}" y2="${y + rowH - 4}"/><text class="chart-cap" transform="translate(${gutter - 14} ${r2(cy)}) rotate(-90)" text-anchor="middle">${t.name}</text>`;
    const out = html`${heading}<line class="chart-share__stem" x1="${r2(x(t.lo))}" x2="${r2(x(t.hi))}" y1="${r2(cy)}" y2="${r2(cy)}"/>${dots}${text({ x: width, y: narrow ? y + 20 : cy + 6, anchor: 'end', cls: 'chart-spread', body: t.spreadText })}`;
    y += rowH;
    return out;
  });
  const ticks = [];
  for (let v = lo; v <= hi; v += narrow ? 20 : 10) ticks.push(v);
  return frame({
    kind: 'spread', width, height: y + 40, body: html`${narrow ? '' : text({ x: width, y: 8, anchor: 'end', cls: 'chart-cap', body: head })}
<line class="chart-ref" x1="${r2(nx)}" x2="${r2(nx)}" y1="4" y2="${r2(y - 4)}"/>${blocks}
<g transform="translate(0 ${r2(y)})">${axis({ scale: x, orient: 'bottom', ticks, format })}</g>
${text({ x: nx, y: y + 32, cls: 'chart-note', body: national.text })}`,
  });
}
