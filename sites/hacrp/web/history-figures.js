// The history's figures: Part 4 of the program page (every hospital every year, a quarter at a time, stickier than
// chance, cut again next year, who keeps getting cut, the map year by year), a place's years, and a hospital's
// record. Every number comes from historyData() (history-data.js); every takeaway is filled from what the figure
// draws; history/copy.js holds the words.
import { figure, drawn, imageOf, imagePair, num } from '../../../web/charts/figure.js';
import { WIDTH, isNarrow } from '../../../web/charts/svg.js';
import { rollCall } from '../../../web/charts/rollCall.js';
import { rollBrackets } from './roll-words.js';
import { chanceDots, staircase } from '../../../web/charts/yearCharts.js';
import { barRows } from '../../../web/charts/barRows.js';
import { rankYears } from '../../../web/charts/rankYears.js';
import { smallLines } from '../../../web/charts/smallLines.js';
import { miniTiles } from '../../../web/charts/tileMap.js';
import { STATE_NAMES, usProjected, usYearMap } from '../../../web/charts/geo.js';
import { TILES } from '../../../web/charts/states.js';
import { lastCall, paraOf } from '../../../web/render/components.js';
import { cmsText, count, listText, pct, pctFloor, shownAbove } from '../../../web/render/format.js';
import { html, jsonScript } from '../../../web/render/html.js';
import { EQUAL_FROM, Z_FROM } from '../../../engine/js/hacrp/eras.js';
import { CUT, NONE, NOT_CUT, everCut, rollOrder, tallyYears } from '../../../engine/js/hacrp/trends.js';
import { ceilToUnit, toUnit } from '../../../engine/js/stats.js';
import { groupLabel } from './groups.js';
import { nameInText } from './places.js';
import { FACT_SHEET_CUT, FEW_DECIDED, MAP_STEPS_PCT, SHORT_NAMES } from './constants.js';
import { COUNT_NOTE, METHODS_PATH } from './links.js';
import { YEAR_CLASSES, yearClass } from './year-classes.js';
import { fyLabel } from './copy.js';
import { psec } from './program-figures.js';
import { fill, t } from './history/copy.js';

export const HIST_WIDE = 1180;
const share = (part, whole) => (whole ? part / whole : 0);
// The history's source line: CMS's files for every year, and its cut lists for the years whose files have no
// payment column.
const SOURCES = new WeakMap();
export const historySource = (hd) => {
  if (!SOURCES.has(hd)) {
    const years = { first: String(hd.fys[0]), last: String(hd.fys[hd.fys.length - 1]) };
    const lists = hd.years.filter((y) => y.decisions === 'cut-list').map((y) => `FY${y.fy}`);
    SOURCES.set(hd, lists.length ? fill('histSource', { ...years, lists: listText(lists) }) : fill('histSourceNoLists', years));
  }
  return SOURCES.get(hd);
};
const pct0 = (x) => pct(x, 0);
const pct1 = (x) => pct(x, 1);
// A share as a table cell: its percent, or empty for none.
const pctCell = (x) => (x === null ? '' : num(pct1(x), x));
// A fiscal year on a year axis: "’16".
const yearTick = (v) => `’${String(v).slice(-2)}`;
const pointOf = (r) => (r && Number.isFinite(r.lon) && Number.isFinite(r.lat) ? [r.lon, r.lat] : null);

// ---------- the roll call ----------

// A roll call's geometry by drawn width: [label column, right margin, row height, top], which the page script reads
// to find the hospital under the pointer and to draw a picked state's grid (rollCall.js draws its rows from TOP = 4).
// notes: the rows carry a note at the right (a place's share cut, then the nation's), which takes room and height.
function rollGeom(width, notes) {
  const narrow = isNarrow(width);
  // The notes' margin holds the longest note, "100.0% · 100.0%" at about 6px a character in the 10px type.
  if (notes) return narrow ? [30, 90, 12, 4] : [40, 100, 18, 4];
  return narrow ? [30, 0, 11, 4] : [40, 0, 17, 4];
}


// A roll call in its box (ever: how many of its records were ever cut), at the phone's width and `wide`, with what the
// page script reads: attrs (where the grid's order comes from; '' for a picture alone), its geometry, the state picker
// (or '') and, when the grid is live (live), the readout's hint. after: markup inside the box after the readout (a
// place's order, as JSON).
function rollBox({ hd, records, ever, notes = null, wide, attrs, picker = '', live, after = '' }) {
  const years = hd.fys.map(String);
  const brackets = rollBrackets(records.length, ever);
  const draw = (width) => {
    const [label, right, rowH] = rollGeom(width, notes);
    return rollCall({ records, years, notes, width, rowH, label, right, blank: t('rollNone'), brackets });
  };
  const geom = Object.fromEntries([WIDTH, wide].map((w) => [String(w), rollGeom(w, notes)]));
  return html`<div class="roll"${attrs} data-geom="${JSON.stringify(geom)}">
${picker}
${imagePair(drawn(draw, wide), t('rollAlt'))}
<p class="roll__readout small" aria-live="polite"${live ? html` data-hint="${t('rollHint')}"` : ''}></p>
${after}</div>`;
}

// The year map's one drawing width, and each hospital's place on it in the pages' order (hd.order), worked out once
// per build: { points: [lon, lat] or null, at: [x, y] or null }.
export const HIST_MAP_WIDE = 960;
const mapPlaces = lastCall((hd, shapes, master) => [hd, shapes, master], (hd, shapes, master) => {
  const points = hd.order.map(([ccn]) => pointOf(master.get(ccn)));
  return { points, at: usProjected(shapes, points, HIST_MAP_WIDE) };
});

// The history asset the roll call's and the year map's scripts read: the grid's hospitals in drawing order with their
// records and states, the years, and each year's counts (cut that year, ever cut by then); with the map, each
// hospital's place on it, flat [x, y, x, y, …] in tenths (null: no place).
export function rollAsset(hd, { shapes = null, master = null } = {}) {
  const asset = {
    fys: hd.fys,
    ccns: hd.order.map(([ccn]) => ccn),
    recs: hd.order.map(([, rec]) => rec),
    states: hd.order.map(([ccn]) => hd.stateOf.get(ccn) ?? ''),
    counts: hd.counts.map((c) => [c.cut, c.ever]),
  };
  if (!shapes || !master) return asset;
  return { ...asset, at: mapPlaces(hd, shapes, master).at.flatMap((p) => (p ? p.map((v) => Math.round(v * 10)) : [null, null])) };
}

// rollUrl and src: the history and hospitals assets, for the page script (without them, the figure is a picture).
export function rollFigure(hd, { n, source, rollUrl = null, src = null }) {
  const records = hd.order.map(([, rec]) => rec);
  const ever = everCut(records);
  const never = records.length - ever;
  const states = [...new Set(hd.order.map(([ccn]) => hd.stateOf.get(ccn)))].filter((st) => STATE_NAMES[st]).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b], 'en'));
  // The state picker, hidden until the page script runs; the script (client/roll-picker.js) redraws the grid with the
  // picked state's hospitals, in the grid's own words (explore/copy.js), and links to the state's page. It carries the
  // nation's share ever cut, from the takeaway's own counts, for the script's sentence.
  const picker = rollUrl ? html`<p class="roll__pick" hidden data-nation="${pct0(share(ever, records.length))}"><label for="roll-state">${t('rollPick')}</label> <select id="roll-state"><option value="">${t('rollAll')}</option>${states.map((st) => html`<option value="${st}">${STATE_NAMES[st]}</option>`)}</select> <a class="roll__open" hidden></a></p>` : '';
  const chart = rollBox({ hd, records, ever, wide: HIST_WIDE, attrs: rollUrl ? html` data-roll="${rollUrl}" data-src="${src}"` : '', picker, live: Boolean(rollUrl) });
  return figure({
    n, source, chart, csvName: 'hacrp-history-years',
    takeaway: fill('rollTakeaway', { ever: count(ever), hospitals: count(records.length), first: String(hd.fys[0]), never: count(never) }),
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('rollColDecided'), numeric: true }, { name: t('rollColCut'), numeric: true }, { name: t('rollColFirst'), numeric: true }, { name: t('rollColEver'), numeric: true }],
      rows: hd.counts.map((c, i) => [fyLabel(hd.fys[i]), num(count(c.decided), c.decided), num(count(c.cut), c.cut), num(count(c.first), c.first), num(count(c.ever), c.ever)]),
    },
  });
}

export function everFigure(hd, { n, source }) {
  const cols = hd.counts.map((c, i) => ({ label: String(hd.fys[i]).slice(-2), cut: c.cut, ever: c.ever, tip: `${fyLabel(hd.fys[i])}: ${count(c.cut)} · ${count(c.ever)}` }));
  const last = hd.counts[hd.counts.length - 1];
  const any = hd.recs.size;
  return figure({
    n, source, csvName: 'hacrp-ever-cut', alt: t('everAlt'),
    takeaway: fill('everTakeaway', { last: String(hd.fys[hd.fys.length - 1]), ever: count(last.ever), share: pct0(share(last.ever, any)) }),
    ...drawn((width) => staircase({ cols, width, format: count })),
    key: null,
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('everCut'), numeric: true }, { name: t('everEver'), numeric: true }],
      rows: hd.counts.map((c, i) => [fyLabel(hd.fys[i]), num(count(c.cut), c.cut), num(count(c.ever), c.ever)]),
    },
  });
}

// Times cut against chance, over the fixed panel (hospitals with a decision in every year CMS cut anyone). The
// takeaway names the never-cut end and the always-cut end.
export function chanceFigure(hd, { n, source }) {
  const { observed: allObserved, chance: allChance, hospitals, years } = hd.panelChance;
  // Over the panel, no hospital can be cut more often than there were years with cuts.
  const observed = allObserved.slice(0, years + 1);
  const chance = allChance.slice(0, years + 1);
  const ks = observed.map((o, k) => ({ k, observed: o, chance: chance[k], tip: fill('chanceTip', { k: String(k), observed: count(o), chance: chanceText(chance[k]) }) }));
  return figure({
    n, source, csvName: 'hacrp-times-cut', alt: t('chanceAlt'), claimLevel: 'recomputed', note: t('chanceKey'),
    takeaway: fill('chanceTakeaway', { hospitals: count(hospitals), years: String(years), never: count(observed[0]), chanceNever: count(Math.round(chance[0])), all: count(observed[years]), chanceAll: chanceText(chance[years]) }),
    ...drawn((width) => chanceDots({ ks, labels: { x: t('chanceX') }, width, format: count })),
    table: {
      columns: [{ name: t('chanceColK'), numeric: true }, { name: t('chanceColObs'), numeric: true }, { name: t('chanceColChance'), numeric: true }],
      rows: ks.map((d) => [num(String(d.k), d.k), num(count(d.observed), d.observed), num(chanceText(d.chance), d.chance)]),
    },
  });
}
// A chance count as words a reader can hold: a whole number from one up, else "1 in N".
function chanceText(x) {
  if (x >= 0.995) return count(Math.round(x));
  if (x <= 0) return '0';
  return fill('chanceOneIn', { n: count(Math.round(1 / x)) });
}

// How long a cut follows a hospital: for each gap in years, the share cut again after a cut and the share cut after
// no cut, pooled over every pair of years that far apart. One year apart, the two years share data.
export function gapFigure(hd, { n, source }) {
  const gaps = hd.gaps;
  const again = (g) => share(g.cutAgain, g.cutBefore);
  const fresh = (g) => share(g.cutNew, g.notBefore);
  const xs = gaps.map((g) => g.k);
  const pt = (g, y, key) => ({ x: g.k, y, tip: fill(key, { k: String(g.k), share: pct0(y) }) });
  const panels = [{ label: t('gapAgain'), points: gaps.map((g) => pt(g, again(g), 'gapTipAgain')), under: gaps.map((g) => ({ x: g.k, y: fresh(g) })), underSolid: true, underLabel: t('gapFresh'), change: '', labelAt: [0, 1, gaps.length - 1] }];
  const yMax = ceilToUnit(Math.max(...gaps.map(again)), 1);
  const one = gaps[0];
  const two = gaps[1];
  const far = gaps[gaps.length - 1];
  const draw = (width) => smallLines({ panels, xs, yMax, ref: null, labels: { x: (v) => String(v), point: pct0, xTitle: t('gapColK') }, width, format: (v) => pct0(v), cols: 1, tall: true });
  return figure({
    n, source, csvName: 'hacrp-cut-again-by-gap', alt: t('gapAlt'), claimLevel: 'recomputed',
    takeaway: fill('gapTakeaway', { one: pct0(again(one)), oneFresh: pct0(fresh(one)), two: pct0(again(two)), twoFresh: pct0(fresh(two)), far: String(far.k), farAgain: pct0(again(far)), farFresh: pct0(fresh(far)) }),
    key: null,
    note: fill('gapNote', { none: hd.fys.filter((_, i) => hd.counts[i].share === null).join(', ') }),
    ...drawn(draw, 640),
    table: {
      columns: [{ name: t('gapColK'), numeric: true }, { name: t('gapAgain'), numeric: true }, { name: t('gapFresh'), numeric: true }, { name: t('gapColPairs'), numeric: true }],
      rows: gaps.map((g) => [num(String(g.k), g.k), num(pct1(again(g)), again(g)), num(pct1(fresh(g)), fresh(g)), num(count(g.cutBefore + g.notBefore), g.cutBefore + g.notBefore)]),
    },
  });
}

// The kinds of hospital whose line the small multiples draw, by group: [kind, key].
const RURAL = ['urban', 'false'];
const SMALLEST = ['beds', '0'];
const KIND_PANELS = [['teach', 'major'], ['own', 'Government'], ['own', 'For-profit'], RURAL, SMALLEST, ['beds', '3']];
// A kind's group in the history (hd.byType), or undefined.
const groupOf = (hd, [kind, key]) => hd.byType.find((k) => k.kind === kind)?.groups.find((g) => g.key === key);

// A group's share cut each year, in the years CMS cut anyone (null otherwise, or with no decision in the group).
const groupShares = (hd, years) => years.map((y, i) => (y.decided && hd.counts[i].share !== null ? y.cut / y.decided : null));

// The fiscal year since which rural hospitals and the smallest have both been cut more often than the nation, every year
// CMS cut anyone, after an earlier year below it; null if they haven't flipped.
export function flipSince(hd) {
  const nation = hd.counts.map((c) => c.share);
  const since = (which) => {
    const g = groupOf(hd, which);
    if (!g) return null;
    const shares = groupShares(hd, g.years);
    const cut = hd.fys.map((_, i) => i).filter((i) => nation[i] !== null && shares[i] !== null);
    const above = (i) => shownAbove(shares[i], nation[i]);
    let k = cut.length;
    while (k > 0 && above(cut[k - 1])) k--;
    const before = cut.slice(0, k);
    return k < cut.length && before.length && before.every((i) => shownAbove(nation[i], shares[i])) ? cut[k] : null;
  };
  const at = [since(RURAL), since(SMALLEST)];
  return at.includes(null) ? null : hd.fys[Math.max(...at)];
}

// Who keeps getting cut: a panel per kind of hospital, its share cut each year (the line) over the nation's (dashed).
// flip: flipSince(hd), which picks the takeaway's words.
export function kindsFigure(hd, { n, source, flip = flipSince(hd) }) {
  const nation = hd.counts.map((c) => c.share);
  const panels = KIND_PANELS.map(([kind, key]) => {
    const g = groupOf(hd, [kind, key]);
    if (!g) return null;
    const shares = groupShares(hd, g.years);
    const points = hd.fys.map((fy, i) => ({ x: fy, y: shares[i], tip: shares[i] === null ? '' : `${groupLabel(kind, key)}, ${fyLabel(fy)}: ${pct0(shares[i])} (${count(g.years[i].cut)} of ${count(g.years[i].decided)})` }));
    const above = shares.filter((s, i) => shownAbove(s, nation[i])).length;
    return { label: groupLabel(kind, key), points, underSolid: true, under: hd.fys.map((fy, i) => ({ x: fy, y: nation[i] })), change: fill('kindsAbove', { k: String(above), n: String(hd.cutYears) }) };
  }).filter(Boolean);
  // The takeaway: rural hospitals against urban ones, first year and newest.
  const rural = groupOf(hd, RURAL);
  const ruralShare = (i) => share(rural.years[i].cut, rural.years[i].decided);
  const lastI = hd.fys.length - 1;
  const draw = (width) => smallLines({ panels, xs: hd.fys, yMax: 0.5, ref: null, labels: { x: yearTick }, width, format: (v) => pct0(v) });
  const groups = hd.byType.flatMap((k) => k.groups.map((g) => ({ label: groupLabel(k.kind, g.key), shares: groupShares(hd, g.years) })));
  return figure({
    n, source, csvName: 'hacrp-cut-by-kind', alt: t('kindsAlt'),
    takeaway: fill(flip ? 'kindsTakeaway' : 'kindsTakeawayNoFlip', { first: String(hd.fys[0]), a: pct0(ruralShare(0)), na: pct0(nation[0]), last: String(hd.fys[lastI]), b: pct0(ruralShare(lastI)), nb: pct0(nation[lastI]) }),
    ...drawn(draw, 760),
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('typesHNation'), numeric: true }, ...groups.map((g) => ({ name: g.label, numeric: true }))],
      rows: hd.fys.map((fy, i) => [fyLabel(fy), pctCell(nation[i]), ...groups.map((g) => pctCell(g.shares[i]))]),
    },
  });
}

// What CMS scores a hospital on: the share cut among hospital-years scored on PSI 90 alone, on infections without PSI
// 90, on every measure, and all of them.
export function coverageFigure(hd, { n, source }) {
  const { groups, first, last } = hd.coverage;
  const rows = [['every', 'covEvery'], ['all', 'covAll'], ['psiOnly', 'covPsiOnly'], ['noPsi', 'covNoPsi']].map(([k, key]) => {
    const g = groups[k];
    const v = share(g.cut, g.decided);
    const label = k === 'psiOnly' ? fill(key, { short: SHORT_NAMES.PSI90 }) : t(key);
    return { label, value: v, valueText: pct0(v), tip: `${label}: ${count(g.cut)} of ${count(g.decided)}`, pen: k === 'noPsi', g };
  });
  return figure({
    n, source, csvName: 'hacrp-cut-by-coverage', alt: t('covAlt'), claimLevel: 'recomputed',
    takeaway: fill('covTakeaway', { short: SHORT_NAMES.PSI90, only: pct0(rows[2].value), none: pct0(rows[3].value), first: String(first), last: String(last) }),
    ...drawn((width) => barRows({ rows, max: Math.max(0.6, ...rows.map((r) => r.value)), width, labelW: isNarrow(width) ? 150 : 180, valuesAtEnd: true })),
    table: {
      columns: [{ name: t('covColGroup') }, { name: t('covColYears'), numeric: true }, { name: t('rollColCut'), numeric: true }, { name: t('covColShare'), numeric: true }],
      rows: rows.map((r) => [r.label, num(count(r.g.decided), r.g.decided), num(count(r.g.cut), r.g.cut), num(pct1(r.value), r.value)]),
    },
  });
}

// Small multiples: one tile map per year, each state shaded by its share cut.
export function statesYearsFigure(hd, { n, source }) {
  const nation = hd.counts.map((c) => c.share);
  const codes = Object.keys(TILES);
  let best = null;
  let least = null;
  for (const [st, v] of hd.byState) {
    if (!STATE_NAMES[st] || v.years.some((y, i) => nation[i] !== null && y.decided < FEW_DECIDED)) continue;
    const above = v.years.filter((y, i) => shownAbove(share(y.cut, y.decided), nation[i])).length;
    const below = v.years.filter((y, i) => shownAbove(nation[i], share(y.cut, y.decided))).length;
    if (!best || above > best.above) best = { st, above };
    if (!least || below > least.below) least = { st, below };
  }
  const maps = hd.fys.map((fy, i) => {
    const states = Object.fromEntries(codes.map((code) => {
      const y = hd.byState.get(code)?.years[i];
      if (!y || !y.decided) return [code, { value: null, label: `${STATE_NAMES[code] ?? code}`, empty: true }];
      const s = share(y.cut, y.decided);
      return [code, { value: s * 100, label: `${STATE_NAMES[code] ?? code}: ${pct0(s)}`, few: y.decided < FEW_DECIDED }];
    }));
    return html`<div class="smallmaps__m"><p class="smallmaps__fy">${fyLabel(fy)}</p>${imageOf(miniTiles({ states, ramp: MAP_STEPS_PCT, width: 220, outline: [best.st, least.st] }), fill('statesHMapAlt', { fy: String(fy) }), null)}</div>`;
  });
  // One key for every map: the steps of the share cut, none cut, no decision, and the two states the takeaway names.
  const edges = [0, ...MAP_STEPS_PCT];
  const step = (i) => (i === edges.length - 1 ? fill('keyUp', { from: `${edges[i]}%` }) : fill('valueRange', { from: `${edges[i]}%`, to: `${edges[i + 1]}%` }));
  const key = html`<ul class="smallmaps__key" role="list">${edges.map((_, i) => html`<li><span class="smallmaps__sw smallmaps__sw--${i + 1}"></span>${step(i)}</li>`)}<li><span class="smallmaps__sw smallmaps__sw--zero"></span>${t('keyNone')}</li><li><span class="smallmaps__sw smallmaps__sw--empty"></span>${t('keyNoDecision')}</li><li><span class="smallmaps__sw smallmaps__sw--ring"></span>${fill('keyRing', { a: STATE_NAMES[best.st], b: STATE_NAMES[least.st] })}</li></ul>`;
  const chart = html`${key}<div class="smallmaps">${maps}</div>`;
  return figure({
    n, source, chart, csvName: 'hacrp-cut-by-state-year',
    takeaway: least.below > 0 && least.st !== best.st
      ? fill('statesHTakeaway', { state: STATE_NAMES[best.st], k: String(best.above), n: String(hd.cutYears), low: STATE_NAMES[least.st], lowK: String(least.below), few: String(FEW_DECIDED) })
      : fill('statesHTakeawayAbove', { state: STATE_NAMES[best.st], k: String(best.above), n: String(hd.cutYears), few: String(FEW_DECIDED) }),
    table: {
      columns: [{ name: t('rollColFy') }, ...[...hd.byState.keys()].map((st) => ({ name: st || t('statesHNoState'), numeric: true }))],
      rows: hd.fys.map((fy, i) => [fyLabel(fy), ...[...hd.byState.values()].map((v) => pctCell(v.years[i].decided ? v.years[i].cut / v.years[i].decided : null))]),
    },
  });
}

// ---------- the hospital page ----------

// A record's characters as the record strip draws them: the cell's class, its word, and its tooltip's word.
const RECORD = {
  [CUT]: { cls: 'cut', label: 'recordCut', tip: 'recordTipCut' },
  [NOT_CUT]: { cls: 'no', label: 'recordNo', tip: 'recordTipNo' },
  [NONE]: { cls: 'none', label: 'recordNone', tip: 'recordTipNone' },
};
// A year of a record in words: what CMS decided, and that it gave the decision without a score where it did.
const decisionWords = (y) => (y.noScore ? fill('recordTipNoScore', { what: t(RECORD[y.c].tip) }) : t(RECORD[y.c].tip));
// One year's cell in a record strip: the year's last two digits over its value; tip: its tooltip, if any.
const recordCell = (fy, cls, value, tip = null) => html`<li class="hrec__y hrec__y--${cls}"${tip ? html` title="${tip}"` : ''}><span class="hrec__fy">${String(fy).slice(-2)}</span><span class="hrec__v">${value}</span></li>`;

// The record strip under the verdict: one box per year, cut in the penalty ink.
export function recordStrip(rec, fys) {
  if (!rec) return '';
  const first = fys[0];
  const last = fys[fys.length - 1];
  const summary = rec.cut ? fill('recordSummary', { cut: String(rec.cut), decided: String(rec.decided) }) : fill('recordSummaryNone', { decided: String(rec.decided) });
  // A decision CMS gave without a score is marked (a dashed box) and said under the row.
  return html`<div class="hrec">
<p class="hrec__head"><span class="cap">${fill('recordHeading', { first: String(first), last: String(last) })}</span> <span class="hrec__sum">${summary}</span></p>
<ol class="hrec__row" role="list">${rec.years.map((y) => recordCell(y.fy, `${RECORD[y.c].cls}${y.noScore ? ' hrec__y--noscore' : ''}`, t(RECORD[y.c].label), fill('recordTip', { fy: String(y.fy), what: decisionWords(y) })))}</ol>
${rec.noScore.length ? html`<p class="hrec__note">${fill('recordNoScoreNote', { years: listText(rec.noScore.map(fyLabel)) })}</p>` : ''}
</div>`;
}

// The breaks drawn on a year chart: the first year of z-scores and of equal weights, where the history spans them.
export function ruleBreaks(fys) {
  const at = (fy) => fys.indexOf(fy);
  return [[Z_FROM, 'breakZ'], [EQUAL_FROM, 'breakEqual']].filter(([fy]) => at(fy) > 0).map(([fy, key]) => ({ at: at(fy), label: t(key) }));
}

// A computed share as a mark and a table cell carry it: to 4 decimals.
const r4 = (x) => (x === null ? null : toUnit(x, 4));

export function yearsFigure(rec, hd, { n, source }) {
  const years = rec.years.map((y, i) => ({
    label: String(y.fy).slice(-2),
    share: r4(y.share),
    cut: y.c === CUT,
    line: hd.checks[i].check.linePctAll,
    tip: y.share === null ? `${fyLabel(y.fy)}: ${decisionWords(y)}` : fill('yearsTip', { fy: String(y.fy), score: cmsText(y.totalText), share: pctFloor(y.share), what: decisionWords(y) }),
  }));
  return figure({
    n, source, csvName: 'hacrp-hospital-years', alt: t('yearsAlt'), claimLevel: 'recomputed', note: t('yearsKey'),
    takeaway: rec.cut ? fill('yearsTakeaway', { cut: String(rec.cut), decided: String(rec.decided) }) : fill('yearsTakeawayNone', { decided: String(rec.decided) }),
    ...drawn((width) => rankYears({ years, breaks: ruleBreaks(hd.fys), labels: { top: t('yearsTop'), mid: t('yearsMid'), bottom: t('yearsBottom'), none: t('yearsNone') }, width })),
    table: {
      columns: [{ name: t('yearsColFy') }, { name: t('yearsColScore'), numeric: true }, { name: t('yearsColShare'), numeric: true }, { name: t('yearsColDecision') }],
      rows: rec.years.map((y) => [fyLabel(y.fy), y.totalText ? num(cmsText(y.totalText), y.totalText) : '', y.share === null ? '' : num(pctFloor(y.share, 1), r4(y.share)), decisionWords(y)]),
    },
  });
}

// ---------- Part 4 ----------

const para = paraOf(fill, t);
// The roll call's link to Methods' note on the year whose count differs from CMS's fact sheet, when it does.
const countLink = (hd) => {
  const c = hd.counts[hd.fys.indexOf(FACT_SHEET_CUT.fy)];
  return c && c.cut !== FACT_SHEET_CUT.cut ? html`<p><a href="${METHODS_PATH}#${COUNT_NOTE}">${fill('rollCountLink', { fy: String(FACT_SHEET_CUT.fy) })}</a></p>` : '';
};

// Part 4's sections, each its words beside its figure (the roll call and the maps at the page's width).
export function part4({ hd, figure: fig, rollUrl = null, src = null, shapes = null, master = null }) {
  const source = historySource(hd);
  const inf = hd.infections?.length ? infAxis(hd.infections) : null;
  const flip = flipSince(hd);
  return html`${psec({ id: 'roll', wide: true, heading: t('rollHeading'), text: html`${para('rollText')}${para('rollText2')}${countLink(hd)}`, figure: rollFigure(hd, { n: fig(), source, rollUrl, src }) })}
${psec({ id: 'ever', heading: t('everHeading'), text: para('everText'), figure: everFigure(hd, { n: fig(), source }) })}
${shapes && master ? psec({ id: 'spread', wide: true, heading: t('ymapHeading'), text: html`${para('ymapText')}${para('ymapText2')}`, figure: yearMapFigure(hd, { n: fig(), source, shapes, master, rollUrl }) }) : ''}
${inf ? psec({ id: 'infections', heading: t('infHeading'), text: html`${para('infText')}${para('infText2', { spike: String(spikeYear(hd.infections)) })}`, figure: infectionsFigure(hd, { n: fig(), source: fill('infSource', { first: String(inf.first), last: String(inf.last) }) }) }) : ''}
${psec({ id: 'chance', heading: t('chanceHeading'), text: html`${para('chanceText')}${para('chanceText2')}`, figure: chanceFigure(hd, { n: fig(), source }) })}
${psec({ id: 'again', heading: t('gapHeading'), text: html`${para('gapText')}${para('gapText2')}`, figure: gapFigure(hd, { n: fig(), source }) })}
${psec({ id: 'kinds', heading: t('kindsHeading'), text: html`${para('kindsText')}${flip ? para('kindsText2', { since: String(flip) }) : para('kindsText2NoFlip')}`, figure: kindsFigure(hd, { n: fig(), source, flip }) })}
${psec({ id: 'coverage', heading: t('covHeading'), text: html`${para('covText', { short: SHORT_NAMES.PSI90 })}${para('covText2')}`, figure: coverageFigure(hd, { n: fig(), source }) })}
${psec({ id: 'statemaps', wide: true, heading: t('statesHHeading'), text: para('statesHText'), figure: statesYearsFigure(hd, { n: fig(), source }) })}`;
}

// ---------- a place's years ----------

// The place's hospitals: today's (place.ccns) and, for a state, region or division, any hospital its state's files
// listed in an earlier year that the master no longer places.
export function placeMembers(place, hd, master) {
  const set = new Set(place.ccns);
  if (place.kind === 'metro') {
    for (const ccn of hd.recs.keys()) if (master.get(ccn)?.cbsa === place.key) set.add(ccn);
  } else {
    // The place's states: a state's own code, or every state its hospitals are in (a region or division).
    const states = new Set(place.kind === 'state' ? [place.key.toUpperCase()] : place.ccns.map((c) => master.get(c)?.state).filter(Boolean));
    for (const ccn of hd.recs.keys()) if (states.has(master.get(ccn)?.state ?? hd.stateOf.get(ccn))) set.add(ccn);
  }
  return [...set].filter((ccn) => hd.recs.has(ccn));
}

// The place's roll call's wide drawing, and the id of its grid order on the page (a JSON script the page script reads).
const PLACE_WIDE = 760;
const PLACE_ORDER_ID = 'place-years-order';

export function placeYearsFigure({ place, hd, master, next, source, src = null }) {
  const members = placeMembers(place, hd, master);
  if (members.length < 2) return null;
  const sub = new Map(members.map((c) => [c, hd.recs.get(c)]));
  const order = rollOrder(sub);
  const records = order.map(([, r]) => r);
  const nation = hd.counts.map((c) => c.share);
  const own = tallyYears(sub, hd.fys.length).map((o) => ({ ...o, share: o.decided ? o.cut / o.decided : null }));
  const above = own.filter((o, i) => shownAbove(o.share, nation[i])).length;
  const ever = everCut(records);
  const notes = own.map((o, i) => (o.share === null ? '' : `${pct1(o.share)} · ${pct1(nation[i])}`));
  // The grid's own order on the page (a place holds a few hundred hospitals at most), for the page script's names.
  const inline = { fys: hd.fys, ccns: order.map(([c]) => c), recs: records, states: order.map(([c]) => hd.stateOf.get(c) ?? '') };
  const chart = rollBox({ hd, records, ever, notes, wide: PLACE_WIDE, attrs: html` data-inline="${PLACE_ORDER_ID}"${src ? html` data-src="${src}"` : ''}`, live: Boolean(src), after: jsonScript(PLACE_ORDER_ID, inline) });
  return figure({
    n: next(), source, chart, csvName: 'hacrp-place-years',
    takeaway: fill('placeYearsTakeaway', { name: nameInText(place, { start: true }), k: String(above), n: String(hd.cutYears), ever: count(ever), hospitals: count(records.length) }),
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('rollColDecided'), numeric: true }, { name: t('rollColCut'), numeric: true }, { name: t('placeYearsColShare'), numeric: true }, { name: t('placeYearsColNation'), numeric: true }],
      rows: own.map((o, i) => [fyLabel(hd.fys[i]), num(count(o.decided), o.decided), num(count(o.cut), o.cut), pctCell(o.share), pctCell(nation[i])]),
    },
  });
}

// ---------- the year map ----------

// The year map: every hospital a dot on the US map, its ink for one year (the newest, as the page loads): red if CMS
// cut it that year, pale red if CMS cut it in an earlier year, gray if never so far. The page script steps the year
// (buttons and play) from the history asset. One drawing at every width: the map has no words to keep a size, and
// charts.css sizes its dots for a phone.
export function yearMapFigure(hd, { n, source, shapes, master, rollUrl = null }) {
  const last = hd.fys.length - 1;
  const { points, at } = mapPlaces(hd, shapes, master);
  const unplaced = points.filter((p) => !p).length;
  const groups = Object.entries(YEAR_CLASSES).map(([k, cls]) => ({ cls, points: hd.order.map(([, rec], j) => (yearClass(rec, last) === k ? at[j] : null)).filter(Boolean) }));
  const svg = usYearMap({ shapes, groups, size: 4.2, width: HIST_MAP_WIDE });
  const c = hd.counts[last];
  const key = html`<ul class="ymap__key" role="list"><li><span class="ymap__sw ymap__sw--now"></span>${t('ymapNow')}</li><li><span class="ymap__sw ymap__sw--scar"></span>${t('ymapScar')}</li><li><span class="ymap__sw ymap__sw--clear"></span>${t('ymapClear')}</li></ul>`;
  const chart = html`<div class="ymap"${rollUrl ? html` data-roll="${rollUrl}"` : ''}>
<div class="ymap__controls" hidden><button type="button" class="ymap__play" data-play="${t('ymapPlay')}" data-stop="${t('ymapStop')}">${t('ymapPlay')}</button><div class="ymap__years" role="group" aria-label="${t('ymapYears')}">${hd.fys.map((fy, i) => html`<button type="button" class="ymap__y" data-i="${String(i)}" aria-pressed="${i === last ? 'true' : 'false'}">${String(fy).slice(-2)}</button>`)}</div></div>
${key}
${imageOf(svg, t('ymapAlt'), null)}
<p class="ymap__readout" aria-live="polite">${fill('ymapSay', { fy: String(hd.fys[last]), cut: count(c.cut), ever: count(c.ever) })}</p>
</div>`;
  return figure({
    n, source, chart, csvName: 'hacrp-ever-cut-map',
    takeaway: fill('ymapTakeaway', { ever: count(c.ever), share: pct0(share(c.ever, hd.recs.size)), last: String(hd.fys[last]) }),
    note: unplaced ? fill('ymapUnplaced', { n: count(unplaced) }) : null,
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('everCut'), numeric: true }, { name: t('everEver'), numeric: true }],
      rows: hd.counts.map((x, i) => [fyLabel(hd.fys[i]), num(count(x.cut), x.cut), num(count(x.ever), x.ever)]),
    },
  });
}

// ---------- infections against the cut ----------

// The infections takeaway: the two measures whose national rate fell most, one, or none.
function infTakeaway(falls, years) {
  const name = (p) => t(`${HAI_NAMES[p.id]}Short`);
  if (falls.length >= 2) return fill('infTakeaway', { ...years, a: name(falls[0]), aPct: pct(-falls[0].delta, 0), b: name(falls[1]), bPct: pct(-falls[1].delta, 0) });
  if (falls.length === 1) return fill('infTakeawayOne', { ...years, a: name(falls[0]), aPct: pct(-falls[0].delta, 0) });
  return fill('infTakeawayNone', years);
}

const HAI_NAMES = { CLABSI: 'infCLABSI', CAUTI: 'infCAUTI', SSI_COLON: 'infSsiColon', SSI_HYST: 'infSsiHyst', MRSA: 'infMRSA', CDI: 'infCDI' };
const pooled = (m) => (m && m.predicted > 0 ? m.observed / m.predicted : null);
const signedPct = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), 0)}`;

// The infection years' axis: the calendar years with a file (cys), every year from the first to the last (xs: a year
// without a file is a gap in the lines), and the first and last.
function infAxis(inf) {
  const cys = inf.map((y) => y.cy);
  const first = cys[0];
  const last = cys[cys.length - 1];
  return { cys, xs: Array.from({ length: last - first + 1 }, (_, i) => first + i), first, last };
}

// The calendar year in which the most measures' national rates rose from the year before they had one.
export function spikeYear(inf) {
  let best = null;
  for (let i = 1; i < inf.length; i++) {
    const rose = Object.keys(HAI_NAMES).filter((id) => pooled(inf[i].measures[id]) > pooled(inf[i - 1].measures[id])).length;
    if (!best || rose > best.rose) best = { cy: inf[i].cy, rose };
  }
  return best?.cy ?? inf[0].cy;
}

// The nation's infection rate per measure, each calendar year Care Compare published one (observed ÷ predicted
// infections, summed over every hospital with both counts), over the share of hospitals CMS cut each fiscal year.
export function infectionsFigure(hd, { n, source }) {
  const inf = hd.infections;
  if (!inf?.length) return null;
  const { cys, xs, first, last } = infAxis(inf);
  const panels = Object.keys(HAI_NAMES).map((id) => {
    const points = xs.map((cy) => {
      const y = inf.find((r) => r.cy === cy);
      const v = y ? pooled(y.measures[id]) : null;
      return { x: cy, y: v === null ? null : toUnit(v, 3), tip: v === null ? '' : `${t(HAI_NAMES[id])}, ${cy}: ${v.toFixed(2)}` };
    });
    const have = points.filter((p) => p.y !== null);
    if (!have.length) return null;
    const change = have[have.length - 1].y / have[0].y - 1;
    return { id, label: t(HAI_NAMES[id]), points, change: signedPct(change), delta: change };
  }).filter(Boolean);
  if (!panels.length) return null;
  const yMax = Math.max(1.2, ...panels.flatMap((p) => p.points.map((pt) => pt.y ?? 0)));
  const falls = panels.filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta);
  const draw = (width) => smallLines({ panels, xs, yMax: ceilToUnit(yMax, 1), ref: 1, labels: { ref: t('infRef'), x: yearTick }, width, format: (v) => String(v) });
  const quarter = html`<div class="infq"><p class="infq__h cap">${t('infQuarter')}</p><ol class="hrec__row" role="list">${hd.counts.map((c, i) => (c.share === null ? recordCell(hd.fys[i], 'none', t('recordNone')) : recordCell(hd.fys[i], 'cut', pct0(c.share))))}</ol></div>`;
  const chart = html`${quarter}<p class="infq__h cap">${t('infRates')}</p>${imagePair(drawn(draw, 760), t('infAlt'))}`;
  return figure({
    n, source, chart, csvName: 'hacrp-infections-by-year', claimLevel: 'recomputed',
    takeaway: infTakeaway(falls, { first: String(first), last: String(last) }),
    note: fill('infNote', { gaps: xs.filter((x) => !cys.includes(x)).map(String).join(' and ') }),
    table: {
      columns: [{ name: t('infColYear') }, ...panels.map((p) => ({ name: p.label, numeric: true }))],
      rows: cys.map((cy) => [String(cy), ...panels.map((p) => {
        const v = p.points.find((pt) => pt.x === cy).y;
        return v === null ? '' : num(v.toFixed(3), v);
      })]),
    },
  });
}

// One hospital's infection rates by calendar year, a panel per measure it has at least two years of results on, each
// over the nation's median hospital (the solid gray line). sir: [{ cy, sir: { CLABSI: number|null, … } }].
export function hospitalInfectionsFigure(sir, hd, { n, source }) {
  const inf = hd.infections;
  if (!sir?.length || !inf?.length) return null;
  const { xs } = infAxis(inf);
  const byCy = new Map(sir.map((r) => [r.cy, r.sir]));
  const panels = Object.keys(HAI_NAMES).map((id) => {
    const points = xs.map((cy) => {
      const v = byCy.get(cy)?.[id] ?? null;
      return { x: cy, y: v, tip: v === null ? '' : fill('hinfTip', { measure: t(HAI_NAMES[id]), cy: String(cy), sir: v.toFixed(3) }) };
    });
    const under = xs.map((cy) => ({ x: cy, y: inf.find((r) => r.cy === cy)?.measures[id].median ?? null }));
    const have = points.filter((p) => p.y !== null);
    if (have.length < 2) return null;
    const delta = have[have.length - 1].y - have[0].y;
    return { id, label: t(HAI_NAMES[id]), points, under, underSolid: true, change: `${have[0].y.toFixed(2)} → ${have[have.length - 1].y.toFixed(2)}`, delta };
  }).filter(Boolean);
  if (!panels.length) return null;
  const top = Math.max(1.5, ...panels.flatMap((p) => p.points.map((pt) => pt.y ?? 0)));
  const yMax = Math.min(ceilToUnit(top * 2, 0) / 2, 6);
  const clipped = panels.map((p, i) => ({ ...p, ...(i === 0 ? { underLabel: t('hinfNation') } : {}), points: p.points.map((pt) => ({ ...pt, y: pt.y === null ? null : Math.min(pt.y, yMax) })) }));
  const down = panels.filter((p) => p.delta < 0).length;
  const draw = (width) => smallLines({ panels: clipped, xs, yMax, ref: 1, labels: { ref: t('infRef'), x: yearTick }, width, format: (v) => String(v) });
  return figure({
    n, source, csvName: 'hacrp-hospital-infections', alt: t('hinfAlt'),
    takeaway: fill('hinfTakeaway', { down: String(down), m: String(panels.length) }),
    key: null,
    note: top > yMax ? fill('hinfClip', { max: String(yMax) }) : null,
    ...drawn(draw, 640),
    table: {
      columns: [{ name: t('infColYear') }, ...panels.map((p) => ({ name: p.label, numeric: true }))],
      rows: xs.filter((cy) => byCy.has(cy)).map((cy) => [String(cy), ...panels.map((p) => {
        const v = byCy.get(cy)[p.id];
        return v === null ? '' : num(v.toFixed(3), Math.min(v, yMax));
      })]),
    },
  });
}
