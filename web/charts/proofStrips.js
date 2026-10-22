// The proof strips: how far a recomputation lands from the published values, one strip per row (a year). Each strip
// is a ruler from -limit to +limit, the build's failure line, with the zone past it hatched in the penalty ink at both
// ends; the differences stand on the ruler as a silhouette of counts in bins of `step`, so thousands of agreements
// read as one thin spike at zero. A row's label sits over its strip on the left, its note on the right.
//   rows    [{ label, note, diffs }]: diffs are the row's differences (recomputed minus published)
//   limit   the failure line (a difference at or past it fails the build)
//   step    the bin width; labels: { fail, zero }; format(v): an axis tick's text
import { html } from '../render/html.js';
import { frame, r2, text } from './svg.js';

const ROW = 46;
const SPIKE = 26;
const TOP = 22;
const AXIS = 24;
// The hatched zones past the failure line, as a share of the ruler's half-width.
const PAST = 0.16;

// Counts of diffs in bins of `step` centered on zero (bin k covers [(k - 0.5) step, (k + 0.5) step)), from -half to
// +half bins; a diff past the ends is counted in the end bin.
export function proofBins(diffs, { limit, step }) {
  const half = Math.round(limit / step);
  const counts = new Array(2 * half + 1).fill(0);
  for (const d of diffs) counts[Math.max(0, Math.min(2 * half, Math.round(d / step) + half))]++;
  return { half, counts };
}

export function proofStrips({ rows, limit, step, labels, width, format }) {
  if (!rows.length || !(limit > 0) || !(step > 0) || step > limit) throw new RangeError('proofStrips: rows, and 0 < step <= limit');
  const x0 = 0;
  const x1 = width;
  const span = (x1 - x0) / (2 * (1 + PAST));
  const mid = (x0 + x1) / 2;
  const x = (v) => mid + (v / limit) * span;
  const bins = rows.map((r) => proofBins(r.diffs, { limit, step }));
  const binW = (span * step) / limit;
  const height = TOP + rows.length * ROW + AXIS;
  const body = rows.map((r, i) => {
    const base = TOP + i * ROW + ROW - 6;
    const { half, counts } = bins[i];
    // Each strip to its own tallest bin, so every year's spike shows whatever its spread.
    const peak = Math.max(1, ...counts);
    // The silhouette: a stepped outline across the bins with any count, closed along the ruler.
    let d = '';
    counts.forEach((c, k) => {
      if (!c) return;
      const left = x((k - half) * step) - binW / 2;
      const h = Math.max(1.5, (c / peak) * SPIKE);
      d += `M${r2(left)} ${r2(base)}V${r2(base - h)}h${r2(binW)}V${r2(base)}Z`;
    });
    return html`<g class="chart-proof__row">
<line class="chart-proof__ruler" x1="${r2(x(-limit))}" x2="${r2(x(limit))}" y1="${r2(base + 0.5)}" y2="${r2(base + 0.5)}"/>
<rect class="chart-proof__fail" x="${r2(x0)}" y="${r2(base - SPIKE)}" width="${r2(x(-limit) - x0)}" height="${SPIKE + 4}"/>
<rect class="chart-proof__fail" x="${r2(x(limit))}" y="${r2(base - SPIKE)}" width="${r2(x1 - x(limit))}" height="${SPIKE + 4}"/>
<path class="chart-proof__spike" d="${d}"/>
${text({ x: x0, y: base - SPIKE - 4, anchor: 'start', cls: 'chart-proof__label chart-label--halo', body: r.label })}
${text({ x: x1, y: base - SPIKE - 4, anchor: 'end', cls: 'chart-cap chart-label--halo', body: r.note })}
</g>`;
  });
  const axisY = TOP + rows.length * ROW;
  const ticks = [-limit, -limit / 2, 0, limit / 2, limit];
  return frame({
    kind: 'proof', width, height, body: html`<line class="chart-proof__zero" x1="${r2(mid)}" x2="${r2(mid)}" y1="${TOP - 4}" y2="${r2(axisY + 4)}"/>
${body}
${ticks.map((v) => text({ x: x(v), y: axisY + 16, cls: 'chart-tick', body: format(v) }))}
${text({ x: x0, y: 10, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: `← ${labels.fail}` })}
${text({ x: x1, y: 10, anchor: 'end', cls: 'chart-cap chart-cap--pen', body: `${labels.fail} →` })}`,
  });
}
