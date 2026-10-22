// One hospital's value on a measure's ruler, with every hospital's values behind it: the distribution as faint
// columns (a value past either end of the axis counts in the end column, as a value past CMS's floor or cap scores
// the same as that end), the stretches that score the same as the floor or cap hatched along the axis, the national
// median as an ink tick through the columns with its label over it, and this hospital's value as a ▲ under the axis
// with its number beside it (on the side with more room). The ▲ takes the penalty ink when `pen` (a page marks the
// measure that raised the score most). No ▲ without a value: the note takes its place, or, with ghost (a score CMS
// assigned as the worst), a hollow ▲ at the worst end with the note beside it.
//   id                     names this SVG's hatch pattern
//   domain                 [lo, hi] of the axis; counts: columns over equal steps of it (countBins)
//   floor, cap, median     CMS's floor and cap, the national median; value: this hospital's (null: none)
//   labels                 { median, value, same, note }: the median's label (with its number), the ▲'s tooltip
//                          name, the hatch's tooltip name, the text in the ▲'s place when value is null
//   format                 value -> text
import { html } from '../render/html.js';
import { checkId, frame, hatchDefs, hatchFill, mark, r2, text, triangle } from './svg.js';

const PAD = 6;
const COL_TOP = 16;
const AXIS = 42;
const HATCH = 6;
const MARK = AXIS + 3;
const HEIGHT = AXIS + 18;

export function ruler({ id, domain: [lo, hi], counts, floor, cap, median, value, labels, format, width = 300, pen = false, ghost = false }) {
  checkId(id, 'ruler');
  const x = (v) => r2(PAD + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (width - 2 * PAD));
  const step = (width - 2 * PAD) / counts.length;
  const most = Math.max(...counts, 1);
  const cols = counts.map((c, i) => (c ? html`<rect class="chart-dist" x="${r2(PAD + i * step + 0.5)}" y="${r2(AXIS - ((AXIS - COL_TOP) * c) / most)}" width="${r2(Math.max(step - 1, 0.5))}" height="${r2(((AXIS - COL_TOP) * c) / most)}"/>` : ''));
  const dead = [[PAD, x(floor)], [x(cap), width - PAD]].filter(([a, b]) => b - a > 0.5);
  const xm = x(median);
  const nearRight = xm > width * 0.72;
  let hospital;
  if (value === null && ghost) {
    // No value, but CMS scored the measure as its worst: a hollow ▲ at the axis's worst end, its note to its left.
    const xg = width - PAD - 8;
    hospital = html`${mark({ tip: labels.note, value: null, hit: { x: xg - 9, y: MARK - 2, width: 18, height: 15 }, body: triangle(xg, MARK, 'chart-hyp') })}
${text({ x: xg - 10, y: MARK + 10, anchor: 'end', cls: 'chart-note chart-label--halo', body: labels.note })}`;
  } else if (value === null) {
    hospital = labels.note ? text({ x: PAD, y: AXIS + 14, anchor: 'start', cls: 'chart-note', body: labels.note }) : '';
  } else {
    const xv = x(value);
    const right = xv < width * 0.6;
    hospital = html`${mark({
      tip: `${labels.value}: ${format(value)}`, value, hit: { x: xv - 9, y: MARK - 2, width: 18, height: 15 },
      body: triangle(xv, MARK, pen ? 'chart-this chart-this--pen' : 'chart-this'),
    })}
${text({ x: xv + (right ? 9 : -9), y: MARK + 10, anchor: right ? 'start' : 'end', cls: 'chart-value chart-value--mark chart-label--halo', body: format(value) })}`;
  }
  return frame({
    kind: 'ruler', width, height: HEIGHT, body: html`${hatchDefs(id)}<g aria-hidden="true">${cols}</g>
${mark({
    tip: `${labels.same} (${format(floor)}, ${format(cap)})`, value: [floor, cap], hit: null,
    body: html`${dead.map(([a, b]) => html`<rect class="chart-dead" fill="${hatchFill(id)}" x="${r2(a)}" y="${AXIS - HATCH / 2}" width="${r2(b - a)}" height="${HATCH}"/>`)}${dead.map(([a, b]) => html`<line class="chart-dead__end" x1="${a === PAD ? b : a}" x2="${a === PAD ? b : a}" y1="${AXIS - HATCH / 2}" y2="${AXIS + HATCH / 2}"/>`)}`,
  })}
<line class="chart-axis__line" x1="${PAD}" x2="${width - PAD}" y1="${AXIS}" y2="${AXIS}"/>
${mark({
    tip: labels.median, value: median, hit: { x: xm - 6, y: COL_TOP - 4, width: 12, height: AXIS - COL_TOP + 10 },
    body: html`<line class="chart-median" x1="${xm}" x2="${xm}" y1="${COL_TOP - 3}" y2="${AXIS + 5}"/>`,
  })}
${text({ x: xm + (nearRight ? -4 : 4), y: COL_TOP - 4, anchor: nearRight ? 'end' : 'start', cls: 'chart-note chart-label--halo', body: labels.median })}
${hospital}`,
  });
}
