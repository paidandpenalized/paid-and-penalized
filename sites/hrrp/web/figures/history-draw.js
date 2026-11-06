// The drawing of the program page's History figure [HI-09]: small multiples, the share of hospitals cut as a large line with each
// rule change written in words at its point (the cap steps from the data, then the marks history-data.js returns), the average cut
// (penalized hospitals and all) and the estimated totals (CMS dark, KFF light) small beside it, the pandemic years shaded in every
// panel. The wide drawing sets the large panel left and the two small ones stacked right; the phone's stacks all three. A year with
// no value breaks a line and draws no bar: never a zero. Plain data in (figures/history-data.js smallLines()), SVG out; the kit's
// classes are reused where one fits, the few new ones (hist-*) are in sites/hrrp/web/styles.css. Words come from program/copy.js.
import { scaleBand, scaleLinear } from 'd3-scale';
import { html } from '../../../../web/render/html.js';
import { NOTE_PX, capsWidth, columnPath, frame, isNarrow, lineD, mark, r2, text } from '../../../../web/charts/svg.js';
import { textWidth, wrapText } from '../../../../web/charts/text.js';
import { fyLabel } from '../copy.js';
import { fmtPct } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { yy } from './year-axis.js';

const RIGHT = 8;
const LINE_H = 12;
const SHARE_STEP = 20;
// What a position costs when it leaves the plot, crosses a line, or lands on words already set.
const OUTSIDE = 100;
const CROSSES_LINE = 1;
const OVERLAPS_WORDS = 10;

export const usdM = (v) => `$${Math.round(v / 1e6)}M`;

// ---------- placing words beside a point ----------

// A polyline's y at px (null in a gap or outside it). pts: [{ px, py }] in order, py null for a year with no value.
function lineAt(pts, px) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (a.py === null || b.py === null || px < a.px || px > b.px) continue;
    return a.py + ((b.py - a.py) * (px - a.px)) / (b.px - a.px || 1);
  }
  return null;
}

// Each item is words at a point, set above or below it (a short leader joining them when the item asks), at the first position that stays
// inside the plot, clear of every line and of the words already set; if none is clear, at the one that breaks the fewest rules.
//   items  [{ at: [{ px, py }] (the points it may sit at, best first), lines: [{ text, cls, mono }], sides, anchors, gap, leader, cls (a hook for tests, no style), data }]
//   box    { x0, x1, top, bottom }: the plot's limits; polys: the lines to keep clear of, [[{ px, py }]]
function place(items, { box, polys }) {
  const placed = [];
  // An item with no point to sit at draws nothing.
  return items.filter((it) => it.at.length).map((it) => {
    const w = Math.max(...it.lines.map((l) => (l.mono ? textWidth(l.text, NOTE_PX, { mono: true }) : l.caps ? capsWidth(l.text) : textWidth(l.text, NOTE_PX))));
    const h = it.lines.length * LINE_H + 1;
    // The positions in order of preference (points, then sides, then anchors); the first clear one wins, else the least bad.
    const fits = ({ pt, side, anchor }) => {
      const [bx0, bx1] = { middle: [pt.px - w / 2, pt.px + w / 2], start: [pt.px - 3, pt.px - 3 + w], end: [pt.px + 3 - w, pt.px + 3] }[anchor];
      const by0 = side === 'above' ? pt.py - it.gap - h : pt.py + it.gap;
      const by1 = by0 + h;
      let bad = 0;
      if (bx0 < box.x0 || bx1 > box.x1 || by0 < box.top || by1 > box.bottom) bad += OUTSIDE;
      for (let px = bx0 - 2; px <= bx1 + 2; px += 3) {
        if (polys.some((p) => { const y = lineAt(p, px); return y !== null && y >= by0 - 3 && y <= by1 + 3; })) { bad += CROSSES_LINE; break; }
      }
      if (placed.some((q) => bx0 < q.bx1 + 3 && bx1 > q.bx0 - 3 && by0 < q.by1 + 2 && by1 > q.by0 - 2)) bad += OVERLAPS_WORDS;
      return { bad, pt, side, anchor, bx0, bx1, by0, by1 };
    };
    const options = it.at.flatMap((pt) => it.sides.flatMap((side) => it.anchors.map((anchor) => ({ pt, side, anchor }))));
    let best = null;
    for (const option of options) {
      const tried = fits(option);
      if (!best || tried.bad < best.bad) best = tried;
      if (best.bad === 0) break;
    }
    placed.push(best);
    const { pt, side, anchor, bx0, bx1, by0, by1 } = best;
    const x = { middle: pt.px, start: bx0, end: bx1 }[anchor];
    const leader = it.leader
      ? html`<line class="chart-axis__tick" x1="${r2(pt.px)}" x2="${r2(pt.px)}" y1="${r2(side === 'above' ? pt.py - 5 : pt.py + 5)}" y2="${r2(side === 'above' ? by1 + 1 : by0 - 1)}"/>` : '';
    const words = it.lines.map((l, k) => text({ x, y: by0 + 10 + k * LINE_H, anchor, cls: `${l.cls} chart-label--halo`, body: l.text }));
    return html`<g${it.cls ? html` class="${it.cls}"` : ''}${it.data ? html` data-fy="${it.data.fy}" data-key="${it.data.key}"` : ''}>${leader}${words}</g>`;
  });
}

// A series of panel points ({ px, py }, py null for a year with no value) as a path's d: a gap breaks the line.
const lineOf = (pts) => lineD(pts.map((q) => ({ x: q.px, y: q.py })), (v) => v, (v) => v);

// ---------- one panel's furniture ----------

// The panel's axes: its title, the tick labels (left) and years (below), gridlines above the base, the pandemic band behind it all.
//   p { ox, oy, w, h, title, sub, years, domain, ticks, fmt, covid, tag }; returns { x, y, box, base, markup }
function furniture(p) {
  const { ox, oy, w, h, left } = p;
  const top = oy + (p.sub ? 36 : 28);
  const base = oy + h - 18;
  const x = scaleLinear().domain([p.years[0] - 0.5, p.years[p.years.length - 1] + 0.5]).range([ox + left, ox + w - RIGHT]);
  const y = scaleLinear().domain(p.domain).range([base, top]);
  const [c0, c1] = [x(p.covid.first - 0.5), x(p.covid.last + 0.5)];
  const last = p.years[p.years.length - 1];
  const every = (fy) => (last - fy) % p.tickEvery === 0;
  const band = p.covid.fys.length
    ? mark({ tip: p.covid.note, hit: null, body: html`<rect class="hist-covid" x="${r2(Math.max(c0, ox + left))}" y="${r2(top)}" width="${r2(Math.min(c1, ox + w - RIGHT) - Math.max(c0, ox + left))}" height="${r2(base - top)}"/>` }) : '';
  const tag = p.tag && p.covid.fys.length
    ? (capsWidth(p.tag) > (c1 - c0) * 1.15 ? p.tag.split(' ') : [p.tag]).map((line, k, all) => text({ x: (c0 + c1) / 2, y: base - 6 - (all.length - 1 - k) * 11, cls: 'chart-cap', body: line })) : '';
  const markup = html`${band}${text({ x: ox, y: oy + 11, anchor: 'start', cls: 'chart-label', body: p.title })}${p.sub ? text({ x: ox, y: oy + 25, anchor: 'start', cls: 'chart-cap', body: p.sub }) : ''}
${p.ticks.map((v) => html`${v === p.domain[0] ? '' : html`<line class="chart-grid" x1="${r2(ox + left)}" x2="${r2(ox + w - RIGHT)}" y1="${r2(y(v))}" y2="${r2(y(v))}"/>`}${text({ x: ox + left - 4, y: y(v) + 4, anchor: 'end', cls: 'chart-tick', body: p.fmt(v) })}`)}
<line class="chart-axis__line" x1="${r2(ox + left)}" x2="${r2(ox + w - RIGHT)}" y1="${r2(base)}" y2="${r2(base)}"/>
${p.years.filter(every).map((fy) => text({ x: x(fy), y: base + 14, cls: 'chart-tick', body: yy(fy) }))}${tag}`;
  return { x, y, base, box: { x0: ox + left, x1: ox + w - RIGHT, top: top - 2, bottom: base }, markup };
}

// ---------- the three panels ----------

// The large panel: the share cut, a dot for each year with its tip, the words at the cap steps and the marks. lines: smallLines().
function sharePanel(lines, p, narrow) {
  const known = lines.share.filter((s) => s.value !== null).map((s) => s.value);
  const start = Math.max(0, Math.floor((Math.min(...known) - 15) / SHARE_STEP) * SHARE_STEP);
  const ticks = [];
  for (let v = start; v <= 100; v += SHARE_STEP) ticks.push(v);
  const f = furniture({ ...p, years: lines.years, left: 34, domain: [start, 100], ticks, fmt: (v) => `${v}%`, sub: start > 0 ? fill('histAxisFrom', { from: `${start}%` }) : null, covid: lines.covid, tag: t('histCovidTag'), tickEvery: narrow ? 4 : 1 });
  const pts = lines.share.map((s) => ({ px: f.x(s.fy), py: s.value === null ? null : f.y(s.value), value: s.value, fy: s.fy }));
  const at = (fy) => pts.find((q) => q.fy === fy);
  const maxW = narrow ? 86 : 118;
  const words = (label) => wrapText(label, maxW, NOTE_PX).map((s) => ({ text: s.trimEnd(), cls: 'chart-note' }));
  const item = (fy, label, data) => {
    const q = at(fy);
    return { at: [q], lines: [...words(label), { text: fmtPct(q.value, 1), cls: 'chart-value chart-value--mark', mono: true }], sides: ['above', 'below'], anchors: ['middle', 'start', 'end'], gap: 12, leader: true, cls: 'hist-ann', data };
  };
  const notes = [
    ...lines.caps.filter((c) => at(c.fy)?.value != null).map((c) => item(c.fy, narrow ? c.short : c.label, { fy: c.fy, key: 'cap' })),
    ...lines.marks.filter((m) => at(m.fy)?.value != null).map((m) => item(m.fy, m.label, { fy: m.fy, key: m.key })),
  ];
  const dots = pts.filter((q) => q.value !== null).map((q) => mark({
    tip: fill('histTipShare', { fy: fyLabel(q.fy), share: fmtPct(q.value, 1) }), value: q.value, data: { fy: q.fy }, hit: null,
    body: html`<circle class="hist-dot--share" cx="${r2(q.px)}" cy="${r2(q.py)}" r="${narrow ? 2.5 : 3}"/>`,
  }));
  const ann = place(notes, { box: f.box, polys: [pts] });
  return html`<g class="hist-panel hist-panel--share">${f.markup}<path class="hist-line hist-line--share" d="${lineOf(pts)}"/>${dots}${ann}</g>`;
}

// The average cut: the penalized hospitals' line in the penalty ink, all hospitals' in gray; the first, the highest and the latest
// of the first printed, the latest of the second, each line named at a spot clear of both.
function avgPanel(lines, p, narrow) {
  // A panel with no value in either series draws nothing.
  if (![...lines.avgPen, ...lines.avgAll].some((s) => s.value !== null)) return '';
  const top = Math.max(...lines.avgPen.map((s) => s.value ?? 0), ...lines.avgAll.map((s) => s.value ?? 0));
  const step = 0.5;
  const yMax = Math.max(step, Math.ceil((top * 1.3) / step) * step);
  const ticks = [0, yMax / 2, yMax];
  const f = furniture({ ...p, years: lines.years, left: 34, domain: [0, yMax], ticks, fmt: (v) => `${v}%`, covid: lines.covid, tag: null, tickEvery: narrow ? 4 : 2 });
  const poly = (series) => series.map((s) => ({ px: f.x(s.fy), py: s.value === null ? null : f.y(s.value), value: s.value, fy: s.fy }));
  const [pen, all] = [poly(lines.avgPen), poly(lines.avgAll)];
  const known = pen.filter((q) => q.value !== null);
  const lastP = known[known.length - 1];
  const peak = known.reduce((a, q) => (q.value > a.value ? q : a), known[0]);  // undefined when only all-hospital values exist
  const lastA = all.filter((q) => q.value !== null).pop();
  const val = (q, side, anchors) => ({ at: [q], lines: [{ text: fmtPct(q.value, 2), cls: 'chart-value chart-value--mark', mono: true }], sides: [side], anchors, gap: 6, leader: false });
  const name = (series, key, side, cls) => {
    const mid = Math.floor(series.length * 0.5);
    const order = [mid, mid - 1, mid + 1, mid - 2, mid + 2, mid - 3, mid + 3, mid - 4, mid + 4, mid + 5, mid + 6].filter((i) => series[i]?.value != null);
    return { at: order.map((i) => series[i]), lines: [{ text: t(key), cls: `chart-cap ${cls}`, caps: true }], sides: [side, side === 'above' ? 'below' : 'above'], anchors: ['middle', 'start', 'end'], gap: 5, leader: false };
  };
  const labeled = [
    ...(peak && peak.fy !== lastP.fy ? [val(peak, 'above', ['middle', 'start', 'end'])] : []),
    ...(lastP ? [val(lastP, 'above', ['end', 'middle'])] : []),
    ...(lastA ? [val(lastA, 'below', ['end', 'middle'])] : []),
    name(pen, 'histAvgPen', 'above', 'hist-name--pen'),
    name(all, 'histAvgAll', 'below', 'hist-name--all'),
  ];
  const words = place(labeled, { box: f.box, polys: [pen, all] });
  const dots = pen.filter((q) => q.value !== null).map((q) => {
    const a = all.find((o) => o.fy === q.fy);
    const both = a?.value != null;
    return mark({
      tip: both ? fill('histTipAvg', { fy: fyLabel(q.fy), pen: fmtPct(q.value, 2), all: fmtPct(a.value, 2) }) : fill('histTipAvgPen', { fy: fyLabel(q.fy), pen: fmtPct(q.value, 2) }), value: both ? [q.value, a.value] : q.value, data: { fy: q.fy }, hit: null,
      body: html`<circle class="hist-dot--pen" cx="${r2(q.px)}" cy="${r2(q.py)}" r="${narrow ? 2 : 2.5}"/>`,
    });
  });
  return html`<g class="hist-panel hist-panel--avg">${f.markup}<path class="hist-line hist-line--all" d="${lineOf(all)}"/><path class="hist-line hist-line--pen" d="${lineOf(pen)}"/>${dots}${words}</g>`;
}

// The estimated totals: a bar for each year that has one, CMS's dark and KFF's light (a source for each bar, in its tip and the table),
// a dash on the base for a year with none (nothing is drawn as a zero); the first, the highest and the latest labeled.
function totalPanel(lines, p, narrow) {
  if (!lines.totals.length) return '';
  const top = Math.max(...lines.totals.map((r) => r.value));
  const step = 2e8;
  const yMax = Math.max(step, Math.ceil(top / step) * step);
  const f = furniture({ ...p, years: lines.years, left: 42, domain: [0, yMax], ticks: [0, yMax / 2, yMax], fmt: usdM, covid: lines.covid, tag: null, tickEvery: narrow ? 4 : 2 });
  const bw = Math.max(3, (f.x(1) - f.x(0)) * 0.62);
  const by = new Map(lines.totals.map((r) => [r.fy, r]));
  const bars = lines.years.map((fy) => {
    const r = by.get(fy);
    const cx = f.x(fy);
    if (!r) return mark({ tip: fill('histTipNoTotal', { fy: fyLabel(fy) }), hit: null, body: html`<line class="hist-none" x1="${r2(cx - bw / 3)}" x2="${r2(cx + bw / 3)}" y1="${r2(f.base - 3)}" y2="${r2(f.base - 3)}"/>` });
    return mark({
      tip: fill('histTipTotal', { fy: fyLabel(fy), total: usdM(r.value), source: r.label ?? t(r.kind === 'KFF' ? 'histSourceKff' : 'histSourceCms') }), value: r.value, data: { fy, kind: r.kind ?? '' }, hit: null,
      body: html`<rect class="hist-bar hist-bar--${r.kind === 'KFF' ? 'kff' : 'cms'}" x="${r2(cx - bw / 2)}" y="${r2(f.y(r.value))}" width="${r2(bw)}" height="${r2(f.base - f.y(r.value))}"/>`,
    });
  });
  const peak = lines.totals.reduce((a, r) => (r.value > a.value ? r : a), lines.totals[0]);
  const firstR = lines.totals[0];
  const lastR = lines.totals[lines.totals.length - 1];
  const picks = [...new Map([firstR, peak, lastR].map((r) => [r.fy, r])).values()];
  const anchors = (r) => (r === firstR ? ['start', 'middle'] : r === lastR ? ['end', 'middle'] : ['middle', 'start', 'end']);
  const labeled = picks.map((r) => ({ at: [{ px: f.x(r.fy), py: f.y(r.value) }], lines: [{ text: usdM(r.value), cls: 'chart-value chart-value--mark', mono: true }], sides: ['above'], anchors: anchors(r), gap: 4, leader: false }));
  return html`<g class="hist-panel hist-panel--total">${f.markup}${bars}${place(labeled, { box: { ...f.box, top: f.box.top - 14 }, polys: [] })}</g>`;
}

// ---------- the drawing ----------

// lines: history-data.js smallLines(); width: the drawing's width in units (a phone's, or the wide one's). Returns the SVG.
export function drawHistory({ lines, width }) {
  const narrow = isNarrow(width);
  const GAP = 28;
  // Each panel's place { ox, oy, w, h }: the phone stacks the three; the wide drawing sets the large one left and the two small ones stacked right.
  const [hBig, hSmall] = narrow ? [270, 150] : [320, (320 - 14) / 2];
  const bigW = Math.round(width * 0.56);
  const smallW = width - bigW - GAP;
  const slot = narrow
    ? { share: { ox: 0, oy: 0, w: width, h: hBig }, avg: { ox: 0, oy: hBig + 10, w: width, h: hSmall }, total: { ox: 0, oy: hBig + hSmall + 20, w: width, h: hSmall } }
    : { share: { ox: 0, oy: 0, w: bigW, h: hBig }, avg: { ox: bigW + GAP, oy: 0, w: smallW, h: hSmall }, total: { ox: bigW + GAP, oy: hSmall + 14, w: smallW, h: hSmall } };
  const body = html`${sharePanel(lines, { ...slot.share, title: t('histTitleShare') }, narrow)}
${avgPanel(lines, { ...slot.avg, title: t('histTitleAvg') }, narrow)}
${totalPanel(lines, { ...slot.total, title: t('histTitleTotal') }, narrow)}`;
  return frame({ kind: 'history', width, height: narrow ? hBig + 2 * hSmall + 24 : hBig + 4, body });
}

// ---------- has this hospital ever escaped? ----------

// Today's hospitals that were in the file every year, counted by how many of those years they were cut: a column for each count
// from none to every year, the every-year column in penalty ink, the rest grey, each column's count over it (on a phone only the
// two ends', which the takeaway names). Under the axis, its two ends named and what it counts. counts: yearsCut().counts ([{ cut, n,
// tip }]); labels: { never, every, axis }.
export function drawYearsCut({ counts, width, labels }) {
  const narrow = isNarrow(width);
  const last = counts.length - 1;
  const top = 18;
  const base = narrow ? 150 : 230;
  const x = scaleBand().domain(counts.map((c) => c.cut)).range([4, width - 4]).paddingInner(narrow ? 0.18 : 0.22);
  const max = Math.max(1, ...counts.map((c) => c.n));
  const y = (n) => base - (n / max) * (base - top);
  const shown = (c) => !narrow || c.cut === 0 || c.cut === last;
  const cols = counts.map((c) => {
    const cx = x(c.cut);
    const w = x.bandwidth();
    const pen = c.cut === last;
    return mark({
      tip: c.tip, value: c.n, hit: { x: cx, y: top - 14, width: w, height: base - top + 14 },
      body: html`${c.n ? html`<path class="${pen ? 'chart-col--pen' : 'chart-col'}" d="${columnPath(cx, w, base, Math.min(base - 1, y(c.n)))}"/>` : ''}${shown(c) ? text({ x: cx + w / 2, y: y(c.n) - 4, cls: `chart-value${pen ? ' chart-label--pen' : ''}`, body: String(c.n) }) : ''}`,
    });
  });
  const tick = (c) => text({ x: x(c.cut) + x.bandwidth() / 2, y: base + 14, cls: 'chart-axis__label', body: String(c.cut) });
  const ticks = counts.filter((c) => !narrow || c.cut % 5 === 0 || c.cut === last).map(tick);
  const under = base + 30;
  return frame({
    kind: 'yearscut', width, height: under + 6, body: html`${cols}
<line class="chart-baseline" x1="4" x2="${width - 4}" y1="${base}" y2="${base}"/>${ticks}
${text({ x: 4, y: under, anchor: 'start', cls: 'chart-note', body: labels.never })}${text({ x: width / 2, y: under, cls: 'chart-note', body: labels.axis })}${text({ x: width - 4, y: under, anchor: 'end', cls: 'chart-note chart-label--pen', body: labels.every })}`,
  });
}
