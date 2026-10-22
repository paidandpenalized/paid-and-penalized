// The rule stack: one small score rule per row (a year), each the year's scores sorted lowest to highest across the
// full width, so every year's line lands where its share cut puts it. Each hospital's hairline takes the ink of the
// decision CMS published for it, so a decision out of order with the scores would show as a hairline of the other
// ink on the wrong side of the line. The line is a short rule through the row. Heights are each row's own: years on different scales
// (CMS changed how the score is built) still show their shape.
//   rows   [{ label, note, scores, yes, line }]: scores ascending; yes[i], CMS cut scores[i]; line: how many of the
//          highest scores lie past the line, so it is drawn before them (null: no line that year)
import { html } from '../render/html.js';
import { frame, r2, text } from './svg.js';

const ROW = 78;
const UP = 40;
const DOWN = 18;
const TOP = 4;
const THIN = 1.5;

// Runs of hospitals with the same decision, in rank order: [{ a, b, yes }], b exclusive.
function runs(yes) {
  const out = [];
  yes.forEach((y, i) => {
    const last = out[out.length - 1];
    if (last && last.yes === y) last.b = i + 1;
    else out.push({ a: i, b: i + 1, yes: y });
  });
  return out;
}

export function ruleStack({ rows, width }) {
  if (!rows.length) throw new RangeError('ruleStack: no rows');
  const height = TOP + rows.length * ROW;
  const body = rows.map((r, i) => {
    const n = r.scores.length;
    const zero = TOP + i * ROW + 16 + UP;
    const hi = Math.max(r.scores[n - 1], 0);
    const lo = Math.min(r.scores[0], 0);
    const k = Math.min(hi > 0 ? UP / hi : Infinity, lo < 0 ? DOWN / -lo : Infinity);
    const xAt = (j) => (j * width) / n;
    const y = (s) => r2(zero - (Number.isFinite(k) ? s * k : 0));
    const shape = ({ a, b }) => {
      const pts = [];
      let last = -Infinity;
      for (let j = a; j < b; j++) {
        const x = xAt(j + 0.5);
        if (j === a || j === b - 1 || x - last >= THIN) {
          pts.push(`${r2(x)} ${y(r.scores[j])}`);
          last = x;
        }
      }
      const first = pts[0].split(' ')[1];
      const end = pts[pts.length - 1].split(' ')[1];
      return `M${r2(xAt(a))} ${r2(zero)}L${r2(xAt(a))} ${first}L${pts.join('L')}L${r2(xAt(b))} ${end}L${r2(xAt(b))} ${r2(zero)}Z`;
    };
    const parts = runs(r.yes);
    const ink = parts.filter((p) => !p.yes).map(shape).join('');
    const pen = parts.filter((p) => p.yes).map(shape).join('');
    const lineX = r.line === null ? null : r2(xAt(n - r.line));
    return html`<g class="chart-rules__row">
${ink ? html`<path class="chart-rule__ink" d="${ink}"/>` : ''}${pen ? html`<path class="chart-rule__pen" d="${pen}"/>` : ''}
<rect class="chart-rule__bar" x="0" y="${r2(zero - 1)}" width="${width}" height="2"/>
${lineX === null ? '' : html`<line class="chart-rule__line" x1="${lineX}" x2="${lineX}" y1="${r2(zero - UP)}" y2="${r2(zero + DOWN)}"/>`}
${text({ x: 0, y: zero - UP - 4, anchor: 'start', cls: 'chart-proof__label chart-label--halo', body: r.label })}
${text({ x: width, y: zero - UP - 4, anchor: 'end', cls: 'chart-cap chart-label--halo', body: r.note })}
</g>`;
  });
  return frame({ kind: 'rules', width, height, body: html`${body}` });
}
