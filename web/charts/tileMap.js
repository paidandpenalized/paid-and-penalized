// A state tile map: one square per code in states.js, filled by a step of the pen ramp (--pen-seq-1 to 5, light to
// dark) or, where there is no value to show, never drawn as zero: hatched (not in the program) or an empty dashed
// outline (nothing to show), with the caller's label. Under the grid, the ramp as one stepped bar with each
// threshold at its edge, then one row per hatched or empty label. Every code in the grid must be given, and only
// those codes.
//   id       names this SVG's hatch pattern (lowercase letters, digits, hyphens)
//   states   { [code]: { value, label, text, hatched, empty } }   label: the tile's tooltip (and, hatched or empty,
//            its legend entry); text: the value as the tile prints it, with showValues
//   showValues  print each valued tile's text under its code (for a viewBox wide enough to hold it)
//   ramp     the step thresholds, ascending (1 to 4 of them: 2 to 5 steps); a value at a threshold takes the step above
//   format   a threshold -> text (default: the number as given, with a true minus)
import { scaleThreshold } from 'd3-scale';
import { html } from '../render/html.js';
import { GAP, WIDTH, checkId, frame, hatchDefs, hatchFill, mark, plain, r2, text } from './svg.js';
import { GRID, TILES } from './states.js';

const LEGEND_ROW = 20;
const SWATCH = 12;
// The stepped bar: each step's width and the bar's height, then room under it for the threshold labels.
const STEP_W = 44;
const BAR_H = 10;
const BAR_LABELS = 16;
const STEPS = 5;
// Steps from --pen-seq-3 up are dark enough for on-mark text (tokens.css).
const DARK_FROM = 3;

// The ramp classes used for k steps: spread across the five, always both ends.
const stepsFor = (k) => Array.from({ length: k }, (_, i) => Math.round((i * (STEPS - 1)) / (k - 1)) + 1);

function checkStates(states) {
  for (const code of Object.keys(states)) if (!Object.hasOwn(TILES, code)) throw new RangeError(`tileMap: unknown code ${code}`);
  for (const code of Object.keys(TILES)) {
    const s = states[code];
    if (!s) throw new RangeError(`tileMap: no entry for ${code} (a code with no data is hatched with a label, never left out)`);
    if (s.hatched && s.empty) throw new RangeError(`tileMap: ${code} is either hatched or empty, not both`);
    if (!s.hatched && !s.empty && !Number.isFinite(s.value)) throw new RangeError(`tileMap: ${code} has no value and is not hatched or empty`);
  }
}

export function tileMap({ id, states, ramp, width = WIDTH, format = plain, showValues = false }) {
  checkId(id, 'tileMap');
  checkStates(states);
  if (!(ramp.length >= 1 && ramp.length < STEPS && ramp.every((t, i) => i === 0 || t > ramp[i - 1]))) {
    throw new RangeError('tileMap: ramp must be 1 to 4 ascending thresholds');
  }
  const steps = stepsFor(ramp.length + 1);
  const stepOf = scaleThreshold().domain(ramp).range(steps);
  const pitch = width / GRID.cols;
  const size = pitch - GAP;
  const gridH = GRID.rows * pitch;

  const tiles = Object.entries(TILES).map(([code, [c, r]]) => {
    const s = states[code];
    const x = c * pitch;
    const y = r * pitch;
    const none = s.hatched || s.empty;
    const step = none ? null : stepOf(s.value);
    const box = html`x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}"`;
    const tile = s.hatched ? html`<rect class="chart-tile-na" fill="${hatchFill(id)}" ${box}/>`
      : s.empty ? html`<rect class="chart-tile-empty" ${box}/>`
        : html`<rect class="chart-tile chart-seq-${step}" ${box} rx="2"/>`;
    const on = step !== null && step >= DARK_FROM ? ' chart-tile__code--on' : '';
    const valued = showValues && !none && s.text;
    // With its value printed, the code moves up and the value sits under it.
    const codeY = valued ? y + size / 2 - 2 : y + size / 2 + 4;
    return html`${mark({
      // A tile (a phone-wide grid's cell, about 30 units) is its own hit area.
      tip: `${code}: ${s.label}`, value: none ? null : s.value, data: { state: code }, hit: null,
      body: html`${tile}${text({ x: x + size / 2, y: codeY, anchor: null, cls: `chart-tile__code${on}`, body: code })}${valued ? text({ x: x + size / 2, y: codeY + 13, anchor: null, cls: `chart-tile__value${on}`, body: s.text }) : ''}`,
    })}
`;
  });

  const labelsOf = (key) => [...new Set(Object.values(states).filter((s) => s[key]).map((s) => s.label))];
  const others = [...labelsOf('hatched').map((label) => ({ label, cls: 'chart-tile-na', fill: hatchFill(id) })),
    ...labelsOf('empty').map((label) => ({ label, cls: 'chart-tile-empty', fill: null }))];
  // The ramp as one bar of steps, each threshold printed under the edge where its step begins; then each hatched
  // or empty label on a row of its own.
  const barY = gridH + 10;
  const bar = html`${steps.map((step, i) => html`<rect class="chart-tile chart-seq-${step}" x="${r2(i * STEP_W)}" y="${r2(barY)}" width="${STEP_W}" height="${BAR_H}"/>`)}${ramp.map((t, i) => text({ x: (i + 1) * STEP_W, y: barY + BAR_H + 12, cls: 'chart-legend__label', body: format(t) }))}`;
  const othersY = barY + BAR_H + BAR_LABELS + 8;
  const legend = others.map(({ label, cls, fill }, i) => ({ x: 0, y: othersY + i * LEGEND_ROW, cls, fill, body: label }));
  const height = othersY + others.length * LEGEND_ROW;

  return frame({
    kind: 'tile-map', width, height, body: html`${hatchDefs(id)}
${tiles}<g class="chart-legend">${bar}${legend.map(({ x, y, cls, fill, body }) =>
      html`<rect class="${cls}"${fill ? html` fill="${fill}"` : ''} x="${r2(x)}" y="${r2(y)}" width="${SWATCH}" height="${SWATCH}"/>${text({ x: x + SWATCH + 6, y: y + SWATCH - 2, anchor: 'start', cls: 'chart-legend__label', body })}`)}</g>`,
  });
}
