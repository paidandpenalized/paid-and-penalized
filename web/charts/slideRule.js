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
import { textWidth } from './text.js';

// The rule's ends sit this far in from the drawing's edges (a page script maps a pointer back to a value with it).
export const SLIDE_PAD = 10;

// The cursor's two readings sit centered over its hairline, kept inside the drawing. The value's shares the line above
// the rule with two words: the value scale's caption at the left end and the average's word over its mark. Where it
// would touch a word, it sits beside that word, just clear of it, on the hairline's side, if that place is clear too;
// else one line higher, over the words, centered over the hairline again. (Below the rule it would sit on the z-score
// caption's line and read as a z-score; beside the word there is no room on a phone, between the caption and the word.)
// The cursor carries its line (data-line: the rule's top and the words' spans) so the page script places the readings
// the same way as the reader drags. Widths are text.js's estimates at charts.css's sizes: the readings 12px in the type
// face, the words 10px caps in the body face with their letter spacing (.chart-cap 0.08em, .chart-slide__word 0.06em).
const READ_PX = 12;
const WORD_PX = 10;
const READ_GAP = 4;
// The value reading's baseline above the rule's top: on the words' line (theirs is 8 above it), or a line higher.
const READ_ON = 12;
const READ_UP = 22;
const capsWide = (s, spacing) => textWidth(String(s).toUpperCase(), WORD_PX) + String(s).length * spacing * WORD_PX;

// Where the readings go with the hairline at cur: the value's { x, y } (x from the hairline, a reading being centered
// on it; y its baseline) and the z-score's zx. value and z: their texts; top: the rule's top; words: the value line's
// [from, to] spans; width: the drawing's.
export function readPlaces({ cur, value, z, top, words, width }) {
  const half = (s) => textWidth(s, READ_PX, { mono: true }) / 2;
  const inside = (hw) => Math.min(width - hw, Math.max(hw, cur));
  const hw = half(value);
  const hit = (c) => words.find(([a, b]) => c + hw + READ_GAP > a && c - hw - READ_GAP < b);
  const touched = hit(inside(hw));
  const beside = touched && (cur < (touched[0] + touched[1]) / 2 ? touched[0] - READ_GAP - hw : touched[1] + READ_GAP + hw);
  const clear = touched && beside >= hw && beside <= width - hw && !hit(beside);
  const [x, y] = !touched ? [inside(hw), READ_ON] : clear ? [beside, READ_ON] : [inside(hw), READ_UP];
  return { x: r2(x - cur), y: top - y, zx: r2(inside(half(z)) - cur) };
}

export function slideRule({ p, domain: [lo, hi], value, labels, format, tickFormat = format, zFormat, zTickFormat = zFormat, width, valueTicks, zTicks }) {
  const left = SLIDE_PAD;
  const right = width - SLIDE_PAD;
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
  const meanW = capsWide(labels.mean, 0.06);
  const line = { top, words: [[left - 6, left - 6 + capsWide(labels.value, 0.08)], [meanX - meanW / 2, meanX + meanW / 2]].map((span) => span.map(r2)) };
  const read = format(value);
  const zRead = zFormat(curZ);
  const at = readPlaces({ cur, value: read, z: zRead, width, ...line });
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
<g class="chart-slide__cursor" data-cursor data-line="${JSON.stringify(line)}" transform="translate(${cur} 0)">
<rect class="chart-slide__glass" x="-13" y="${top - 6}" width="26" height="${h + 12}" rx="3"/>
<line class="chart-slide__hair" x1="0" x2="0" y1="${top - 6}" y2="${top + h + 6}"/>
<text class="chart-slide__read" x="${at.x}" y="${at.y}" text-anchor="middle" data-read="value">${read}</text>
<text class="chart-slide__read chart-slide__read--z" x="${at.zx}" y="${top + h + 32}" text-anchor="middle" data-read="z">${zRead}</text>
</g>`,
  });
}
