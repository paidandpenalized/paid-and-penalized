// One measure's published values, every hospital a dot, three ways: stacked into columns (stackedDots: where the
// values pile up, a dot for every few hospitals), pulled in to a floor and a cap (pullIn: each value as reported on
// one strip and as scored on the strip under it, a line joining each one that moves), and before and after a change
// to every value (shiftStrip: the same strip drawn twice, for a page script to move between). Drawn from the values
// alone; the caller's words name what they mean.
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { dotsPath, spread, stackColumns, unitHistogram } from './dots.js';
import { frame, mark, r2, text } from './svg.js';

// ---------- stacked columns ----------

// values: sorted; domain [lo, hi]: the axis (values past hi stack in one column at the right edge, an arrow over it);
// step: the bins' width; per: hospitals to a dot; rows: the plot's height in dots (the caller's tallest column of any
// measure, so every measure draws at one height); refs { one, median } with labels { one, median, per, zero, over }
// (zero: the label on the column at zero, or null; over: the label on the overflow column); tip(bin) -> its tooltip.
export function stackedDots({ values, domain: [lo, hi], step, per, rows, refs, labels, tip, format, width }) {
  const bins = Math.round((hi - lo) / step);
  const counts = new Array(bins).fill(0);
  let over = 0;
  for (const v of values) {
    if (v > hi) over += 1;
    else counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step + 1e-9)))] += 1;
  }
  const left = 6;
  const right = width - (over ? 30 : 8);
  const binW = (right - left) / bins;
  const pitch = binW;
  const top = 34;
  const base = top + rows * pitch;
  const x = scaleLinear().domain([lo, hi]).range([left, right]);
  const cols = stackColumns(counts, { x: (i) => left + (i + 0.5) * binW, base, pitch, per });
  const overCol = over ? stackColumns([over], { x: () => right + 16, base, pitch, per })[0] : [];
  const dots = cols.flat();
  const binMarks = counts.map((c, i) => (c ? mark({
    tip: tip({ from: lo + i * step, to: lo + (i + 1) * step, count: c }), value: null,
    hit: { x: left + i * binW, y: top, width: binW, height: base - top }, body: '',
  }) : ''));
  const oneX = r2(x(refs.one));
  const medX = r2(x(refs.median));
  const zeroCol = labels.zero && counts[0] ? html`${text({ x: left + binW + 6, y: cols[0][cols[0].length - 1][1] + 4, anchor: 'start', cls: 'chart-label chart-label--halo', body: labels.zero })}` : '';
  return frame({
    kind: 'stack', width, height: base + 44, body: html`<line class="chart-ref" x1="${oneX}" x2="${oneX}" y1="${top - 22}" y2="${base}"/>
${text({ x: oneX + 4, y: top - 12, anchor: 'start', cls: 'chart-cap', body: labels.one })}
${dotsPath(dots, 'chart-dots--ink', pitch * 0.82)}
${dotsPath(overCol, 'chart-dots--ink', pitch * 0.82)}
${over ? html`${text({ x: right + 16, y: overCol[overCol.length - 1][1] - 10, cls: 'chart-note', body: '→' })}${text({ x: width, y: base + 38, anchor: 'end', cls: 'chart-note', body: labels.over })}` : ''}
${zeroCol}
${binMarks}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks: width < 400 ? 4 : 8, format })}</g>
<line class="chart-median" x1="${medX}" x2="${medX}" y1="${r2(base - 6)}" y2="${r2(base + 6)}"/>
${text({ x: medX, y: base + 30, cls: 'chart-note', body: labels.median })}
${text({ x: 0, y: 12, anchor: 'start', cls: 'chart-note', body: labels.per })}`,
  });
}

// ---------- a strip's silhouette ----------

// Values counted on `bins` equal columns over [lo, hi] (values past either end count in the end column), drawn as
// one filled silhouette standing on y + h, its tallest column h high: the shape of every hospital's value at once.
export function silhouette(values, { x, lo, hi, bins, y, h, most = null }) {
  const counts = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))] += 1;
  const top = most ?? Math.max(...counts, 1);
  const base = y + h;
  let d = `M${r2(x(lo))} ${r2(base)}`;
  counts.forEach((c, i) => {
    const yy = r2(base - (h * c) / top);
    d += `L${r2(x(lo + i * w))} ${yy}L${r2(x(lo + (i + 1) * w))} ${yy}`;
  });
  return { d: `${d}L${r2(x(hi))} ${r2(base)}Z`, most: top };
}

// ---------- pulled in to the floor and cap ----------

// values: sorted; floor, cap; domain [lo, hi]; labels { reported, scored, floor, cap, pulled }. Each strip is the
// values' silhouette (as reported, then as scored); each value that moves is a dot on both strips, joined by a line.
export function pullIn({ values, floor, cap, domain: [lo, hi], labels, format, width }) {
  const left = 4;
  const right = width - 8;
  const x = scaleLinear().domain([lo, hi]).range([left, right]);
  const narrow = width < 400;
  const bandH = narrow ? 34 : 46;
  const y1 = 24;
  const y2 = y1 + bandH + (narrow ? 56 : 70);
  const d = narrow ? 2.6 : 3.4;
  const bins = narrow ? 60 : 120;
  const moved = [[], []];
  const lines = [];
  const scored = values.map((v) => Math.min(cap, Math.max(floor, v)));
  const beyond = values.filter((v) => v > hi).length;
  values.forEach((v, i) => {
    if (scored[i] === v) return;
    const a = [x(Math.min(v, hi)), y1 + bandH - 3 - spread(i) * (bandH * 0.6)];
    const b = [x(scored[i]) + (v > cap ? -1 : 1) * spread(i * 7 + 3) * 4, y2 + bandH - 3 - spread(i * 3 + 1) * (bandH * 0.9)];
    moved[0].push(a);
    moved[1].push(b);
    lines.push(`M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`);
  });
  const top = silhouette(values.map((v) => Math.min(v, hi)), { x, lo, hi, bins, y: y1, h: bandH });
  const bottom = silhouette(scored, { x, lo, hi, bins, y: y2, h: bandH });
  const fx = r2(x(floor));
  const cx = r2(x(cap));
  const end = y2 + bandH + 6;
  return frame({
    kind: 'pull', width, height: end + 30, body: html`${text({ x: left, y: y1 - 8, anchor: 'start', cls: 'chart-cap', body: labels.reported })}
${text({ x: left, y: y2 - 8, anchor: 'start', cls: 'chart-cap', body: labels.scored })}
<path class="chart-sil" d="${top.d}"/>
<path class="chart-sil" d="${bottom.d}"/>
<path class="chart-pull__line" d="${lines.join('')}"/>
${dotsPath(moved[0], 'chart-dots--ink', d)}${dotsPath(moved[1], 'chart-dots--ink', d)}
<line class="chart-boundary" x1="${cx}" x2="${cx}" y1="${y1 - 4}" y2="${r2(end)}"/>
${floor > lo ? html`<line class="chart-boundary" x1="${fx}" x2="${fx}" y1="${y1 - 4}" y2="${r2(end)}"/>${text({ x: fx - 4, y: y1 + bandH + 16, anchor: 'end', cls: 'chart-cap chart-label--halo', body: labels.floor })}` : ''}
${text({ x: cx + 4, y: y1 + bandH + 16, anchor: 'start', cls: 'chart-cap chart-label--halo', body: labels.cap })}
${text({ x: right, y: y1 + bandH + 30, anchor: 'end', cls: 'chart-label chart-label--halo', body: labels.pulled })}
${beyond ? text({ x: right, y: y1 - 8, anchor: 'end', cls: 'chart-note', body: labels.beyond(beyond) }) : ''}
<g transform="translate(0 ${r2(end)})">${axis({ scale: x, orient: 'bottom', ticks: narrow ? 4 : 8, format })}</g>`,
  });
}

// ---------- one strip, before and after ----------

// The values' silhouette on one strip, which a page script can squeeze toward zero (data-shift: its transform-origin
// is the axis's zero), and the z-scores' silhouette on a second strip that never moves. labels { top, bottom }.
export function shiftStrip({ values, z, domain: [lo, hi], zDomain: [zlo, zhi], labels, format, zFormat, width }) {
  const left = 4;
  const right = width - 8;
  const x = scaleLinear().domain([lo, hi]).range([left, right]);
  const xz = scaleLinear().domain([zlo, zhi]).range([left, right]);
  const narrow = width < 400;
  const bandH = narrow ? 40 : 56;
  const y1 = 26;
  const y2 = y1 + bandH + 64;
  const bins = narrow ? 50 : 100;
  const top = silhouette(values, { x, lo, hi, bins, y: y1, h: bandH });
  const bottom = silhouette(z, { x: xz, lo: zlo, hi: zhi, bins, y: y2, h: bandH });
  return frame({
    kind: 'shift', width, height: y2 + bandH + 34, body: html`<text class="chart-cap" x="${left}" y="${y1 - 10}" text-anchor="start" data-shift-label>${labels.top}</text>
<path class="chart-sil chart-sil--ink" data-shift d="${top.d}" style="transform-origin: ${r2(x(0))}px ${r2(y1 + bandH)}px"/>
<g transform="translate(0 ${r2(y1 + bandH + 6)})">${axis({ scale: x, orient: 'bottom', ticks: narrow ? 4 : 7, format })}</g>
${text({ x: left, y: y2 - 10, anchor: 'start', cls: 'chart-cap', body: labels.bottom })}
<path class="chart-sil chart-sil--ink" d="${bottom.d}"/>
<g transform="translate(0 ${r2(y2 + bandH + 6)})">${axis({ scale: xz, orient: 'bottom', ticks: narrow ? 4 : 7, format: zFormat })}</g>`,
  });
}

// ---------- before and after, many at once ----------

// The same hospitals stacked twice on one axis, a dot each: their scores as they were (top) and as changed (bottom),
// so the mass moving across the line shows. On the bottom stack, those now short of the line are ink, those still past
// it in the penalty ink. items [{ from, to, out }]; edges: bins with the line as one edge; labels { top, bottom, out,
// stuck }; pitch, cols: each dot's room and dots per bin row.
export function escapeStacks({ items, edges, line, labels, format, width, pitch, cols }) {
  const left = 4;
  const right = width - 8;
  const x = scaleLinear().domain([edges[0], edges[edges.length - 1]]).range([left, right]);
  const binOf = (v) => {
    let k = 0;
    while (k < edges.length - 2 && edges[k + 1] <= v) k++;
    return k;
  };
  const binW = x(edges[1]) - x(edges[0]);
  const rowsOf = (vals) => {
    const n = new Map();
    for (const v of vals) n.set(binOf(v), (n.get(binOf(v)) ?? 0) + 1);
    return Math.ceil(Math.max(...n.values()) / cols);
  };
  const top1 = 30;
  const base1 = top1 + rowsOf(items.map((it) => it.from)) * pitch;
  const top2 = base1 + 64;
  const base2 = top2 + rowsOf(items.map((it) => it.to)) * pitch;
  const before = unitHistogram([...items].sort((a, b) => a.from - b.from).map((it) => ({ bin: binOf(it.from) })), { x0: (b) => x(edges[b]), binW, cols, base: base1, pitch });
  const sorted = [...items].sort((a, b) => a.to - b.to);
  const after = unitHistogram(sorted.map((it) => ({ bin: binOf(it.to) })), { x0: (b) => x(edges[b]), binW, cols, base: base2, pitch });
  const d = pitch * 0.84;
  const lx = r2(x(line));
  const axisAt = (y) => html`<g transform="translate(0 ${r2(y)})">${axis({ scale: x, orient: 'bottom', ticks: width < 400 ? 4 : 8, format })}</g>`;
  return frame({
    kind: 'escape', width, height: base2 + 30, body: html`${text({ x: left, y: top1 - 12, anchor: 'start', cls: 'chart-cap', body: labels.top })}
${dotsPath(before, 'chart-dots--pen', d)}
${axisAt(base1)}
${text({ x: left, y: top2 - 12, anchor: 'start', cls: 'chart-cap chart-label--halo', body: labels.bottom })}
${dotsPath(after.filter((_, k) => sorted[k].out), 'chart-dots--ink', d)}${dotsPath(after.filter((_, k) => !sorted[k].out), 'chart-dots--pen', d)}
${axisAt(base2)}
<line class="chart-boundary" x1="${lx}" x2="${lx}" y1="${top1 - 22}" y2="${r2(base2)}"/>
${text({ x: lx - 6, y: top2 + 4, anchor: 'end', cls: 'chart-label chart-label--halo', body: labels.out })}
${text({ x: lx + 6, y: top2 + 4, anchor: 'start', cls: 'chart-label chart-label--pen chart-label--halo', body: labels.stuck })}`,
  });
}
