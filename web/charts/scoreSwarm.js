// Every hospital's score as one dot in a histogram (a unit histogram): each bin's hospitals in rows across its width,
// stacked from the axis up, those at or past the line in the penalty ink. A highlighted group's hospitals stack first
// (at the bottom of each bin) and keep full ink while the rest fade, so the group reads as its own histogram inside
// the nation's. A magnifier (the loupe) blows up the scores either side of the line, a dot per hospital, so the gap
// between the highest score not cut and the lowest cut shows. The layout is exported (swarmLayout) so a page script
// finds the hospital under the pointer and redraws the chart for a new group with the same arithmetic.
//   items    [{ score, yes, hl }] (yes: at or past the line, as CMS decided; hl: in the highlighted group)
//   edges    the bins' edges (the line, CMS's lowest Yes score, is one of them); band [highestNo, lowestYes]
//   labels   { line, below, above, loupe, highestNo, lowestYes } (text)
//   loupe    { from, to, step } in scores, or null for none; place: 'inset' (top right) or 'below'
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { dotsPath, unitHistogram } from './dots.js';
import { frame, r2, text } from './svg.js';

const LOUPE_H = 112;

// Each item's bin, then its place: the highlighted first in each bin, each part in score order.
export function swarmLayout({ items, edges, width, pitch, cols, top, hlOn }) {
  const left = 8;
  const right = width - 8;
  const x = scaleLinear().domain([edges[0], edges[edges.length - 1]]).range([left, right]);
  const binOf = (s) => {
    let lo = 0;
    let hi = edges.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (edges[mid] <= s) lo = mid; else hi = mid - 1;
    }
    return lo;
  };
  const order = items.map((item, i) => ({ item, i, bin: binOf(item.score) }))
    .sort((a, b) => a.bin - b.bin || (hlOn ? Number(b.item.hl) - Number(a.item.hl) : 0) || a.item.score - b.item.score || a.i - b.i);
  const perBin = new Map();
  for (const o of order) perBin.set(o.bin, (perBin.get(o.bin) ?? 0) + 1);
  const rows = Math.ceil(Math.max(...perBin.values()) / cols);
  const base = top + rows * pitch;
  const binW = x(edges[1]) - x(edges[0]);
  const pos = unitHistogram(order, { x0: (b) => x(edges[b]), binW, cols, base, pitch });
  const at = new Array(items.length);
  order.forEach((o, k) => { at[o.i] = pos[k]; });
  return { x, at, base, left, right };
}

function loupeOf({ items, loupe, x: mainX, box, band: [highestNo, lowestYes], labels }) {
  const inner = { left: box.x + 22, right: box.x + box.w - 22 };
  const x = scaleLinear().domain([loupe.from, loupe.to]).range([inner.left, inner.right]);
  const bins = Math.round((loupe.to - loupe.from) / loupe.step);
  const binW = (inner.right - inner.left) / bins;
  const pitch = Math.min(binW, 7);
  const base = box.y + box.h - 30;
  const inside = items.filter((it) => it.score >= loupe.from && it.score < loupe.to).sort((a, b) => a.score - b.score);
  const stack = new Map();
  const yes = [];
  const no = [];
  for (const it of inside) {
    const b = Math.min(bins - 1, Math.floor((it.score - loupe.from) / loupe.step + 1e-9));
    const k = stack.get(b) ?? 0;
    stack.set(b, k + 1);
    (it.yes ? yes : no).push([inner.left + (b + 0.5) * binW, base - (k + 0.5) * pitch]);
  }
  const hx = r2(x(highestNo));
  const lx = r2(x(lowestYes));
  const ticks = x.ticks(4);
  // The callout: from the zoomed span on the main axis up to the loupe's lower corners.
  const [a, b] = [mainX(loupe.from), mainX(loupe.to)];
  return html`<path class="chart-loupe__beam" d="M${r2(a)} ${r2(box.axisY)}L${r2(box.x)} ${r2(box.y + box.h)}M${r2(b)} ${r2(box.axisY)}L${r2(box.x + box.w)} ${r2(box.y + box.h)}"/>
<rect class="chart-loupe__glass" x="${r2(box.x)}" y="${r2(box.y)}" width="${r2(box.w)}" height="${r2(box.h)}" rx="6"/>
${text({ x: box.x + 10, y: box.y + 16, anchor: 'start', cls: 'chart-cap', body: labels.loupe })}
<line class="chart-loupe__gap" x1="${hx}" x2="${lx}" y1="${r2(base + 6)}" y2="${r2(base + 6)}"/>
${dotsPath(no, 'chart-dots--ink', pitch * 0.82)}${dotsPath(yes, 'chart-dots--pen', pitch * 0.82)}
<line class="chart-boundary" x1="${lx}" x2="${lx}" y1="${r2(box.y + 24)}" y2="${r2(base + 4)}"/>
${text({ x: hx - 4, y: box.y + 34, anchor: 'end', cls: 'chart-note', body: labels.highestNo })}
${text({ x: lx + 4, y: box.y + 34, anchor: 'start', cls: 'chart-note chart-label--pen', body: labels.lowestYes })}
<line class="chart-axis__line" x1="${r2(inner.left)}" x2="${r2(inner.right)}" y1="${r2(base)}" y2="${r2(base)}"/>
${ticks.map((v) => html`<line class="chart-axis__tick" x1="${r2(x(v))}" x2="${r2(x(v))}" y1="${r2(base)}" y2="${r2(base + 4)}"/>${text({ x: x(v), y: base + 16, cls: 'chart-axis__label', body: String(v) })}`)}`;
}

export function scoreSwarm({ items, edges, band, labels, width, pitch, cols, loupe = null, place = 'inset', hlOn = false, format }) {
  const top = 40;
  const { x, at, base, left, right } = swarmLayout({ items, edges, width, pitch, cols, top, hlOn });
  const groups = { pen: [], ink: [], penFaint: [], inkFaint: [] };
  items.forEach((it, i) => {
    const key = it.yes ? (hlOn && !it.hl ? 'penFaint' : 'pen') : (hlOn && !it.hl ? 'inkFaint' : 'ink');
    groups[key].push(at[i]);
  });
  const lx = r2(x(band[1]));
  const d = pitch * 0.84;
  const box = loupe && (place === 'inset'
    ? { x: right - 340, y: top - 24, w: 340, h: LOUPE_H, axisY: base }
    : { x: left, y: base + 40, w: right - left, h: LOUPE_H, axisY: base });
  const height = place === 'below' && loupe ? box.y + box.h + 8 : base + 36;
  return frame({
    kind: 'swarm', width, height, body: html`${dotsPath(groups.inkFaint, 'chart-dots--faint', d)}${dotsPath(groups.penFaint, 'chart-dots--pen-faint', d)}
${dotsPath(groups.ink, hlOn ? 'chart-dots--hl' : 'chart-dots--ink', d)}${dotsPath(groups.pen, 'chart-dots--pen', d)}
<line class="chart-boundary" x1="${lx}" x2="${lx}" y1="${top - 30}" y2="${r2(base)}"/>
${text({ x: lx - 6, y: top - 20, anchor: 'end', cls: 'chart-cap', body: labels.below })}
${text({ x: lx + 6, y: top - 20, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.above })}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks: width < 400 ? 4 : 9, format })}</g>
${box ? loupeOf({ items, loupe, x, box, band, labels }) : ''}`,
  });
}
