// What a hospital's year would come to at any spending level (TEAM's payoff figure): the result, from `span` under
// target to `span` over, as one line, in the gain ink under target and the loss ink over it, flat wherever a limit holds
// it; the stop-gain and stop-loss as dashed lines, named; a shaded band around target. Any hospital's year: the caller
// passes `at`, the result at a spending level s (a share: −0.05 is 5% under target, the same for every category), and the
// limits, so the program page's worked example and the calculator draw with one module. Pure: an SVG string for the build
// and the browser alike; colors come from classes in the site's stylesheet.
//   at       s -> dollars (positive: Medicare pays; negative: the hospital repays); falls as s rises
//   limits   { gain, loss } positive dollars (loss 0: a track with no loss side, which draws no stop-loss)
//   span     the spending range either side of target (0.3: 30%); step: the table's spacing, which must divide span
//   band     the shaded band's half-width (a share), or 0 for none (named on the wide drawing; a phone's leaves the
//            name to the figure's note, where the stop-gain's label would cross it)
//   marker   null, or a spending level (a share) to ring on the line
//   words    { under, over (the axis's two ends), stopGain, stopLoss, band (the lines' and the band's names),
//              x(s) (a tick's label), y(v) (a gridline's label), tip(s, result) (a point's tooltip) }
//   width    the viewBox's width
// Each tabled point (payoffPoints) is a mark carrying its result, so figure() can hold the table to the chart.
import { html } from '../render/html.js';
import { frame, isNarrow, mark, r1, r2, text } from './svg.js';

// The curve is traced at this spacing, then reduced to its corners (it is straight between them), so the markup holds
// a few points per line and each corner sits within a tenth of a percent of spending of where it is.
const TRACE = 0.001;
const EPS = 1e-9;
const tidy = (s) => Math.round(s * 1e6) / 1e6 + 0;

function checked({ limits, span, step, band }) {
  if (!(span > 0) || !Number.isFinite(span)) throw new RangeError('payoff: span must be a positive number');
  const n = (2 * span) / step;
  if (!(step > 0) || Math.abs(n - Math.round(n)) > EPS) throw new RangeError('payoff: step must divide span');
  if (!(limits?.gain >= 0) || !(limits.loss >= 0) || !Number.isFinite(limits.gain) || !Number.isFinite(limits.loss)) throw new RangeError('payoff: limits are dollars of 0 or more');
  if (!(band >= 0) || band > span) throw new RangeError('payoff: band must be from 0 to span');
  return Math.round(n);
}

// The table's points: every step from span under target to span over, each { s, result } with the result rounded to
// the dollar (never −0).
export function payoffPoints({ at, span, step, limits = { gain: 0, loss: 0 }, band = 0 }) {
  const n = checked({ limits, span, step, band });
  return Array.from({ length: n + 1 }, (_, i) => {
    const s = tidy(-span + i * step);
    return { s, result: Math.round(at(s)) + 0 };
  });
}

// The points of the line from s0 to s1, reduced to its ends and corners.
function corners(at, s0, s1) {
  const n = Math.round(Math.abs(s1 - s0) / TRACE);
  const pts = Array.from({ length: n + 1 }, (_, i) => [s0 + ((s1 - s0) * i) / n, 0]).map(([s]) => [s, at(s)]);
  const kept = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [kept[kept.length - 1], pts[i], pts[i + 1]];
    const slope1 = (b[1] - a[1]) / (b[0] - a[0]);
    const slope2 = (c[1] - b[1]) / (c[0] - b[0]);
    if (Math.abs(slope1 - slope2) > Math.max(1, Math.abs(slope1)) * 1e-6) kept.push(b);
  }
  kept.push(pts[pts.length - 1]);
  return kept;
}

export function payoff({ at, limits, span, step, band = 0, marker = null, words, width }) {
  checked({ limits, span, step, band });
  const narrow = isNarrow(width);
  const left = narrow ? 44 : 52;
  const right = 6;
  const top = 18;
  const plotH = narrow ? 150 : 190;
  const bottom = top + plotH;
  const lo = Math.min(at(span), -limits.loss, 0);
  const hi = Math.max(at(-span), limits.gain, 0);
  const pad = (hi - lo) * 0.1 || 1;
  const [d0, d1] = [lo - pad, hi + pad];
  const x = (s) => r2(left + ((s + span) / (2 * span)) * (width - left - right));
  const y = (v) => r2(top + ((d1 - v) / (d1 - d0)) * plotH);
  const path = (pts) => `M${pts.map(([s, v]) => `${x(s)} ${y(v)}`).join('L')}`;
  const tickS = Array.from({ length: Math.round((2 * span) / 0.1) + 1 }, (_, i) => tidy(-span + i * 0.1)).filter((s) => Math.abs(s) <= span + EPS);
  // A phone's drawing labels every other gridline (each fifth of the spending axis), so no two labels touch.
  const labeled = (s) => !narrow || Math.abs(Math.round(s * 10)) % 2 === 0;
  const ticksY = [...new Set([limits.gain, limits.gain / 2, 0, -limits.loss / 2, -limits.loss])];
  const grid = html`${ticksY.map((v) => html`<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}"/>${text({ x: left - 5, y: y(v) + 4, anchor: 'end', cls: 'chart-tick', body: words.y(v) })}`)}
${tickS.map((s) => html`<line class="chart-grid" x1="${x(s)}" x2="${x(s)}" y1="${top}" y2="${bottom}"/>${labeled(s) ? text({ x: x(s), y: bottom + 14, cls: 'chart-tick', body: words.x(s) }) : ''}`)}`;
  const shade = band > 0 ? html`<rect class="chart-payoff__band" x="${x(-band)}" y="${top}" width="${r2(x(band) - x(-band))}" height="${plotH}"/>${narrow ? '' : text({ x: x(0), y: top + 12, cls: 'chart-payoff__band-label', body: words.band })}` : '';
  const limitLine = (v, label, anchor) => html`<line class="chart-payoff__limit" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}"/>${text({ x: anchor === 'end' ? width - right : left + 4, y: v > 0 ? y(v) - 4 : y(v) + 12, anchor, cls: 'chart-tick chart-label--halo', body: label })}`;
  const limitsDrawn = html`${limits.gain > 0 ? limitLine(limits.gain, words.stopGain, 'end') : ''}${limits.loss > 0 ? limitLine(-limits.loss, words.stopLoss, 'start') : ''}`;
  const lines = html`<path class="chart-payoff__gain" d="${path(corners(at, -span, 0))}"/><path class="chart-payoff__loss" d="${path(corners(at, 0, span))}"/>`;
  const points = payoffPoints({ at, span, step }).map(({ s, result }) => mark({
    tip: words.tip(s, result), value: result, hit: { x: x(s) - 6, y: y(result) - 6, width: 12, height: 12 },
    body: html`<circle class="chart-payoff__pt" cx="${x(s)}" cy="${y(result)}" r="3"/>`,
  }));
  const ring = marker === null ? '' : html`<circle class="chart-payoff__marker" cx="${x(marker)}" cy="${y(at(marker))}" r="5"/>`;
  const caption = html`${text({ x: left, y: bottom + 30, anchor: 'start', cls: 'chart-axis__title', body: words.under })}${text({ x: width - right, y: bottom + 30, anchor: 'end', cls: 'chart-axis__title', body: words.over })}`;
  return frame({
    kind: 'payoff', width, height: r1(bottom + 36), body: html`${shade}
${grid}
<line class="chart-zero" x1="${left}" x2="${width - right}" y1="${y(0)}" y2="${y(0)}"/>
${limitsDrawn}
${lines}
${points}
${ring}
${caption}`,
  });
}
