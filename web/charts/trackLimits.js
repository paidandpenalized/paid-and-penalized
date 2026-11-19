// The tracks' limits (TEAM's Figure 2): for each track, the most a hospital can be paid (a bar up from one zero line) and
// the most it can owe (a bar down), as shares of its yearly target amount, on one scale, so a track twice as wide draws
// twice as tall. A track with no loss side draws no bar there and says so in the caller's words. Pure: an SVG string
// for the build and the browser alike; colors come from classes in the site's stylesheet.
//   tracks  { [key]: { gain, loss } } shares (0.2 is 20%), in the order to draw; loss 0: no loss side
//   words   { name(key), sub: { [key]: text }, gain(x), loss(x) (a limit's label), none (the no-loss label),
//             tip(key, 'gain' | 'loss', x) (a bar's tooltip), axis(x) (a gridline's label) }
//   width   the viewBox's width (the kit's WIDTH on a phone, a wider one beside the words)
// Each bar is a mark whose value is its limit in percent (20 for 0.2), as trackRows tables it.
import { html } from '../render/html.js';
import { frame, isNarrow, mark, r2, text } from './svg.js';

// The limit's value as a mark and its table carry it: percent, to two decimals at most.
const pctValue = (x) => Math.round(x * 10000) / 100;

export function trackLimits({ tracks, words, width }) {
  const keys = Object.keys(tracks);
  if (!keys.length) throw new RangeError('trackLimits: no tracks');
  for (const k of keys) {
    const { gain, loss } = tracks[k];
    if (!(gain > 0) || !(loss >= 0)) throw new RangeError(`trackLimits: track ${k} needs a gain above 0 and a loss of 0 or more`);
  }
  const narrow = isNarrow(width);
  const left = narrow ? 30 : 40;
  // A phone's columns are narrow: a sub with a comma takes two lines.
  const subLines = (k) => (narrow ? words.sub[k].split(/(?<=,) /) : [words.sub[k]]);
  const top = Math.max(...keys.map((k) => subLines(k).length)) > 1 ? 56 : 44;
  const half = narrow ? 70 : 92;
  const zero = top + half;
  const bottom = zero + half;
  const max = Math.max(...keys.map((k) => Math.max(tracks[k].gain, tracks[k].loss)));
  const y = (v) => r2(zero - (v / max) * half);
  const slot = (width - left) / keys.length;
  const barW = Math.min(narrow ? 30 : 52, slot * 0.42);
  const grid = [max / 2, max].flatMap((v) => [v, -v]);
  const gridLines = grid.map((v) => html`<line class="chart-grid" x1="${left}" x2="${width}" y1="${y(v)}" y2="${y(v)}"/>${text({ x: left - 5, y: y(v) + 4, anchor: 'end', cls: 'chart-tick', body: v > 0 ? `+${words.axis(v)}` : `−${words.axis(-v)}` })}`);
  const columns = keys.map((k, i) => {
    const { gain, loss } = tracks[k];
    const x = r2(left + i * slot + (narrow ? 6 : 10));
    const labelX = x + barW + 4;
    const bar = (side, v) => {
      const y0 = side === 'gain' ? y(v) : zero;
      const h = r2(Math.abs(y(v) - zero));
      return mark({
        tip: words.tip(k, side, v), value: pctValue(v), hit: { x, y: y0, width: barW, height: Math.max(h, 8) },
        body: html`<rect class="chart-tracks__${side}" x="${x}" y="${y0}" width="${r2(barW)}" height="${h}"/>${text({ x: labelX, y: side === 'gain' ? y(v) + 11 : y(-v) - 3, anchor: 'start', cls: 'chart-value', body: words[side](v) })}`,
      });
    };
    return html`${text({ x, y: 14, anchor: 'start', cls: 'chart-label', body: words.name(k) })}${subLines(k).map((line, j) => text({ x, y: 29 + j * 12, anchor: 'start', cls: 'chart-tick', body: line }))}
${bar('gain', gain)}
${loss > 0 ? bar('loss', loss) : text({ x, y: zero + 15, anchor: 'start', cls: 'chart-tick', body: words.none })}
`;
  });
  return frame({
    kind: 'tracks', width, height: bottom + 6, body: html`${gridLines}
<line class="chart-zero" x1="${left}" x2="${width}" y1="${zero}" y2="${zero}"/>${text({ x: left - 5, y: zero + 4, anchor: 'end', cls: 'chart-tick', body: '0' })}
${columns}`,
  });
}

// The figure's table rows for these tracks: [name, sub, the most it can be paid, the most it can owe], the two limits as
// numeric cells whose values are trackLimits' marks' (a track with no loss side: `none`, value 0). words: { name(key),
// sub: { [key]: text }, pct(x) (a limit's text), none }.
export const trackRows = (tracks, words) => Object.entries(tracks).map(([k, { gain, loss }]) => [
  words.name(k),
  words.sub[k],
  { text: words.pct(gain), value: String(pctValue(gain)) },
  loss > 0 ? { text: words.pct(loss), value: String(pctValue(loss)) } : { text: words.none, value: '0' },
]);
