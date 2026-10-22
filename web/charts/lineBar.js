// One score on the whole span of scores, for a page's first screen: a track from the lowest score to the highest
// (both printed inside its ends), the side at and above CMS's line shaded, the line itself in the penalty ink, the
// middle score as an ink tick crossing the track, and this hospital's score as a ▲ under it with its label. The
// middle's label sits left of its tick and the line's right of the line, so the two never meet (the middle is below
// the line whenever the line is above the median, as a 75th-percentile line is); a middle at or past the line takes
// its label below the track instead.
//   domain   [lowest, highest] score; actual: this score; band: [highestNo, lowestYes]; middle: the middle score
//   labels   { actual, line, lineValue, middle, middleValue, low, high, zone }  the caller's words, values formatted
import { html } from '../render/html.js';
import { labelAt } from '../whatif/marks.js';
import { WIDTH, frame, mark, r2, text, triangle } from './svg.js';

const PAD = 4;
const Y = { name: 11, value: 25, top: 34, bottom: 62, mark: 66, label: 94 };
const TICK_OUT = 5;
const HEIGHT = 100;
// The lowest and highest scores, printed inside the track's ends, are left out where the hospital's needle would
// cross them (within this share of the track from that end).
const END_ROOM = 0.24;

export function lineBar({ domain: [lo, hi], actual, band: [highestNo, lowestYes], middle, labels, width = WIDTH }) {
  if (!(lo < hi) || !(highestNo < lowestYes)) throw new RangeError('lineBar: need lowest < highest and highestNo < lowestYes');
  const x = (v) => PAD + ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (width - 2 * PAD);
  const xl = x((highestNo + lowestYes) / 2);
  const xm = x(middle);
  const xa = x(actual);
  const ta = (xa - PAD) / (width - 2 * PAD);
  const place = labelAt(ta);
  const middleLeft = middle < highestNo;
  const two = (px, anchor, name, value, cls = '') => html`${text({ x: px, y: Y.name, anchor, cls: `chart-cap${cls}`, body: name })}${text({ x: px, y: Y.value, anchor, cls: 'chart-value chart-value--mark', body: value })}`;
  return frame({
    kind: 'line-bar', width, height: HEIGHT + (middleLeft ? 0 : 26), body: html`<rect class="chart-track" x="${PAD}" y="${Y.top}" width="${r2(width - 2 * PAD)}" height="${Y.bottom - Y.top}"/>
<rect class="chart-zone" x="${r2(xl)}" y="${Y.top}" width="${r2(width - PAD - xl)}" height="${Y.bottom - Y.top}"/>
${ta > END_ROOM ? text({ x: PAD + 6, y: Y.bottom - 10, anchor: 'start', cls: 'chart-end', body: labels.low }) : ''}
${ta < 1 - END_ROOM ? text({ x: width - PAD - 6, y: Y.bottom - 10, anchor: 'end', cls: 'chart-end', body: labels.high }) : ''}
${labels.zone ? text({ x: width - PAD, y: Y.name, anchor: 'end', cls: 'chart-cap chart-cap--pen', body: labels.zone }) : ''}
${mark({
    tip: `${labels.middle}: ${labels.middleValue}`, value: middle, hit: { x: xm - 6, y: Y.top - TICK_OUT, width: 12, height: Y.bottom - Y.top + 2 * TICK_OUT },
    body: html`<line class="chart-median" x1="${r2(xm)}" x2="${r2(xm)}" y1="${Y.top - TICK_OUT}" y2="${Y.bottom + TICK_OUT}"/>`,
  })}
${middleLeft ? two(xm - 5, 'end', labels.middle, labels.middleValue) : html`${text({ x: xm, y: HEIGHT + 10, anchor: 'middle', cls: 'chart-cap', body: labels.middle })}${text({ x: xm, y: HEIGHT + 24, anchor: 'middle', cls: 'chart-value chart-value--mark', body: labels.middleValue })}`}
${mark({
    tip: `${labels.line}: ${labels.lineValue}`, value: [highestNo, lowestYes], hit: { x: xl - 6, y: 0, width: 12, height: Y.bottom + TICK_OUT },
    body: html`<line class="chart-line" x1="${r2(xl)}" x2="${r2(xl)}" y1="2" y2="${Y.bottom + TICK_OUT}"/>`,
  })}
${two(xl + 5, 'start', labels.line, labels.lineValue, ' chart-cap--pen')}
${mark({
    tip: `${labels.actual}: ${labels.actualValue}`, value: actual, hit: { x: xa - 9, y: Y.mark - 2, width: 18, height: 16 },
    body: html`<line class="chart-needle" x1="${r2(xa)}" x2="${r2(xa)}" y1="${Y.top}" y2="${Y.bottom}"/>${triangle(xa, Y.mark, 'chart-this')}`,
  })}
${text({ x: xa, y: Y.label, anchor: place.anchor, dx: place.dx, cls: 'chart-label', body: html`${labels.actual} <tspan class="chart-value">${labels.actualValue}</tspan>` })}`,
  });
}
