// Shares against a reference: each group a row, its share a dot (its area for how many hospitals it holds) on a
// stem from the reference line (the whole population's share), so how far a group sits from everyone shows at once.
// Groups are listed in sections (a kind each), each section under its own small head. A stem past the reference is
// in the penalty ink when it sits more than band past the reference (a group cut more often than everyone); otherwise
// in ink. Each row is a mark.
//   sections [{ head, rows: [{ label, sub, value (0 to 1), n, tip, valueText }] }]; ref: the reference share;
//   labels { ref }; max: the axis's top share
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { html } from '../render/html.js';
import { axis } from './axis.js';
import { frame, mark, r2, text } from './svg.js';

export function shareDots({ sections, ref, labels, max, width, format, band = 0 }) {
  const narrow = width < 400;
  const labelW = narrow ? 0 : 150;
  const left = labelW + 8;
  const right = width - (narrow ? 44 : 64);
  const x = scaleLinear().domain([0, max]).range([left, right]);
  const most = Math.max(...sections.flatMap((s) => s.rows.map((r) => r.n)));
  const size = scaleSqrt().domain([0, most]).range([0, narrow ? 7 : 10]);
  const rowH = narrow ? 34 : 28;
  const headH = 26;
  let y = 28;
  const out = [];
  for (const s of sections) {
    out.push(text({ x: 0, y: y + 14, anchor: 'start', cls: 'chart-cap', body: s.head }));
    y += headH;
    for (const r of s.rows) {
      const cy = y + rowH / 2 + (narrow ? 6 : 0);
      const xv = r2(x(r.value));
      const xr = r2(x(ref));
      const pen = r.value > ref + band;
      out.push(mark({
        tip: r.tip, value: r.value, hit: { x: 0, y, width, height: rowH },
        body: html`<line class="chart-share__track" x1="${left}" x2="${right}" y1="${r2(cy)}" y2="${r2(cy)}"/>
<line class="chart-share__stem${pen ? ' chart-share__stem--pen' : ''}" x1="${xr}" x2="${xv}" y1="${r2(cy)}" y2="${r2(cy)}"/>
<circle class="chart-share__dot${pen ? ' chart-share__dot--pen' : ''}" cx="${xv}" cy="${r2(cy)}" r="${r2(Math.max(3, size(r.n)))}"/>
${narrow
    ? text({ x: left, y: cy - 10, anchor: 'start', cls: 'chart-label', body: html`${r.label} <tspan class="chart-note">${r.sub}</tspan>` })
    : html`${text({ x: 0, y: cy - 1, anchor: 'start', cls: 'chart-label', body: r.label })}${text({ x: 0, y: cy + 11, anchor: 'start', cls: 'chart-note', body: r.sub })}`}
${text({ x: width, y: cy + 4, anchor: 'end', cls: `chart-value${pen ? ' chart-label--pen' : ''}`, body: r.valueText })}`,
      }));
      y += rowH + (narrow ? 8 : 0);
    }
    y += 8;
  }
  const rx = r2(x(ref));
  return frame({
    kind: 'share', width, height: y + 26, body: html`<line class="chart-ref" x1="${rx}" x2="${rx}" y1="12" y2="${r2(y)}"/>
${text({ x: rx, y: 8, cls: 'chart-cap', body: labels.ref })}
${out}
<g transform="translate(0 ${r2(y)})">${axis({ scale: x, orient: 'bottom', ticks: narrow ? 3 : 6, format })}</g>`,
  });
}
