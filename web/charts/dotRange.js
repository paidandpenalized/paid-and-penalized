// One value against a national range: the floor-to-cap range as a gray band with hairline ends, the median as a tick, and
// this hospital's value as a ▲ under the axis with its label (no ▲ when value is null). Words are the caller's.
// dotRanges stacks several as small multiples in one SVG, each row under its title and on its own scale (units differ).
//   label, medianLabel, rangeLabel   the ▲'s label and the median's and range's tooltip names
//   format                           value -> text (default: the number as given, with a true minus)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, frame, mark, plain, r2, text, triangle } from './svg.js';

const HEIGHT = 76;
const MARGIN = 18;
const AXIS_Y = 30;
const BAND = 10;
const MARK_Y = 40;
// Room past the plotted values, as a share of their span.
const ROOM = 0.04;

// A row title's height, above each small multiple.
const TITLE_H = 18;

function body({ value, floor, cap, median, label, medianLabel, rangeLabel, width, format }) {
  if (!(floor <= median && median <= cap)) throw new RangeError('dotRange: need floor <= median <= cap');
  const plotted = [floor, cap, median, ...(value === null ? [] : [value])];
  const [lo, hi] = [Math.min(...plotted), Math.max(...plotted)];
  const room = (hi - lo) * ROOM || 1;
  const scale = scaleLinear().domain([lo - room, hi + room]).range([MARGIN, width - MARGIN]);
  const x = (v) => r2(scale(v));
  const tAt = (v) => (scale(v) - MARGIN) / (width - 2 * MARGIN);

  let hospital = '';
  if (value !== null) {
    const { anchor, dx } = labelAt(tAt(value));
    hospital = html`${mark({
      tip: `${label}: ${format(value)}`, value, hit: { x: x(value) - 9, y: MARK_Y - 2, width: 18, height: 16 },
      body: triangle(x(value), MARK_Y, 'chart-this'),
    })}
${text({ x: x(value), y: 68, anchor, dx, cls: 'chart-label', body: label })}`;
  }

  return html`${mark({
      tip: `${rangeLabel}: ${format(floor)} – ${format(cap)}`, value: [floor, cap],
      hit: { x: x(floor), y: AXIS_Y - BAND, width: x(cap) - x(floor), height: 2 * BAND },
      body: html`<rect class="chart-band" x="${x(floor)}" y="${AXIS_Y - BAND / 2}" width="${r2(x(cap) - x(floor))}" height="${BAND}"/>${[floor, cap].map((v) => html`<line class="chart-band__end" x1="${x(v)}" x2="${x(v)}" y1="${AXIS_Y - BAND / 2 - 2}" y2="${AXIS_Y + BAND / 2 + 2}"/>`)}`,
    })}
<g transform="translate(0 ${AXIS_Y})">${axis({ scale, orient: 'top', ticks: 5 })}</g>
${mark({
    tip: `${medianLabel}: ${format(median)}`, value: median, hit: { x: x(median) - 6, y: AXIS_Y - BAND, width: 12, height: 2 * BAND },
    body: html`<line class="chart-median" x1="${x(median)}" x2="${x(median)}" y1="${AXIS_Y - BAND / 2 - 1}" y2="${AXIS_Y + BAND / 2 + 3}"/>`,
  })}
${hospital}`;
}

export function dotRange({ width = WIDTH, format = plain, ...args }) {
  return frame({ kind: 'dot-range', width, height: HEIGHT, body: body({ ...args, width, format }) });
}

// rows: [{ title, value, floor, cap, median, label, format }], drawn top to bottom in the order given.
export function dotRanges({ rows, medianLabel, rangeLabel, width = WIDTH }) {
  if (!rows?.length) throw new RangeError('dotRanges: no rows');
  const pitch = TITLE_H + HEIGHT;
  return frame({
    kind: 'dot-ranges', width, height: rows.length * pitch, body: rows.map(({ title, format = plain, ...row }, i) => html`<g transform="translate(0 ${i * pitch})">${text({ x: 0, y: 13, anchor: 'start', cls: 'chart-label', body: title })}
<g transform="translate(0 ${TITLE_H})">${body({ ...row, medianLabel, rangeLabel, width, format })}</g></g>
`),
  });
}
