// Plain horizontal bars, a row each: the label at the left, the bar on a light track, its value printed after it.
// One row may be marked (pen: the penalty ink). Each row is a mark.
//   rows [{ label, value, valueText, tip, pen }]; max: the track's full length in values; labelW: the label column's
//   width (default: by the drawing's width); valuesAtEnd: print every value in one column past the track's end
//   (for rows whose bars run near the end), else just after its bar
//   optional per row: sub (a second, smaller line under the label: the counts behind the bar) and tick (a value on the
//   same scale marked across the track: what to compare the bar with)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { barPath, frame, mark, r2, text } from './svg.js';

export function barRows({ rows, max, width, labelW = width < 400 ? 70 : 96, valuesAtEnd = false }) {
  const right = width - 44;
  const x = scaleLinear().domain([0, max]).range([labelW, right]);
  const subs = rows.some((r) => r.sub);
  const rowH = subs ? 38 : 26;
  const body = rows.map((r, i) => {
    const y = 6 + i * rowH;
    const at = r.tick == null ? null : r2(x(r.tick));
    return mark({
      tip: r.tip, value: r.value, hit: { x: 0, y, width, height: rowH },
      body: html`<rect class="chart-track" x="${labelW}" y="${y + 6}" width="${r2(right - labelW)}" height="12"/><path class="${r.pen ? 'chart-bar chart-col--pen' : 'chart-bar'}" d="${barPath(labelW, x(r.value), y + 6, 12)}"/>${r.tick == null ? '' : html`<line class="chart-bartick" x1="${at}" x2="${at}" y1="${y + 2}" y2="${y + 22}"/>`}${text({ x: labelW - 8, y: subs && r.sub ? y + 13 : y + 16, anchor: 'end', cls: 'chart-punch__row', body: r.label })}${r.sub ? text({ x: labelW - 8, y: y + 27, anchor: 'end', cls: 'chart-tick', body: r.sub }) : ''}${text({ x: valuesAtEnd ? right + 6 : r2(x(r.value)) + 5, y: y + 16, anchor: 'start', cls: 'chart-value chart-value--mark', body: r.valueText })}`,
    });
  });
  return frame({ kind: 'bars', width, height: 12 + rows.length * rowH, body: html`${body}` });
}
