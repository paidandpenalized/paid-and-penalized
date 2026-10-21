// One value against a national range: the axis from zero (or from just under CMS's floor, when the floor is above
// zero) to just past the larger of the cap and the value; the values that score the same as CMS's floor or cap
// hatched from that end to the axis's end (one encoding for one idea, as on the what-if's tracks); the median as a
// tick in ink crossing the axis; and this hospital's value as a ▲ under the axis (no ▲ when value is null), its
// number beside it in mono on a paper halo, on the side with more room. Words are the caller's. dotRanges stacks
// several as small multiples in one SVG, each row on its own scale (units differ) with its title in a column at the
// left; the ▲'s label prints once, under the first row that has a ▲, and a key (figure.js) names the marks for every
// row. Its optional cue (e.g. which way is better) is said once, at the chart's top right.
//   id                               names this SVG's hatch pattern (lowercase letters, digits, hyphens)
//   label, medianLabel, sameLabel    the ▲'s name (its label and tooltip), the median's and the hatch's tooltip names
//   showLabel                        print the ▲'s label under it (dotRange: yes; dotRanges: the first ▲ only)
//   note                             text in the ▲'s place when value is null (optional)
//   format                           value -> text (default: the number as given, with a true minus)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, checkId, frame, hatchDefs, hatchFill, mark, plain, r2, text, triangle } from './svg.js';

const MARGIN = 18;
// The axis sits under its tick labels (LABEL_Y above it, clear of every mark); the hatch is centered on it, the
// median crosses it, and the ▲ hangs just under the median.
const AXIS_Y = 24;
const LABEL_Y = -12;
const HATCH = 8;
const MEDIAN = 14;
const MARK_Y = AXIS_Y + MEDIAN / 2 + 2;
// An axis tick this close to the median (in units) is left out, so the two never read as one mark.
const NEAR = 6;
// A row's height without and with the ▲'s label.
const HEIGHT = MARK_Y + 14;
const LABELLED = HEIGHT + 14;
// Room past the plotted values, as a share of their span (an axis that starts at zero gets none below).
const ROOM = 0.1;
// dotRanges: the title column (short names, about 7 characters) and the gap between rows.
const TITLE_W = 58;
const ROW_GAP = 4;
// The ▲'s number: its gap from the ▲'s center, and its baseline (about the ▲'s middle for 11-unit text).
const VALUE_DX = 9;
const VALUE_Y = MARK_Y + 9.5;
// The cue's row over the first row's tick labels.
const CUE_H = 16;

function body({ id, value, floor, cap, median, label, showLabel = true, note = null, medianLabel, sameLabel, width, format, x0 = 0 }) {
  if (!(floor <= median && median <= cap)) throw new RangeError('dotRange: need floor <= median <= cap');
  const [lo, hi] = [Math.min(floor, value ?? floor), Math.max(cap, value ?? cap)];
  const room = (hi - lo) * ROOM || 1;
  const [left, right] = [x0 + MARGIN, width - MARGIN];
  const scale = scaleLinear().domain([lo === 0 ? 0 : lo - room, hi + room]).range([left, right]);
  const x = (v) => r2(scale(v));
  const tAt = (v) => (scale(v) - left) / (right - left);
  const ticks = scale.ticks(5);

  let hospital = '';
  if (value !== null) {
    const { anchor, dx } = labelAt(tAt(value));
    const side = tAt(value) > 0.5 ? -1 : 1;
    hospital = html`${mark({
      tip: `${label}: ${format(value)}`, value, hit: { x: x(value) - 9, y: MARK_Y - 2, width: 18, height: 16 },
      body: triangle(x(value), MARK_Y, 'chart-this'),
    })}
${text({ x: x(value) + side * VALUE_DX, y: VALUE_Y, anchor: side > 0 ? 'start' : 'end', cls: 'chart-value chart-value--mark chart-label--halo', body: format(value) })}${showLabel ? html`
${text({ x: x(value), y: MARK_Y + 25, anchor, dx, cls: 'chart-label', body: label })}` : ''}`;
  } else if (note) {
    hospital = text({ x: left, y: MARK_Y + 9, anchor: 'start', cls: 'chart-note', body: note });
  }

  // Each stretch that scores the same as an end: below the floor (when the axis reaches below it) and past the cap.
  const dead = [[left, x(floor)], [x(cap), right]].filter(([a, b]) => b - a > 0.5);
  const edge = (v) => html`<line class="chart-dead__end" x1="${x(v)}" x2="${x(v)}" y1="${AXIS_Y - HATCH / 2}" y2="${AXIS_Y + HATCH / 2}"/>`;
  const lowEnd = floor > scale.domain()[0];
  return html`${mark({
      tip: `${sameLabel} (${lowEnd ? `${format(floor)}, ` : ''}${format(cap)})`, value: [floor, cap], hit: null,
      body: html`${dead.map(([a, b]) => html`<rect class="chart-dead" fill="${hatchFill(id)}" x="${r2(a)}" y="${AXIS_Y - HATCH / 2}" width="${r2(b - a)}" height="${HATCH}"/>`)}${lowEnd ? edge(floor) : ''}${edge(cap)}`,
    })}
<g transform="translate(0 ${AXIS_Y})">${axis({ scale, orient: 'top', ticks, labelY: LABEL_Y, noTick: (v) => Math.abs(scale(v) - scale(median)) < NEAR })}</g>
${mark({
    tip: `${medianLabel}: ${format(median)}`, value: median, hit: { x: x(median) - 6, y: AXIS_Y - MEDIAN / 2 - 1, width: 12, height: MEDIAN + 2 },
    body: html`<line class="chart-median" x1="${x(median)}" x2="${x(median)}" y1="${AXIS_Y - MEDIAN / 2}" y2="${AXIS_Y + MEDIAN / 2}"/>`,
  })}
${hospital}`;
}

export function dotRange({ id = 'range', width = WIDTH, format = plain, showLabel = true, ...args }) {
  checkId(id, 'dotRange');
  return frame({
    kind: 'dot-range', width, height: showLabel && args.value !== null ? LABELLED : HEIGHT,
    body: html`${hatchDefs(id)}${body({ ...args, id, showLabel, width, format })}`,
  });
}

// rows: [{ title, value, floor, cap, median, label, note, format }], drawn top to bottom in the order given. cue:
// optional text over the rows' top right.
export function dotRanges({ id = 'ranges', rows, medianLabel, sameLabel, width = WIDTH, cue = null }) {
  checkId(id, 'dotRanges');
  if (!rows?.length) throw new RangeError('dotRanges: no rows');
  const first = rows.findIndex((r) => r.value !== null);
  let y = cue ? CUE_H : 0;
  const drawn = rows.map(({ title, format = plain, ...row }, i) => {
    const showLabel = i === first;
    const out = html`<g transform="translate(0 ${y})">${text({ x: 0, y: AXIS_Y + 4, anchor: 'start', cls: 'chart-label', body: title })}
${body({ ...row, id, showLabel, medianLabel, sameLabel, width, format, x0: TITLE_W })}</g>
`;
    y += (showLabel ? LABELLED : HEIGHT) + ROW_GAP;
    return out;
  });
  const top = cue ? text({ x: width, y: CUE_H - 6, anchor: 'end', cls: 'chart-axis__title', body: cue }) : '';
  return frame({ kind: 'dot-ranges', width, height: y - ROW_GAP, body: html`${hatchDefs(id)}${top}${drawn}` });
}
