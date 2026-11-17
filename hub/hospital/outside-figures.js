// The figures of a hospital's page outside Medicare's penalty programs (outside.js outsideBody's figure blocks). The
// nearest hospitals in the programs (nearBlock): for a critical access, rural emergency or unlisted acute hospital, the
// NEAREST_K nearest hospitals the dollar file estimates, on an area map beside a table of their estimated net change.
// Server-drawn; the figure script (web/client/figure.js) adds the pins' tooltips and the table's scroll box.
import { areaMap, nearestTo, NEAR_MAP_WIDTH, pointOf } from '../../web/charts/geo.js';
import { printout } from '../../web/render/components.js';
import { count, placeText } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { hospitalPathOf } from '../../web/site.js';
import { fillOutside } from './outside-copy.js';
import { signedMoney, signedShareText } from './text.js';

// Reading aids, not method constants: how many nearest hospitals a page lists, and how far the closest may be before the
// section is left out (it drops the Pacific territories, whose nearest such hospital is an ocean away, and keeps Puerto
// Rico's). The caption never names the limit.
export const NEAREST_K = 5;
export const NEAR_MAX_MILES = 250;

// The groups whose pages show the nearest hospitals: hospitals that serve the same kind of community as the ones the
// programs adjust (a federal, psychiatric or other specialty hospital's nearest acute hospitals say nothing about it).
const NEAR_GROUPS = new Set(['critical_access', 'rural_emergency', 'not_listed']);

// The class of a context dot (the same group's other hospitals) on the map.
const CONTEXT_CLS = 'hh__ctx';

// A distance in words, for the caption and a tooltip: "less than a mile" under one, "about a mile" for one when rounded,
// whole miles otherwise.
export function milesText(x) {
  if (x < 1) return fillOutside('nearMilesUnder');
  const n = Math.round(x);
  return n === 1 ? fillOutside('nearMilesAbout') : fillOutside('nearMiles', { n: count(n) });
}
// A distance in the table: whole miles, "under 1" for a hospital under a mile away (never "0").
const milesCell = (x) => (x < 1 ? fillOutside('nearUnderMile', { one: count(1) }) : count(Math.round(x)));

// The estimated hospitals with their places ({ ...h, point }), worked out once per list.
const PLACED = new WeakMap();
function placedOf(estimated) {
  if (!PLACED.has(estimated)) PLACED.set(estimated, estimated.filter((h) => h.est).map((h) => ({ ...h, point: pointOf(h) })).filter((h) => h.point));
  return PLACED.get(estimated);
}

// The caption: the closest one's distance and how many of the rows the programs cut on net, in words for none and all.
function caption(rows) {
  const k = rows.filter((r) => r.est.net < 0).length;
  const values = { miles: milesText(rows[0].miles), n: String(rows.length) };
  if (k === 0) return fillOutside('nearCaptionNone', values);
  if (k === rows.length) return fillOutside('nearCaptionAll', values);
  return fillOutside('nearCaption', { ...values, k: String(k) });
}

// The map's key: this hospital, a pin cut on net and one not, and the context dots where the map draws any.
const keyItem = (swatch, label) => html`<li><span class="${swatch}" aria-hidden="true"></span>${label}</li>`;
function key(h, withContext) {
  return html`<ul class="fig__key hh__nkey" role="list">${keyItem('fig__swatch fig__swatch--this', fillOutside('nearKeyThis'))}${keyItem('hh__nsw hh__nsw--cut', fillOutside('nearKeyCut'))}${keyItem('hh__nsw', fillOutside('nearKeyNotCut'))}${withContext ? keyItem('hh__nsw hh__nsw--ctx', fillOutside('nearKeyOther', { kinds: fillOutside(`likeCount.${h.group}`) })) : ''}</ul>`;
}

// The nearest hospitals in the programs, or '' for a hospital without a place, outside NEAR_GROUPS, or whose closest such
// hospital is over NEAR_MAX_MILES away. h: an OutsideHospital; estimated: the hub's hospitals (hubHospitals; only those
// with an estimate count); outsideSameGroup: the outside hospitals of h's group (the map's context dots; h itself is left
// out); shapes, counties: loadHub()'s; fy: the dollar estimates' fiscal year (text), as the net column names it.
export function nearBlock(h, { estimated, outsideSameGroup, shapes, counties, fy }) {
  const point = pointOf(h);
  if (!point || !NEAR_GROUPS.has(h.group)) return '';
  const rows = nearestTo(placedOf(estimated), point, { k: NEAREST_K });
  if (!rows.length || rows[0].miles > NEAR_MAX_MILES) return '';
  const cut = (r) => r.est.net < 0;
  const who = (r) => [r.name, placeText(r)].filter(Boolean).join(', ');
  const context = outsideSameGroup.filter((x) => x.ccn !== h.ccn).map((x) => ({ point: pointOf(x), cls: CONTEXT_CLS }));
  const map = areaMap({
    shapes, counties, context, width: NEAR_MAP_WIDTH,
    label: fillOutside('nearAlt', { n: String(rows.length) }),
    center: { point, tip: fillOutside('nearThis', { name: h.name }) },
    points: rows.map((r, i) => ({
      point: r.point, n: i + 1,
      // The kit's pin classes: filled in the pen ink for a cut, on paper for none.
      cls: cut(r) ? 'chart-pin--yes' : 'chart-pin--no',
      tip: fillOutside('nearTip', { n: String(i + 1), who: who(r), net: signedMoney(r.est.net), share: signedShareText(r.est.share), distance: milesText(r.miles) }),
    })),
  });
  const table = printout(html`<table class="gb gb--near" aria-labelledby="hh-near-h">
<thead><tr><th scope="col" class="num">${fillOutside('nearColRank')}</th><th scope="col">${fillOutside('nearColHospital')}</th><th scope="col" class="num">${fillOutside('nearColMiles')}</th><th scope="col" class="num">${fillOutside('nearColNet', { fy })}</th><th scope="col" class="num">${fillOutside('nearColShare')}</th></tr></thead>
<tbody>${rows.map((r, i) => html`<tr${cut(r) ? html` class="near--cut"` : ''}><td class="num"><span class="near__n">${String(i + 1)}</span></td><th scope="row"><a href="${hospitalPathOf('hub', r.ccn)}">${r.name}</a><span class="near__city">${placeText(r)}</span></th><td class="num">${milesCell(r.miles)}</td><td class="num near__cut${cut(r) ? ' near__cut--pen' : ''}">${signedMoney(r.est.net)}</td><td class="num">${signedShareText(r.est.share)}</td></tr>`)}</tbody>
</table>`);
  return html`<section class="hh__near" aria-labelledby="hh-near-h">
<div class="wrap"><div class="hh__neari">
<div class="hh__neart">
<h2 id="hh-near-h">${fillOutside('nearHeading')}</h2>
<p class="hh__nearcap">${caption(rows)}</p>
${map ? html`<figure class="fig hh__nearmap" id="hh-near-map" data-figure>
${map}
${key(h, String(map).includes(`class="${CONTEXT_CLS}"`))}
</figure>` : ''}
</div>
<div class="hh__neartab">${table}</div>
</div></div>
</section>`;
}
