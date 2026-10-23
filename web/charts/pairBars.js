// Two shares side by side for each group: its share of a count (in ink) over its share of an amount (in the penalty
// ink), both on one 0-to-max scale, rows grouped under headings. For "the same quarter of hospitals, a very different
// share of the money". Each bar is a mark with its tooltip and value; each row's two numbers print at the bar ends.
//   sections [{ heading, rows: [{ label, a, b, aText, bText, tipA, tipB }] }]: a and b are fractions (0 to 1)
//   labels   { a, b }: what the two bars are (the key over the chart)
import { html } from '../render/html.js';
import { frame, isNarrow, mark, r2, text } from './svg.js';

const ROW = 30;
const BAR = 10;
const HEAD = 26;
const KEY = 26;

export function pairBars({ sections, labels, width }) {
  const narrow = isNarrow(width);
  const nameW = narrow ? 92 : 170;
  const valueW = 44;
  const x0 = nameW;
  const x1 = width - valueW;
  const max = Math.max(...sections.flatMap((s) => s.rows.flatMap((r) => [r.a, r.b])), 0.01);
  const x = (v) => x0 + (v / max) * (x1 - x0);
  let y = KEY;
  const body = [];
  for (const s of sections) {
    y += HEAD;
    body.push(text({ x: 0, y: y - 8, anchor: 'start', cls: 'chart-cap', body: s.heading }));
    body.push(html`<line class="chart-baseline" x1="${x0}" x2="${x0}" y1="${r2(y - 2)}" y2="${r2(y + s.rows.length * ROW - 4)}"/>`);
    for (const r of s.rows) {
      const ya = y + 2;
      const yb = ya + BAR + 1;
      body.push(text({ x: nameW - 8, y: ya + BAR + 3, anchor: 'end', cls: 'chart-label', body: r.label }));
      body.push(mark({ tip: r.tipA, value: r.a, hit: null, body: html`<rect class="chart-pair__a" x="${x0}" y="${r2(ya)}" width="${r2(Math.max(0.5, x(r.a) - x0))}" height="${BAR}"/>` }));
      body.push(mark({ tip: r.tipB, value: r.b, hit: null, body: html`<rect class="chart-pair__b" x="${x0}" y="${r2(yb)}" width="${r2(Math.max(0.5, x(r.b) - x0))}" height="${BAR}"/>` }));
      body.push(text({ x: x(r.a) + 4, y: ya + BAR - 1, anchor: 'start', cls: 'chart-value chart-pair__v', body: r.aText }));
      body.push(text({ x: x(r.b) + 4, y: yb + BAR - 1, anchor: 'start', cls: 'chart-value chart-pair__v chart-pair__v--b', body: r.bText }));
      y += ROW;
    }
  }
  const keyB = narrow ? Math.round(width / 2) : 220;
  const key = html`<rect class="chart-pair__a" x="0" y="4" width="14" height="${BAR}"/>${text({ x: 20, y: 13, anchor: 'start', cls: 'chart-label', body: labels.a })}
<rect class="chart-pair__b" x="${keyB}" y="4" width="14" height="${BAR}"/>${text({ x: keyB + 20, y: 13, anchor: 'start', cls: 'chart-label', body: labels.b })}`;
  return frame({ kind: 'pair', width, height: y + 6, body: html`${key}
${body}` });
}
