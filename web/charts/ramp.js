// A score compared with CMS's line, as a static figure: the line midway between the highest score CMS marked No and
// the lowest it marked Yes (band), the side above it shaded, this hospital's score as a ▲ under the axis with its
// label, and, if given, a hypothetical score as a hollow ▲ (past the domain, clamped to the edge with an arrow). The
// geometry is the what-if ramp's (web/whatif/marks.js), on a viewBox `width` units wide.
//   domain        [low, high] of scores (e.g. rampDomain from marks.js)
//   labels        { actual, line, hypothetical (only with a hypothetical) }   the caller's words
//   format        score -> text (default: the number as given, with a true minus)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { labelAt, lineScore, rampAt, rampEdge, rampLabels, rampPct, rampSide } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, frame, mark, plain, r2, text, triangle } from './svg.js';

const HEIGHT = 84;
const AXIS_Y = 40;
const MARK_Y = 44;

export function ramp({ domain, actual, hypothetical = null, band: [highestNo, lowestYes], width = WIDTH, labels, format = plain }) {
  if (!(highestNo < lowestYes)) throw new RangeError('ramp: band must be [highestNo, lowestYes] with highestNo < lowestYes');
  const xAt = (t) => (rampPct(t) * width) / 100;
  const at = (score) => rampAt(score, domain);
  const scale = scaleLinear().domain(domain).range([xAt(0), xAt(1)]);
  const line = at(lineScore({ highestNo, lowestYes }));
  const start = at(actual);
  const hasHyp = hypothetical !== null;
  const hyp = hasHyp ? at(hypothetical) : null;
  const placed = hasHyp ? rampLabels(start, hyp, labels.actual, labels.hypothetical) : { start: labelAt(start) };
  const edge = hasHyp ? rampEdge(rampSide(hypothetical, domain)) : null;
  const label = (p, y, body) => text({ x: xAt(p.t), y, anchor: p.anchor, dx: p.dx, cls: 'chart-label', body });
  const triMark = (t, value, tip, cls) => mark({
    tip, value, hit: { x: xAt(t) - 9, y: AXIS_Y, width: 18, height: 18 }, body: triangle(xAt(t), MARK_Y, cls),
  });

  return frame({
    kind: 'ramp', width, height: HEIGHT, body: html`<rect class="chart-zone" x="${r2(xAt(line))}" y="18" width="${r2(xAt(1) - xAt(line))}" height="22"/>
<g transform="translate(0 ${AXIS_Y})">${axis({ scale, orient: 'top', ticks: 5 })}</g>
${mark({
    tip: `${labels.line} (${format(highestNo)}, ${format(lowestYes)})`, value: [highestNo, lowestYes],
    hit: { x: xAt(line) - 6, y: 8, width: 12, height: 40 },
    body: html`<line class="chart-line" x1="${r2(xAt(line))}" x2="${r2(xAt(line))}" y1="16" y2="${MARK_Y}"/>`,
  })}
${label(labelAt(line), 12, labels.line)}
${hasHyp ? html`${triMark(hyp, hypothetical, `${labels.hypothetical}: ${format(hypothetical)}`, 'chart-hyp')}
` : ''}${triMark(start, actual, `${labels.actual}: ${format(actual)}`, 'chart-this')}
${hasHyp && edge.text ? html`${text({ x: xAt(edge.t), y: 54, anchor: edge.anchor, dx: edge.dx, cls: 'chart-label', body: edge.text })}
` : ''}${label(placed.start, 70, labels.actual)}${hasHyp ? html`
${label(placed.hyp, 70, labels.hypothetical)}` : ''}`,
  });
}
