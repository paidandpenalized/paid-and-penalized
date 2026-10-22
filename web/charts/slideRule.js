// A slide rule for one measure: its values on the top scale and their z-scores on the bottom one, lined up, since a
// value inside the floor and cap maps to its z-score in a straight line ((value − mean) ÷ SD). Past the floor or cap
// the scale is hatched: every value there reads the end's z-score. A cursor (a window with a hairline) stands at one
// value, its readings printed above and below; a page script lets the reader drag it (data-slide holds what it
// needs). The average of every hospital (z = 0) is marked on both scales.
//   p        { floor, cap, mean, sd } (the measure's fitted values); domain [lo, hi] in values
//   value    where the cursor stands; labels { value, z, mean }; format (a value) and zFormat (a z-score) -> text
import { scaleLinear } from 'd3-scale';
import { html } from '../render/html.js';
import { frame, r2, text } from './svg.js';

export function slideRule({ p, domain: [lo, hi], value, labels, format, tickFormat = format, zFormat, zTickFormat = zFormat, width, valueTicks, zTicks }) {
  const left = 10;
  const right = width - 10;
  const x = scaleLinear().domain([lo, hi]).range([left, right]);
  const zOf = (v) => (Math.min(p.cap, Math.max(p.floor, v)) - p.mean) / p.sd;
  const top = 34;
  const h = width < 400 ? 74 : 86;
  const mid = top + h / 2;
  const fx = x(Math.max(p.floor, lo));
  const cx = x(p.cap);
  const meanX = r2(x(p.mean));
  const tick = (vx, y, dir, len) => html`<line class="chart-slide__tick" x1="${r2(vx)}" x2="${r2(vx)}" y1="${r2(y)}" y2="${r2(y + dir * len)}"/>`;
  // Minor ticks on the value scale, a tenth of a major step apart.
  const step = valueTicks.length > 1 ? valueTicks[1] - valueTicks[0] : 0;
  const minors = step ? Array.from({ length: Math.round((hi - lo) / (step / 5)) + 1 }, (_, i) => lo + (i * step) / 5).filter((v) => v <= hi) : [];
  const zX = (z) => x(p.mean + z * p.sd);
  const cur = r2(x(value));
  const curZ = zOf(value);
  return frame({
    kind: 'slide', width, height: top + h + 40, body: html`<rect class="chart-slide__stock" x="${left - 6}" y="${top}" width="${r2(right - left + 12)}" height="${h}" rx="3"/>
<rect class="chart-same" x="${r2(cx)}" y="${top}" width="${r2(right + 6 - cx)}" height="${h}"/>
${p.floor > lo ? html`<rect class="chart-same" x="${left - 6}" y="${top}" width="${r2(fx - left + 6)}" height="${h}"/>` : ''}
<line class="chart-slide__mid" x1="${left - 6}" x2="${r2(right + 6)}" y1="${r2(mid)}" y2="${r2(mid)}"/>
${minors.map((v) => tick(x(v), top, 1, 6))}
${valueTicks.filter((v) => x(v) > left + 2 && x(v) < right - 2).map((v) => html`${tick(x(v), top, 1, 13)}${text({ x: x(v), y: top + 25, cls: 'chart-slide__num', body: tickFormat(v) })}`)}
${zTicks.map((z) => html`${tick(zX(z), top + h, -1, 13)}${text({ x: zX(z), y: top + h - 18, cls: z === 0 ? 'chart-slide__num chart-slide__num--zero' : 'chart-slide__num', body: zTickFormat(z) })}`)}
<line class="chart-slide__mean" x1="${meanX}" x2="${meanX}" y1="${r2(top - 4)}" y2="${r2(top + h)}"/>
${text({ x: meanX, y: top - 8, cls: 'chart-slide__word', body: labels.mean })}
${text({ x: left - 6, y: top - 8, anchor: 'start', cls: 'chart-cap', body: labels.value })}
${text({ x: left - 6, y: top + h + 16, anchor: 'start', cls: 'chart-cap', body: labels.z })}
<g class="chart-slide__cursor" data-cursor transform="translate(${cur} 0)">
<rect class="chart-slide__glass" x="-13" y="${top - 6}" width="26" height="${h + 12}" rx="3"/>
<line class="chart-slide__hair" x1="0" x2="0" y1="${top - 6}" y2="${top + h + 6}"/>
<text class="chart-slide__read" x="0" y="${top - 12}" text-anchor="middle" data-read="value">${format(value)}</text>
<text class="chart-slide__read chart-slide__read--z" x="0" y="${top + h + 32}" text-anchor="middle" data-read="z">${zFormat(curZ)}</text>
</g>`,
  });
}
