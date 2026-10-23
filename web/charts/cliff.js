// The money as a cliff, for one hospital: what a program's flat cut would be at any score. Flat at $0 up to CMS's
// line, a drop at the line to the whole cut, then flat again out to the highest score, so a score a hair over the line
// costs what the highest score costs. This hospital rides it as a dot; the highest score sits on the floor as a ring;
// under the axis, every published score as a faint strip, so the crowd at the edge shows.
//   domain   [lowest, highest] score; band: [highestNo, lowestYes]; actual: this hospital's score
//   strip    optional: { edges, counts } every score, binned (edges: counts.length + 1 ascending scores), drawn as two
//            paths in the distribution's inks (below the line, and at or past it)
//   labels   { zero, zeroWords, cut, cutWords, line, actual, actualValue, highest, highestValue }: the caller's words,
//            values formatted (zero and cut: the two levels' dollars, drawn large; the words beside them)
//   cut      the dollars the cut level plots (negative), for the figure's table; the ledge plots 0
// A drawing wider than a phone's is taller, with larger dollars, so the drop reads as a drop.
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { lineScore } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, capsWidth, frame, isNarrow, mark, r2, text } from './svg.js';

const PAD = 10;
const DOT = 6;
const LAYOUTS = {
  narrow: { lineLabel: 11, levelLabel: 30, ledge: 42, cutLabel: 66, floor: 130, axis: 144, strip: 166, stripH: 18, height: 192, amount: 18 },
  wide: { lineLabel: 13, levelLabel: 38, ledge: 52, cutLabel: 92, floor: 200, axis: 216, strip: 244, stripH: 34, height: 286, amount: 30 },
};
// A dollar amount's width in viewBox units (the mono at its size, about 0.62 em a character); the words' widths are
// capsWidth's (12-unit body text runs about 6.4 units a character).
const amountWidth = (s, size) => String(s).length * 0.62 * size;
// A level's dollars, large.
const amountSpan = (amount, size, pen) => html`<tspan class="chart-cliff__amount${pen ? ' chart-cliff__amount--pen' : ''}" style="font-size: ${size}px">${amount}</tspan>`;

// The strip's columns, each a box up from the strip's base, as two paths: the bins short of the line and those at or
// past it. Remembered per strip and drawing (every hospital page draws the same strip at the same two widths).
const STRIPS = new WeakMap();
function stripPaths(strip, { x, lowestYes, Y }) {
  const key = `${x.range()[1]}:${x.domain()}:${lowestYes}`;
  if (!STRIPS.has(strip)) STRIPS.set(strip, new Map());
  const made = STRIPS.get(strip);
  if (!made.has(key)) {
    const most = Math.max(...strip.counts, 1);
    const base = Y.strip + Y.stripH;
    const paths = { below: '', above: '' };
    strip.counts.forEach((c, i) => {
      if (!c) return;
      const left = x(strip.edges[i]);
      paths[strip.edges[i] >= lowestYes ? 'above' : 'below'] += `M${r2(left)} ${base}v${r2(-Math.max(1, (c / most) * Y.stripH))}h${r2(Math.max(0.6, x(strip.edges[i + 1]) - left - 0.6))}V${base}z`;
    });
    made.set(key, paths);
  }
  return made.get(key);
}

export function cliff({ domain: [lo, hi], band: [highestNo, lowestYes], actual, strip = null, labels, cut, width = WIDTH }) {
  if (!(lo < hi) || !(highestNo < lowestYes)) throw new RangeError('cliff: need lowest < highest and highestNo < lowestYes');
  if (!(cut < 0)) throw new RangeError('cliff: cut is a negative amount');
  const Y = isNarrow(width) ? LAYOUTS.narrow : LAYOUTS.wide;
  const x = scaleLinear().domain([lo, hi]).range([PAD, width - PAD]).clamp(true);
  const xl = x(lineScore({ highestNo, lowestYes }));
  const x0 = x(lo);
  const x1 = x(hi);
  const over = actual >= lowestYes;
  const xa = x(actual);
  const ya = over ? Y.floor : Y.ledge;
  // A level's label: its dollars large, its words after them.
  const level = (amount, words, pen) => html`${amountSpan(amount, Y.amount, pen)}<tspan dx="6">${words}</tspan>`;
  // This hospital's label beside its dot, on the side with room: over the line, above the floor right of the dot;
  // under it, below the ledge, ending left of the dot when there is room there.
  const actualText = html`${labels.actual} <tspan class="chart-value">${labels.actualValue}</tspan>`;
  const actualW = capsWidth(`${labels.actual} ${labels.actualValue}`);
  const actualAt = over
    ? (xa + 12 + actualW <= width ? { x: xa + 12, y: Y.floor - 12, anchor: 'start' } : { x: xa - 12, y: Y.floor - 12, anchor: 'end' })
    : (xa - 12 - actualW >= 0 ? { x: xa - 12, y: Y.ledge + 22, anchor: 'end' } : { x: xa + 12, y: Y.ledge + 22, anchor: 'start' });
  // The highest score's label just above its ring, ending at it; left off (the ring stays, and the table and the
  // takeaway name it) where this hospital's label would run into it, as on a phone with the hospital near the line.
  const highText = `${labels.highest} ${labels.highestValue}`;
  const showHigh = !(over && Math.abs(xa - x1) < 2 * DOT);
  const clash = over && actualAt.x + (actualAt.anchor === 'start' ? actualW : 0) + 8 > x1 - capsWidth(highText);
  const showHighLabel = showHigh && !clash;
  // The cut level's label inside the pit, just right of the drop: on one line where it fits, else its words on a second
  // line, ending at the right edge if they don't fit from the drop.
  const cutW = amountWidth(labels.cut, Y.amount) + 6 + capsWidth(labels.cutWords);
  const oneLine = xl + 10 + cutW <= width;
  const wordsAt = xl + 10 + capsWidth(labels.cutWords) <= width ? { x: xl + 10, anchor: 'start' } : { x: width - 2, anchor: 'end' };
  const cutLabel = oneLine
    ? text({ x: xl + 10, y: Y.cutLabel, anchor: 'start', cls: 'chart-label chart-label--pen', body: level(labels.cut, labels.cutWords, true) })
    : html`${text({ x: xl + 10, y: Y.cutLabel, anchor: 'start', cls: 'chart-label chart-label--pen', body: amountSpan(labels.cut, Y.amount, true) })}
${text({ x: wordsAt.x, y: Y.cutLabel + 16, anchor: wordsAt.anchor, cls: 'chart-label chart-label--pen', body: labels.cutWords })}`;
  const bars = strip && stripPaths(strip, { x, lowestYes, Y });
  return frame({
    kind: 'cliff', width, height: Y.height, body: html`<rect class="chart-zone" x="${r2(xl)}" y="${Y.ledge}" width="${r2(x1 - xl)}" height="${Y.floor - Y.ledge}"/>
${text({ x: xl, y: Y.lineLabel, anchor: xl > width - 70 ? 'end' : 'middle', cls: 'chart-cap chart-cap--pen', body: labels.line })}
${mark({
    tip: `${labels.zero} ${labels.zeroWords}`, value: 0, hit: { x: x0, y: Y.ledge - 6, width: xl - x0, height: 12 },
    body: html`<line class="chart-cliff__ledge" x1="${r2(x0)}" x2="${r2(xl)}" y1="${Y.ledge}" y2="${Y.ledge}"/>`,
  })}
<line class="chart-cliff__drop" x1="${r2(xl)}" x2="${r2(xl)}" y1="${Y.ledge}" y2="${Y.floor}"/>
${mark({
    tip: `${labels.cut} ${labels.cutWords}`, value: cut, hit: { x: xl, y: Y.floor - 6, width: x1 - xl, height: 12 },
    body: html`<line class="chart-cliff__floor" x1="${r2(xl)}" x2="${r2(x1)}" y1="${Y.floor}" y2="${Y.floor}"/>`,
  })}
${text({ x: x0, y: Y.levelLabel, anchor: 'start', cls: 'chart-label', body: level(labels.zero, labels.zeroWords, false) })}
${cutLabel}
<g transform="translate(0 ${Y.axis})">${axis({ scale: x, ticks: isNarrow(width) ? 4 : 9 })}</g>
${bars ? html`${bars.below && html`<path class="chart-dist" aria-hidden="true" d="${bars.below}"/>`}${bars.above && html`<path class="chart-col--pen" aria-hidden="true" d="${bars.above}"/>`}` : ''}
${showHigh ? mark({
    tip: `${labels.highest}: ${labels.highestValue}`, value: hi, hit: { x: x1 - 8, y: Y.floor - 8, width: 16, height: 16 },
    body: html`<circle class="chart-cliff__ring" cx="${r2(x1)}" cy="${Y.floor}" r="${DOT - 1}"/>`,
  }) : ''}
${showHighLabel ? text({ x: x1, y: Y.floor - 12, anchor: 'end', cls: 'chart-note', body: highText }) : ''}
${mark({
    tip: `${labels.actual}: ${labels.actualValue}`, value: actual, hit: { x: xa - 9, y: ya - 9, width: 18, height: 18 },
    body: html`<circle class="chart-cliff__dot${over ? ' chart-cliff__dot--over' : ''}" cx="${r2(xa)}" cy="${ya}" r="${DOT}"/>`,
  })}
${text({ x: actualAt.x, y: actualAt.y, anchor: actualAt.anchor, cls: 'chart-label chart-label--halo', body: actualText })}`,
  });
}
