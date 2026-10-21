// Each part of a total as a horizontal bar from a zero line, one row per part in the order given (never re-sorted):
// negative parts grow left, positive parts right, all on one scale. A row CMS assigned is hatched; its label (the
// caller's words) says so, and keeps a hatched stub at the zero line when its bar would be too short to show the
// hatch. Bars are THICKNESS units thick, rounded at the data end; the value sits at the row's end. Labels get
// LABEL_W units (about 15 characters) and are never truncated: pass short names.
//   id       names this SVG's hatch pattern (lowercase letters, digits, hyphens)
//   rows     [{ id, label, value, assigned }]
//   extent   the largest |value| the scale holds (default: the rows' largest)
//   format   value -> text (default: the number as given, with a true minus)
import { html } from '../render/html.js';
import { WIDTH, barPath, checkId, frame, hatchDefs, hatchFill, mark, plain, r2, text } from './svg.js';

const ROW = 28;
const THICKNESS = 16; // at most MAX_THICKNESS (svg.js)
const LABEL_W = 112;
const VALUE_W = 64;
const PAD = 4;
// From a row's middle to the baseline of its 12-unit text.
const BASELINE = 4;
// An assigned bar shorter than half this is drawn as a stub this wide, centered on the zero line.
const STUB = 8;

export function contribBars({ id, rows, extent, width = WIDTH, format = plain }) {
  checkId(id, 'contribBars');
  if (!rows.length) throw new RangeError('contribBars: no rows');
  const max = extent ?? Math.max(...rows.map((r) => Math.abs(r.value)));
  const half = (width - LABEL_W - VALUE_W) / 2;
  const zero = LABEL_W + half;
  const xOf = (v) => zero + (max > 0 ? (v / max) * half : 0);
  const height = rows.length * ROW + 2 * PAD;

  return frame({
    kind: 'bars', width, height, body: html`${hatchDefs(id)}
${rows.map((row, i) => {
    const y = PAD + i * ROW;
    const barY = y + (ROW - THICKNESS) / 2;
    const tip = xOf(row.value);
    const stub = row.assigned && Math.abs(tip - zero) < STUB / 2;
    const d = stub ? barPath(zero - STUB / 2, zero + STUB / 2, barY, THICKNESS) : barPath(zero, tip, barY, THICKNESS);
    const fill = row.assigned ? html` fill="${hatchFill(id)}"` : '';
    return html`${mark({
      tip: `${row.label}: ${format(row.value)}`, value: row.value, data: { row: row.id },
      hit: { x: 0, y, width, height: ROW },
      body: html`${text({ x: 0, y: y + ROW / 2 + BASELINE, anchor: 'start', cls: 'chart-label', body: row.label })}${d ? html`<path class="${row.assigned ? 'chart-bar-na' : 'chart-bar'}"${fill} d="${d}"/>` : ''}${text({ x: width, y: y + ROW / 2 + BASELINE, anchor: 'end', cls: 'chart-value', body: format(row.value) })}`,
    })}
`;
  })}<line class="chart-zero" x1="${r2(zero)}" x2="${r2(zero)}" y1="0" y2="${height}"/>`,
  });
}
