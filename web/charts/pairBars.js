// Two shares side by side for each group: its share of a count (in ink) over its share of an amount (in the penalty
// ink), both on one 0-to-max scale, rows grouped under headings. For "the same quarter of hospitals, a very different
// share of the money". Each bar is a mark with its tooltip and value; each row's two numbers print at the bar ends.
//   sections [{ heading, rows: [{ label, a, b, aText, bText, tipA, tipB }] }]: a and b are fractions (0 to 1)
//   labels   { a, b }: what the two bars are (the key over the chart)
//   direct   { a, b } or null: short words that name the bars in place instead of the key, set after the first row's two numbers;
//            the value column widens to hold them (no key then)
import { html } from '../render/html.js';
import { LABEL_PX, frame, isNarrow, mark, r2, text } from './svg.js';
import { textWidth } from './text.js';

const ROW = 30;
// The gap between a name (at the labels' size, svg.js LABEL_PX) and its bars.
const LABEL_GAP = 8;
const BAR = 10;
const HEAD = 26;
const KEY = 26;

export function pairBars({ sections, labels, width, direct = null }) {
  const narrow = isNarrow(width);
  // The name column: its usual width, or wider where a name needs it, so none runs off the drawing's left edge.
  const widest = Math.max(...sections.flatMap((s) => s.rows.map((r) => textWidth(r.label, LABEL_PX))));
  const nameW = Math.max(narrow ? 92 : 170, Math.ceil(widest) + LABEL_GAP);
  // The row that names its bars in place (direct): the first; its numbers and words set the value column's width.
  const named = direct ? sections[0]?.rows[0] ?? null : null;
  const VALUE_PX = 11;
  const valueW = named ? Math.max(44, ...[[named.aText, direct.a], [named.bText, direct.b]].map(([v, w]) => Math.ceil(textWidth(`${v} ${w}`, VALUE_PX, { mono: true })) + 6)) : 44;
  const x0 = nameW;
  const x1 = width - valueW;
  const max = Math.max(...sections.flatMap((s) => s.rows.flatMap((r) => [r.a, r.b])), 0.01);
  const x = (v) => x0 + (v / max) * (x1 - x0);
  const suffix = (r, side) => (r === named ? html` <tspan class="chart-note">${direct[side]}</tspan>` : '');
  // On a phone the key's two entries take a row each; a chart that names its bars in place has no key.
  let y = named ? 0 : narrow ? KEY + 18 : KEY;
  const body = [];
  for (const s of sections) {
    y += HEAD;
    body.push(text({ x: 0, y: y - 8, anchor: 'start', cls: 'chart-cap', body: s.heading }));
    body.push(html`<line class="chart-baseline" x1="${x0}" x2="${x0}" y1="${r2(y - 2)}" y2="${r2(y + s.rows.length * ROW - 4)}"/>`);
    for (const r of s.rows) {
      const ya = y + 2;
      const yb = ya + BAR + 1;
      body.push(text({ x: nameW - LABEL_GAP, y: ya + BAR + 3, anchor: 'end', cls: 'chart-label', body: r.label }));
      body.push(mark({ tip: r.tipA, value: r.a, hit: null, body: html`<rect class="chart-pair__a" x="${x0}" y="${r2(ya)}" width="${r2(Math.max(0.5, x(r.a) - x0))}" height="${BAR}"/>` }));
      body.push(mark({ tip: r.tipB, value: r.b, hit: null, body: html`<rect class="chart-pair__b" x="${x0}" y="${r2(yb)}" width="${r2(Math.max(0.5, x(r.b) - x0))}" height="${BAR}"/>` }));
      body.push(text({ x: x(r.a) + 4, y: ya + BAR - 1, anchor: 'start', cls: 'chart-value chart-pair__v', body: html`${r.aText}${suffix(r, 'a')}` }));
      body.push(text({ x: x(r.b) + 4, y: yb + BAR - 1, anchor: 'start', cls: 'chart-value chart-pair__v chart-pair__v--b', body: html`${r.bText}${suffix(r, 'b')}` }));
      y += ROW;
    }
  }
  const [keyB, keyBy] = narrow ? [0, 22] : [220, 4];
  const key = html`<rect class="chart-pair__a" x="0" y="4" width="14" height="${BAR}"/>${text({ x: 20, y: 13, anchor: 'start', cls: 'chart-label', body: labels.a })}
<rect class="chart-pair__b" x="${keyB}" y="${keyBy}" width="14" height="${BAR}"/>${text({ x: keyB + 20, y: keyBy + 9, anchor: 'start', cls: 'chart-label', body: labels.b })}`;
  return frame({ kind: 'pair', width, height: y + 6, body: html`${named ? '' : key}
${body}` });
}
