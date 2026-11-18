// The figures of a hospital's page outside Medicare's penalty programs (outside.js outsideBody's figure blocks). The
// nearest hospitals in the programs (nearBlock): for a critical access, rural emergency or unlisted acute hospital, up to
// NEAREST_K of the nearest hospitals the dollar file estimates within NEAR_MAX_MILES, on an area map beside a table of
// their estimated net change. Server-drawn; the figure script (web/client/figure.js) adds the pins' tooltips, their keys
// and the table's scroll box. The hospitals like this one (likeBlock), on every page: how many of its group Medicare's
// hospital list holds, nationally and in its state, beside a US map of them with this one marked (static: no script),
// Puerto Rico in an inset of its own, or, on a Puerto Rico hospital's page, a map of Puerto Rico alone. Both read one
// context, worked out once per build (outsideFigureContext). Each map is a numbered figure ("Figure N.", as
// web/charts/figure.js captions one), numbered in page order by the page's counter. Both maps mark this hospital the same
// way: a dot in the pen ink inside a ring.
import { STATE_NAMES } from '../../engine/js/states.js';
import { counter, keysHintFor } from '../../web/charts/figure.js';
import { figCaption, keyList } from '../../web/charts/fig-parts.js';
import { dotsPath } from '../../web/charts/dots.js';
import { areaMap, EARTH_MILES, miles, nearestTo, NEAR_MAP_WIDTH, pointOf, prInset, prMap, US_MAP_CODES, usPaths, usProjected } from '../../web/charts/geo.js';
import { WIDTH } from '../../web/charts/svg.js';
import { fillAround, printout } from '../../web/render/components.js';
import { count, placeText } from '../../web/render/format.js';
import { html } from '../../web/render/html.js';
import { milesCell, milesText } from '../../web/render/miles.js';
import { hospitalPathOf } from '../../web/site.js';
import { MAP_WIDTH } from '../asset.js';
import { fillOutside, hasOutside } from './outside-copy.js';
import { shownName } from './record.js';
import { signedMoney, signedShareText } from './text.js';

// Reading aids, not method constants: how many nearest hospitals a page lists at most, and how far one may be to be
// listed (so the section leaves out the territories, whose nearest such hospital is an ocean away: on today's files that
// includes Puerto Rico, since the dollar file estimates no Puerto Rico hospital). The caption never names the limit.
export const NEAREST_K = 5;
export const NEAR_MAX_MILES = 250;

// The groups whose pages show the nearest hospitals: hospitals that serve the same kind of community as the ones the
// programs adjust (a federal, psychiatric or other specialty hospital's nearest acute hospitals say nothing about it).
export const NEAR_GROUPS = new Set(['critical_access', 'rural_emergency', 'not_listed']);

// The classes of the nearest map's context dots, the same group's other hospitals (gray) and the other hospitals in the
// programs (in ink).
const CONTEXT_CLS = 'hh__ctx';
const PROGRAM_CLS = 'hh__ctxe';
// The nearest map's reading aids (web/charts/geo.js areaMap's aids). It is drawn twice, on the kit's phone-wide viewBox
// and a wider one, so its pins and words keep their size (charts.css shows one).
//   gap         the room kept between two spread pins (the kit's default is 8), so a cluster of pins in one town reads as
//               separate pins on the phone's narrower drawing
//   clear       the context dots a pin or the ring would cover left out
//   dense       the context dots one path per class
//   towns       each pin's town beside it
//   ring        this hospital ringed, as on the US map
//   labels      at most this many states labeled by postal code
//   pad         room between the pins and the frame's edge, so no pin is cut off
//   aspect      a frame wider than it is tall (about the table's height beside it on a desktop page)
//   contextR    the context dots' radius, in viewBox units
//   countyThin  the county lines thinned to a point every 2 units (the kit's default is 1): faint hairlines, and the map
//               is drawn twice
export const NEAR_AIDS = Object.freeze({ gap: 14, clear: true, dense: true, towns: true, ring: true, labels: 4, pad: 30, aspect: 0.72, contextR: 3, countyThin: 2 });
// The nearest map's figure id (its keyboard hint is <id>-keys).
const NEAR_FIG_ID = 'hh-near-map';

// Hospitals like this one: the US map's dots for the group's hospitals (their class, in viewBox units at MAP_WIDTH, the
// home map's frame), and this hospital as a dot in the pen ink inside a ring (radii, the same units). A dot's diameter
// follows the group's size, so a sparse group (a few dozen) still shows where a dense one (over a thousand) doesn't
// blot the map: LIKE_DOT_MAX for a group of up to LIKE_DOT_FULL hospitals, shrinking with the square root of the count
// beyond it (the dots' ink per area held about even), never under LIKE_DOT_MIN (about 3px on a desktop page).
const LIKE_DOT = 'hh__likedot';
const LIKE_DOT_MIN = 4.8;
const LIKE_DOT_MAX = 9;
const LIKE_DOT_FULL = 250;
export const likeDotSize = (n) => Math.max(LIKE_DOT_MIN, Math.min(LIKE_DOT_MAX, LIKE_DOT_MAX * Math.sqrt(LIKE_DOT_FULL / Math.max(n, 1))));
const ME_R = 5;
// Puerto Rico's inset is small (web/charts/geo.js prInset), and the free sea beside Florida leaves no room to draw it
// larger: a group with more than INSET_FULL hospitals there has its inset's dots shrunk with the square root of their
// count beyond it, never under INSET_DOT_MIN, so they read as dots on the island rather than one gray patch.
const INSET_FULL = 10;
const INSET_DOT_MIN = 3;
export const insetDotSize = (n, size) => (n > INSET_FULL ? Math.max(INSET_DOT_MIN, size * Math.sqrt(INSET_FULL / n)) : size);
// Puerto Rico's code over its inset, in viewBox units at MAP_WIDTH (about the map's other small type on a desktop page).
const INSET_LABEL_SIZE = 18;
const RING_R = 11;
// The map of Puerto Rico alone (a Puerto Rico hospital's page): its padding, so a ring at the coast stays inside.
const PR_MAP_PAD = 2 * RING_R;

// A group's noun ("critical access hospitals"): the unlisted acute group's names the hospital-acquired conditions file's
// year, the one thing true of all its hospitals. years: { hacrpFy, hrrpFy }, as text.
const kindsOf = (group, years) => fillOutside(`likeCount.${group}`, group === 'not_listed' ? { hacrpFy: years.hacrpFy } : {});

// Where hospital h goes on a "like this one" map, and how its group's dot is drawn there: { xy, size, layer }, or null
// where the map has no place for it (another territory, or no coordinates). On the US map (alone false), a state's
// hospital is at Albers USA's place, in layer 'us'; a Puerto Rico hospital is in the inset (web/charts/geo.js prInset),
// in layer 'us' too unless its group crowds the inset, whose dots are then drawn smaller in a layer of their own
// ('inset'). On the map of Puerto Rico alone (alone true; prMap), only a Puerto Rico hospital has a place, in layer 'pr'.
// like: the build's { shapes, inset, pr }, with the group's dot size and the inset's ({ size, insetSize }).
function placeOnLikeMap(h, like, alone = false) {
  const point = pointOf(h);
  if (!point) return null;
  const pr = h.state === 'PR';
  const [xy, size, layer] = alone ? [pr ? like.pr?.project(point) : null, like.size, 'pr']
    : pr ? [like.inset?.project(point), like.insetSize, like.insetSize === like.size ? 'us' : 'inset']
      : [usProjected(like.shapes, [point], MAP_WIDTH)[0], like.size, 'us'];
  return xy ? { xy, size, layer } : null;
}
// One path of a layer's dots ('' for none).
const layerDots = (places, layer) => {
  const mine = places.filter((p) => p.layer === layer);
  return dotsPath(mine.map((p) => p.xy), LIKE_DOT, mine[0]?.size);
};

// Everything the two figures read that is the same for every page, worked out once per build:
//   estimated  the hospitals the dollar file estimates, each with its place ({ ...h, point }), those without one left out
//   programContext  the same hospitals as the nearest map's context dots ({ ccn, point, cls }), in the same order
//   groups     each group's { counts (likeCounts' entry), kinds (its noun), context (its hospitals' places, for the
//              nearest map's dots: { ccn, point, cls }), place (placeOnLikeMap's like: Puerto Rico's inset on the US
//              map, prInset, and the map of Puerto Rico alone, prMap, each or null, with the group's dot sizes),
//              like ({ height, body }: the US map's land, Puerto Rico's inset and the group's dots, each page's own among
//              them, under the ring the page draws) and prLike (the same for the map of Puerto Rico alone, its dots the
//              group's Puerto Rico hospitals, or null) }
//   shapes, counties, years ({ hacrpFy, hrrpFy }, text), fy (the dollar estimates' fiscal year, text)
// hospitals: the hub's (hubHospitals); outside: hubModel().outside; likeCounts: hubModel().likeCounts, which must count
// the same hospitals; master: loadHub().master (by CCN: no unlisted acute hospital may be in the HACRP file, which its
// group's noun says); shapes, counties: loadHub()'s; programYears: the master's { hacrp, hrrp }; fy: the dollar file's year.
export function outsideFigureContext({ hospitals, outside, likeCounts, master, shapes, counties, programYears, fy }) {
  if (!Number.isInteger(programYears?.hacrp) || !Number.isInteger(programYears?.hrrp)) throw new TypeError('outside: the figures need the master\'s HACRP and HRRP years');
  const years = { hacrpFy: String(programYears.hacrp), hrrpFy: String(programYears.hrrp) };
  const estimated = hospitals.filter((h) => h.est).map((h) => ({ ...h, point: pointOf(h) })).filter((h) => h.point);
  const programContext = estimated.map((x) => ({ ccn: x.ccn, point: x.point, cls: PROGRAM_CLS }));
  const members = new Map();
  for (const h of outside) {
    if (h.group === 'not_listed' && master.get(h.ccn)?.programs.hacrp.inProgram) throw new RangeError('outside: an unlisted acute hospital is in the HACRP file');
    if (!members.has(h.group)) members.set(h.group, []);
    members.get(h.group).push(h);
  }
  const { height, paths } = usPaths(shapes, MAP_WIDTH);
  const inset = prInset(shapes, MAP_WIDTH);
  // Puerto Rico's box: a hairline frame, its code above it, the island drawn as land with the states.
  const box = inset ? html`<rect class="hh__inset" x="${inset.box.x}" y="${inset.box.y}" width="${inset.box.width}" height="${inset.box.height}"/><text class="hh__insetlab" x="${inset.box.x + inset.box.width}" y="${inset.box.y}" dy="-4" text-anchor="end" font-size="${INSET_LABEL_SIZE}">PR</text>` : '';
  const land = html`<g class="chart-land"><path d="${[...US_MAP_CODES.map((code) => paths.get(code)), inset?.outline].filter(Boolean).join('')}"/></g>${box}`;
  const pr = prMap(shapes, MAP_WIDTH, PR_MAP_PAD);
  const prLand = pr ? html`<g class="chart-land"><path d="${pr.outline}"/></g>` : '';
  const groups = new Map();
  for (const [group, list] of members) {
    const counts = likeCounts.get(group);
    if (counts?.n !== list.length) throw new RangeError(`outside: the counts of group ${group} are not its hospitals'`);
    const size = likeDotSize(list.length);
    const inInset = list.filter((o) => o.state === 'PR' && inset?.project(pointOf(o))).length;
    const place = { shapes, inset, pr, size, insetSize: insetDotSize(inInset, size) };
    const onUs = list.map((o) => placeOnLikeMap(o, place)).filter(Boolean);
    const onPr = list.map((o) => placeOnLikeMap(o, place, true)).filter(Boolean);
    groups.set(group, {
      counts,
      kinds: kindsOf(group, years),
      context: list.map((o) => ({ ccn: o.ccn, point: pointOf(o), cls: CONTEXT_CLS })).filter((c) => c.point),
      place,
      like: { height, body: html`${land}<g class="chart-us__points">${layerDots(onUs, 'us')}${layerDots(onUs, 'inset')}</g>` },
      prLike: onPr.length ? { height: pr.height, body: html`${prLand}<g class="chart-us__points">${layerDots(onPr, 'pr')}</g>` } : null,
    });
  }
  if (groups.size !== likeCounts.size) throw new RangeError('outside: the counts hold a group with no hospitals');
  return Object.freeze({ estimated, programContext, groups, shapes, counties, years, fy: String(fy) });
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

// The maps' keys (web/charts/fig-parts.js keyList). This hospital's swatch, as both maps draw it: a dot in the pen ink inside
// a ring; and the group's other hospitals'.
const THIS_KEY = { swatch: 'hh__lsw hh__lsw--me', label: fillOutside('nearKeyThis') };
const LIKE_KEY = { swatch: 'hh__nsw hh__nsw--ctx', label: fillOutside('keyLike') };
// The nearest map's key: this hospital, a pin cut on net and one not, and each kind of context dot the map draws (drawn:
// areaMap's contextDrawnBy).
function key(drawn) {
  return keyList([
    THIS_KEY,
    { swatch: 'hh__nsw hh__nsw--cut', label: fillOutside('nearKeyCut') },
    { swatch: 'hh__nsw', label: fillOutside('nearKeyNotCut') },
    ...(drawn[PROGRAM_CLS] ? [{ swatch: 'hh__nsw hh__nsw--est', label: fillOutside('nearKeyProgram') }] : []),
    ...(drawn[CONTEXT_CLS] ? [LIKE_KEY] : []),
  ], { cls: 'hh__nkey' });
}

// The context a nearest map can draw, cut cheaply to a box of longitude and latitude about the page's points: the map's
// frame is fitted around them (with room, at its aspect), so nothing outside a box several times their reach from this
// hospital can fall inside it. The map still decides what is in its frame; the box only spares it projecting the rest
// of the country twice per page. center: [lon, lat]; points: the pins' and the frame's fitted places ([lon, lat]).
const NEAR_BOX_REACH = 6;
const MILES_PER_DEGREE = (EARTH_MILES * Math.PI) / 180;
function nearBox(center, points) {
  const reach = NEAR_BOX_REACH * Math.max(...points.map((p) => miles(center, p)));
  const dLat = reach / MILES_PER_DEGREE;
  const [s, n] = [center[1] - dLat, center[1] + dLat];
  const dLon = reach / (MILES_PER_DEGREE * Math.cos((Math.min(89, Math.max(Math.abs(s), Math.abs(n))) * Math.PI) / 180));
  const [w, e] = [center[0] - dLon, center[0] + dLon];
  // A box across the antimeridian (Alaska's Aleutians) keeps every longitude.
  const anyLon = w < -180 || e > 180;
  return ({ point: [lon, lat] }) => lat >= s && lat <= n && (anyLon || (lon >= w && lon <= e));
}

// The nearest hospitals in the programs, or '' for a hospital without a place, outside NEAR_GROUPS, or with no estimated
// hospital within NEAR_MAX_MILES. The rows: up to NEAREST_K of the nearest, only those within NEAR_MAX_MILES. The map
// needs two (web/charts/geo.js areaMap), so a table of one stands alone, its caption a paragraph; with the map, the
// caption is the figure's. On a phone the table folds each row's share of Medicare inpatient pay under its dollars
// (hub/styles.css), so it fits the screen. h: an OutsideHospital; ctx: outsideFigureContext's; next: the page's figure
// counter (web/charts/figure.js counter), called only when the map is drawn.
export function nearBlock(h, ctx, next = counter()) {
  const point = pointOf(h);
  if (!point || !NEAR_GROUPS.has(h.group)) return '';
  const rows = nearestTo(ctx.estimated, point, { k: NEAREST_K }).filter((r) => r.miles <= NEAR_MAX_MILES);
  if (!rows.length) return '';
  const g = groupOf(ctx, h);
  const cut = (r) => r.est.net < 0;
  const who = (r) => [r.name, placeText(r)].filter(Boolean).join(', ');
  // Context: the group's other hospitals, and the program hospitals not in the table; the program ones drawn first, so a
  // gray dot of the page's own kind sits on top.
  const listed = new Set(rows.map((r) => r.ccn));
  const [lon, lat] = point;
  const inBox = nearBox(point, [[lon - 0.25, lat - 0.25], [lon + 0.25, lat + 0.25], ...rows.map((r) => r.point)]);
  const context = [
    ...ctx.programContext.filter((x) => !listed.has(x.ccn) && inBox(x)),
    ...g.context.filter((x) => x.ccn !== h.ccn && inBox(x)),
  ];
  // Every pin carries its town: the kit names a town once (by its city and state), beside the nearest of its pins where
  // the name fits (web/charts/pin-layout.js townLabels), in each drawing.
  const pins = rows.map((r, i) => ({
    point: r.point, n: i + 1, town: r.city || null, townKey: `${r.city}|${r.state}`,
    // The kit's pin classes: filled in the pen ink for a cut, on paper for none.
    cls: cut(r) ? 'chart-pin--yes' : 'chart-pin--no',
    tip: fillOutside('nearTip', { n: String(i + 1), who: who(r), net: signedMoney(r.est.net), share: signedShareText(r.est.share), distance: milesText(r.miles) }),
  }));
  const draw = (width, variant) => areaMap({
    shapes: ctx.shapes, counties: ctx.counties, context, width, variant,
    label: fillOutside('nearAlt'), aids: NEAR_AIDS,
    center: { point, tip: fillOutside('nearThis', { name: shownName(h) }) },
    points: pins,
  });
  const narrow = draw(WIDTH, 'narrow');
  const wide = narrow && draw(NEAR_MAP_WIDTH, 'wide');
  const map = narrow && html`${narrow}
${wide}`;
  // The key names a kind of dot either drawing shows.
  const drawn = narrow ? Object.fromEntries([CONTEXT_CLS, PROGRAM_CLS].map((cls) => [cls, (narrow.contextDrawnBy[cls] ?? 0) + (wide.contextDrawnBy[cls] ?? 0)])) : {};
  // The kit's table (web/styles/charts.css .gb--near), as HACRP's: a cut's row is near--yes, its number in the pen ink. The
  // share has a column of its own on a wide screen and a line under the dollars on a phone (hh__nshare): CSS shows one.
  const shareCol = fillOutside('nearColShare');
  const table = printout(html`<table class="gb gb--near hh__ntab" aria-labelledby="hh-near-h">
<thead><tr><th scope="col" class="num">${fillOutside('nearColRank')}</th><th scope="col">${fillOutside('nearColHospital')}</th><th scope="col" class="num">${fillOutside('nearColMiles')}</th><th scope="col" class="num">${fillOutside('nearColNet', { fy: ctx.fy })}<span class="hh__nshare">${shareCol}</span></th><th scope="col" class="num hh__sharec">${shareCol}</th></tr></thead>
<tbody>${rows.map((r, i) => html`<tr${cut(r) ? html` class="near--yes"` : ''}><td class="num"><span class="near__n">${String(i + 1)}</span></td><th scope="row"><a href="${hospitalPathOf('hub', r.ccn)}">${r.name}</a><span class="near__city">${placeText(r)}</span></th><td class="num">${milesCell(r.miles)}</td><td class="num near__cut${cut(r) ? ' near__cut--pen' : ''}">${signedMoney(r.est.net)}<span class="hh__nshare">${signedShareText(r.est.share)}</span></td><td class="num hh__sharec">${signedShareText(r.est.share)}</td></tr>`)}</tbody>
</table>`);
  return html`<section class="hh__near" aria-labelledby="hh-near-h">
<div class="wrap"><div class="hh__neari">
<div class="hh__neart">
<h2 id="hh-near-h">${fillOutside('nearHeading')}</h2>
${map ? html`<figure class="fig hh__nearmap" id="${NEAR_FIG_ID}" data-figure>
${figCaption(next(), caption(rows))}
${map}
${key(drawn)}
</figure>
${keysHintFor(NEAR_FIG_ID, fillOutside('nearKeys'))}` : html`<p class="hh__nearcap">${caption(rows)}</p>`}
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

// The map: { svg, caption, own (true for the map of Puerto Rico alone) }, or null where it has no place for h (another territory, or no coordinates; the page then
// shows the text alone, across the section). For a hospital in Puerto Rico, a map of Puerto Rico alone (prMap: the US
// map's inset is too small to read one hospital in), its caption giving the national count the map doesn't show; for any
// other, the US map: every state's outline over the land (the home map's projection and shapes, at its width), Puerto Rico
// in its inset. Each with the group's hospitals as dots and h ringed in the pen ink.
function likeMap(h, g) {
  const at = (g.prLike && placeOnLikeMap(h, g.place, true)) || placeOnLikeMap(h, g.place);
  if (!at) return null;
  const own = at.layer === 'pr';
  const [x, y] = at.xy;
  const { height, body } = own ? g.prLike : g.like;
  const label = own ? fillOutside('likeAltPr', { kinds: g.kinds }) : fillOutside('likeAlt', { kinds: g.kinds });
  const caption = own
    ? fillOutside('likeCaptionPr', { ns: count(g.counts.byState.get('PR')), n: count(g.counts.n) })
    : fillOutside('likeCaption');
  return {
    caption,
    own,
    svg: html`<svg class="chart chart--like-map${own ? ' chart--like-pr' : ''}" viewBox="0 0 ${MAP_WIDTH} ${height}" width="100%" role="img" aria-label="${label}" focusable="false" style="--vb: ${MAP_WIDTH}">${body}<circle class="hh__likering" cx="${x}" cy="${y}" r="${RING_R}"/><circle class="hh__likeme" cx="${x}" cy="${y}" r="${ME_R}"/></svg>`,
  };
}

// Hospitals like this one, on every outside page: the words left, the map right, its top level with the heading. The
// map's caption and key close the words' column (the figure names its caption by id), so a short sentence leaves no
// empty block beside a tall map; on a phone they come between the words and the map. h: an OutsideHospital; ctx:
// outsideFigureContext's; next: the page's figure counter, called only when the map is drawn.
const LIKE_CAP_ID = 'hh-like-cap';
export function likeBlock(h, ctx, next = counter()) {
  const g = groupOf(ctx, h);
  const map = likeMap(h, g);
  const own = `own.${h.group}`;
  return html`<section class="hh__like" aria-labelledby="hh-like-h">
<div class="wrap"><div class="hh__likei${map ? '' : ' hh__likei--solo'}">
<div class="hh__liket">
<h2 id="hh-like-h">${fillOutside('likeHeading')}</h2>
<p class="hh__likes">${likeSentence(h, g.counts, g.kinds, ctx.years)}</p>
${hasOutside(own) ? html`<p class="hh__likeown">${fillOutside(own)}</p>` : ''}
${map ? html`<div class="hh__likelegend">
${figCaption(next(), map.caption, { id: LIKE_CAP_ID, tag: 'p' })}
${keyList([THIS_KEY, LIKE_KEY], { cls: 'hh__lkey' })}
</div>` : ''}
</div>
${map ? html`<figure class="fig hh__likemap${map.own ? ' hh__likemap--pr' : ''}" aria-labelledby="${LIKE_CAP_ID}">
${map.svg}
</figure>` : ''}
</div></div>
</section>`;
}
