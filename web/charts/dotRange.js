// One value against a national range: the floor-to-cap range as a faint gray band with hairline ends, the median as a
// short tick, and this hospital's value as a ▲ under the axis (no ▲ when value is null). Words are the caller's.
// dotRanges stacks several as small multiples in one SVG, each row on its own scale (units differ) with its title in a
// column at the left; the ▲'s label prints once, under the first row that has a ▲, and a key (figure.js) names the
// marks for every row.
//   label, medianLabel, rangeLabel   the ▲'s name (its label and tooltip) and the median's and range's tooltip names
//   showLabel                        print the ▲'s label under it (dotRange: yes; dotRanges: the first ▲ only)
//   note                             text in the ▲'s place when value is null (optional)
//   format                           value -> text (default: the number as given, with a true minus)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, frame, mark, plain, r2, text, triangle } from './svg.js';

const MARGIN = 18;
// The axis sits under its tick labels; the band is centered on it and the ▲ hangs just under the band.
const AXIS_Y = 22;
const BAND = 10;
const MEDIAN = 10;
const MARK_Y = AXIS_Y + BAND / 2 + 3;
// A row's height without and with the ▲'s label.
const HEIGHT = MARK_Y + 14;
const LABELLED = HEIGHT + 14;
// Room past the plotted values, as a share of their span.
const ROOM = 0.04;
// dotRanges: the title column (short names, about 7 characters) and the gap between rows.
const TITLE_W = 58;
const ROW_GAP = 4;

function body({ value, floor, cap, median, label, showLabel = true, note = null, medianLabel, rangeLabel, width, format, x0 = 0 }) {
  if (!(floor <= median && median <= cap)) throw new RangeError('dotRange: need floor <= median <= cap');
  const plotted = [floor, cap, median, ...(value === null ? [] : [value])];
  const [lo, hi] = [Math.min(...plotted), Math.max(...plotted)];
  const room = (hi - lo) * ROOM || 1;
  const [left, right] = [x0 + MARGIN, width - MARGIN];
  const scale = scaleLinear().domain([lo - room, hi + room]).range([left, right]);
  const x = (v) => r2(scale(v));
  const tAt = (v) => (scale(v) - left) / (right - left);

  let hospital = '';
  if (value !== null) {
    const { anchor, dx } = labelAt(tAt(value));
    hospital = html`${mark({
      tip: `${label}: ${format(value)}`, value, hit: { x: x(value) - 9, y: MARK_Y - 2, width: 18, height: 16 },
      body: triangle(x(value), MARK_Y, 'chart-this'),
    })}${showLabel ? html`
${text({ x: x(value), y: MARK_Y + 25, anchor, dx, cls: 'chart-label', body: label })}` : ''}`;
  } else if (note) {
    hospital = text({ x: left, y: MARK_Y + 9, anchor: 'start', cls: 'chart-note', body: note });
  }

  return html`${mark({
      tip: `${rangeLabel}: ${format(floor)} – ${format(cap)}`, value: [floor, cap],
      hit: { x: x(floor), y: AXIS_Y - BAND, width: x(cap) - x(floor), height: 2 * BAND },
      body: html`<rect class="chart-band" x="${x(floor)}" y="${AXIS_Y - BAND / 2}" width="${r2(x(cap) - x(floor))}" height="${BAND}"/>${[floor, cap].map((v) => html`<line class="chart-band__end" x1="${x(v)}" x2="${x(v)}" y1="${AXIS_Y - BAND / 2 - 2}" y2="${AXIS_Y + BAND / 2 + 2}"/>`)}`,
    })}
<g transform="translate(0 ${AXIS_Y})">${axis({ scale, orient: 'top', ticks: 5 })}</g>
${mark({
    tip: `${medianLabel}: ${format(median)}`, value: median, hit: { x: x(median) - 6, y: AXIS_Y - BAND, width: 12, height: 2 * BAND },
    body: html`<line class="chart-median" x1="${x(median)}" x2="${x(median)}" y1="${AXIS_Y - MEDIAN / 2}" y2="${AXIS_Y + MEDIAN / 2}"/>`,
  })}
${hospital}`;
}

export function dotRange({ width = WIDTH, format = plain, showLabel = true, ...args }) {
  return frame({ kind: 'dot-range', width, height: showLabel && args.value !== null ? LABELLED : HEIGHT, body: body({ ...args, showLabel, width, format }) });
}

// rows: [{ title, value, floor, cap, median, label, note, format }], drawn top to bottom in the order given.
export function dotRanges({ rows, medianLabel, rangeLabel, width = WIDTH }) {
  if (!rows?.length) throw new RangeError('dotRanges: no rows');
  const first = rows.findIndex((r) => r.value !== null);
  let y = 0;
  const drawn = rows.map(({ title, format = plain, ...row }, i) => {
    const showLabel = i === first;
    const out = html`<g transform="translate(0 ${y})">${text({ x: 0, y: AXIS_Y + 4, anchor: 'start', cls: 'chart-label', body: title })}
${body({ ...row, showLabel, medianLabel, rangeLabel, width, format, x0: TITLE_W })}</g>
`;
    y += (showLabel ? LABELLED : HEIGHT) + ROW_GAP;
    return out;
  });
  return frame({ kind: 'dot-ranges', width, height: y - ROW_GAP, body: html`${drawn}` });
}
