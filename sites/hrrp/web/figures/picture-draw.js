// The drawings of the program page's "The FY2027 picture" Part that the chart kit has no chart for: the size of the cuts (Step 2's
// swarm form, on the cut), the share cut by number of conditions measured with its interval [CF-11], the old site's strip plot of
// the cuts by peer group, and the range bar of each trait of a hospital [TD-10]. Each takes plain rows (figures/picture-data.js,
// with the words already made by figures/picture.js) and a drawing width and returns the SVG. The kit's marks and classes are
// reused wherever one fits (chart-share__*, chart-median, chart-ref); the few new ones are in sites/hrrp/styles.css.
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { html } from '../../../../web/render/html.js';
import { axis } from '../../../../web/charts/axis.js';
import { dotsPath, spread } from '../../../../web/charts/dots.js';
import { scoreSwarm } from '../../../../web/charts/scoreSwarm.js';
import { NOTE_PX, frame, isNarrow, mark, r2, text } from '../../../../web/charts/svg.js';
import { textWidth } from '../../../../web/charts/text.js';
import { clamp } from '../../../../engine/js/stats.js';
import { dotsFor } from './swarm.js';

// ---------- the size of the cuts ----------

// The drawing's margin on each side (scoreSwarm's); the dot layout is Step 2's swarm's (figures/swarm.js dotsFor).
const MARGIN = 8;
// A wide drawing's dots are a little larger than a phone's, which has the height to give.
const DOT_PITCH = { wide: 3.4, narrow: 2.4 };

// items: [{ score: the cut in percent }] of the measured hospitals; the no-cut pile sits in a bin of its own just left of zero.
// edges: the bins' edges, the first one the pile's; cap: the axis's top (percent). labels: { below, above } the counts at the line.
export function drawCuts({ items, edges, cap, labels, width, ticks, format }) {
  const { cols, pitch } = dotsFor(width, edges.length - 1, DOT_PITCH[isNarrow(width) ? 'narrow' : 'wide']);
  return scoreSwarm({
    items: items.map((i) => ({ score: Math.min(cap, i.score), yes: i.score > 0 })), edges, band: [0, 0], line: 0, width, pitch, cols,
    labels, ticks, format,
  });
}

// ---------- the share cut by number of conditions measured ----------

// rows: [{ label, sub, share (0 to 1), lo, hi (the interval), n, tip, valueText }], widest groups first as given.
export function drawMeasured({ rows, width, axisFormat }) {
  const narrow = isNarrow(width);
  const left = narrow ? 8 : 150;
  const right = width - (narrow ? 44 : 56);
  const x = scaleLinear().domain([0, 1]).range([left, right]);
  const most = Math.max(...rows.map((r) => r.n));
  const size = scaleSqrt().domain([0, most]).range([0, narrow ? 7 : 9]);
  const rowH = narrow ? 44 : 34;
  let y = 6;
  const out = rows.map((r) => {
    const cy = y + (narrow ? 30 : 17);
    const [xs, xl, xh] = [r2(x(r.share)), r2(x(r.lo)), r2(x(r.hi))];
    const body = html`<line class="chart-share__track" x1="${left}" x2="${right}" y1="${r2(cy)}" y2="${r2(cy)}"/>
<line class="cond-ci" x1="${xl}" x2="${xh}" y1="${r2(cy)}" y2="${r2(cy)}"/><line class="cond-ci" x1="${xl}" x2="${xl}" y1="${r2(cy - 4)}" y2="${r2(cy + 4)}"/><line class="cond-ci" x1="${xh}" x2="${xh}" y1="${r2(cy - 4)}" y2="${r2(cy + 4)}"/>
<circle class="chart-share__dot chart-share__dot--pen" cx="${xs}" cy="${r2(cy)}" r="${r2(Math.max(2.5, size(r.n)))}"/>
${narrow
    ? text({ x: 0, y: y + 12, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })
    : html`${text({ x: 0, y: cy - 1, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: 0, y: cy + 11, anchor: 'start', cls: 'chart-note', body: r.sub })}`}
${text({ x: width, y: cy + 4, anchor: 'end', cls: 'chart-value chart-label--pen', body: r.valueText })}`;
    const row = mark({ tip: r.tip, value: r.share, hit: { x: 0, y, width, height: rowH }, body });
    y += rowH;
    return row;
  });
  const ticks = narrow ? [0, 0.5, 1] : Array.from({ length: 11 }, (_, i) => r2(i / 10));
  return frame({
    kind: 'share', width, height: y + 30, body: html`${out}
<g transform="translate(0 ${r2(y + 4)})">${axis({ scale: x, orient: 'bottom', ticks, format: axisFormat })}</g>`,
  });
}

// ---------- the cuts by peer group: the old site's strip plot ----------

// The dot's shade by the size of its cut, the old site's bins (no cut, under 0.25%, under 0.5%, under 1%, under 2%, 2% or more).
export const stripShade = (red) => (red <= 0 ? 0 : red < 0.25 ? 1 : red < 0.5 ? 2 : red < 1 ? 3 : red < 2 ? 4 : 5);
const STRIP_DOT = 2.8;

// rows: [{ label, sub, reds (cuts in percent of each measured hospital), median (percent or null), shareText, tip }];
// cap: the axis's top (percent); labels: { median, shade } for the key.
export function drawStrip({ rows, cap, width, labels, ticks, format }) {
  const narrow = isNarrow(width);
  const left = narrow ? MARGIN : 100;
  const right = width - (narrow ? MARGIN : 74);
  const rowH = narrow ? 56 : 46;
  const top = 26;
  const x = scaleLinear().domain([0, cap]).range([left, right]);
  const shades = Array.from({ length: 6 }, () => []);
  const body = rows.map((r, row) => {
    const y0 = top + row * rowH;
    const pad = narrow ? 22 : 7;
    r.reds.forEach((red, i) => shades[stripShade(red)].push([x(Math.min(cap, red)), y0 + pad + spread(i + 31 * row) * (rowH - pad - 7)]));
    const mx = r.median === null ? null : r2(x(Math.min(cap, r.median)));
    // On a phone the row's words sit over its band; the band and the median tick start under them.
    const bandTop = y0 + (narrow ? 17 : 2);
    return mark({
      tip: r.tip, value: r.median, hit: { x: 0, y: y0, width, height: rowH },
      body: html`${row % 2 ? '' : html`<rect class="strip__band" x="${left}" y="${bandTop}" width="${r2(right - left)}" height="${y0 + rowH - 2 - bandTop}"/>`}
${narrow
    ? html`${text({ x: MARGIN, y: y0 + 13, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })}${text({ x: width - MARGIN, y: y0 + 13, anchor: 'end', cls: 'chart-value', body: r.shareText })}`
    : html`${text({ x: 0, y: y0 + rowH / 2 - 2, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: 0, y: y0 + rowH / 2 + 11, anchor: 'start', cls: 'chart-note', body: r.sub })}${text({ x: width, y: y0 + rowH / 2 + 4, anchor: 'end', cls: 'chart-value', body: r.shareText })}`}
${mx === null ? '' : html`<line class="chart-median strip__median" x1="${mx}" x2="${mx}" y1="${bandTop}" y2="${y0 + rowH - 2}"/>`}`,
    });
  });
  const dots = shades.map((pts, i) => dotsPath(pts, `strip-dot strip-dot--${i}`, STRIP_DOT));
  const base = top + rows.length * rowH;
  return frame({
    kind: 'strip', width, height: base + 34, body: html`<line class="chart-median strip__median" x1="${left + 4}" x2="${left + 4}" y1="4" y2="18"/>${text({ x: left + 12, y: 15, anchor: 'start', cls: 'chart-note', body: labels.median })}${text({ x: right, y: 15, anchor: 'end', cls: 'chart-note', body: labels.shade })}
${body}${dots}
<g transform="translate(0 ${r2(base)})">${axis({ scale: x, orient: 'bottom', ticks, format })}</g>`,
  });
}

// ---------- the traits' ranges [TD-10] ----------

// traits: [{ name, groups: [{ label, share (percent), tip }], lo, hi (percent), spreadText }], widest first; national: { share (percent),
// text }; format: percent -> axis text. A trait is one row under its own heading and rule: set vertically in the left gutter
// on the wide drawing, over the row on a phone.
export function drawSpread({ traits, national, width, format, head }) {
  const narrow = isNarrow(width);
  const shares = traits.flatMap((t) => t.groups.map((g) => g.share)).concat(national.share);
  const lo = Math.max(0, Math.floor((Math.min(...shares) - 4) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...shares) + 4) / 10) * 10);
  const gutter = narrow ? 0 : 30;
  const x = scaleLinear().domain([lo, hi]).range([gutter + (narrow ? 22 : 20), width - (narrow ? 22 : 100)]);
  const rowH = narrow ? 92 : 80;
  const SLOTS = narrow ? [-9, 22, -19, 35] : [-10, 19, -22, 31];
  let y = 8;
  const blocks = traits.map((t) => {
    const cy = y + (narrow ? 52 : 40);
    const taken = SLOTS.map(() => []);
    const dots = [...t.groups].sort((a, b) => a.share - b.share).map((g) => {
      const w = textWidth(g.label, NOTE_PX) + 16;
      const [a0, a1] = [x(g.share) - w / 2, x(g.share) + w / 2];
      const k = taken.findIndex((spans) => spans.every(([b0, b1]) => a1 < b0 || a0 > b1));
      const slot = k < 0 ? 0 : k;
      taken[slot].push([a0, a1]);
      return mark({
        tip: g.tip, value: g.share, hit: null,
        body: html`<circle class="chart-share__dot chart-share__dot--pen" cx="${r2(x(g.share))}" cy="${r2(cy)}" r="4.5"/>${text({ x: clamp(x(g.share), w / 2, width - w / 2), y: cy + SLOTS[slot] + 3, cls: 'chart-note chart-label--halo', body: g.label })}`,
      });
    });
    const heading = narrow
      ? html`<line class="spread__rule" x1="0" x2="${width}" y1="${y + 2}" y2="${y + 2}"/>${text({ x: 0, y: y + 18, anchor: 'start', cls: 'chart-cap', body: t.name })}`
      : html`<line class="spread__rule" x1="${gutter - 6}" x2="${gutter - 6}" y1="${y + 4}" y2="${y + rowH - 4}"/><text class="chart-cap" transform="translate(${gutter - 14} ${r2(cy)}) rotate(-90)" text-anchor="middle">${t.name}</text>`;
    const out = html`${heading}<line class="chart-share__stem" x1="${r2(x(t.lo))}" x2="${r2(x(t.hi))}" y1="${r2(cy)}" y2="${r2(cy)}"/>${dots}${text({ x: width, y: narrow ? y + 20 : cy + 6, anchor: 'end', cls: 'chart-spread', body: t.spreadText })}`;
    y += rowH;
    return out;
  });
  const nx = r2(x(national.share));
  const ticks = [];
  for (let v = lo; v <= hi; v += narrow ? 20 : 10) ticks.push(v);
  return frame({
    kind: 'spread', width, height: y + 40, body: html`${narrow ? '' : text({ x: width, y: 8, anchor: 'end', cls: 'chart-cap', body: head })}
${blocks}<line class="chart-ref" x1="${nx}" x2="${nx}" y1="4" y2="${r2(y - 4)}"/>
<g transform="translate(0 ${r2(y)})">${axis({ scale: x, orient: 'bottom', ticks, format })}</g>
${text({ x: nx, y: y + 32, cls: 'chart-note', body: national.text })}`,
  });
}
