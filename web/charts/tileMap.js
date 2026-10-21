// A state tile map: one square per code in states.js, filled by a step of the pen ramp (--pen-seq-1 to 5, light to
// dark); a value of exactly zero takes the neutral mark, never a meaning ink; where there is no value to show, never
// drawn as zero: hatched (not in the program) or an empty dashed outline (nothing to show), with the caller's label.
// A tile whose value rests on few cases carries a dashed inner outline. Under the grid, the ramp as one stepped bar
// under its title, with each threshold at its edge and the two ends labelled; then one row each for zero, few cases,
// and every hatched or empty label, in sentence case. Every code in the grid must be given, and only those codes.
//   id       names this SVG's hatch pattern (lowercase letters, digits, hyphens)
//   states   { [code]: { value, label, text, few, hatched, empty } }   label: the tile's tooltip (and, hatched or
//            empty, its legend entry); text: the value as the tile prints it, with showValues; few: the value rests
//            on few cases
//   showValues  print each valued tile's text under its code (for a viewBox wide enough to hold it)
//   ramp     the step thresholds, ascending (1 to 4 of them: 2 to 5 steps); a value at a threshold takes the step above
//   format   a threshold -> text (default: the number as given, with a true minus)
//   legend   { title, high, zero, few }: the stepped bar's title, the text at its right end (the highest value), and
//            the legend rows for a zero value and for few cases (required when some tile is zero or few)
import { scaleThreshold } from 'd3-scale';
import { capitalize } from '../render/format.js';
import { html } from '../render/html.js';
import { GAP, WIDTH, checkId, frame, hatchDefs, hatchFill, mark, plain, r2, text } from './svg.js';
import { GRID, TILES } from './states.js';

const LEGEND_ROW = 20;
// The few-cases outline's inset inside its tile.
const FEW_INSET = 2.5;
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

export function tileMap({ id, states, ramp, legend: words = {}, width = WIDTH, format = plain, showValues = false }) {
  checkId(id, 'tileMap');
  checkStates(states);
  const valued = Object.values(states).filter((s) => !s.hatched && !s.empty);
  const anyZero = valued.some((s) => s.value === 0);
  const anyFew = valued.some((s) => s.few);
  if (anyZero && !words.zero) throw new RangeError('tileMap: a zero tile needs legend.zero, its legend row');
  if (anyFew && !words.few) throw new RangeError('tileMap: a few-cases tile needs legend.few, its legend row');
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
    const zero = !none && s.value === 0;
    const step = none || zero ? null : stepOf(s.value);
    const box = html`x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}"`;
    const on = step !== null && step >= DARK_FROM ? ' chart-tile__code--on' : '';
    const tile = s.hatched ? html`<rect class="chart-tile-na" fill="${hatchFill(id)}" ${box}/>`
      : s.empty ? html`<rect class="chart-tile-empty" ${box}/>`
        : html`<rect class="chart-tile ${zero ? 'chart-tile-zero' : `chart-seq-${step}`}" ${box} rx="2"/>${s.few ? fewOutline(x, y, size, on) : ''}`;
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
  const others = [
    ...(anyZero ? [{ label: words.zero, cls: 'chart-tile chart-tile-zero', fill: null }] : []),
    ...(anyFew ? [{ label: words.few, cls: 'chart-tile chart-tile-zero', fill: null, few: true }] : []),
    ...labelsOf('hatched').map((label) => ({ label, cls: 'chart-tile-na', fill: hatchFill(id) })),
    ...labelsOf('empty').map((label) => ({ label, cls: 'chart-tile-empty', fill: null }))];
  // The ramp as one bar of steps under its title, each threshold printed under the edge where its step begins and
  // the ends labelled (zero under the low end, legend.high beside the high end); then one row for each other mark.
  const titleY = gridH + 18;
  const barY = words.title ? titleY + 8 : gridH + 10;
  const labelY = barY + BAR_H + 12;
  const ends = [text({ x: 0, y: labelY, anchor: 'start', cls: 'chart-legend__label', body: format(0) }),
    ...(words.high ? [text({ x: steps.length * STEP_W + 6, y: barY + BAR_H - 1, anchor: 'start', cls: 'chart-legend__label', body: words.high })] : [])];
  const bar = html`${words.title ? text({ x: 0, y: titleY, anchor: 'start', cls: 'chart-legend__title', body: words.title }) : ''}${steps.map((step, i) => html`<rect class="chart-tile chart-seq-${step}" x="${r2(i * STEP_W)}" y="${r2(barY)}" width="${STEP_W}" height="${BAR_H}"/>`)}${ramp.map((t, i) => text({ x: (i + 1) * STEP_W, y: labelY, cls: 'chart-legend__label', body: format(t) }))}${ends}`;
  const othersY = barY + BAR_H + BAR_LABELS + 8;
  const rows = others.map((row, i) => ({ ...row, x: 0, y: othersY + i * LEGEND_ROW, body: capitalize(row.label) }));
  const height = othersY + others.length * LEGEND_ROW;

  return frame({
    kind: 'tile-map', width, height, body: html`${hatchDefs(id)}
${tiles}<g class="chart-legend">${bar}${rows.map(({ x, y, cls, fill, few, body }) =>
      html`<rect class="${cls}"${fill ? html` fill="${fill}"` : ''} x="${r2(x)}" y="${r2(y)}" width="${SWATCH}" height="${SWATCH}"/>${few ? fewOutline(x - 0.5, y - 0.5, SWATCH + 1, '') : ''}${text({ x: x + SWATCH + 6, y: y + SWATCH - 2, anchor: 'start', cls: 'chart-legend__label', body })}`)}</g>`,
  });
}

// The few-cases mark: a dashed outline just inside a tile, in ink (on-mark ink over a dark step).
const fewOutline = (x, y, size, on) => html`<rect class="chart-tile-few${on ? ' chart-tile-few--on' : ''}" x="${r2(x + FEW_INSET)}" y="${r2(y + FEW_INSET)}" width="${r2(size - 2 * FEW_INSET)}" height="${r2(size - 2 * FEW_INSET)}"/>`;
