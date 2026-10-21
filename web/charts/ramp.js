// A score compared with CMS's line, as a static figure: the line midway between the highest score CMS marked No and
// the lowest it marked Yes (band), the side above it shaded (and named, with labels.zone), the axis's labels under
// it, this hospital's score as a ▲ under them with its label, and, if given, a hypothetical score as a hollow ▲ (past the domain, clamped to the
// edge with an arrow; its label on a second row when the two would touch). The geometry is the what-if ramp's
// (web/whatif/marks.js), on a viewBox `width` units wide.
//   domain        [low, high] of scores (e.g. rampDomain from marks.js)
//   labels        { actual, line, hypothetical (only with a hypothetical), lineTip, zone (both optional) }   the
//                 caller's words; lineTip is the line's tooltip (default: the line's label with the band's two scores)
//   format        score -> text (default: the number as given, with a true minus)
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { RAMP_TICK, RAMP_Y as Y, labelAt, lineScore, rampAt, rampEdge, rampHeight, rampLabels, rampPct, rampSide, zoneLabelAt } from '../whatif/marks.js';
import { axis } from './axis.js';
import { WIDTH, frame, mark, plain, r2, text, triangle } from './svg.js';

export function ramp({ domain, actual, hypothetical = null, band: [highestNo, lowestYes], width = WIDTH, labels, format = plain }) {
  if (!(highestNo < lowestYes)) throw new RangeError('ramp: band must be [highestNo, lowestYes] with highestNo < lowestYes');
  const xAt = (t) => (rampPct(t) * width) / 100;
  const at = (score) => rampAt(score, domain);
  const scale = scaleLinear().domain(domain).range([xAt(0), xAt(1)]);
  const line = at(lineScore({ highestNo, lowestYes }));
  const start = at(actual);
  const hasHyp = hypothetical !== null;
  const hyp = hasHyp ? at(hypothetical) : null;
  const placed = hasHyp ? rampLabels(start, hyp, labels.actual, labels.hypothetical) : { start: labelAt(start), stacked: false };
  const edge = hasHyp ? rampEdge(rampSide(hypothetical, domain)) : null;
  const label = (p, y, body) => text({ x: xAt(p.t), y, anchor: p.anchor, dx: p.dx, cls: 'chart-label', body });
  const triMark = (t, value, tip, cls) => mark({
    tip, value, hit: { x: xAt(t) - 9, y: Y.mark - 4, width: 18, height: 18 }, body: triangle(xAt(t), Y.mark, cls),
  });
  const zone = labels.zone ? zoneLabelAt(line) : null;

  return frame({
    kind: 'ramp', width, height: rampHeight(placed.stacked), body: html`<rect class="chart-zone" x="${r2(xAt(line))}" y="${Y.zoneTop}" width="${r2(xAt(1) - xAt(line))}" height="${Y.axis - Y.zoneTop}"/>
${zone ? html`${text({ x: xAt(zone.t), y: Y.zoneLabel, anchor: zone.anchor, dx: zone.dx, cls: 'chart-zone-label', body: labels.zone })}
` : ''}<g transform="translate(0 ${Y.axis})">${axis({ scale, orient: 'bottom', ticks: 5, labelY: Y.tickLabel - Y.axis })}</g>
${mark({
    tip: labels.lineTip ?? `${labels.line} (${format(highestNo)}, ${format(lowestYes)})`, value: [highestNo, lowestYes],
    hit: { x: xAt(line) - 6, y: 4, width: 12, height: 44 },
    body: html`<line class="chart-line" x1="${r2(xAt(line))}" x2="${r2(xAt(line))}" y1="${Y.zoneTop - 2}" y2="${Y.axis + RAMP_TICK}"/>`,
  })}
${label(labelAt(line), Y.lineLabel, labels.line)}
${hasHyp ? html`${triMark(hyp, hypothetical, `${labels.hypothetical}: ${format(hypothetical)}`, 'chart-hyp')}
` : ''}${triMark(start, actual, `${labels.actual}: ${format(actual)}`, 'chart-this')}
${hasHyp && edge.text ? html`${text({ x: xAt(edge.t), y: Y.edge, anchor: edge.anchor, dx: edge.dx, cls: 'chart-label', body: edge.text })}
` : ''}${label(placed.start, Y.label, labels.actual)}${hasHyp ? html`
${label(placed.hyp, placed.stacked ? Y.label2 : Y.label, labels.hypothetical)}` : ''}`,
  });
}
