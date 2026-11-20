// A hospital's scenario range against its track's limits (TEAM's band on the hub's hospital page): one dollar axis from
// the stop-loss side to the stop-gain side, symmetric about $0 so $0 sits mid-frame on every drawing; the range as a bar,
// the part below $0 (what the hospital would repay) in the repaid ink and the part above (what Medicare would pay) in the
// paid ink; $0 marked; and past each limit a hatched wall, since no result goes there. A track with no loss side walls off
// everything below $0 and says so. Pure: an SVG string for the build and the browser alike; colors come from classes in
// the site's stylesheet.
//   id      names this SVG's hatch pattern (lowercase letters, digits, hyphens): unique on its page
//   low, high  the range's ends, in dollars (positive: Medicare would pay; negative: the hospital would repay), within
//          the limits
//   limits  { gain, loss } positive dollars (loss 0: a track with no loss side)
//   words   { money(v) (an amount's label, $0 included), stopGain(v), stopLoss(v) (the walls' labels, v the limit in
//            dollars), noLoss (the label of a track with no loss side), tip(low, high) (the range's tooltip),
//            wallTip(side, v) ('gain' or 'loss', the limit's tooltip) }
//   width   the viewBox's width (the kit's WIDTH on a phone, a wider one beside the words)
// The range is a mark carrying its two ends, each wall a mark carrying its limit (the loss side's as a negative amount),
// in whole dollars (the words give each amount; the marks only pair with a table): limitRulerValues lists the four, for
// the figure's table.
import { html } from '../render/html.js';
import { checkId, frame, hatchDefs, hatchFill, isNarrow, mark, r2, text } from './svg.js';

// The axis runs this far past the larger limit either way, so each wall has room to read as a wall.
const WALL = 1.2;
const SIDE = 4;
// The tick type's advance (11-unit IBM Plex Mono: 0.6 em a character), to keep two labels on one row apart.
const CHAR = 6.6;
const EPS = 0.5;
// A mark's value: whole dollars, never -0.
const dollars = (v) => Math.round(v) + 0;

function checked({ low, high, limits }) {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) throw new RangeError('limitRuler: low and high are dollars, low at most high');
  if (!(limits?.gain > 0) || !(limits.loss >= 0) || !Number.isFinite(limits.gain) || !Number.isFinite(limits.loss)) throw new RangeError('limitRuler: the limits are a gain above 0 and a loss of 0 or more');
  if (low < -limits.loss - EPS || high > limits.gain + EPS) throw new RangeError('limitRuler: the range runs past a limit');
}

// The four values the ruler plots, as its figure tables them (whole dollars): the range's ends, then the limits (the loss
// side's negative).
export const limitRulerValues = ({ low, high, limits }) => [
  { key: 'low', value: dollars(low) }, { key: 'high', value: dollars(high) }, { key: 'loss', value: dollars(-limits.loss) }, { key: 'gain', value: dollars(limits.gain) },
];

export function limitRuler({ id, low, high, limits, words, width }) {
  checkId(id, 'limitRuler');
  checked({ low, high, limits });
  const narrow = isNarrow(width);
  const extent = Math.max(limits.gain, limits.loss) * WALL;
  const x = (v) => r2(SIDE + ((v + extent) / (2 * extent)) * (width - 2 * SIDE));
  const [valueY, barTop, barH] = [13, 20, narrow ? 14 : 16];
  const axisY = barTop + barH + 4;
  const wallsY = axisY + 15;
  const [xLoss, xGain, x0] = [x(-limits.loss), x(limits.gain), x(0)];

  const wall = (side, from, to, v) => mark({
    tip: words.wallTip(side, v), value: dollars(v), hit: null,
    body: html`<rect class="chart-ruler__wall" fill="${hatchFill(id)}" x="${from}" y="${barTop - 2}" width="${r2(to - from)}" height="${axisY - barTop + 2}"/><line class="chart-ruler__limit" x1="${side === 'loss' ? to : from}" x2="${side === 'loss' ? to : from}" y1="${barTop - 2}" y2="${axisY}"/>`,
  });
  const walls = html`${wall('loss', SIDE, xLoss, -limits.loss + 0)}${wall('gain', xGain, width - SIDE, limits.gain)}`;

  const lossPart = low < 0 ? html`<rect class="chart-ruler__loss" x="${x(low)}" y="${barTop}" width="${r2(x(Math.min(high, 0)) - x(low))}" height="${barH}"/>` : '';
  const gainPart = high > 0 ? html`<rect class="chart-ruler__gain" x="${x(Math.max(low, 0))}" y="${barTop}" width="${r2(x(high) - x(Math.max(low, 0)))}" height="${barH}"/>` : '';
  const band = mark({
    tip: words.tip(low, high), value: [dollars(low), dollars(high)], hit: { x: Math.min(x(low), x(high) - 4), y: barTop, width: Math.max(x(high) - x(low), 8), height: barH },
    body: html`${lossPart}${gainPart}`,
  });

  // The range's ends over the bar, each set outward from its end (so the two never meet), kept inside the frame; $0 over
  // its tick where it clears them both.
  const [lowText, highText, zeroText] = [words.money(low), words.money(high), words.money(0)];
  const lowRight = Math.max(x(low) - 2, lowText.length * CHAR + SIDE);
  const highLeft = Math.min(x(high) + 2, width - SIDE - highText.length * CHAR);
  const zeroHalf = (zeroText.length * CHAR) / 2;
  const zeroClear = low === 0 || high === 0 ? false : lowRight + 3 < x0 - zeroHalf && x0 + zeroHalf < highLeft - 3;
  const values = html`${text({ x: lowRight, y: valueY, anchor: 'end', cls: 'chart-value chart-ruler__end', body: lowText })}${text({ x: highLeft, y: valueY, anchor: 'start', cls: 'chart-value chart-ruler__end', body: highText })}${zeroClear ? text({ x: x0, y: valueY, cls: 'chart-tick', body: zeroText }) : ''}`;

  // The walls' labels under the axis, each held to its end of the frame (the stop-loss from the left end, the stop-gain to
  // the right end), at every width, so the two sit apart under their walls; a track with no loss side says so under its
  // wall.
  const lossLabel = limits.loss > 0
    ? text({ x: SIDE, y: wallsY, anchor: 'start', cls: 'chart-tick', body: words.stopLoss(limits.loss) })
    : text({ x: x0 - 4, y: wallsY, anchor: 'end', cls: 'chart-tick', body: words.noLoss });
  const gainLabel = text({ x: width - SIDE, y: wallsY, anchor: 'end', cls: 'chart-tick', body: words.stopGain(limits.gain) });

  return frame({
    kind: 'ruler', width, height: wallsY + 5, body: html`${hatchDefs(id)}
${walls}
<line class="chart-ruler__axis" x1="${SIDE}" x2="${width - SIDE}" y1="${axisY}" y2="${axisY}"/>
${band}
<line class="chart-ruler__zero" x1="${x0}" x2="${x0}" y1="${barTop - 5}" y2="${axisY + 4}"/>
${values}
${lossLabel}${gainLabel}`,
  });
}
