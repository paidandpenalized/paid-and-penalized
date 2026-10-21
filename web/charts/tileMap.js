// A state tile map: one square per code in states.js, filled by a step of the pen ramp (--pen-seq-1 to 5, light to
// dark) or, where there is no value to show, hatched with the caller's label: never drawn as zero. A legend under
// the grid names each step and each hatched label. Every code in the grid must be given, and only those codes.
//   id       names this SVG's hatch pattern (lowercase letters, digits, hyphens)
//   states   { [code]: { value, label, hatched } }   label: the tile's tooltip (and, hatched, its legend entry)
//   ramp     the step thresholds, ascending (1 to 4 of them: 2 to 5 steps); a value at a threshold takes the step above
//   format   a threshold -> text (default: the number as given, with a true minus)
import { scaleThreshold } from 'd3-scale';
import { html } from '../render/html.js';
import { GAP, WIDTH, checkId, frame, hatchDefs, hatchFill, mark, plain, r2, text } from './svg.js';
import { GRID, TILES } from './states.js';

const LEGEND_COLS = 3;
const LEGEND_ROW = 20;
const SWATCH = 12;
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
    if (!s.hatched && !Number.isFinite(s.value)) throw new RangeError(`tileMap: ${code} has no value and is not hatched`);
  }
}

export function tileMap({ id, states, ramp, width = WIDTH, format = plain }) {
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
    const step = s.hatched ? null : stepOf(s.value);
    const tile = s.hatched
      ? html`<rect class="chart-tile-na" fill="${hatchFill(id)}" x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}"/>`
      : html`<rect class="chart-tile chart-seq-${step}" x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}" rx="2"/>`;
    const codeCls = step !== null && step >= DARK_FROM ? 'chart-tile__code chart-tile__code--on' : 'chart-tile__code';
    return html`${mark({
      // A tile (a phone-wide grid's cell, about 30 units) is its own hit area.
      tip: `${code}: ${s.label}`, value: s.hatched ? null : s.value, data: { state: code }, hit: null,
      body: html`${tile}${text({ x: x + size / 2, y: y + size / 2 + 4, anchor: null, cls: codeCls, body: code })}`,
    })}
`;
  });

  const stepText = (i) => (i === 0 ? `< ${format(ramp[0])}` : i === ramp.length ? `≥ ${format(ramp[i - 1])}` : `${format(ramp[i - 1])} – ${format(ramp[i])}`);
  const hatchedLabels = [...new Set(Object.values(states).filter((s) => s.hatched).map((s) => s.label))];
  // The steps share rows, LEGEND_COLS to a row; each hatched label, likely longer, has a row of its own.
  const stepRows = Math.ceil(steps.length / LEGEND_COLS);
  const colW = width / LEGEND_COLS;
  const legendY = gridH + 8;
  const legend = [
    ...steps.map((step, i) => ({
      x: (i % LEGEND_COLS) * colW, y: legendY + Math.floor(i / LEGEND_COLS) * LEGEND_ROW,
      cls: `chart-tile chart-seq-${step}`, body: stepText(i),
    })),
    ...hatchedLabels.map((label, i) => ({
      x: 0, y: legendY + (stepRows + i) * LEGEND_ROW, cls: 'chart-tile-na', fill: hatchFill(id), body: label,
    })),
  ];
  const height = legendY + (stepRows + hatchedLabels.length) * LEGEND_ROW;

  return frame({
    kind: 'tile-map', width, height, body: html`${hatchDefs(id)}
${tiles}<g class="chart-legend">${legend.map(({ x, y, cls, fill, body }) =>
      html`<rect class="${cls}"${fill ? html` fill="${fill}"` : ''} x="${r2(x)}" y="${r2(y)}" width="${SWATCH}" height="${SWATCH}"/>${text({ x: x + SWATCH + 6, y: y + SWATCH - 2, anchor: 'start', cls: 'chart-legend__label', body })}`)}</g>`,
  });
}
