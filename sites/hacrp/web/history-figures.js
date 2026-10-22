// The history's figures: Part 4 of the program page (every hospital every year, a quarter at a time, stickier than
// chance, cut again next year, who keeps getting cut, the map year by year), a place's years, and a hospital's
// record. Every number comes from historyData() (history-data.js); every takeaway is filled from what the figure
// draws; history/copy.js holds the words.
import { figure, drawn, imageOf, imagePair, num } from '../../../web/charts/figure.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { rollCall } from '../../../web/charts/rollCall.js';
import { chanceDots, staircase } from '../../../web/charts/yearCharts.js';
import { barRows } from '../../../web/charts/barRows.js';
import { rankYears } from '../../../web/charts/rankYears.js';
import { smallLines } from '../../../web/charts/smallLines.js';
import { miniTiles } from '../../../web/charts/tileMap.js';
import { STATE_NAMES, usProjected, usYearMap } from '../../../web/charts/geo.js';
import { TILES } from '../../../web/charts/states.js';
import { cmsText, count, decimal, pct } from '../../../web/render/format.js';
import { html } from '../../../web/render/html.js';
import { CUT, NONE } from '../../../engine/js/hacrp/trends.js';
import { groupLabel, kindLabel } from './groups.js';
import { FEW_DECIDED, MAP_STEPS_PCT, SHORT_NAMES } from './constants.js';
import { YEAR_CLASSES, yearClass } from './year-classes.js';
import { fill, t } from './history/copy.js';

export const HIST_WIDE = 1180;
const fyLabel = (fy) => fill('fyShort', { fy: String(fy) });
const share = (part, whole) => (whole ? part / whole : 0);
// The years CMS cut anyone (every year but FY2023).
export const cutYears = (hd) => hd.counts.filter((c) => c.cut).length;
// The history's source line: CMS's files for every year, and its cut lists for the years whose files have no
// payment column.
const SOURCES = new WeakMap();
export const historySource = (hd) => {
  if (!SOURCES.has(hd)) {
    const lists = hd.years.filter((y) => y.decisions === 'cut-list').map((y) => String(y.fy));
    SOURCES.set(hd, fill('histSource', { first: String(hd.fys[0]), last: String(hd.fys[hd.fys.length - 1]), second: lists[1] ?? lists[0] ?? '' }));
  }
  return SOURCES.get(hd);
};
const pct0 = (x) => pct(x, 0);
const pct1 = (x) => pct(x, 1);

// The roll-call order with every hospital never cut at the end: records compared year by year with "no decision"
// read as "not cut", so the hospitals cut first stand first; ties by the records themselves, then CCN.
function rollOrder(hd) {
  const key = (rec) => rec.replaceAll(NONE, 'N');
  return [...hd.recs].sort(([ca, a], [cb, b]) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka < kb ? 1 : -1; // 'Y' > 'N': cut first
    return a < b ? 1 : a > b ? -1 : ca < cb ? -1 : 1;
  });
}

// The roll call's geometry by drawn width: [label column, right margin], which the page script reads to find the
// hospital under the pointer.
const ROLL_GEOM = (width) => (width < 400 ? [30, 0] : [40, 0]);

// The history asset the roll call's script reads: the grid's hospitals in drawing order with their records and
// states, and the years.
export function rollAsset(hd, { shapes = null, master = null } = {}) {
  const order = rollOrder(hd);
  const asset = { fys: hd.fys, ccns: order.map(([ccn]) => ccn), recs: order.map(([, rec]) => rec), states: order.map(([ccn]) => hd.stateOf.get(ccn) ?? '') };
  if (!shapes || !master) return asset;
  // The year map's dots: each hospital's place at both drawn widths, flat [x, y, x, y, …] in tenths (null: no place).
  const points = order.map(([ccn]) => pointOf(master.get(ccn)));
  const flat = (width) => usProjected(shapes, points, width).flatMap((p) => (p ? p.map((v) => Math.round(v * 10)) : [null, null]));
  return { ...asset, at: { [String(WIDTH)]: flat(WIDTH), [String(HIST_MAP_WIDE)]: flat(HIST_MAP_WIDE) } };
}
const pointOf = (r) => (r && Number.isFinite(r.lon) && Number.isFinite(r.lat) ? [r.lon, r.lat] : null);

// rollUrl and src: the history and hospitals assets, for the page script (without them, the figure is a picture).
export function rollFigure(hd, { n, source, rollUrl = null, src = null }) {
  const order = rollOrder(hd);
  const records = order.map(([, rec]) => rec);
  const ever = records.filter((r) => r.includes(CUT)).length;
  const never = records.length - ever;
  const years = hd.fys.map((fy) => String(fy));
  const draw = (width) => {
    const [label, right] = ROLL_GEOM(width);
    return rollCall({
      records, years, width, rowH: width < 400 ? 11 : 17, label, right, blank: t('rollNone'),
      brackets: [{ from: 0, to: ever, label: fill('rollEver', { n: count(ever) }), pen: true }, { from: ever, to: records.length, label: fill('rollNever', { n: count(never) }) }],
    });
  };
  const pair = drawn(draw, HIST_WIDE);
  const states = [...new Set(order.map(([ccn]) => hd.stateOf.get(ccn)))].filter((st) => STATE_NAMES[st]).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b], 'en'));
  const geom = Object.fromEntries([WIDTH, HIST_WIDE].map((w) => [String(w), ROLL_GEOM(w)]));
  const chart = html`<div class="roll"${rollUrl ? html` data-roll="${rollUrl}" data-src="${src}"` : ''} data-geom="${JSON.stringify(geom)}">
${rollUrl ? html`<p class="roll__pick" hidden><label for="roll-state">${t('rollPick')}</label> <select id="roll-state"><option value="">${t('rollAll')}</option>${states.map((st) => html`<option value="${st}">${STATE_NAMES[st]}</option>`)}</select></p>` : ''}
${imagePair(pair, t('rollAlt'))}
<p class="roll__readout small" aria-live="polite"></p>
</div>`;
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
    n, source, csvName: 'hacrp-times-cut', alt: t('chanceAlt'), claimLevel: 'recomputed',
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
  const panels = [{ label: t('gapAgain'), points: gaps.map((g) => pt(g, again(g), 'gapTipAgain')), under: gaps.map((g) => ({ x: g.k, y: fresh(g) })), underLabel: t('gapFresh'), change: '' }];
  const yMax = Math.ceil(Math.max(...gaps.map(again)) * 10) / 10;
  const one = gaps[0];
  const two = gaps[1];
  const far = gaps[gaps.length - 1];
  const draw = (width) => smallLines({ panels, xs, yMax, ref: null, labels: { x: (v) => String(v) }, width, format: (v) => pct0(v), cols: 1, tall: true });
  return figure({
    n, source, csvName: 'hacrp-cut-again-by-gap', alt: t('gapAlt'), claimLevel: 'recomputed',
    takeaway: fill('gapTakeaway', { one: pct0(again(one)), oneFresh: pct0(fresh(one)), two: pct0(again(two)), twoFresh: pct0(fresh(two)), far: String(far.k), farAgain: pct0(again(far)), farFresh: pct0(fresh(far)) }),
    key: null,
    note: t('gapNote'),
    ...drawn(draw, 640),
    table: {
      columns: [{ name: t('gapColK'), numeric: true }, { name: t('gapAgain'), numeric: true }, { name: t('gapFresh'), numeric: true }, { name: t('gapColPairs'), numeric: true }],
      rows: gaps.map((g) => [num(String(g.k), g.k), num(pct1(again(g)), again(g)), num(pct1(fresh(g)), fresh(g)), num(count(g.cutBefore + g.notBefore), g.cutBefore + g.notBefore)]),
    },
  });
}

// The kinds of hospital whose line the small multiples draw, by group: [kind, key].
const KIND_PANELS = [['teach', 'major'], ['own', 'Government'], ['own', 'For-profit'], ['urban', 'false'], ['beds', '0'], ['beds', '3']];

// Who keeps getting cut: a panel per kind of hospital, its share cut each year (the line) over the nation's (dashed).
export function kindsFigure(hd, { n, source }) {
  const nation = hd.counts.map((c) => (c.decided ? share(c.cut, c.decided) : null));
  const groupOf = (kind, key) => hd.byType.find((k) => k.kind === kind)?.groups.find((g) => g.key === key);
  const panels = KIND_PANELS.map(([kind, key]) => {
    const g = groupOf(kind, key);
    if (!g) return null;
    const points = hd.fys.map((fy, i) => {
      const y = g.years[i];
      const v = y.decided && hd.counts[i].cut ? share(y.cut, y.decided) : null;
      return { x: fy, y: v, tip: v === null ? '' : `${groupLabel(kind, key)}, ${fyLabel(fy)}: ${pct0(v)} (${count(y.cut)} of ${count(y.decided)})` };
    });
    const above = points.filter((p, i) => p.y !== null && p.y > nation[i]).length;
    return { label: groupLabel(kind, key), points, under: hd.fys.map((fy, i) => ({ x: fy, y: hd.counts[i].cut ? nation[i] : null })), change: fill('kindsAbove', { k: String(above), n: String(cutYears(hd)) }), kind, key, above };
  }).filter(Boolean);
  // The takeaway: rural hospitals against urban ones, first year and newest.
  const urban = groupOf('urban', 'true');
  const rural = groupOf('urban', 'false');
  const ratio = (i) => share(share(rural.years[i].cut, rural.years[i].decided), share(urban.years[i].cut, urban.years[i].decided));
  const lastI = hd.fys.length - 1;
  const draw = (width) => smallLines({ panels, xs: hd.fys, yMax: 0.5, ref: null, labels: { x: (v) => `’${String(v).slice(-2)}` }, width, format: (v) => pct0(v) });
  const groups = hd.byType.flatMap((k) => k.groups.map((g) => ({ label: groupLabel(k.kind, g.key), years: g.years })));
  return figure({
    n, source, csvName: 'hacrp-cut-by-kind', alt: t('kindsAlt'),
    takeaway: fill('kindsTakeaway', { first: String(hd.fys[0]), firstRatio: decimal(ratio(0), 1), last: String(hd.fys[lastI]), lastRatio: decimal(ratio(lastI), 1) }),
    ...drawn(draw, 760),
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('typesHNation'), numeric: true }, ...groups.map((g) => ({ name: g.label, numeric: true }))],
      rows: hd.fys.map((fy, i) => [fyLabel(fy), nation[i] === null ? '' : num(pct1(nation[i]), nation[i]), ...groups.map((g) => (g.years[i].decided && hd.counts[i].cut ? num(pct1(share(g.years[i].cut, g.years[i].decided)), share(g.years[i].cut, g.years[i].decided)) : ''))]),
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
    const label = k === 'psiOnly' || k === 'noPsi' ? fill(key, { short: SHORT_NAMES.PSI90 }) : t(key);
    return { label, value: v, valueText: pct0(v), tip: `${label}: ${count(g.cut)} of ${count(g.decided)}`, pen: k === 'noPsi', g };
  });
  return figure({
    n, source, csvName: 'hacrp-cut-by-coverage', alt: t('covAlt'), claimLevel: 'recomputed',
    takeaway: fill('covTakeaway', { short: SHORT_NAMES.PSI90, only: pct0(rows[2].value), none: pct0(rows[3].value), first: String(first), last: String(last) }),
    ...drawn((width) => barRows({ rows, max: Math.max(0.6, ...rows.map((r) => r.value)), width, labelW: width < 400 ? 150 : 180 })),
    table: {
      columns: [{ name: t('covColGroup') }, { name: t('covColYears'), numeric: true }, { name: t('rollColCut'), numeric: true }, { name: t('covColShare'), numeric: true }],
      rows: rows.map((r) => [r.label, num(count(r.g.decided), r.g.decided), num(count(r.g.cut), r.g.cut), num(pct1(r.value), r.value)]),
    },
  });
}

// Small multiples: one tile map per year, each state shaded by its share cut.
export function statesYearsFigure(hd, { n, source }) {
  const nation = hd.counts.map((c) => share(c.cut, c.decided));
  const codes = Object.keys(TILES);
  let best = null;
  let least = null;
  for (const [st, v] of hd.byState) {
    const years = v.years.filter((_, i) => hd.counts[i].cut);
    if (!STATE_NAMES[st] || years.some((y) => y.decided < FEW_DECIDED)) continue;
    const above = v.years.filter((y, i) => hd.counts[i].cut && share(y.cut, y.decided) > nation[i]).length;
    if (!best || above > best.above) best = { st, above };
    if (!least || above < least.above) least = { st, above };
  }
  const maps = hd.fys.map((fy, i) => {
    const states = Object.fromEntries(codes.map((code) => {
      const y = hd.byState.get(code)?.years[i];
      if (!y || !y.decided) return [code, { value: null, label: `${STATE_NAMES[code] ?? code}`, empty: true }];
      const s = share(y.cut, y.decided);
      return [code, { value: s * 100, label: `${STATE_NAMES[code] ?? code}: ${pct0(s)}`, few: y.decided < 10 }];
    }));
    return html`<div class="smallmaps__m"><p class="smallmaps__fy">${fyLabel(fy)}</p>${imageOf(miniTiles({ states, ramp: MAP_STEPS_PCT, width: 220 }), fill('statesHMapAlt', { fy: String(fy) }), null)}</div>`;
  });
  const chart = html`<div class="smallmaps">${maps}</div>`;
  return figure({
    n, source, chart, csvName: 'hacrp-cut-by-state-year',
    takeaway: fill('statesHTakeaway', { state: STATE_NAMES[best.st], k: String(best.above), n: String(cutYears(hd)), low: STATE_NAMES[least.st], lowK: String(cutYears(hd) - least.above), few: String(FEW_DECIDED) }),
    table: {
      columns: [{ name: t('rollColFy') }, ...[...hd.byState.keys()].map((st) => ({ name: st, numeric: true }))],
      rows: hd.fys.map((fy, i) => [fyLabel(fy), ...[...hd.byState.values()].map((v) => (v.years[i].decided ? num(pct1(share(v.years[i].cut, v.years[i].decided)), share(v.years[i].cut, v.years[i].decided)) : ''))]),
    },
  });
}

// ---------- the hospital page ----------

// The record strip under the verdict: one box per year, cut in the penalty ink.
export function recordStrip(rec, fys) {
  if (!rec) return '';
  const first = fys[0];
  const last = fys[fys.length - 1];
  const summary = rec.cut ? fill('recordSummary', { cut: String(rec.cut), decided: String(rec.decided) }) : fill('recordSummaryNone', { decided: String(rec.decided) });
  const what = { Y: t('recordTipCut'), N: t('recordTipNo'), '.': t('recordTipNone') };
  return html`<div class="hrec">
<p class="hrec__head"><span class="cap">${fill('recordHeading', { first: String(first), last: String(last) })}</span> <span class="hrec__sum">${summary}</span></p>
<ol class="hrec__row" role="list">${rec.years.map((y) => html`<li class="hrec__y hrec__y--${y.c === 'Y' ? 'cut' : y.c === 'N' ? 'no' : 'none'}" title="${fill('recordTip', { fy: String(y.fy), what: what[y.c] })}"><span class="hrec__fy">${String(y.fy).slice(-2)}</span><span class="hrec__v">${y.c === 'Y' ? t('recordCut') : y.c === 'N' ? t('recordNo') : t('recordNone')}</span><span class="vh">${fill('recordTip', { fy: String(y.fy), what: what[y.c] })}</span></li>`)}</ol>
</div>`;
}

// The breaks drawn on a year chart: the first year of z-scores and of equal weights, where the history spans them.
export function ruleBreaks(fys) {
  const at = (fy) => fys.indexOf(fy);
  return [[2018, 'breakZ'], [2020, 'breakEqual']].filter(([fy]) => at(fy) > 0).map(([fy, key]) => ({ at: at(fy), label: t(key) }));
}

export function yearsFigure(rec, hd, { n, source }) {
  const what = { Y: t('recordTipCut'), N: t('recordTipNo'), '.': t('recordTipNone') };
  const years = rec.years.map((y, i) => {
    const c = hd.checks[i].check;
    return {
      label: String(y.fy).slice(-2),
      share: y.share,
      cut: y.c === 'Y',
      line: c.linePct,
      value: y.share,
      tip: y.share === null ? `${fyLabel(y.fy)}: ${what[y.c]}` : fill('yearsTip', { fy: String(y.fy), score: cmsText(y.totalText), share: pct0(y.share), what: what[y.c] }),
    };
  });
  return figure({
    n, source, csvName: 'hacrp-hospital-years', alt: t('yearsAlt'), claimLevel: 'recomputed',
    takeaway: rec.cut ? fill('yearsTakeaway', { cut: String(rec.cut), decided: String(rec.decided) }) : fill('yearsTakeawayNone', { decided: String(rec.decided) }),
    ...drawn((width) => rankYears({ years: years.map((y) => ({ ...y, value: y.share })), breaks: ruleBreaks(hd.fys), labels: { top: t('yearsTop'), mid: t('yearsMid'), bottom: t('yearsBottom'), none: t('yearsNone') }, width })),
    table: {
      columns: [{ name: t('yearsColFy') }, { name: t('yearsColScore'), numeric: true }, { name: t('yearsColShare'), numeric: true }, { name: t('yearsColDecision') }],
      rows: rec.years.map((y) => [fyLabel(y.fy), y.totalText ? num(cmsText(y.totalText), y.totalText) : '', y.share === null ? '' : num(pct1(y.share), y.share), what[y.c]]),
    },
  });
}

// ---------- Part 4 ----------

const para = (key, values) => html`<p>${values ? fill(key, values) : t(key)}</p>`;

// Part 4's sections, each its words beside its figure (the roll call and the maps at the page's width).
export function part4({ hd, source, figure: fig, psec, rollUrl = null, src = null, shapes = null, master = null }) {
  const infSource = hd.infections?.length ? fill('infSource', { first: String(hd.infections[0].cy), last: String(hd.infections[hd.infections.length - 1].cy) }) : null;
  return html`${psec({ id: 'roll', wide: true, heading: t('rollHeading'), text: html`${para('rollText')}${para('rollText2')}`, figure: rollFigure(hd, { n: fig(), source, rollUrl, src }) })}
${psec({ id: 'ever', heading: t('everHeading'), text: para('everText'), figure: everFigure(hd, { n: fig(), source }) })}
${shapes && master ? psec({ id: 'spread', wide: true, heading: t('ymapHeading'), text: html`${para('ymapText')}${para('ymapText2')}`, figure: yearMapFigure(hd, { n: fig(), source, shapes, master, rollUrl }) }) : ''}
${infSource ? psec({ id: 'infections', heading: t('infHeading'), text: html`${para('infText')}${para('infText2')}`, figure: infectionsFigure(hd, { n: fig(), source: infSource }) }) : ''}
${psec({ id: 'chance', heading: t('chanceHeading'), text: html`${para('chanceText')}${para('chanceText2')}`, figure: chanceFigure(hd, { n: fig(), source }) })}
${psec({ id: 'again', heading: t('gapHeading'), text: html`${para('gapText')}${para('gapText2')}`, figure: gapFigure(hd, { n: fig(), source }) })}
${psec({ id: 'kinds', heading: t('kindsHeading'), text: html`${para('kindsText')}${para('kindsText2')}`, figure: kindsFigure(hd, { n: fig(), source }) })}
${psec({ id: 'coverage', heading: t('covHeading'), text: html`${para('covText', { short: SHORT_NAMES.PSI90 })}${para('covText2')}`, figure: coverageFigure(hd, { n: fig(), source }) })}
${psec({ id: 'statemaps', wide: true, heading: t('statesHHeading'), text: para('statesHText'), figure: statesYearsFigure(hd, { n: fig(), source }) })}`;
}

// ---------- a place's years ----------

// The place's hospitals: today's (place.ccns) and, for a state, region or division, any hospital its state's files
// listed in an earlier year that the master no longer places.
export function placeMembers(place, hd, master) {
  const set = new Set(place.ccns);
  if (place.kind !== 'metro') {
    const states = new Set(place.stateCodes ?? []);
    for (const ccn of hd.recs.keys()) if (!master.get(ccn) && states.has(hd.stateOf.get(ccn))) set.add(ccn);
  }
  return [...set].filter((ccn) => hd.recs.has(ccn));
}

export function placeYearsFigure({ place, hd, master, next, source, src = null }) {
  const members = placeMembers(place, hd, master);
  if (members.length < 2) return null;
  const sub = new Map(members.map((c) => [c, hd.recs.get(c)]));
  const order = rollOrder({ recs: sub });
  const records = order.map(([, r]) => r);
  const nation = hd.counts.map((c) => share(c.cut, c.decided));
  const own = hd.fys.map((_, i) => {
    const chars = records.map((r) => r[i]);
    const decided = chars.filter((c) => c !== NONE).length;
    return { decided, cut: chars.filter((c) => c === CUT).length };
  });
  const above = own.filter((o, i) => o.decided && share(o.cut, o.decided) > nation[i]).length;
  const ever = records.filter((r) => r.includes(CUT)).length;
  const notes = own.map((o, i) => (o.decided ? `${pct0(share(o.cut, o.decided))} · ${pct0(nation[i])}` : ''));
  const geom = (width) => (width < 400 ? [30, 70] : [40, 90]);
  const draw = (width) => {
    const [label, right] = geom(width);
    return rollCall({
      records, years: hd.fys.map(String), notes, width, rowH: width < 400 ? 12 : 18, label, right, blank: t('rollNone'),
      brackets: ever && ever < records.length ? [{ from: 0, to: ever, label: fill('rollEver', { n: count(ever) }), pen: true }, { from: ever, to: records.length, label: fill('rollNever', { n: count(records.length - ever) }) }] : [],
    });
  };
  const PLACE_WIDE = 760;
  const pair = drawn(draw, PLACE_WIDE);
  // The grid's own order inline (a place holds a few hundred hospitals at most), for the page script's names.
  const inline = { fys: hd.fys, ccns: order.map(([c]) => c), recs: records, states: order.map(([c]) => hd.stateOf.get(c) ?? '') };
  const chart = html`<div class="roll" data-inline="${JSON.stringify(inline)}"${src ? html` data-src="${src}"` : ''} data-geom="${JSON.stringify({ [String(WIDTH)]: geom(WIDTH), [String(PLACE_WIDE)]: geom(PLACE_WIDE) })}">
${imagePair(pair, t('rollAlt'))}
<p class="roll__readout small" aria-live="polite"></p>
</div>`;
  return figure({
    n: next(), source, chart, csvName: 'hacrp-place-years',
    takeaway: fill('placeHistTakeaway', { name: place.name, k: String(above), n: String(cutYears(hd)), ever: count(ever), hospitals: count(records.length) }),
    table: {
      columns: [{ name: t('rollColFy') }, { name: t('rollColDecided'), numeric: true }, { name: t('rollColCut'), numeric: true }, { name: t('placeHistColShare'), numeric: true }, { name: t('placeHistColNation'), numeric: true }],
      rows: own.map((o, i) => [fyLabel(hd.fys[i]), num(count(o.decided), o.decided), num(count(o.cut), o.cut), o.decided ? num(pct1(share(o.cut, o.decided)), share(o.cut, o.decided)) : '', num(pct1(nation[i]), nation[i])]),
    },
  });
}


// ---------- the year map ----------

export const HIST_MAP_WIDE = 960;
// The year map: every hospital a dot on the US map, its ink for one year (the newest, as the page loads): red if CMS
// cut it that year, pale red if CMS cut it in an earlier year, gray if never so far. The page script steps the year
// (buttons and play) from the history asset.
export function yearMapFigure(hd, { n, source, shapes, master, rollUrl = null }) {
  const order = rollOrder(hd);
  const last = hd.fys.length - 1;
  const points = order.map(([ccn]) => pointOf(master.get(ccn)));
  const unplaced = points.filter((p) => !p).length;
  const draw = (width) => {
    const at = usProjected(shapes, points, width);
    const groups = Object.entries(YEAR_CLASSES).map(([k, cls]) => ({ cls, points: order.map(([, rec], j) => (yearClass(rec, last) === k ? at[j] : null)).filter(Boolean) }));
    return usYearMap({ shapes, groups, size: width < 400 ? 2.4 : 4.2, width });
  };
  const pair = drawn(draw, HIST_MAP_WIDE);
  const c = hd.counts[last];
  const key = html`<ul class="ymap__key" role="list"><li><span class="ymap__sw ymap__sw--now"></span>${t('ymapNow')}</li><li><span class="ymap__sw ymap__sw--scar"></span>${t('ymapScar')}</li><li><span class="ymap__sw ymap__sw--clear"></span>${t('ymapClear')}</li></ul>`;
  const chart = html`<div class="ymap"${rollUrl ? html` data-roll="${rollUrl}"` : ''}>
<div class="ymap__controls" hidden><button type="button" class="ymap__play" data-play="${t('ymapPlay')}" data-stop="${t('ymapStop')}">${t('ymapPlay')}</button><div class="ymap__years" role="group" aria-label="${t('ymapYears')}">${hd.fys.map((fy, i) => html`<button type="button" class="ymap__y" data-i="${String(i)}" aria-pressed="${i === last ? 'true' : 'false'}">${String(fy).slice(-2)}</button>`)}</div></div>
${key}
${imagePair(pair, t('ymapAlt'))}
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

const HAI_NAMES = { CLABSI: 'infCLABSI', CAUTI: 'infCAUTI', SSI_COLON: 'infSsiColon', SSI_HYST: 'infSsiHyst', MRSA: 'infMRSA', CDI: 'infCDI' };
const pooled = (m) => (m && m.predicted > 0 ? m.observed / m.predicted : null);
const signedPct = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pct(Math.abs(x), 0)}`;

// The nation's infection rate per measure, each calendar year Care Compare published one (observed ÷ predicted
// infections, summed over every hospital with both counts), over the share of hospitals CMS cut each fiscal year.
export function infectionsFigure(hd, { n, source }) {
  const inf = hd.infections;
  if (!inf?.length) return null;
  const cys = inf.map((y) => y.cy);
  const xs = Array.from({ length: cys[cys.length - 1] - cys[0] + 1 }, (_, i) => cys[0] + i);
  const panels = Object.keys(HAI_NAMES).map((id) => {
    const points = xs.map((cy) => {
      const y = inf.find((r) => r.cy === cy);
      const v = y ? pooled(y.measures[id]) : null;
      return { x: cy, y: v === null ? null : Math.round(v * 1000) / 1000, tip: v === null ? '' : `${t(HAI_NAMES[id])}, ${cy}: ${v.toFixed(2)}` };
    });
    const firstV = points.find((p) => p.y !== null).y;
    const lastV = [...points].reverse().find((p) => p.y !== null).y;
    const change = lastV / firstV - 1;
    return { id, label: t(HAI_NAMES[id]), points, change: signedPct(change), delta: change };
  });
  const yMax = Math.max(1.2, ...panels.flatMap((p) => p.points.map((pt) => pt.y ?? 0))) ;
  const falls = panels.filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta);
  const draw = (width) => smallLines({ panels, xs, yMax: Math.ceil(yMax * 10) / 10, ref: 1, labels: { ref: t('infRef'), x: (v) => `’${String(v).slice(-2)}` }, width, format: (v) => String(v) });
  const quarter = html`<div class="infq"><p class="infq__h cap">${t('infQuarter')}</p><ol class="hrec__row" role="list">${hd.counts.map((c, i) => html`<li class="hrec__y hrec__y--${c.cut ? 'cut' : 'none'}"><span class="hrec__fy">${String(hd.fys[i]).slice(-2)}</span><span class="hrec__v">${c.cut ? pct0(share(c.cut, c.decided)) : t('recordNone')}</span></li>`)}</ol></div>`;
  const pair = drawn(draw, 760);
  const chart = html`${quarter}<p class="infq__h cap">${t('infRates')}</p>${imagePair(pair, t('infAlt'))}`;
  return figure({
    n, source, chart, csvName: 'hacrp-infections-by-year', claimLevel: 'recomputed',
    takeaway: fill('infTakeaway', { first: String(cys[0]), last: String(cys[cys.length - 1]), a: t(`${HAI_NAMES[falls[0].id]}Short`), aPct: pct(-falls[0].delta, 0), b: t(`${HAI_NAMES[falls[1].id]}Short`), bPct: pct(-falls[1].delta, 0) }),
    note: fill('infNote', { gaps: xs.filter((x) => !cys.includes(x)).map(String).join(' and ') }),
    table: {
      columns: [{ name: t('infColYear') }, ...panels.map((p) => ({ name: p.label, numeric: true }))],
      rows: cys.map((cy) => [String(cy), ...panels.map((p) => { const v = p.points.find((pt) => pt.x === cy).y; return v === null ? '' : num(v.toFixed(3), v); })]),
    },
  });
}

// One hospital's infection rates by calendar year, a panel per measure it has at least two years of results on, each
// over the nation's median hospital (the dashed line). sir: [{ cy, sir: { CLABSI: number|null, … } }].
export function hospitalInfectionsFigure(sir, hd, { n, source }) {
  const inf = hd.infections;
  if (!sir?.length || !inf?.length) return null;
  const cys = inf.map((y) => y.cy);
  const xs = Array.from({ length: cys[cys.length - 1] - cys[0] + 1 }, (_, i) => cys[0] + i);
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
    return { id, label: t(HAI_NAMES[id]), points, under, change: `${have[0].y.toFixed(2)} → ${have[have.length - 1].y.toFixed(2)}`, delta };
  }).filter(Boolean);
  if (!panels.length) return null;
  const top = Math.max(1.5, ...panels.flatMap((p) => p.points.map((pt) => pt.y ?? 0)));
  const yMax = Math.min(Math.ceil(top * 2) / 2, 6);
  const clipped = panels.map((p) => ({ ...p, points: p.points.map((pt) => ({ ...pt, y: pt.y === null ? null : Math.min(pt.y, yMax) })) }));
  const down = panels.filter((p) => p.delta < 0).length;
  const draw = (width) => smallLines({ panels: clipped, xs, yMax, ref: 1, labels: { ref: t('infRef'), x: (v) => `’${String(v).slice(-2)}` }, width, format: (v) => String(v) });
  return figure({
    n, source, csvName: 'hacrp-hospital-infections', alt: t('hinfAlt'),
    takeaway: fill('hinfTakeaway', { down: String(down), m: String(panels.length), first: String(cys[0]), last: String(cys[cys.length - 1]) }),
    key: null,
    note: top > yMax ? fill('hinfClip', { max: String(yMax) }) : null,
    ...drawn(draw, 640),
    table: {
      columns: [{ name: t('infColYear') }, ...panels.map((p) => ({ name: p.label, numeric: true }))],
      rows: xs.filter((cy) => byCy.has(cy)).map((cy) => [String(cy), ...panels.map((p) => { const v = byCy.get(cy)[p.id]; return v === null ? '' : num(v.toFixed(3), Math.min(v, yMax) === v ? v : Math.min(v, yMax)); })]),
    },
  });
}
