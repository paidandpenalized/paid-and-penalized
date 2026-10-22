// Plain horizontal bars, a row each: the label at the left, the bar on a light track, its value printed after it.
// One row may be marked (pen: the penalty ink). Each row is a mark.
//   rows [{ label, value, valueText, tip, pen }]; max: the track's full length in values; labelW: the label column's
//   width (default: by the drawing's width); valuesAtEnd: print every value in one column past the track's end
//   (for rows whose bars run near the end), else just after its bar
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { barPath, frame, mark, r2, text } from './svg.js';

export function barRows({ rows, max, width, labelW = width < 400 ? 70 : 96, valuesAtEnd = false }) {
  const right = width - 44;
  const x = scaleLinear().domain([0, max]).range([labelW, right]);
  const rowH = 26;
  const body = rows.map((r, i) => {
    const y = 6 + i * rowH;
    return mark({
      tip: r.tip, value: r.value, hit: { x: 0, y, width, height: rowH },
      body: html`<rect class="chart-track" x="${labelW}" y="${y + 6}" width="${r2(right - labelW)}" height="12"/><path class="${r.pen ? 'chart-bar chart-col--pen' : 'chart-bar'}" d="${barPath(labelW, x(r.value), y + 6, 12)}"/>${text({ x: labelW - 8, y: y + 16, anchor: 'end', cls: 'chart-punch__row', body: r.label })}${text({ x: valuesAtEnd ? right + 6 : r2(x(r.value)) + 5, y: y + 16, anchor: 'start', cls: 'chart-value chart-value--mark', body: r.valueText })}`,
    });
  });
  return frame({ kind: 'bars', width, height: 12 + rows.length * rowH, body: html`${body}` });
}
