// Columns of dots, one per group along x, each hospital a dot at its score (y) spread sideways in proportion to how
// many share its neighborhood (a sina plot): the column's outline is its distribution. A horizontal line crosses
// every column (CMS's line); dots at or past it in the penalty ink. Under each column: its name and its counts.
//   columns  [{ label, short, sub, sub2, scores, yes (per score: past the line), tip }] (short: the label on a phone;
//            sub, sub2: two lines under it, the second left out on a phone); line: the score; domain [lo, hi]
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { dotsPath, spread } from './dots.js';
import { frame, mark, r2, text } from './svg.js';

const BINS = 40;

export function sina({ columns, line, domain: [lo, hi], labels, width, height = 360, format }) {
  const narrow = width < 400;
  const left = 36;
  const right = width - 6;
  const top = 18;
  const base = top + height;
  const y = scaleLinear().domain([lo, hi]).range([base, top]);
  const colW = (right - left) / columns.length;
  const d = narrow ? 2.2 : 3;
  const pen = [];
  const ink = [];
  const marks = columns.map((c, k) => {
    const cx = left + (k + 0.5) * colW;
    const counts = new Array(BINS).fill(0);
    const binOf = (s) => Math.min(BINS - 1, Math.max(0, Math.floor(((s - lo) / (hi - lo)) * BINS)));
    for (const s of c.scores) counts[binOf(s)] += 1;
    const most = Math.max(...counts, 1);
    const half = colW * 0.44;
    c.scores.forEach((s, i) => {
      const w = half * Math.sqrt(counts[binOf(s)] / most);
      const p = [cx + (spread(i + k * 977) * 2 - 1) * w, y(s)];
      (c.yes[i] ? pen : ink).push(p);
    });
    return mark({
      tip: c.tip, value: null, hit: { x: cx - colW / 2, y: top, width: colW, height: base - top + 40 },
      body: html`${text({ x: cx, y: base + 18, cls: 'chart-label', body: narrow ? c.short : c.label })}${text({ x: cx, y: base + 32, cls: 'chart-note', body: c.sub })}${narrow ? '' : text({ x: cx, y: base + 45, cls: 'chart-note', body: c.sub2 })}`,
    });
  });
  const ly = r2(y(line));
  return frame({
    kind: 'sina', width, height: base + (narrow ? 40 : 52), body: html`<g transform="translate(${left} 0)">${axis({ scale: y, orient: 'left', ticks: 6, format, grid: right - left })}</g>
${dotsPath(ink, 'chart-dots--ink', d)}${dotsPath(pen, 'chart-dots--pen', d)}
<line class="chart-boundary" x1="${left}" x2="${right}" y1="${ly}" y2="${ly}"/>
${text({ x: left + 4, y: ly - 5, anchor: 'start', cls: 'chart-cap chart-label--halo', body: labels.line })}
${marks}`,
  });
}
