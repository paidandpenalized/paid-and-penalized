// The figures of a hospital's page outside Medicare's penalty programs (outside.js outsideBody's figure blocks). The
// nearest hospitals in the programs (nearBlock): for a critical access, rural emergency or unlisted acute hospital, up to
// NEAREST_K of the nearest hospitals the dollar file estimates within NEAR_MAX_MILES, on an area map beside a table of
// their estimated net change. Server-drawn; the figure script (web/client/figure.js) adds the pins' tooltips, their keys
// and the table's scroll box. The hospitals like this one (likeBlock), on every page: how many of its group Medicare's
// hospital list holds, nationally and in its state, beside a US map of them with this one marked (static: no script).
// Both read one context, worked out once per build (outsideFigureContext).
import { STATE_NAMES } from '../../engine/js/states.js';
import { keysHintFor } from '../../web/charts/figure.js';
import { areaMap, nearestTo, NEAR_MAP_WIDTH, pointOf, US_MAP_CODES, usPaths, usPoints, usProjected } from '../../web/charts/geo.js';
import { fillAround, printout } from '../../web/render/components.js';
import { count, placeText } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { milesCell, milesText } from '../../web/render/miles.js';
import { hospitalPathOf } from '../../web/site.js';
import { MAP_WIDTH } from '../asset.js';
import { fillOutside, hasOutside } from './outside-copy.js';
import { signedMoney, signedShareText } from './text.js';

// Reading aids, not method constants: how many nearest hospitals a page lists at most, and how far one may be to be
// listed (so the section leaves out the territories, whose nearest such hospital is an ocean away: on today's files that
// includes Puerto Rico, since the dollar file estimates no Puerto Rico hospital). The caption never names the limit.
export const NEAREST_K = 5;
export const NEAR_MAX_MILES = 250;

// The groups whose pages show the nearest hospitals: hospitals that serve the same kind of community as the ones the
// programs adjust (a federal, psychiatric or other specialty hospital's nearest acute hospitals say nothing about it).
const NEAR_GROUPS = new Set(['critical_access', 'rural_emergency', 'not_listed']);

// The class of a context dot (the same group's other hospitals) on the nearest map.
const CONTEXT_CLS = 'hh__ctx';
// The nearest map's figure id (its keyboard hint is <id>-keys).
const NEAR_FIG_ID = 'hh-near-map';

// Hospitals like this one: the US map's dots for the group's hospitals (their class and diameter, in viewBox units at
// MAP_WIDTH, the home map's frame), and this hospital as a dot in the pen ink inside a ring (radii, the same units).
const LIKE_DOT = 'hh__likedot';
const LIKE_DOT_D = 4.4;
const ME_R = 5;
const RING_R = 11;

// A group's noun ("critical access hospitals"): the unlisted acute group's names the hospital-acquired conditions file's
// year, the one thing true of all its hospitals. years: { hacrpFy, hrrpFy }, as text.
const kindsOf = (group, years) => fillOutside(`likeCount.${group}`, group === 'not_listed' ? { hacrpFy: years.hacrpFy } : {});

// Everything the two figures read that is the same for every page, worked out once per build:
//   estimated  the hospitals the dollar file estimates, each with its place ({ ...h, point }), those without one left out
//   groups     each group's { counts (likeCounts' entry), kinds (its noun), context (its hospitals' places, for the
//              nearest map's dots: { ccn, point, cls }), like ({ height, body }: the US map's land and the group's dots,
//              each page's own among them, under the ring the page draws) }
//   shapes, counties, years ({ hacrpFy, hrrpFy }, text), fy (the dollar estimates' fiscal year, text)
// hospitals: the hub's (hubHospitals); outside: hubModel().outside; likeCounts: hubModel().likeCounts, which must count
// the same hospitals; shapes, counties: loadHub()'s; programYears: the master's { hacrp, hrrp }; fy: the dollar file's year.
export function outsideFigureContext({ hospitals, outside, likeCounts, shapes, counties, programYears, fy }) {
  if (!Number.isInteger(programYears?.hacrp) || !Number.isInteger(programYears?.hrrp)) throw new TypeError('outside: the figures need the master\'s HACRP and HRRP years');
  const years = { hacrpFy: String(programYears.hacrp), hrrpFy: String(programYears.hrrp) };
  const estimated = hospitals.filter((h) => h.est).map((h) => ({ ...h, point: pointOf(h) })).filter((h) => h.point);
  const members = new Map();
  for (const h of outside) {
    if (!members.has(h.group)) members.set(h.group, []);
    members.get(h.group).push(h);
  }
  const { height, paths } = usPaths(shapes, MAP_WIDTH);
  const land = html`<g class="chart-land"><path d="${US_MAP_CODES.map((code) => paths.get(code)).filter(Boolean).join('')}"/></g>`;
  const groups = new Map();
  for (const [group, list] of members) {
    const counts = likeCounts.get(group);
    if (counts?.n !== list.length) throw new RangeError(`outside: the counts of group ${group} are not its hospitals'`);
    const dots = usPoints({ shapes, points: list.map((o) => ({ point: pointOf(o), cls: LIKE_DOT })), sizes: { [LIKE_DOT]: LIKE_DOT_D }, width: MAP_WIDTH });
    groups.set(group, {
      counts,
      kinds: kindsOf(group, years),
      context: list.map((o) => ({ ccn: o.ccn, point: pointOf(o), cls: CONTEXT_CLS })).filter((c) => c.point),
      like: { height, body: html`${land}${dots}` },
    });
  }
  if (groups.size !== likeCounts.size) throw new RangeError('outside: the counts hold a group with no hospitals');
  return Object.freeze({ estimated, groups, shapes, counties, years, fy: String(fy) });
}
const groupOf = (ctx, h) => {
  const g = ctx.groups.get(h.group);
  if (!g) throw new RangeError(`outside: no figures context for group ${h.group}`);
  return g;
};

// The caption: the closest one's distance and how many of the rows the programs cut on net, in words for none and all,
// and in words of its own for a table of one.
function caption(rows) {
  const k = rows.filter((r) => r.est.net < 0).length;
  const miles = milesText(rows[0].miles);
  if (rows.length === 1) return fillOutside(k ? 'nearCaptionOneCut' : 'nearCaptionOneNotCut', { miles });
  const values = { miles, n: String(rows.length) };
  if (k === 0) return fillOutside('nearCaptionNone', values);
  if (k === rows.length) return fillOutside('nearCaptionAll', values);
  return fillOutside('nearCaption', { ...values, k: String(k) });
}

// A map's key: a list of items, each a swatch class and its words.
const keyItem = (swatch, label) => html`<li><span class="${swatch}" aria-hidden="true"></span>${label}</li>`;
const keyList = (cls, items) => html`<ul class="fig__key ${cls}" role="list">${items.map(([swatch, label]) => keyItem(swatch, label))}</ul>`;
// The nearest map's key: this hospital, a pin cut on net and one not, and the context dots where the map draws any.
function key(kinds, withContext) {
  return keyList('hh__nkey', [
    ['fig__swatch fig__swatch--this', fillOutside('nearKeyThis')],
    ['hh__nsw hh__nsw--cut', fillOutside('nearKeyCut')],
    ['hh__nsw', fillOutside('nearKeyNotCut')],
    ...(withContext ? [['hh__nsw hh__nsw--ctx', fillOutside('nearKeyOther', { kinds })]] : []),
  ]);
}

// The nearest hospitals in the programs, or '' for a hospital without a place, outside NEAR_GROUPS, or with no estimated
// hospital within NEAR_MAX_MILES. The rows: up to NEAREST_K of the nearest, only those within NEAR_MAX_MILES. The map
// needs two (web/charts/geo.js areaMap), so a table of one stands alone. h: an OutsideHospital; ctx:
// outsideFigureContext's.
export function nearBlock(h, ctx) {
  const point = pointOf(h);
  if (!point || !NEAR_GROUPS.has(h.group)) return '';
  const rows = nearestTo(ctx.estimated, point, { k: NEAREST_K }).filter((r) => r.miles <= NEAR_MAX_MILES);
  if (!rows.length) return '';
  const g = groupOf(ctx, h);
  const cut = (r) => r.est.net < 0;
  const who = (r) => [r.name, placeText(r)].filter(Boolean).join(', ');
  const map = areaMap({
    shapes: ctx.shapes, counties: ctx.counties, context: g.context.filter((x) => x.ccn !== h.ccn), width: NEAR_MAP_WIDTH,
    label: fillOutside('nearAlt'),
    center: { point, tip: fillOutside('nearThis', { name: h.name }) },
    points: rows.map((r, i) => ({
      point: r.point, n: i + 1,
      // The kit's pin classes: filled in the pen ink for a cut, on paper for none.
      cls: cut(r) ? 'chart-pin--yes' : 'chart-pin--no',
      tip: fillOutside('nearTip', { n: String(i + 1), who: who(r), net: signedMoney(r.est.net), share: signedShareText(r.est.share), distance: milesText(r.miles) }),
    })),
  });
  // The kit's table (web/styles/charts.css .gb--near), as HACRP's: a cut's row is near--yes, its number in the pen ink.
  const table = printout(html`<table class="gb gb--near" aria-labelledby="hh-near-h">
<thead><tr><th scope="col" class="num">${fillOutside('nearColRank')}</th><th scope="col">${fillOutside('nearColHospital')}</th><th scope="col" class="num">${fillOutside('nearColMiles')}</th><th scope="col" class="num">${fillOutside('nearColNet', { fy: ctx.fy })}</th><th scope="col" class="num">${fillOutside('nearColShare')}</th></tr></thead>
<tbody>${rows.map((r, i) => html`<tr${cut(r) ? html` class="near--yes"` : ''}><td class="num"><span class="near__n">${String(i + 1)}</span></td><th scope="row"><a href="${hospitalPathOf('hub', r.ccn)}">${r.name}</a><span class="near__city">${placeText(r)}</span></th><td class="num">${milesCell(r.miles)}</td><td class="num near__cut${cut(r) ? ' near__cut--pen' : ''}">${signedMoney(r.est.net)}</td><td class="num">${signedShareText(r.est.share)}</td></tr>`)}</tbody>
</table>`);
  return html`<section class="hh__near" aria-labelledby="hh-near-h">
<div class="wrap"><div class="hh__neari">
<div class="hh__neart">
<h2 id="hh-near-h">${fillOutside('nearHeading')}</h2>
<p class="hh__nearcap">${caption(rows)}</p>
${map ? html`<figure class="fig hh__nearmap" id="${NEAR_FIG_ID}" data-figure>
${map}
${key(g.kinds, map.contextDrawn > 0)}
</figure>
${keysHintFor(NEAR_FIG_ID, fillOutside('nearKeys'))}` : ''}
</div>
<div class="hh__neartab">${table}</div>
</div></div>
</section>`;
}

// The sentence under the heading: the group's national count (the big figure, h.group's count on Medicare's hospital
// list), the count in h's state where STATE_NAMES names it, and what the programs do about them. An unlisted acute
// hospital's says only what CMS's Readmissions file lists ({k}: c.listed, those it lists), never that the programs
// adjust none of them. kinds: the group's noun; years: { hacrpFy, hrrpFy }, as text.
function likeSentence(h, c, kinds, years) {
  const state = STATE_NAMES[h.state];
  const values = { kinds, ...(state ? { ns: count(c.byState.get(h.state)), state } : {}) };
  let key = state ? 'likeText' : 'likeTextNoState';
  if (h.group === 'not_listed') {
    key = `likeTextNotListed${c.listed ? 'Some' : ''}${state ? '' : 'NoState'}`;
    Object.assign(values, { hrrpFy: years.hrrpFy }, c.listed ? { k: count(c.listed) } : {});
  }
  return fillAround((marks) => fillOutside(key, { ...values, ...marks }), { n: html`<span class="hh__likek">${count(c.n)}</span>` });
}

// The US map: every state's outline over the land (the home map's projection and shapes, at its width), the group's
// hospitals as faint dots, and h ringed in the pen ink. null where the projection has no place for h (a territory
// with no inset, Puerto Rico included, or no coordinates): the page then shows the text alone.
function likeMap(h, { like }, shapes, label) {
  const [at] = usProjected(shapes, [pointOf(h)], MAP_WIDTH);
  if (!at) return null;
  const [x, y] = at;
  return html`<svg class="chart chart--like-map" viewBox="0 0 ${MAP_WIDTH} ${like.height}" width="100%" role="img" aria-label="${label}" focusable="false" style="--vb: ${MAP_WIDTH}">${like.body}<circle class="hh__likering" cx="${x}" cy="${y}" r="${RING_R}"/><circle class="hh__likeme" cx="${x}" cy="${y}" r="${ME_R}"/></svg>`;
}

// Hospitals like this one, on every outside page. h: an OutsideHospital; ctx: outsideFigureContext's.
export function likeBlock(h, ctx) {
  const g = groupOf(ctx, h);
  const map = likeMap(h, g, ctx.shapes, fillOutside('likeAlt', { kinds: g.kinds }));
  const own = `own.${h.group}`;
  return html`<section class="hh__like" aria-labelledby="hh-like-h">
<div class="wrap"><div class="hh__likei">
<div class="hh__liket">
<h2 id="hh-like-h">${fillOutside('likeHeading')}</h2>
<p class="hh__likes">${likeSentence(h, g.counts, g.kinds, ctx.years)}</p>
${hasOutside(own) ? html`<p class="hh__likeown">${fillOutside(own)}</p>` : ''}
</div>
${map ? html`<figure class="fig hh__likemap">
${map}
${keyList('hh__lkey', [['hh__lsw hh__lsw--me', fillOutside('nearKeyThis')], ['hh__nsw hh__nsw--ctx', fillOutside('nearKeyOther', { kinds: g.kinds })]])}
</figure>` : ''}
</div></div>
</section>`;
}
