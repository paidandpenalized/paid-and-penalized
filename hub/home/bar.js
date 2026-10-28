// The story's first chart, drawn at build time (step 0, "Scale"): one bar of the year's estimated Medicare inpatient
// pay, a dot for every hospital with an estimate, ordered by its pay (each at the middle of its own slice of the total,
// so the many small hospitals crowd the left and the few large ones spread to the right); the share the programs move
// as a red sliver at the bar's right end; and that sliver magnified, split into what is not paid and what moves to other
// hospitals as bonuses. The drawing is graphics only, in viewBox units; its words are the figure's HTML around it, so
// they keep their size at every width. The story's script repaints the same layout on its canvas (barHash, barOrder).
import { dotsPath } from '../../web/charts/dots.js';
import { fillCopy } from '../../web/render/components.js';
import { count, money, pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { COPY } from './copy.js';

// The drawing's frame, in viewBox units: its width, the bar's top and height, the dots' inset from its ends and edges
// and their diameter, how far the sliver reaches past the bar, the gap the magnifier's lines cross, and the split bar's
// height.
const W = 600;
const BAR_Y = 6;
const BAR_H = 60;
const INSET_X = 3;
const INSET_Y = 4;
const DOT = 2.1;
const SLIVER_OUT = 5;
const SLIVER_MIN = 2;
const GAP = 70;
const SPLIT_H = 26;
const SPLIT_GAP = 1;
const H = BAR_Y + BAR_H + GAP + SPLIT_H + 2;
// How many times the sliver is magnified: the split bar is the sliver this many times wider.
export const MAGNIFY = 100;

const r1 = (v) => Math.round(v * 10) / 10;
// A share of the drawing's width or height, to four places (a style property's number).
const frac = (v) => Math.round(v * 1e4) / 1e4;
const fill = (key, values) => fillCopy(COPY, key, values);

// A stable spread in [0, 1) for a hospital's row in the hub asset (its index in the dollar file's order): the height of
// its dot in the bar. An integer hash (multiply, xor-shift), the same in the build and the browser.
export function barHash(i) {
  let x = ((i + 1) * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

// Each hospital with an estimate as { i, mid }: i its index in `hospitals` (the hub asset's row), mid the middle of its
// slice of the total pay, from 0 to 1, in order of pay (smallest first, the dollar file's order on a tie).
export function barOrder(hospitals) {
  const rows = hospitals.map((h, i) => ({ i, pay: h.est?.total })).filter((r) => r.pay !== undefined)
    .sort((a, b) => a.pay - b.pay || a.i - b.i);
  const total = rows.reduce((sum, r) => sum + r.pay, 0);
  let before = 0;
  return rows.map(({ i, pay }) => {
    const mid = (before + pay / 2) / total;
    before += pay;
    return { i, mid };
  });
}

// The drawing, graphics only: the bar's frame, the dots, the sliver, the magnifier's dashed lines and the split bar.
// dots: [[x, y]]; sliver: its width; mx0: the split's left edge; red: the not-paid part's width; label: its name.
function drawing({ dots, sliver, mx0, red, label }) {
  const drawn = Math.max(SLIVER_MIN, sliver);
  const splitY = BAR_Y + BAR_H + GAP;
  const lineTop = BAR_Y + BAR_H + SLIVER_OUT + 1;
  const marks = [
    html`<rect class="sbar__frame" x="0.5" y="${BAR_Y + 0.5}" width="${W - 1}" height="${BAR_H - 1}"/>`,
    dotsPath(dots, 'chart-dots--ink', DOT),
    html`<rect class="sbar__sliver" x="${r1(W - drawn)}" y="${BAR_Y - SLIVER_OUT}" width="${r1(drawn)}" height="${BAR_H + 2 * SLIVER_OUT}"/>`,
    html`<path class="sbar__mag" d="M${r1(W - sliver)} ${lineTop}L${r1(mx0)} ${splitY - 2}M${W - 0.5} ${lineTop}V${splitY - 2}"/>`,
    html`<rect class="sbar__np" x="${r1(mx0)}" y="${splitY}" width="${r1(red - SPLIT_GAP)}" height="${SPLIT_H}"/>`,
    html`<rect class="sbar__bo" x="${r1(mx0 + red + SPLIT_GAP)}" y="${splitY}" width="${r1(W - mx0 - red - SPLIT_GAP)}" height="${SPLIT_H}"/>`,
  ];
  return html`<svg class="sbar__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" focusable="false">${marks}</svg>`;
}

// The figure: its caption, the pay and what the programs move over the bar, the drawing (an image whose label is the
// takeaway), the magnification beside the split, the two parts' dollars and words under it. hospitals: the hub's list
// (hubHospitals); facts: storyFacts of it; fy: the fiscal year.
export function barFigure({ hospitals, facts, fy }) {
  const share = facts.gross / facts.pay;
  if (!(share > 0 && share * MAGNIFY <= 1)) throw new RangeError(`hub home: the programs move ${share} of pay, which the bar cannot magnify ${MAGNIFY} times`);
  const dots = barOrder(hospitals).map(({ i, mid }) => [INSET_X + mid * (W - 2 * INSET_X), BAR_Y + INSET_Y + barHash(i) * (BAR_H - 2 * INSET_Y)]);
  const sliver = W * share;
  const mx0 = W - sliver * MAGNIFY;
  const red = sliver * MAGNIFY * (facts.notPaid / facts.gross);
  const words = {
    fy: String(fy), n: count(facts.n), pay: money(facts.pay), gross: money(facts.gross), share: pct(share, 2),
    notPaid: money(facts.notPaid), bonus: money(facts.vbpBonus), times: count(MAGNIFY),
  };
  // The split's left edge and the middle of its height, as shares of the drawing's width and height: the HTML labels
  // beside and under it sit there at any width.
  const at = `--mx:${frac(mx0 / W)};--my:${frac((BAR_Y + BAR_H + GAP + SPLIT_H / 2) / H)}`;
  return html`<figure class="sbar">
<figcaption class="sbar__cap">${fill('barCaption', { fy: words.fy, n: words.n })}</figcaption>
<p class="sbar__top"><span class="sbar__pay">${words.pay}</span> <span class="sbar__moved"><span class="sbar__mv">${fill('barMoved', { gross: words.gross, share: words.share })}</span> <span class="sbar__by">${COPY.barMovedBy}</span></span></p>
<div class="sbar__draw" style="${at}">${drawing({ dots, sliver, mx0, red, label: fill('barLabel', words) })}<span class="sbar__x" aria-hidden="true">${fill('barTimes', { times: words.times })}</span></div>
<div class="sbar__split" style="${at}"><p class="sbar__part"><b class="sbar__v sbar__v--pen">${words.notPaid}</b> ${COPY.barNotPaid}</p><p class="sbar__part sbar__part--end"><b class="sbar__v">${words.bonus}</b> ${COPY.barBonus}</p></div>
</figure>`;
}
