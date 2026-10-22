// Standing in line, year by year: where one hospital's score fell among every score CMS published that year, as a
// share (the bottom is the lowest score, the top the highest), with each year's cut zone shaded from CMS's line up.
// Shares compare across years even where CMS changed how the score is built, which raw scores do not. Years where
// the rule changed carry a dashed rule and its label.
//   years    [{ label, share, cut, line, tip, value }]: share in [0, 1] or null (no score that year); cut: CMS cut it;
//            line: the share at CMS's line that year (null: no cut that year); value: the number the table holds
//   breaks   [{ at, label }]: a rule change before years[at]
import { html } from '../render/html.js';
import { frame, mark, r2, text } from './svg.js';

const M = { top: 22, bottom: 26, left: 40, right: 8 };
const H = 150;

export function rankYears({ years, breaks = [], labels, width }) {
  const n = years.length;
  const colW = (width - M.left - M.right) / n;
  const cx = (i) => M.left + (i + 0.5) * colW;
  const y = (s) => M.top + (1 - s) * H;
  const zones = years.map((yr, i) => (yr.line === null ? '' : html`<rect class="chart-rank__zone" x="${r2(M.left + i * colW + 1)}" y="${r2(y(1))}" width="${r2(colW - 2)}" height="${r2(y(yr.line) - y(1))}"/>`));
  // A year CMS scored no one: its column says so, on its side.
  const none = labels.none ? years.map((yr, i) => (yr.line === null && yr.share === null ? html`<text class="chart-cap" transform="translate(${r2(cx(i) + 3)} ${r2(y(0.5))}) rotate(-90)" text-anchor="middle">${labels.none}</text>` : '')) : '';
  // The path through the years with a score; a year without one breaks it.
  let d = '';
  let open = false;
  years.forEach((yr, i) => {
    if (yr.share === null) { open = false; return; }
    d += `${open ? 'L' : 'M'}${r2(cx(i))} ${r2(y(yr.share))}`;
    open = true;
  });
  const dots = years.map((yr, i) => (yr.share === null ? '' : mark({
    tip: yr.tip, value: yr.value, hit: { x: M.left + i * colW, y: M.top, width: colW, height: H },
    body: html`<circle class="${yr.cut ? 'chart-rank__dot chart-rank__dot--cut' : 'chart-rank__dot'}" cx="${r2(cx(i))}" cy="${r2(y(yr.share))}" r="${width < 400 ? 4 : 5}"/>`,
  })));
  const every = width < 400 && n > 8 ? 2 : 1;
  const xLabels = years.map((yr, i) => ((n - 1 - i) % every === 0 ? text({ x: cx(i), y: M.top + H + 16, cls: 'chart-tick', body: yr.label }) : ''));
  // A break's label runs right of its rule, or left when the next break would meet it (its width estimated at the
  // caps' 6.4 units a character).
  const rules = breaks.map((b, i) => {
    const x = M.left + b.at * colW;
    const next = breaks[i + 1];
    const crowded = next && M.left + next.at * colW - x < String(b.label).length * 6.4 + 10;
    return html`<line class="chart-rank__break" x1="${r2(x)}" x2="${r2(x)}" y1="${M.top - 14}" y2="${r2(M.top + H)}"/>${text({ x: crowded ? x - 3 : x + 3, y: M.top - 6, anchor: crowded ? 'end' : 'start', cls: 'chart-cap', body: b.label })}`;
  });
  const height = M.top + H + M.bottom;
  return frame({
    kind: 'rank', width, height, body: html`${zones}
<line class="chart-grid" x1="${M.left}" x2="${width - M.right}" y1="${r2(y(0.5))}" y2="${r2(y(0.5))}"/>
<line class="chart-rank__base" x1="${M.left}" x2="${width - M.right}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>
${text({ x: M.left - 6, y: y(1) + 4, anchor: 'end', cls: 'chart-tick', body: labels.top })}
${text({ x: M.left - 6, y: y(0.5) + 4, anchor: 'end', cls: 'chart-tick', body: labels.mid })}
${text({ x: M.left - 6, y: y(0) + 4, anchor: 'end', cls: 'chart-tick', body: labels.bottom })}
${rules}
${none}
<path class="chart-rank__path" d="${d}"/>
${dots}
${xLabels}`,
  });
}
