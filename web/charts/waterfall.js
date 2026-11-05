// A sum built one part at a time, against a line: each part a bar from the running total before it to the total after
// it (a part that raises the sum filled, one that lowers it hollow, a part CMS assigned hatched, the part a page
// marks in the penalty ink), a dotted step from each bar's end to the next bar's start, then the sum as a bar from zero.
// CMS's line runs through every row with the side past it shaded, and zero is a solid rule. Each bar's number sits at
// its right.
//   id       names the hatch pattern
//   rows     [{ label, value, valueText, tip, assigned, pen }] in order; total { label, value, valueText, tip, pen }
//   band     [highestNo, lowestYes]: the line between; labels { line, zone }
// For a sum whose parts are a sliver of the line it is held against (a figure with no band):
//   band: null    no line and no shading; the scale fits the bars (or domain)
//   domain        [lo, hi] the scale's ends, not widened or rounded: a zoom, named by caption
//   labelW        the labels' column (default 62); a row's note (words where its bar would be, for a part of zero)
//   stacked       each row's label above its bar and the bars from the left edge (a phone), not the label column
//   ticks, format the axis's tick values and their text; caption: a line under the axis naming the scale
//   cap           { value, max, title, label, share, tip, ticks, format }: a strip under the axis on the scale 0 to max (default
//                 value, the cap) holding the rows' parts, the cap as the line at value and beams from the zoomed scale to where it sits
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { lineScore } from '../whatif/marks.js';
import { axis } from './axis.js';
import { textWidth } from './text.js';
import { LABEL_PX, NOTE_PX, barPath, checkId, frame, hatchDefs, hatchFill, mark, r2, text } from './svg.js';

const LABEL_W = 62;
const VALUE_W = 54;
const ROW = 24;
const ROW_STACKED = 40;
const BAR = 14;
const TOP = 22;
// A stacked row's bar sits this far under its row's top; the left edge of its scale.
const STACK_BAR_Y = 20;
const STACK_LEFT = 4;
// A stacked row's label starts this far right of the zero line, which would cross it.
const STACK_LABEL = 6;

export function waterfall({ id, rows, total, band = null, labels = {}, width = 300, domain = null, labelW = LABEL_W, stacked = false, ticks = 5, format, caption = null, cap = null }) {
  checkId(id, 'waterfall');
  let run = 0;
  const steps = rows.map((r) => { const from = run; run += r.value; return { ...r, from, to: run }; });
  const [highestNo, lowestYes] = band ?? [];
  const ends = [0, ...steps.flatMap((s) => [s.from, s.to]), total.value, ...(band ?? [])];
  const [lo, hi] = [Math.min(...ends), Math.max(...ends)];
  const room = (hi - lo) * 0.06;
  const left = stacked ? STACK_LEFT : labelW;
  const range = [left, width - VALUE_W];
  const scale = domain ? scaleLinear().domain(domain).range(range) : scaleLinear().domain([lo - room, hi + room]).nice().range(range);
  const x = (v) => r2(scale(v));
  const line = band && lineScore({ highestNo, lowestYes });
  const rowH = stacked ? ROW_STACKED : ROW;
  const labelX = stacked ? left + STACK_LABEL : 0;
  const bottom = TOP + (steps.length + 1) * rowH + 6;
  const yOf = (i) => TOP + i * rowH + (stacked ? STACK_BAR_Y : (ROW - BAR) / 2);
  // A row's label and its words: on the bar's line, or (stacked) above the bar with the words after the label.
  const labelY = (y) => (stacked ? y - 6 : y + BAR - 3);
  const bar = (from, to, y, cls, fill = null) => {
    const d = barPath(scale(from), scale(to), y, BAR);
    return d ? html`<path class="${cls}"${fill ? html` fill="${fill}"` : ''} d="${d}"/>` : html`<line class="${cls}" x1="${x(from)}" x2="${x(from)}" y1="${y}" y2="${y + BAR}"/>`;
  };
  // A part of zero says why, where its bar would be: after the label (stacked) or from the running total (to the value column's edge).
  const noteOf = (s, y) => {
    const at = stacked ? labelX + textWidth(s.label, LABEL_PX) + 8 : scale(s.from) + 8;
    const flip = !stacked && at + textWidth(s.note, NOTE_PX) > range[1];
    return text({ x: flip ? range[1] : at, y: labelY(y), anchor: flip ? 'end' : 'start', cls: 'chart-note', body: s.note });
  };
  const drawn = steps.map((s, i) => {
    const y = yOf(i);
    const cls = s.assigned ? 'chart-step chart-step--na' : s.pen ? 'chart-step chart-step--pen' : s.value < 0 ? 'chart-step chart-step--down' : 'chart-step';
    return html`${mark({
      tip: s.tip, value: s.value, hit: { x: left, y: TOP + i * rowH, width: width - left, height: rowH },
      body: html`${s.note ? '' : bar(s.from, s.to, y, cls, s.assigned ? hatchFill(id) : null)}${text({ x: labelX, y: labelY(y), anchor: 'start', cls: s.pen ? 'chart-label chart-label--pen' : 'chart-label', body: s.label })}${s.note ? noteOf(s, y) : ''}${text({ x: width, y: y + BAR - 3, anchor: 'end', cls: 'chart-value', body: s.valueText })}`,
    })}
<line class="chart-connector" x1="${x(s.to)}" x2="${x(s.to)}" y1="${y + BAR}" y2="${yOf(i + 1)}"/>
`;
  });
  const yt = yOf(steps.length);
  const ruleY = stacked ? yt - STACK_BAR_Y : yt - 5;
  let height = bottom + 24;
  let below = '';
  if (caption) {
    below = html`${text({ x: left, y: bottom + 30, anchor: 'start', cls: 'chart-note', body: caption })}`;
    height = bottom + 42;
  }
  if (cap) {
    const stripY = bottom + (caption ? 44 : 34) + 18;
    const capMax = cap.max ?? cap.value;
    const capX = scaleLinear().domain([0, capMax]).range(range);
    const cx = (v) => r2(capX(v));
    const start = bottom + (caption ? 36 : 24);
    below = html`${below}<path class="chart-loupe__beam" d="M${x(scale.domain()[0])} ${r2(start)}L${cx(0)} ${r2(stripY)}M${x(scale.domain()[1])} ${r2(start)}L${cx(scale.domain()[1])} ${r2(stripY)}"/>
${mark({
    tip: cap.tip, value: [total.value, cap.value], hit: { x: left, y: stripY - 6, width: width - left, height: 30 },
    body: html`${text({ x: stacked ? left + 8 : 0, y: stripY - (stacked ? 8 : -11), anchor: 'start', cls: 'chart-label', body: cap.title })}<rect class="chart-track" x="${cx(0)}" y="${stripY}" width="${cx(capMax) - cx(0)}" height="${BAR}"/>${steps.filter((s) => s.value > 0).map((s) => html`<rect class="chart-step chart-step--pen" x="${cx(s.from)}" y="${stripY}" width="${r2(Math.max(0, capX(s.to) - capX(s.from) - 1))}" height="${BAR}"/>`)}<line class="chart-line" x1="${cx(cap.value)}" x2="${cx(cap.value)}" y1="${stripY - 6}" y2="${stripY + BAR + 6}"/>${text({ x: cx(cap.value), y: stripY - 9, anchor: 'end', cls: 'chart-cap chart-cap--pen', body: cap.label })}${text({ x: width, y: stripY + BAR - 3, anchor: 'end', cls: 'chart-value chart-value--total', body: cap.share })}`,
  })}
<g transform="translate(0 ${r2(stripY + BAR + 6)})">${axis({ scale: capX, orient: 'bottom', ticks: cap.ticks, format: cap.format })}</g>`;
    height = stripY + BAR + 6 + 24;
  }
  return frame({
    kind: 'waterfall', width, height, body: html`${hatchDefs(id)}
${band ? html`<rect class="chart-zone" x="${x(line)}" y="${TOP - 6}" width="${r2(width - VALUE_W - scale(line))}" height="${bottom - TOP + 6}"/>
${labels.zone ? text({ x: width - VALUE_W - 4, y: TOP + 4, anchor: 'end', cls: 'chart-zone-label', body: labels.zone }) : ''}
` : ''}<line class="chart-zero" x1="${x(0)}" x2="${x(0)}" y1="${TOP - 6}" y2="${bottom}"/>
${drawn}<line class="chart-rule" x1="${left}" x2="${width - VALUE_W}" y1="${ruleY}" y2="${ruleY}"/>
${mark({
    tip: total.tip, value: total.value, hit: { x: left, y: stacked ? yt - STACK_BAR_Y : yt - 4, width: width - left, height: stacked ? rowH : ROW },
    body: html`${bar(0, total.value, yt, total.pen ? 'chart-step chart-step--pen chart-step--total' : 'chart-step chart-step--total')}${text({ x: labelX, y: labelY(yt), anchor: 'start', cls: 'chart-label', body: total.label })}${text({ x: width, y: yt + BAR - 3, anchor: 'end', cls: 'chart-value chart-value--total', body: total.valueText })}`,
  })}
${band ? html`${mark({
    tip: labels.lineTip, value: [highestNo, lowestYes], hit: { x: x(line) - 6, y: 0, width: 12, height: bottom },
    body: html`<line class="chart-line" x1="${x(line)}" x2="${x(line)}" y1="${TOP - 10}" y2="${bottom}"/>`,
  })}
${text({ x: x(line) + 4, y: TOP - 12, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.line })}
` : ''}<g transform="translate(0 ${bottom})">${axis({ scale, orient: 'bottom', ticks, format })}</g>${below}`,
  });
}
