// The score rule by the money: the same sorted scores as the score rule (scoreRule.js), each hospital's hairline as
// wide as its weight (its dollars at stake) instead of one slot each, so the cut side's share of the money shows as its
// share of the width. Two filled silhouettes (svg.js silhouette), the cut side in the penalty ink.
//   scores   sorted ascending; weights: one per score (> 0); cut: how many at the high end are past the line
//   labels   { low, high, line, cut, under }: the ends' captions, the line's name, the cut side's words and the other
//            side's
import { html } from '../render/html.js';
import { frame, r2, silhouette, text } from './svg.js';

const M = { top: 22, bottom: 20 };

export function moneyRule({ scores, weights, cut, labels, width, up = 72, down = 46 }) {
  const n = scores.length;
  if (!n || weights.length !== n || cut < 0 || cut > n) throw new RangeError('moneyRule: scores, a weight for each, and a cut count within them');
  const total = weights.reduce((s, w) => s + w, 0);
  const starts = [];
  let run = 0;
  for (const w of weights) { starts.push(run); run += w; }
  const xOf = (v) => (v / total) * width;
  const x = (i) => xOf(starts[i] + weights[i] / 2);
  const hi = Math.max(scores[n - 1], 0);
  const lo = Math.min(scores[0], 0);
  const k = Math.min(hi > 0 ? up / hi : Infinity, lo < 0 ? down / -lo : Infinity);
  const zero = M.top + up;
  const y = (s) => r2(zero - s * k);
  const shape = (a, b) => silhouette(scores, a, b, { x, x0: xOf(starts[a]), x1: b < n ? xOf(starts[b]) : width, y, base: zero });
  const split = n - cut;
  const lineX = r2(split < n ? xOf(starts[split]) : width);
  const height = zero + down + M.bottom;
  return frame({
    kind: 'money-rule', width, height, body: html`<path class="chart-rule__ink" d="${shape(0, split)}"/>
<path class="chart-rule__pen" d="${shape(split, n)}"/>
<rect class="chart-rule__bar" x="0" y="${r2(zero - 2.5)}" width="${width}" height="5"/>
<line class="chart-rule__line" x1="${lineX}" x2="${lineX}" y1="${M.top - 16}" y2="${r2(zero + down)}"/>
${text({ x: 0, y: height - 4, anchor: 'start', cls: 'chart-cap', body: labels.low })}
${text({ x: width, y: height - 4, anchor: 'end', cls: 'chart-cap', body: labels.high })}
${text({ x: lineX - 6, y: M.top - 8, anchor: 'end', cls: 'chart-cap', body: labels.under })}
${text({ x: lineX + 6, y: M.top - 8, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.cut })}`,
  });
}
