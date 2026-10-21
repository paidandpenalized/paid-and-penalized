// A chart axis: a 1px hairline, short ticks and IBM Plex Mono tick labels (web/styles/charts.css). Drawn at the
// origin along the scale's range; the caller places it with a transform.
//   orient  'bottom' (labels under the line), 'top' (labels above it, leaving room for a ▲ under the line) or 'left'
//   ticks   a count, or the tick values
//   format  value -> text; by default the scale's own tick format (d3-format, which writes a true minus)
//   grid    for 'left', the length of a hairline gridline at each tick (0: none)
//   labelY  for 'top' or 'bottom', the labels' baseline off the line (default: just past the ticks)
import { html } from '../render/html.js';
import { r2 } from './svg.js';

const TICK = 4;

export function axis({ scale, orient = 'bottom', ticks = 5, format, grid = 0, labelY = null }) {
  if (!['bottom', 'top', 'left'].includes(orient)) throw new RangeError(`axis: orient must be bottom, top or left, got "${orient}"`);
  const values = Array.isArray(ticks) ? ticks : scale.ticks(ticks);
  const fmt = format ?? scale.tickFormat(Array.isArray(ticks) ? values.length : ticks);
  const [a, b] = scale.range().map(r2);

  if (orient === 'left') {
    return html`<g class="chart-axis"><line class="chart-axis__line" x1="0" x2="0" y1="${a}" y2="${b}"/>${values.map((v) => {
      const y = r2(scale(v));
      return html`${grid > 0 ? html`<line class="chart-grid" x1="0" x2="${r2(grid)}" y1="${y}" y2="${y}"/>` : ''}<line class="chart-axis__tick" x1="${-TICK}" x2="0" y1="${y}" y2="${y}"/><text class="chart-axis__label" x="${-TICK - 3}" y="${y}" dy="0.32em" text-anchor="end">${fmt(v)}</text>`;
    })}</g>`;
  }
  const dir = orient === 'top' ? -1 : 1;
  const baseline = labelY ?? (orient === 'top' ? -TICK - 4 : TICK + 12);
  return html`<g class="chart-axis"><line class="chart-axis__line" x1="${a}" x2="${b}" y1="0" y2="0"/>${values.map((v) => {
    const x = r2(scale(v));
    return html`<line class="chart-axis__tick" x1="${x}" x2="${x}" y1="0" y2="${dir * TICK}"/><text class="chart-axis__label" x="${x}" y="${baseline}" text-anchor="middle">${fmt(v)}</text>`;
  })}</g>`;
}
