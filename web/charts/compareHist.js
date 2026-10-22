// A place's scores against the nation's, both as shares of their own hospitals so places of any size compare: the
// place's columns (past the line in the penalty ink) and the nation's as a stepped outline over them. Each column is
// a mark.
//   edges: the bins' edges (the line one of them); place, nation: counts per bin; line: the score; labels
//   { place, nation, line }; tip(i) -> a column's tooltip
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { columnPath, frame, mark, r2, text } from './svg.js';

export function compareHist({ edges, place, nation, line, labels, tip, width, format }) {
  const left = 34;
  const right = width - 8;
  const top = 26;
  const base = top + (width < 400 ? 150 : 190);
  const x = scaleLinear().domain([edges[0], edges[edges.length - 1]]).range([left, right]);
  const sum = (a) => a.reduce((s, v) => s + v, 0) || 1;
  const ps = place.map((c) => c / sum(place));
  const ns = nation.map((c) => c / sum(nation));
  const y = scaleLinear().domain([0, Math.max(...ps, ...ns)]).nice().range([base, top]);
  const cols = ps.map((v, i) => {
    const x0 = x(edges[i]);
    const w = Math.max(1, x(edges[i + 1]) - x0 - 1.5);
    const d = columnPath(x0 + 0.75, w, base, y(v));
    return mark({ tip: tip(i), value: null, hit: { x: x0, y: top, width: x(edges[i + 1]) - x0, height: base - top }, body: d ? html`<path class="${edges[i] >= line ? 'chart-col chart-col--pen' : 'chart-col'}" d="${d}"/>` : '' });
  });
  let outline = `M${r2(x(edges[0]))} ${r2(base)}`;
  ns.forEach((v, i) => { outline += `V${r2(y(v))}H${r2(x(edges[i + 1]))}`; });
  outline += `V${r2(base)}`;
  const lx = r2(x(line));
  return frame({
    kind: 'compare', width, height: base + 30, body: html`<g transform="translate(${left} 0)">${axis({ scale: y, orient: 'left', ticks: 4, format: (v) => `${Math.round(v * 100)}%`, grid: right - left })}</g>
${cols}
<path class="chart-outline" d="${outline}"/>
<line class="chart-boundary" x1="${lx}" x2="${lx}" y1="${top - 14}" y2="${r2(base)}"/>
${text({ x: lx + 4, y: top - 4, anchor: 'start', cls: 'chart-cap', body: labels.line })}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks: width < 400 ? 4 : 8, format })}</g>`,
  });
}
