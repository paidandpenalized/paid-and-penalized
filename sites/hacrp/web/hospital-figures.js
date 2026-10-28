// The hospital page's figures beyond the what-if, each built from CMS's values and the national context
// (compare.js): the line bar beside the record, the ledger of measures (each value on a ruler among every hospital's),
// the worksheet and waterfall that add the parts up to the score, the groups the hospital belongs to, and its nearest
// hospitals. Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { toUnit } from '../../../engine/js/stats.js';
import { WIDE, drawn, figure, imageOf, keysHint, num } from '../../../web/charts/figure.js';
import { areaMap } from '../../../web/charts/geo.js';
import { lineBar } from '../../../web/charts/lineBar.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { ridges } from '../../../web/charts/ridges.js';
import { ruler } from '../../../web/charts/ruler.js';
import { waterfall } from '../../../web/charts/waterfall.js';
import { cmsText, count, decimal, noun, pct, pctFloor } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { pill, printout, wsOp, wsTerm } from '../../../web/render/components.js';
import { isSir } from '../../../engine/js/hacrp/measures.js';
import { countBins } from './compare.js';
import { NEAR_MAP_WIDTH, REDUCTION_TEXT, RINGS_MAX, RING_MILES, RULER_BINS, RULER_ROOM_HIGH, RULER_ROOM_LOW, SIR_EXPECTED_TEXT } from './constants.js';
import { fill, t } from './copy.js';
import { HOSPITALS_PATH } from './view.js';
import { pillOf } from './whatif-text.js';
import { hospitalHref } from './hospital-table.js';
import { cutText } from './money.js';
import { groupLabel } from './groups.js';

const at = (v) => decimal(v, DP);
const share = (part, whole) => pct(whole ? part / whole : 0, 0);
// A rank as "higher than", "worse than" or "better than" says it: rounded down, so it never rounds across a step (a
// hospital just under CMS's line never reads "higher than 75%" when it is 74.97%).
const beyond = (part, whole) => pctFloor(whole ? part / whole : 0);
// The line bar's wide drawing, about the verdict column's width.
const LINE_BAR_WIDE = 440;
// The ledger's wide rulers, about their column's width on a wide screen.
const RULER_WIDE = 520;

// ---------- the line bar ----------

// Beside the record: this score on the span of every published score, with CMS's line and the middle hospital. Two
// drawings (a phone's and a wider one), shown one at a time as a figure's are (charts.css data-fit).
export function lineBarBlock(view, nat) {
  if (!view.scored) return null;
  const { highestNo, lowestYes } = view.boundaryText;
  const [lo, hi] = nat.domain;
  const words = {
    actual: t('barThis'), actualValue: view.score.text, line: t('barLine'), lineValue: fill('barLineValue', { lowestYes }),
    middle: t('barMiddle'), middleValue: cmsText(at(nat.medianScore)), low: fill('barLow', { low: cmsText(at(lo)) }),
    high: fill('barHigh', { high: cmsText(at(hi)) }), zone: fill('pillYes', { pct: REDUCTION_TEXT }),
  };
  const alt = fill('barAlt', { low: cmsText(at(lo)), high: cmsText(at(hi)), score: view.score.text, middle: cmsText(at(nat.medianScore)), lowestYes });
  const draw = (width) => lineBar({ domain: nat.domain, actual: view.total, band: [view.boundary.highestNo, view.boundary.lowestYes], middle: nat.medianScore, labels: words, width });
  const rank = nat.rankOf(view.total);
  return html`<div class="hosp__bar">
${imageOf(draw(WIDTH), alt, 'narrow')}
${imageOf(draw(LINE_BAR_WIDE), alt, 'wide')}
</div>
<p class="hosp__rank">${fill('rankHigher', { share: beyond(rank.below, rank.n - 1), n: count(rank.n - 1) })}</p>`;
}

// ---------- the ledger ----------

// A measure's ruler axis and its national distribution, once per build: from zero (or just under a floor above
// zero) to past the cap, the values counted on RULER_BINS equal columns.
const RULERS = new WeakMap();
function rulerOf(nat, model, id) {
  let byId = RULERS.get(nat);
  if (!byId) RULERS.set(nat, (byId = new Map()));
  if (!byId.has(id)) {
    const p = model.params[id];
    const lo = p.floor > 0 ? p.floor - (p.cap - p.floor) * RULER_ROOM_LOW : 0;
    const hi = p.cap + (p.cap - lo) * RULER_ROOM_HIGH;
    const edges = Array.from({ length: RULER_BINS + 1 }, (_, i) => lo + ((hi - lo) * i) / RULER_BINS);
    byId.set(id, { domain: [lo, hi], counts: countBins(nat.measures[id].values, edges), p, median: medianAt(p) });
  }
  return byId.get(id);
}

// Where a value sits among the measure's published values, in words.
function rankWords(nat, id, value, median) {
  const r = nat.measureRank(id, value);
  const others = r.n - 1;
  if (value > median) return fill('rankWorse', { share: beyond(r.below, others), n: count(others) });
  if (value < median) return fill('rankBetter', { share: beyond(r.above, others), n: count(others) });
  return t('rankMiddle');
}

// A measure's short name, which opens a box with its definition on a click or tap, with no script (a <details>). The
// value that means "as expected": PSI 90's national composite is one; an infection ratio's, SIR_EXPECTED.
function shortName(m) {
  const one = isSir(m.id) ? SIR_EXPECTED_TEXT : decimal(1, 0);
  return html`<details class="def"><summary>${m.short}<span class="def__mark" aria-hidden="true">?</span><span class="vh"> ${t('defineMore')}</span></summary><p class="def__box">${fill(`define${m.id}`, { one })}</p></details>`;
}

// view.largest's id, the part that raised the score most (the page marks it in red).
// notes(m): the measure's notes markup (CMS's footnotes, the estimate tag).
export function ledgerFigure({ view, nat, model, n, source, notes }) {
  const topId = view.largest?.id ?? null;
  const rows = view.measures.map((m) => {
    const r = rulerOf(nat, model, m.id);
    const value = m.hasValue ? Number(m.valueRaw) : null;
    const fmt = (v) => decimal(v, r.p.decimals);
    const better = value !== null && value <= r.median && !m.assigned;
    const rank = m.assigned ? null : value === null ? (m.hasZ ? null : t('rankNone')) : rankWords(nat, m.id, value, r.median);
    const draw = (width, fit) => {
      const svg = ruler({
        id: `ruler-${m.id.toLowerCase()}-${fit}`, domain: r.domain, counts: r.counts, floor: r.p.floor, cap: r.p.cap, median: r.median, value,
        labels: { median: fill('rulerMedian', { median: fmt(r.median) }), value: t('barThis'), same: t('figRangeSame'), note: value === null ? (m.assigned ? t('valueAssigned') : t('noValue')) : null },
        format: fmt, width, pen: m.id === topId, ghost: m.assigned,
      });
      return imageOf(svg, null, fit);
    };
    const svg = html`${draw(WIDTH, 'narrow')}${draw(RULER_WIDE, 'wide')}`;
    const cls = ['ledger__row', m.id === topId && 'is-top', better && 'is-better', !m.hasZ && 'is-none', m.assigned && 'is-assigned'].filter(Boolean).join(' ');
    const dash = html`<span aria-hidden="true">—</span><span class="vh">${t('noValue')}</span>`;
    return { m, r, value, fmt, rank, markup: html`<li class="${cls}">
<div class="ledger__name"><div class="ledger__short">${shortName(m)}${m.id === topId ? html` <span class="ledger__tag">${t('ledgerTop')}</span>` : ''}</div><p class="ledger__label">${m.label}</p>${rank ? html`<p class="ledger__rank">${rank}</p>` : ''}${notes(m)}</div>
<div class="ledger__ruler">${svg}</div>
<p class="ledger__num"><span class="ledger__k">${t('colValue')}</span><span class="cms">${m.hasValue ? m.valueText : dash}</span></p>
<p class="ledger__num"><span class="ledger__k">${t('colZ')}</span><span class="cms">${m.hasZ ? m.zText : dash}</span></p>
<p class="ledger__num ledger__part"><span class="ledger__k">${t('ledgerColPart')}</span><span>${m.contributionText ?? dash}</span></p>
</li>` };
  });
  const valued = rows.filter((row) => row.value !== null && !row.m.assigned);
  const above = valued.filter((row) => row.value > row.r.median).length;
  const takeaway = !valued.length ? t('figLedgerNoValues')
    : valued.length === 1 ? fill('figRangeOne', { short: valued[0].m.short, side: t(above ? 'figSideAbove' : 'figSideBelow') })
    : view.largest ? fill('figLedgerTakeaway', { k: String(valued.length), above: String(above), short: view.largest.short })
      : fill('figLedgerTakeawayNone', { k: String(valued.length), above: String(above) });
  const chart = html`<div class="ledger">
<div class="ledger__head" aria-hidden="true"><span>${t('colMeasure')}</span><span class="ledger__dir"><span>← ${t('ledgerBetter')}</span><span>${t('ledgerColRuler')}</span><span>${t('ledgerWorse')} →</span></span><span class="num">${t('colValue')}</span><span class="num">${t('colZ')}</span><span class="num">${t('ledgerColPart')}</span></div>
<ol class="ledger__rows" role="list">${rows.map((row) => row.markup)}</ol>
</div>`;
  return figure({
    n, takeaway, source, chart, claimLevel: 'official', csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-measures`,
    key: [{ swatch: 'this', label: t('figRangeThis') }, { swatch: 'median', label: t('figRangeMedian') }, { swatch: 'same', label: t('figRangeSame') }],
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colValue'), numeric: true }, { name: t('figColMedian'), numeric: true }, { name: t('colZ'), numeric: true }, { name: t('figColPart'), numeric: true }, { name: t('figColRank') }],
      rows: rows.map(({ m, r, fmt, rank }) => [m.short, m.hasValue ? m.valueRaw : num(t('noValue'), null), num(fmt(r.median), r.median), m.hasZ ? m.zRaw : num(t('noValue'), null), m.contributionText === null ? num(t('noValue'), null) : num(m.contributionText, m.contributionRaw), rank ?? '']),
    },
  });
}

// ---------- the worksheet and the waterfall ----------

// The arithmetic in the hospital's own numbers: (z₁ + z₂ + …) ÷ n = score, each term over its short name, the part
// that raised the score most in red, a term CMS assigned hatched. CMS's text throughout.
export function worksheet(view) {
  const terms = view.measures.filter((m) => m.hasZ);
  if (!terms.length) return null;
  const topId = view.largest?.id ?? null;
  const sum = terms.reduce((acc, m) => acc + Number(m.zRaw), 0);
  const recomputed = toUnit(sum / terms.length, DP);
  const exact = at(recomputed) === view.score.raw;
  const term = (m, i) => {
    const neg = m.zRaw.startsWith('-');
    const digits = neg ? m.zRaw.slice(1) : m.zRaw;
    return html`${i ? wsOp(neg ? '−' : '+') : ''}${wsTerm(html`${i === 0 && neg ? '−' : ''}${digits}`, m.short, [m.id === topId && 'is-top', m.assigned && 'is-assigned'].filter(Boolean).join(' '))}`;
  };
  return html`<div class="ws" role="group" aria-label="${t('sumHeading')}">
<p class="ws__line"><span class="ws__paren">(</span>${terms.map(term)}<span class="ws__paren">)</span>${wsOp('÷')}${wsTerm(String(terms.length), t('wsN'), 'ws__term--n')}${wsOp('=')}${wsTerm(view.score.text, t('wsTotal'), 'ws__term--total')}</p>
${exact ? '' : html`<p class="small muted">${fill('sumRounded', { recomputed: cmsText(at(recomputed)), total: view.score.text })}</p>`}
</div>`;
}

export function sumFigure({ view, n, source }) {
  const parts = view.measures.filter((m) => m.contribution !== null);
  if (!parts.length) return null;
  const topId = view.largest?.id ?? null;
  const { highestNo, lowestYes } = view.boundaryText;
  const band = [view.boundary.highestNo, view.boundary.lowestYes];
  const total = view.total;
  const nText = String(view.n);
  let run = 0;
  const rows = parts.map((m) => {
    run += m.contributionRaw;
    return { m, running: toUnit(run, DP) };
  });
  const draw = (width) => waterfall({
    id: width === WIDE ? 'sum-wide' : 'sum', band, width,
    rows: rows.map(({ m }) => ({ label: m.short, value: m.contributionRaw, valueText: m.contributionText, assigned: m.assigned, pen: m.id === topId, tip: fill('sumPartTip', { short: m.short, z: m.zText, n: nText, part: m.contributionText }) })),
    total: { label: t('sumTotal'), value: total, valueText: view.score.text, pen: view.status === 'yes', tip: fill('sumTotalTip', { total: view.score.text }) },
    labels: { line: t('barLine'), lineTip: fill('heroLine', { highestNo, lowestYes }), zone: fill('pillYes', { pct: REDUCTION_TEXT }) },
  });
  return figure({
    n, source, alt: t('figSumAlt'), claimLevel: 'recomputed', csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-sum`,
    takeaway: fill('figSumTakeaway', { total: view.score.text, side: t(total >= band[1] ? 'figSumAbove' : 'figSumBelow') }),
    ...drawn(draw),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colZ'), numeric: true }, { name: t('figColPart'), numeric: true }, { name: t('figColRunning'), numeric: true }],
      rows: [
        ...rows.map(({ m, running }) => [m.short, m.zRaw, num(m.contributionText, m.contributionRaw), num(cmsText(at(running)), running)]),
        [t('wsTotal'), num('', null), num('', null), num(view.score.text, view.score.raw)],
        [t('barLine'), num('', null), num(highestNo, band[0]), num(lowestYes, band[1])],
      ],
    },
  });
}

// ---------- among hospitals like it ----------


// Where a score sits against the middle of each group's scores, in words for all, some or none of the k groups (none
// above reads "below" in all of them, or "at or below" when the score sits on a group's middle; two groups are "both").
export function peersPosition(total, rows) {
  const k = String(rows.length);
  const all = rows.length === 2 ? t('figPeersBoth') : fill('figPeersEvery', { k });
  const above = rows.filter((r) => total > r.g.median).length;
  if (above === rows.length) return fill('figPeersAboveAll', { all });
  if (above > 0) return fill('figPeersAboveSome', { above: String(above), k });
  return fill(rows.every((r) => total < r.g.median) ? 'figPeersBelowAll' : 'figPeersAtOrBelowAll', { all });
}

export function peersFigure({ view, nat, master, n, source }) {
  if (!view.scored) return null;
  const groups = nat.groupsOf(view.ccn);
  if (groups.length < 2) return null;
  const total = view.total;
  const { highestNo, lowestYes } = view.boundaryText;
  const band = [view.boundary.highestNo, view.boundary.lowestYes];
  const rows = groups.map((g) => {
    const label = groupLabel(g.kind, g.key, { metro: master?.cbsaName });
    const s = share(g.yes, g.decided);
    return { g, label, share: s, sub: fill('groupSub', { n: count(g.decided) }), higher: beyond(g.below, g.scored - 1), others: g.scored - 1 };
  });
  const draw = (width) => ridges({
    edges: nat.edges, band, actual: total, width,
    rows: rows.map((r) => ({ label: r.label, sub: r.sub, counts: r.g.bins, median: r.g.median, share: fill('groupShare', { share: r.share }), tip: fill('groupTip', { group: r.label, yes: count(r.g.yes), decided: count(r.g.decided), share: r.share, median: cmsText(at(r.g.median)) }) })),
    labels: { actual: t('barThis'), actualValue: view.score.text, line: t('barLine'), lineTip: fill('heroLine', { highestNo, lowestYes }) },
  });
  const shares = rows.map((r) => ({ r, v: r.g.yes / r.g.decided }));
  const low = shares.reduce((a, b) => (b.v < a.v ? b : a));
  const high = shares.reduce((a, b) => (b.v > a.v ? b : a));
  const fig = figure({
    n, source, alt: t('figPeersAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-groups`,
    takeaway: low.r.share === high.r.share
      ? fill('figPeersSame', { position: peersPosition(total, rows), share: low.r.share })
      : fill('figPeersTakeaway', { position: peersPosition(total, rows), low: low.r.share, lowGroup: low.r.label, high: high.r.share, highGroup: high.r.label }),
    ...drawn(draw),
    table: {
      columns: [{ name: t('figColGroup') }, { name: t('figColDecided'), numeric: true }, { name: t('figColCut'), numeric: true }, { name: t('figColShare'), numeric: true }, { name: t('figColMiddle'), numeric: true }, { name: t('figColHigher'), numeric: true }],
      rows: [
        ...rows.map((r) => [r.label, num(count(r.g.decided), r.g.decided), num(count(r.g.yes), r.g.yes), num(r.share, r.g.yes / r.g.decided), num(cmsText(at(r.g.median)), r.g.median), num(r.higher, r.g.below / Math.max(r.g.scored - 1, 1))]),
        [t('barThis'), num('', null), num('', null), num('', null), num(view.score.text, view.score.raw), num('', null)],
        [t('barLine'), num('', null), num('', null), num('', null), num(highestNo, band[0]), num(lowestYes, band[1])],
      ],
    },
  });
  return { fig, rows };
}

// ---------- the nearest hospitals ----------

// The nearest hospitals' takeaway: how many of the k CMS cut, in words for none and all, and the closest one's distance.
function nearbyTakeaway(yes, k, distance) {
  if (yes === 0) return fill('figNearbyNone', { k: String(k), distance });
  if (yes === k) return fill('figNearbyAll', { k: String(k), distance });
  return fill('figNearbyTakeaway', { yes: String(yes), k: String(k), distance });
}

const DECISION = { Yes: 'nearbyCut', No: 'nearbyNotCut', 'N/A': 'nearbyNA' };
const decisionWord = (d) => (DECISION[d] ? t(DECISION[d]) : d);
// The decision as the record card shows it: a pill, its word carrying the meaning (CMS's text for any other value).
const decisionMark = (d) => (DECISION[d] ? pill(pillOf(d)) : d);

// The measure glyph: one square per measure in order, with its count in words for screen readers.
function glyph(flags) {
  const scored = flags.filter((f) => f !== 'none').length;
  const worse = flags.filter((f) => f === 'worse' || f === 'assigned').length;
  return html`<span class="mg" aria-hidden="true">${flags.map((f) => html`<span class="mg--${f}"></span>`)}</span><span class="vh">${fill('nearbyGlyph', { worse: String(worse), scored: String(scored) })}</span>`;
}

// A hospital's estimated cut in a table: the dollars, in the penalty ink for a cut; words where there is no estimate.
const cutCell = (dollars) => html`<td class="num near__cut${dollars > 0 ? ' near__cut--pen' : ''}">${cutText(dollars)}</td>`;

// A distance in the nearest hospitals' table: whole miles, "under 1" for a hospital under a mile away (never "0").
const miles = (x) => (x < 1 ? fill('nearbyUnderMile', { one: count(1) }) : count(Math.round(x)));
// A distance in words, for a tooltip and the takeaway: "less than a mile" under one, "about a mile" for one when
// rounded, whole miles ("3 miles") otherwise.
export const milesText = (x) => (x < 1 ? t('milesUnder') : Math.round(x) === 1 ? t('milesAbout') : noun(Math.round(x), 'mile'));

// The table's estimated-cut column reads each nearby hospital's cut from the national context (compare.js).
export function nearbyBlock({ view, nat, shapes, counties = [], n, source }) {
  if (!view.point || !shapes) return null;
  const near = nat.nearest(view.ccn, view.point);
  if (near.length < 2) return null;
  const tip = (h, i) => fill('nearbyTip', { n: String(i + 1), name: h.name, city: h.city, score: cmsText(h.totalText), decision: decisionWord(h.decision), distance: milesText(h.miles) });
  const kind = (h) => (h.decision === 'Yes' ? 'yes' : h.decision === 'No' ? 'no' : 'na');
  const far = near.at(-1).miles;
  const rings = RING_MILES.filter((r) => r < far).slice(-RINGS_MAX).map((r) => ({ miles: r, label: fill('nearbyRing', { miles: count(r) }) }));
  const map = areaMap({
    shapes, counties, rings, label: t('figNearbyAlt'), width: NEAR_MAP_WIDTH,
    center: { point: view.point, tip: `${t('nearbyThis')}: ${view.name}` },
    points: near.map((h, i) => ({ point: h.point, n: i + 1, cls: `chart-pin--${kind(h)}`, tip: tip(h, i) })),
  });
  const yes = near.filter((h) => h.decision === 'Yes').length;
  const href = (ccn) => hospitalHref(HOSPITALS_PATH, ccn);
  const table = printout(html`<table class="gb gb--near" aria-labelledby="nearby-h">
<thead><tr><th scope="col" class="num">#</th><th scope="col">${t('nearbyColName')}</th><th scope="col" class="num">${t('nearbyColMiles')}</th><th scope="col" class="num">${t('nearbyColScore')}</th><th scope="col">${t('nearbyColDecision')}</th><th scope="col" class="num">${t('tableColMoney')}</th><th scope="col">${t('nearbyColMeasures')}</th></tr></thead>
<tbody>${near.map((h, i) => html`<tr class="near--${kind(h)}"><td class="num"><span class="near__n">${String(i + 1)}</span></td><th scope="row"><a href="${href(h.ccn)}">${h.name}</a><span class="near__city">${h.city}, ${h.state}</span></th><td class="num">${miles(h.miles)}</td><td class="num">${cmsText(h.totalText)}</td><td>${decisionMark(h.decision)}</td>${cutCell(h.cut)}<td>${glyph(h.flags)}</td></tr>`)}</tbody>
</table>`);
  const fig = map && figure({
    n, source, chart: map, csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-nearest`,
    takeaway: nearbyTakeaway(yes, near.length, milesText(near[0].miles)),
    table: {
      columns: [{ name: t('nearbyColName') }, { name: t('nearbyColMiles'), numeric: true }, { name: t('nearbyColScore'), numeric: true }, { name: t('nearbyColDecision') }],
      rows: near.map((h) => [`${h.name}, ${h.city}, ${h.state}`, num(miles(h.miles), toUnit(h.miles, 1)), h.totalText, decisionWord(h.decision)]),
    },
  });
  return { table, fig, keys: fig ? keysHint(n, t('figRangeKeys')) : '', count: near.length };
}

