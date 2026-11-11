// The Medicaid work-requirement band on a hospital's page across the programs (hub/hospital/page.js): a scenario, not a
// payment, so it sits apart from the Medicare net, under a dashed rule, and is never added to it. For a hospital with a
// loss to draw: the share of its patient revenue it could lose a year, low to high (the scenario tag beside it), a bar on
// a square-root scale every hospital's page shares, the three cases' shares, and a link to the hospital on the
// work-requirement page. For one with no loss to draw: the reason's stamp and sentence (web/medicaid/reasons.js, the
// work-requirement page's own words) and the link. For one the scenario file has no row for: no band. Server-drawn, no
// script. The numbers are the work-requirement page's at the default use rate (engine/js/medicaid/hospital.js
// hospitalScenario: the file's own middle case, the engine's low and high), unsigned, beside the word "lose".
import { hospitalScenario } from '../../engine/js/medicaid/hospital.js';
import { fillCopy, stamp } from '../../web/render/components.js';
import { pct } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { scenarioTag } from '../../web/render/shell.js';
import { reasonStamp, reasonWhy } from '../../web/medicaid/reasons.js';
import { SITE } from '../../web/site.js';
import { arrow } from '../parts.js';
import { COPY } from './copy.js';

const fill = (key, values) => fillCopy(COPY, key, values);

// ---------- the scale ----------

// The scale's top: the largest high-case share of any hospital in the file, up to the next whole percent, worked out once
// per file (medicaid: loadHub().medicaid). Every hospital's band shares it, so two pages' bars compare.
const TOPS = new WeakMap();
export function scaleTop(medicaid) {
  if (!TOPS.has(medicaid)) {
    let max = 0;
    for (const ccn of medicaid.hospitals.keys()) {
      const one = hospitalScenario(medicaid, ccn);
      if (one.shares) max = Math.max(max, one.shares[2]);
    }
    if (!(max > 0)) throw new RangeError('hub: the Medicaid scenario file has no hospital with a loss to draw');
    TOPS.set(medicaid, Math.ceil(max * 100) / 100);
  }
  return TOPS.get(medicaid);
}

// A share's place along the bar, 0 to 1, on the square-root scale (as the work-requirement page's strips draw shares), so
// the many small shares stay apart and the few large ones fit.
export const placeOf = (share, top) => Math.sqrt(Math.max(0, share) / top);

// The labeled ticks: zero, then 1, 2 and 5 times each power of ten from TICK_FROM up to the top. TICK_FROM, half a
// percent, is a reading aid (the scale's first label), not a method constant.
const TICK_FROM = 0.005;
export function scaleTicks(top) {
  const ticks = [0];
  for (let exp = -3; exp <= 0; exp += 1) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** exp;
      if (v >= TICK_FROM - 1e-12 && v <= top + 1e-12) ticks.push(v);
    }
  }
  return ticks;
}
const tickText = (v) => pct(v, v > 0 && v < 0.01 ? 1 : 0);

// ---------- the band ----------

// The drawing (aria-hidden: the words around it give every number): the ticks' rules, the base, the low-to-high band and
// the middle case's mark, on a 1,000-unit-wide box the page stretches to its column (preserveAspectRatio none, every
// stroke non-scaling), so it keeps its height and its lines' weight at any width.
const W = 1000;
const H = 28;
function bar(shares, top) {
  const x = (v) => Math.round(placeOf(v, top) * W * 10) / 10;
  const [lo, mid, hi] = shares.map(x);
  const ticks = scaleTicks(top);
  return html`<div class="hh__wbbar">
<svg class="hh__wbsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${ticks.map((t) => html`<line class="hh__wb-grid" x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}"/>`)}<line class="hh__wb-base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/><rect class="hh__wb-band" x="${lo}" y="7" width="${Math.round(Math.max(hi - lo, 0) * 10) / 10}" height="14"/><line class="hh__wb-mid" x1="${mid}" x2="${mid}" y1="2" y2="${H - 2}"/></svg>
<p class="hh__wbax" aria-hidden="true">${ticks.map((t, i) => {
    const at = placeOf(t, top);
    // The first label starts at zero and one near the top ends at its tick, so neither leaves the column; the label under
    // a percent (minor) steps aside on the narrowest phones, where it would touch the next.
    const cls = i === 0 ? html` class="hh__wbax--start"` : at > 0.94 ? html` class="hh__wbax--end"` : t < 0.01 ? html` class="hh__wbax--minor"` : '';
    return html`<span${cls} style="--x:${Math.round(at * 10000) / 10000}">${tickText(t)}</span>`;
  })}</p>
</div>`;
}

const link = (ccn) => html`<a class="hh__deep" href="${SITE.sites['work-requirement'].path}?h=${ccn}">${fill('wbLink')}${arrow}</a>`;

// The band for a hospital (h: the hub's), ending its line, or '' when the scenario file has no row for it. medicaid: loadHub().medicaid
// ({ fy, columns, hospitals, states }); net: whether the page shows a Medicare net above (its note says the band is never
// part of it).
export function medicaidBand(h, medicaid, { net }) {
  const one = hospitalScenario(medicaid, h.ccn);
  if (!one) return '';
  const fy = String(medicaid.fy);
  const body = one.reason
    ? html`<div class="hh__wbr">${stamp({ label: reasonStamp(one.reason), ink: true })}<p class="hh__why">${reasonWhy(one.reason, { stateName: one.stateName, fy })}</p></div>`
    : html`<p class="hh__wblab">${fill('wbLabel')} ${scenarioTag(fy)}</p>
<p class="hh__wbv">${fill('wbRange', { low: pct(one.shares[0], 2), high: pct(one.shares[2], 2) })}</p>
${bar(one.shares, scaleTop(medicaid))}
<ul class="hh__wbk" role="list">${['wbLow', 'wbMiddle', 'wbHigh'].map((key, i) => html`<li${i === 1 ? html` class="hh__wbk--mid"` : ''}>${fill(key, { share: pct(one.shares[i], 2) })}</li>`)}</ul>
<p class="hh__why">${fill('wbHow', { fy })}</p>`;
  return html`<section class="hh__wb" aria-labelledby="hh-wb-h" data-medicaid>
<div class="wrap"><div class="hh__wbi">
<div class="hh__wbh">
<p class="cap kicker">${fill('wbKicker')}</p>
<h2 id="hh-wb-h">${fill('wbHeading')}</h2>
<p class="hh__wbnote">${fill(net ? 'wbNote' : 'wbNoteAlone')}</p>
</div>
<div class="hh__wbb">
${body}
${link(h.ccn)}
</div>
</div></div>
</section>
`;
}
