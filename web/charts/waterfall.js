// A sum built one part at a time, against a line: each part a bar from the running total before it to the total after
// it (a part that raises the sum filled, one that lowers it hollow, a part CMS assigned hatched, the part a page
// marks in the penalty ink), a dotted step from each bar's end to the next bar's start, then the sum as a bar from zero.
// CMS's line runs through every row with the side past it shaded, and zero is a solid rule. Each bar's number sits at
// its right.
//   id       names the hatch pattern
//   rows     [{ label, value, valueText, tip, assigned, pen }] in order; total { label, value, valueText, tip, pen }
//   band     [highestNo, lowestYes]: the line between; labels { line, zone }
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { lineScore } from '../whatif/marks.js';
import { axis } from './axis.js';
import { barPath, checkId, frame, hatchDefs, hatchFill, mark, r2, text } from './svg.js';

const LABEL_W = 62;
const VALUE_W = 54;
const ROW = 24;
const BAR = 14;
const TOP = 22;

export function waterfall({ id, rows, total, band: [highestNo, lowestYes], labels, width = 300 }) {
  checkId(id, 'waterfall');
  let run = 0;
  const steps = rows.map((r) => { const from = run; run += r.value; return { ...r, from, to: run }; });
  const ends = [0, ...steps.flatMap((s) => [s.from, s.to]), total.value, highestNo, lowestYes];
  const [lo, hi] = [Math.min(...ends), Math.max(...ends)];
  const room = (hi - lo) * 0.06;
  const scale = scaleLinear().domain([lo - room, hi + room]).nice().range([LABEL_W, width - VALUE_W]);
  const x = (v) => r2(scale(v));
  const line = lineScore({ highestNo, lowestYes });
  const bottom = TOP + (steps.length + 1) * ROW + 6;
  const yOf = (i) => TOP + i * ROW + (ROW - BAR) / 2;
  const bar = (from, to, y, cls, fill = null) => {
    const d = barPath(scale(from), scale(to), y, BAR);
    return d ? html`<path class="${cls}"${fill ? html` fill="${fill}"` : ''} d="${d}"/>` : html`<line class="${cls}" x1="${x(from)}" x2="${x(from)}" y1="${y}" y2="${y + BAR}"/>`;
  };
  const drawn = steps.map((s, i) => {
    const y = yOf(i);
    const cls = s.assigned ? 'chart-step chart-step--na' : s.pen ? 'chart-step chart-step--pen' : s.value < 0 ? 'chart-step chart-step--down' : 'chart-step';
    return html`${mark({
      tip: s.tip, value: s.value, hit: { x: LABEL_W, y: TOP + i * ROW, width: width - LABEL_W, height: ROW },
      body: html`${bar(s.from, s.to, y, cls, s.assigned ? hatchFill(id) : null)}${text({ x: 0, y: y + BAR - 3, anchor: 'start', cls: s.pen ? 'chart-label chart-label--pen' : 'chart-label', body: s.label })}${text({ x: width, y: y + BAR - 3, anchor: 'end', cls: 'chart-value', body: s.valueText })}`,
    })}
<line class="chart-connector" x1="${x(s.to)}" x2="${x(s.to)}" y1="${y + BAR}" y2="${yOf(i + 1)}"/>
`;
  });
  const yt = yOf(steps.length);
  return frame({
    kind: 'waterfall', width, height: bottom + 24, body: html`${hatchDefs(id)}
<rect class="chart-zone" x="${x(line)}" y="${TOP - 6}" width="${r2(width - VALUE_W - scale(line))}" height="${bottom - TOP + 6}"/>
${labels.zone ? text({ x: width - VALUE_W - 4, y: TOP + 4, anchor: 'end', cls: 'chart-zone-label', body: labels.zone }) : ''}
<line class="chart-zero" x1="${x(0)}" x2="${x(0)}" y1="${TOP - 6}" y2="${bottom}"/>
${drawn}<line class="chart-rule" x1="${LABEL_W}" x2="${width - VALUE_W}" y1="${yt - 5}" y2="${yt - 5}"/>
${mark({
    tip: total.tip, value: total.value, hit: { x: LABEL_W, y: yt - 4, width: width - LABEL_W, height: ROW },
    body: html`${bar(0, total.value, yt, total.pen ? 'chart-step chart-step--pen chart-step--total' : 'chart-step chart-step--total')}${text({ x: 0, y: yt + BAR - 3, anchor: 'start', cls: 'chart-label', body: total.label })}${text({ x: width, y: yt + BAR - 3, anchor: 'end', cls: 'chart-value chart-value--total', body: total.valueText })}`,
  })}
${mark({
    tip: labels.lineTip, value: [highestNo, lowestYes], hit: { x: x(line) - 6, y: 0, width: 12, height: bottom },
    body: html`<line class="chart-line" x1="${x(line)}" x2="${x(line)}" y1="${TOP - 10}" y2="${bottom}"/>`,
  })}
${text({ x: x(line) + 4, y: TOP - 12, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.line })}
<g transform="translate(0 ${bottom})">${axis({ scale, orient: 'bottom', ticks: 5 })}</g>`,
  });
}
