// The Medicaid work-requirement band on a hospital's page across the programs (hub/hospital/page.js): a scenario, not a
// payment, so it sits apart from the Medicare net, under a dashed rule, and is never added to it. For a hospital with a
// loss to draw: the share of its patient revenue it could lose a year, low to high (the scenario tag beside it), a bar on
// a square-root scale every hospital's page shares, the three cases' shares, and a link to the hospital on the
// work-requirement page. For one with no loss to draw: the reason's stamp and sentence (web/medicaid/reasons.js, the
// work-requirement page's own words) and the link. For one the scenario file has no row for: no band. Server-drawn, no
// script. The numbers are the work-requirement page's at the default use rate (engine/js/medicaid/hospital.js
// hospitalScenario: the file's own middle case, the engine's low and high), unsigned, beside the word "lose": the shares,
// and under their range the same cases' dollars, low to high, the middle case's beside its share, each as step 4 prints
// it (web/medicaid/format.js).
import { hospitalScenario } from '../../engine/js/medicaid/hospital.js';
import { fillCopy, stamp } from '../../web/render/components.js';
import { pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { r1 } from '../../web/charts/svg.js';
import { scenarioTag } from '../../web/render/shell.js';
import { printedLost, printedShares } from '../../web/medicaid/format.js';
import { reasonStamp, reasonWhy } from '../../web/medicaid/reasons.js';
import { SITE } from '../../web/site.js';
import { arrow } from '../parts.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// ---------- the scale ----------

// Every hospital of the file as hospitalScenario gives it, by CCN, and the scale's top: the largest high-case share of any
// of them, up to the next whole percent. Worked out once per file (medicaid: loadHub().medicaid); every hospital's band
// shares the top, so two pages' bars compare.
const FILES = new WeakMap();
function fileOf(medicaid) {
  if (!FILES.has(medicaid)) {
    const byCcn = new Map();
    let max = 0;
    for (const ccn of medicaid.hospitals.keys()) {
      const one = hospitalScenario(medicaid, ccn);
      byCcn.set(ccn, one);
      if (one.shares) max = Math.max(max, one.shares[2]);
    }
    if (!(max > 0)) throw new RangeError('hub: the Medicaid scenario file has no hospital with a loss to draw');
    // A share of patient revenue lost is at most all of it, so the top is at most 100% and scaleTicks's decades reach it.
    if (max > 1) throw new RangeError(`hub: a Medicaid scenario share of patient revenue over 100% (${max})`);
    FILES.set(medicaid, { byCcn, top: Math.ceil(max * 100) / 100 });
  }
  return FILES.get(medicaid);
}
export const scaleTop = (medicaid) => fileOf(medicaid).top;

// A share's place along the bar, 0 to 1, on the square-root scale (as the work-requirement page's strips draw shares), so
// the many small shares stay apart and the few large ones fit.
export const placeOf = (share, top) => Math.sqrt(Math.max(0, share) / top);

// The labeled ticks: zero, then 1, 2 and 5 times each power of ten from half a percent (a reading aid, the scale's first
// label, not a method constant) up to the top. They reach 100%, the most a share can be (scaleTop throws past it), so
// they cover any top; a top outside them throws.
const TICKS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
export function scaleTicks(top) {
  if (!(top > TICKS[0] && top <= 1)) throw new RangeError(`hub: a Medicaid scale top of ${top} is outside the ticks' decades`);
  return [0, ...TICKS.filter((v) => v <= top + 1e-12)];
}
const tickText = (v) => pct(v, v > 0 && v < 0.01 ? 1 : 0);

// ---------- the band ----------

// The drawing (aria-hidden: the words around it give every number): the ticks' rules, the base, the low-to-high range and
// the middle case's mark, on a 1,000-unit-wide box the page stretches to its column (preserveAspectRatio none, every
// stroke non-scaling), so it keeps its height and its lines' weight at any width. A range narrower than MIN_W (a few
// pixels on a phone) draws MIN_W wide about its centre, so the smallest shares still show a range around their mark; then
// the square-root scale's caption.
const W = 1000;
const H = 28;
const MIN_W = 12;
export function rangeBox(lo, hi) {
  if (hi - lo >= MIN_W) return { x: r1(lo), width: r1(hi - lo) };
  const x = Math.min(Math.max(0, (lo + hi) / 2 - MIN_W / 2), W - MIN_W);
  return { x: r1(x), width: MIN_W };
}
function bar(shares, top) {
  const x = (v) => r1(placeOf(v, top) * W);
  const [lo, mid, hi] = shares.map(x);
  const box = rangeBox(lo, hi);
  const ticks = scaleTicks(top);
  return html`<div class="hh__wbbar">
<svg class="hh__wbsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${ticks.map((t) => html`<line class="hh__wb-grid" x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}"/>`)}<line class="hh__wb-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="hh__wb-band" x="${box.x}" y="7" width="${box.width}" height="14"/><line class="hh__wb-mid" x1="${mid}" x2="${mid}" y1="2" y2="${H - 2}"/></svg>
<p class="hh__wbax" aria-hidden="true">${ticks.map((t, i) => {
    const at = placeOf(t, top);
    // The first label starts at zero and one near the top ends at its tick, so neither leaves the column; the label under
    // a percent (minor) steps aside on the narrowest phones, where it would touch the next.
    const cls = i === 0 ? html` class="hh__wbax--start"` : at > 0.94 ? html` class="hh__wbax--end"` : t < 0.01 ? html` class="hh__wbax--minor"` : '';
    return html`<span${cls} style="--x:${Math.round(at * 10000) / 10000}">${tickText(t)}</span>`;
  })}</p>
<p class="hh__wbscale">${fill('wbScale')}</p>
</div>`;
}

// The link to the hospital on the work-requirement page (its ?h= opens on it): the band's last line, and one of the program
// pages a page outside the penalty programs lists (outside.js).
export const wbLink = (ccn) => html`<a class="hh__deep" href="${SITE.sites['work-requirement'].path}?h=${ccn}">${fill('wbLink')}${arrow}</a>`;

// The band for a hospital (h: the hub's), ending its line, or '' with no row for it in the scenario file (the page is then
// exactly as it was before the band). medicaid: loadHub().medicaid ({ fy, columns, hospitals, states }), required: loadHub
// always reads the scenario file (the shell's facts need it too); net: whether the page shows a Medicare net above (its
// note says the band is never part of it); note: a dek (already filled) that replaces the default over a loss to draw
// (a row with a reason keeps the reason's dek, since the requirement may not reach that hospital at all). The shares print
// as the work-requirement page prints them (web/medicaid/format.js); the headline is their range, or, too small to print
// as two numbers, its bound.
export function medicaidBand(h, medicaid, { net, note = null }) {
  const { byCcn, top } = fileOf(medicaid);
  const one = byCcn.get(h.ccn);
  if (!one) return '';
  const fy = String(medicaid.fy);
  const { texts, range } = one.shares ? printedShares(one.shares) : {};
  const lost = one.lost && printedLost(one.lost);
  const caseText = (key, i) => (i === 1 && lost ? fill('wbMiddleLost', { share: texts[i], lost: lost[i] }) : fill(key, { share: texts[i] }));
  const body = one.reason
    ? html`<div class="hh__wbr">${stamp({ label: reasonStamp(one.reason), ink: true })}<p class="hh__why">${reasonWhy(one.reason, { stateName: one.stateName, fy })}</p></div>`
    : html`<p class="hh__wblab">${fill('wbLabel')} ${scenarioTag(fy)}</p>
<p class="hh__wbv">${range.under ?? fill('wbRange', { low: range.low, high: range.high })}</p>
${lost ? html`<p class="hh__wbd">${fill('wbDollars', { low: lost[0], high: lost[2], fy })}</p>` : ''}
${bar(one.shares, top)}
<ul class="hh__wbk" role="list">${['wbLow', 'wbMiddle', 'wbHigh'].map((key, i) => html`<li${i === 1 ? html` class="hh__wbk--mid"` : ''}>${caseText(key, i)}</li>`)}</ul>
<p class="hh__why">${fill('wbHow', { fy })}</p>`;
  return html`<section class="hh__wb" aria-labelledby="hh-wb-h" data-medicaid>
<div class="wrap"><div class="hh__wbi">
<div class="hh__wbh">
<p class="cap kicker">${fill('wbKicker')}</p>
<h2 id="hh-wb-h">${fill('wbHeading')}</h2>
<p class="hh__wbnote">${note && !one.reason ? note : fill(`${one.reason ? 'wbNoteReason' : 'wbNote'}${net ? '' : 'Alone'}`)}</p>
</div>
<div class="hh__wbb">
${body}
${wbLink(h.ccn)}
</div>
</div></div>
</section>
`;
}
