// How closely pairs of measures agree: a triangle of cells, one per pair, each a square whose side grows with the
// pair's rank correlation (zero: a dot; one: the whole cell) and its value printed in it; and a scatter of one pair,
// every hospital with both values a dot. Each cell is a mark (data-pair names its pair, for a page script to draw
// that pair's scatter).
//   ids, shorts: the measures; pairs [{ a, b, rho, n, tip, text }]; picked: the pair drawn ("A|B")
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { dotsPath } from './dots.js';
import { frame, mark, r2, text } from './svg.js';

export function agreeGrid({ ids, shorts, pairs, picked, width }) {
  const k = ids.length - 1;
  const labelW = 54;
  const cell = Math.min(54, (width - labelW - 8) / k);
  const top = 24;
  const byPair = new Map(pairs.map((p) => [`${p.a}|${p.b}`, p]));
  const cells = [];
  for (let i = 1; i < ids.length; i++) {
    for (let j = 0; j < i; j++) {
      const p = byPair.get(`${ids[j]}|${ids[i]}`) ?? byPair.get(`${ids[i]}|${ids[j]}`);
      if (!p) continue;
      const x = labelW + j * cell;
      const y = top + (i - 1) * cell;
      const side = Math.max(3, Math.sqrt(Math.max(p.rho, 0)) * (cell - 6));
      const key = `${p.a}|${p.b}`;
      cells.push(mark({
        tip: p.tip, value: p.rho, data: { pair: key }, hit: { x, y, width: cell, height: cell },
        body: html`<rect class="chart-agree__cell${key === picked ? ' is-picked' : ''}" x="${r2(x + 1)}" y="${r2(y + 1)}" width="${r2(cell - 2)}" height="${r2(cell - 2)}"/><rect class="chart-agree__sq" x="${r2(x + (cell - side) / 2)}" y="${r2(y + (cell - side) / 2)}" width="${r2(side)}" height="${r2(side)}"/><text class="chart-agree__v" x="${r2(x + cell / 2)}" y="${r2(y + cell - 5)}" text-anchor="middle">${p.text}</text>`,
      }));
    }
  }
  const rowLabels = ids.slice(1).map((id, i) => text({ x: labelW - 6, y: top + i * cell + cell / 2 + 4, anchor: 'end', cls: 'chart-punch__row', body: shorts[id] }));
  const colLabels = ids.slice(0, -1).map((id, j) => text({ x: labelW + j * cell + cell / 2, y: top + k * cell + 14, cls: 'chart-punch__row', body: shorts[id] }));
  return frame({ kind: 'agree', width, height: top + k * cell + 22, body: html`${rowLabels}${colLabels}${cells}` });
}

// One pair's scatter: points [[x, y]] in values, both axes from zero to max; labels { x, y }.
export function agreeScatter({ points, max, labels, width, format }) {
  const left = 34;
  const size = width - left - 8;
  const top = 12;
  const x = scaleLinear().domain([0, max]).range([left, left + size]);
  const y = scaleLinear().domain([0, max]).range([top + size, top]);
  const clamp = (v) => Math.min(v, max);
  const pts = points.map(([a, b]) => [x(clamp(a)), y(clamp(b))]);
  return frame({
    kind: 'scatter', width, height: top + size + 40, body: html`<rect class="chart-scatter__bg" x="${left}" y="${top}" width="${r2(size)}" height="${r2(size)}"/>
<line class="chart-ref" x1="${r2(x(0))}" x2="${r2(x(max))}" y1="${r2(y(0))}" y2="${r2(y(max))}"/>
${dotsPath(pts, 'chart-dots--scatter', width < 400 ? 2.6 : 3.2)}
<g transform="translate(0 ${r2(top + size)})">${axis({ scale: x, orient: 'bottom', ticks: 5, format })}</g>
<g transform="translate(${left} 0)">${axis({ scale: y, orient: 'left', ticks: 5, format })}</g>
${text({ x: left + size, y: top + size + 32, anchor: 'end', cls: 'chart-axis__title', body: labels.x })}
${text({ x: left + 4, y: top + 12, anchor: 'start', cls: 'chart-axis__title', body: labels.y })}`,
  });
}
