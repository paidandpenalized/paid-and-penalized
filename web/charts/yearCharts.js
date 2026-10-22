// Charts over program years, for the history: the staircase (each year's cut in front of everyone cut by then) and the
// chance dots (how many were cut k times against what chance gives). Each mark carries its tooltip and plotted values.
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { columnPath, frame, isNarrow, mark, r2, text } from './svg.js';

// The staircase. cols: [{ label, cut, ever, tip }] oldest first; the tall pale column is ever cut by that year, the
// red one in front of it that year's cut; format(n) prints each column's ever-cut number over it.
export function staircase({ cols, width, format }) {
  const M = { top: 26, bottom: 24, left: 4, right: 4 };
  const H = 200;
  const max = Math.max(...cols.map((c) => c.ever));
  const y = scaleLinear().domain([0, max]).range([M.top + H, M.top]);
  const step = (width - M.left - M.right) / cols.length;
  const w = Math.max(6, step * 0.72);
  const narrow = isNarrow(width);
  const body = cols.map((c, i) => {
    const x = M.left + i * step + (step - w) / 2;
    return mark({
      tip: c.tip, value: [c.cut, c.ever], hit: { x: M.left + i * step, y: M.top, width: step, height: H },
      body: html`<path class="chart-stair__ever" d="${columnPath(x, w, y(0), y(c.ever))}"/><path class="chart-col--pen" d="${columnPath(x + w * 0.18, w * 0.64, y(0), y(c.cut))}"/>
${text({ x: x + w / 2, y: y(c.ever) - 5, cls: 'chart-value chart-value--mark', body: narrow && (cols.length - 1 - i) % 2 ? '' : format(c.ever) })}
${text({ x: x + w / 2, y: M.top + H + 15, cls: 'chart-tick', body: narrow && (cols.length - 1 - i) % 2 ? '' : c.label })}`,
    });
  });
  return frame({ kind: 'stair', width, height: M.top + H + M.bottom, body: html`<line class="chart-axis__line" x1="${M.left}" x2="${width - M.right}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>${body}` });
}

// The chance dots. ks: [{ k, observed, chance, tip }] for k = 0..; the solid dot what happened, the ring what chance
// gives, joined by a stem; labels: { x } names the axis.
export function chanceDots({ ks, labels, width, format }) {
  const M = { top: 14, bottom: 40, left: 40, right: 10 };
  const H = 200;
  const max = Math.max(...ks.flatMap((d) => [d.observed, d.chance]));
  const y = scaleLinear().domain([0, max]).nice().range([M.top + H, M.top]);
  const step = (width - M.left - M.right) / ks.length;
  const r = isNarrow(width) ? 3.5 : 5;
  const body = ks.map((d, i) => {
    const cx = M.left + (i + 0.5) * step;
    const up = d.observed > d.chance;
    return mark({
      tip: d.tip, value: [d.observed, d.chance], hit: { x: M.left + i * step, y: M.top, width: step, height: H },
      body: html`<line class="chart-chance__stem${up ? ' chart-chance__stem--up' : ''}" x1="${r2(cx)}" x2="${r2(cx)}" y1="${r2(y(d.chance))}" y2="${r2(y(d.observed))}"/>
<circle class="chart-chance__ring" cx="${r2(cx)}" cy="${r2(y(d.chance))}" r="${r}"/>
<circle class="chart-chance__dot" cx="${r2(cx)}" cy="${r2(y(d.observed))}" r="${r}"/>
${text({ x: cx, y: M.top + H + 15, cls: 'chart-tick', body: String(d.k) })}`,
    });
  });
  return frame({
    kind: 'chance', width, height: M.top + H + M.bottom, body: html`<g transform="translate(${M.left} 0)">${axis({ scale: y, orient: 'left', ticks: 4, format, grid: width - M.left - M.right })}</g>
${body}
${text({ x: (M.left + width - M.right) / 2, y: M.top + H + 34, cls: 'chart-cap', body: labels.x })}`,
  });
}
