// The back-test drawn: one strip per group of hospitals, each hospital a dot at its estimate over what its cost report
// recorded, on a log scale (1 is exact; twice and half as much sit the same distance either side). Behind each strip's
// dots, the group's likely range (the middle 80% of the back-test's misses) as a band, hatched where the group had too
// few hospitals and takes a wider group's; the group's median a tick. Each strip's label and note sit over it. One dashed line down every strip at the overall
// median, one dotted at exact. Dots are packed up and down from the strip's middle so none overlap; each names its
// hospital only in its tooltip.
//   rows     [{ label, note, short: { label, note } (the phone's shorter words), band: [lo, hi] ratios, borrowed,
//            median (a ratio, or null with no hospitals), dots: [{ x (a ratio > 0), tip }] }]
//   domain   [lo, hi] ratios, > 0; ticks: the ratios the axis marks (narrowTicks: the phone's); format(v): a tick's text
//   overall  the overall median ratio; labels: { exact, overall, axis }
import { scaleLog } from 'd3-scale';
import { html } from '../render/html.js';
import { dodge } from './acrossLine.js';
import { axis } from './axis.js';
import { frame, hatchDefs, hatchFill, isNarrow, mark, r2, text } from './svg.js';

const PAD = 8;
const TOP = 34;
const LABEL = 30; // a row's label and its note, two lines over its strip
const MIN_HALF = 9; // half a strip's height at the least
const GAP = 14;
const AXIS = 30;

export function bandStrips({ rows, domain, ticks, narrowTicks = ticks, format, overall, labels, width }) {
  if (!rows.length || !(domain[0] > 0) || !(domain[1] > domain[0])) throw new RangeError('bandStrips: rows, and 0 < domain[0] < domain[1]');
  const narrow = isNarrow(width);
  const r = narrow ? 2.6 : 3.4;
  const marks = narrow ? narrowTicks : ticks;
  const x = scaleLog().domain(domain).range([PAD, width - PAD]).clamp(true);
  // Each row's dots dodged about its middle; the row is as tall as its stack.
  const laid = rows.map((row) => {
    const dots = row.dots.map((d) => ({ ...d, cx: x(d.x), r }));
    const ys = dodge(dots);
    const half = Math.max(MIN_HALF, ...dots.map((d, i) => Math.abs(ys[i]) + r + 1));
    return { row, dots, ys, half };
  });
  let y = TOP;
  const placed = laid.map((l) => {
    const mid = y + LABEL + l.half;
    const out = { ...l, top: y, mid };
    y = mid + l.half + GAP;
    return out;
  });
  const axisY = y - GAP + 6;
  const height = axisY + AXIS;
  const id = `bt-${Math.round(width)}`; // one hatch per drawing: the page holds the phone's and the wide one
  const strip = ({ row, dots, ys, half, top, mid }) => {
    const [lo, hi] = row.band.map(x);
    const band = html`<rect class="chart-bt__band${row.borrowed ? ' chart-bt__band--borrowed' : ''}" x="${r2(lo)}" y="${r2(mid - half)}" width="${r2(hi - lo)}" height="${r2(2 * half)}"${row.borrowed ? html` fill="${hatchFill(id)}"` : ''}/>`;
    const median = row.median === null ? '' : html`<line class="chart-median" x1="${r2(x(row.median))}" x2="${r2(x(row.median))}" y1="${r2(mid - half - 3)}" y2="${r2(mid + half + 3)}"/>`;
    return html`<g class="chart-bt__row">
${text({ x: PAD, y: top + 11, anchor: 'start', cls: 'chart-proof__label chart-label--halo', body: narrow ? row.short.label : row.label })}
${text({ x: PAD, y: top + 24, anchor: 'start', cls: 'chart-cap chart-label--halo', body: narrow ? row.short.note : row.note })}
<line class="chart-bt__ruler" x1="${PAD}" x2="${r2(width - PAD)}" y1="${r2(mid)}" y2="${r2(mid)}"/>
${band}
${dots.map((d, i) => {
    const dot = html`<circle class="chart-bt__dot" cx="${r2(d.cx)}" cy="${r2(mid + ys[i])}" r="${r2(d.r)}"/>`;
    return d.tip && !narrow ? mark({ tip: d.tip, hit: null, body: dot }) : dot;
  })}
${median}
</g>`;
  };
  const xe = x(1);
  const xo = x(overall);
  return frame({
    kind: 'bt', width, height, body: html`${hatchDefs(id)}
<line class="chart-bt__exact" x1="${r2(xe)}" x2="${r2(xe)}" y1="${TOP - 6}" y2="${r2(axisY)}"/>
<line class="chart-ref" x1="${r2(xo)}" x2="${r2(xo)}" y1="${TOP - 6}" y2="${r2(axisY)}"/>
${text({ x: xe, y: TOP - 22, anchor: xo < xe ? 'start' : 'end', dx: xo < xe ? 3 : -3, cls: 'chart-cap', body: labels.exact })}
${text({ x: xo, y: TOP - 10, anchor: xo < xe ? 'end' : 'start', dx: xo < xe ? -3 : 3, cls: 'chart-cap', body: labels.overall })}
${placed.map(strip)}
<g transform="translate(0 ${r2(axisY)})">${axis({ scale: x, ticks: marks, format })}</g>
${text({ x: width - PAD, y: height - 2, anchor: 'end', cls: 'chart-cap', body: labels.axis })}`,
  });
}
