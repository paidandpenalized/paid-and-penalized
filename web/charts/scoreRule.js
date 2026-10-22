// The score rule: a page's bold rule drawn as every hospital's score, lowest to highest. The rule is zero; each
// hospital is one hairline across the page's width, rising above the rule for a score above zero and hanging under
// it for one below, so the sorted scores make one silhouette. Those at or past the line are in the penalty ink. The
// silhouette is two filled shapes (thinned to about one point per THIN units), not a line per hospital, so it stays
// small at any count; a page script maps a pointer's x back to the hospital under it (ruleRank).
//   scores   sorted ascending; cut: how many at the high end are past the line
//   labels   { low, high, line, cut } (text): the ends' captions, the line's name and the cut side's count
//   highlight  optional ranks to draw as ticks through the rule (a place's hospitals among the nation's)
import { html } from '../render/html.js';
import { frame, r2, text } from './svg.js';

const M = { left: 0, right: 0, top: 22, bottom: 20 };
const THIN = 1.5;

// The x of rank i (0-based) of n across [left, right]: the middle of its slot.
export const ruleX = (i, n, width) => M.left + ((i + 0.5) * (width - M.left - M.right)) / n;
// The rank under an x, clamped to the list.
export const ruleRank = (x, n, width) => Math.max(0, Math.min(n - 1, Math.floor(((x - M.left) / (width - M.left - M.right)) * n)));

export function scoreRule({ scores, cut, labels, width, up = 72, down = 46, highlight = null }) {
  const n = scores.length;
  if (!n || cut < 0 || cut > n) throw new RangeError('scoreRule: scores, and a cut count within them');
  const hi = Math.max(scores[n - 1], 0);
  const lo = Math.min(scores[0], 0);
  const k = Math.min(hi > 0 ? up / hi : Infinity, lo < 0 ? down / -lo : Infinity);
  const zero = M.top + up;
  const y = (s) => r2(zero - s * k);
  // One silhouette from rank a to rank b (exclusive): along the scores, then back along zero.
  const shape = (a, b) => {
    if (b <= a) return '';
    const pts = [];
    let last = -Infinity;
    for (let i = a; i < b; i++) {
      const x = ruleX(i, n, width);
      if (i === a || i === b - 1 || x - last >= THIN) {
        pts.push(`${r2(x)} ${y(scores[i])}`);
        last = x;
      }
    }
    const x0 = r2(ruleX(a, n, width) - (width - M.left - M.right) / n / 2);
    const x1 = r2(ruleX(b - 1, n, width) + (width - M.left - M.right) / n / 2);
    return `M${x0} ${r2(zero)}L${x0} ${pts[0].split(' ')[1]}L${pts.join('L')}L${x1} ${pts[pts.length - 1].split(' ')[1]}L${x1} ${r2(zero)}Z`;
  };
  const split = n - cut;
  const lineX = r2(split < n ? ruleX(split, n, width) - (width - M.left - M.right) / n / 2 : width);
  const height = zero + down + M.bottom;
  // A highlighted hospital: its own hairline in ink, from the rule to its score, and a short tick under the rule so
  // one with a score near zero still shows.
  const tick = (i) => `M${r2(ruleX(i, n, width))} ${r2(zero)}V${y(scores[i])}M${r2(ruleX(i, n, width))} ${r2(zero + 4)}v8`;
  const ticks = highlight ? highlight.filter((i) => i < n - cut).map(tick).join('') : '';
  const penTicks = highlight ? highlight.filter((i) => i >= n - cut).map(tick).join('') : '';
  return frame({
    kind: 'score-rule', width, height, body: html`<path class="chart-rule__ink" d="${shape(0, split)}"/>
<path class="chart-rule__pen" d="${shape(split, n)}"/>
<rect class="chart-rule__bar" x="0" y="${r2(zero - 2.5)}" width="${width}" height="5"/>
${ticks ? html`<path class="chart-rule__hl" d="${ticks}"/>` : ''}${penTicks ? html`<path class="chart-rule__hl chart-rule__hl--pen" d="${penTicks}"/>` : ''}
<line class="chart-rule__line" x1="${lineX}" x2="${lineX}" y1="${M.top - 16}" y2="${r2(zero + down)}"/>
${text({ x: 0, y: height - 4, anchor: 'start', cls: 'chart-cap', body: labels.low })}
${text({ x: width, y: height - 4, anchor: 'end', cls: 'chart-cap', body: labels.high })}
${text({ x: lineX - 6, y: M.top - 8, anchor: 'end', cls: 'chart-cap', body: labels.line })}
${text({ x: lineX + 6, y: M.top - 8, anchor: 'start', cls: 'chart-cap chart-cap--pen', body: labels.cut })}`,
  });
}
