// The HACRP figures (DES-31), drawn with the chart kit (web/charts/) in HACRP's words: on a hospital page, each
// measure's part of the Total HAC Score and each measure's value against the national range; on the program page,
// the median hospital against CMS's line (the formula stepper's last step), the histogram of Total HAC Scores and
// the state tile grid. Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { clamp, toUnit } from '../../../engine/js/stats.js';
import { contribBars } from '../../../web/charts/contribBars.js';
import { dotRanges } from '../../../web/charts/dotRange.js';
import { figure } from '../../../web/charts/figure.js';
import { histogram, histogramBins } from '../../../web/charts/histogram.js';
import { ramp } from '../../../web/charts/ramp.js';
import { TILES } from '../../../web/charts/states.js';
import { tileMap } from '../../../web/charts/tileMap.js';
import { cmsText, count, decimal, pct, signed } from '../../../web/render/format.js';
import { rampDomain } from '../../../web/whatif/marks.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { SHORT_NAMES, TILE_STEPS_PCT } from './constants.js';
import { fill, t } from './copy.js';

// Scores, z-scores and parts of the score at CMS's four decimals; the stepper's fitted mean and SD likewise.
const DP = 4;
const BINS = 20;
const SHARE_DP = 1;
const num = (text, value) => ({ text, value: value === null ? null : String(value) });

// Each measure's national range, from the model: CMS's floor and cap as published, and the national median of
// published values at CMS's decimals (as the what-if shows it). { [id]: { floor, cap, median, decimals } }.
export function measureRanges(model) {
  return Object.fromEntries(MEASURE_IDS.map((id) => {
    const { floor, cap, median, decimals } = model.params[id];
    return [id, { floor, cap, median: toUnit(median, decimals), decimals }];
  }));
}

// Hospital page: each scored measure's part of the Total HAC Score (its z-score divided by the number scored).
export function partsFigure(view, n, source) {
  // The plotted part is the view's own text of it (so the bar, its table and the takeaway agree to the digit).
  const parts = view.measures.filter((m) => m.contribution !== null).map((m) => ({
    m, value: Number(m.contributionText.replace('−', '-')), label: m.assigned ? fill('figPartsAssigned', { short: m.short }) : m.short,
  }));
  const largest = view.largest && view.measures.find((m) => m.id === view.largest.id);
  const takeaway = largest
    ? fill('figPartsTakeaway', { short: largest.short, total: view.score.text, contribution: view.largest.contributionText })
    : fill('figPartsNone', { total: view.score.text, n: String(view.n) });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', alt: t('figPartsAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-parts`,
    svg: contribBars({ id: 'parts', rows: parts.map(({ m, value, label }) => ({ id: m.id, label, value, assigned: m.assigned })), format: (v) => signed(v, DP) }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colZ'), numeric: true }, { name: t('figColPart'), numeric: true }],
      rows: parts.map(({ m, value, label }) => [label, num(m.zText, m.zRaw), num(m.contributionText, value)]),
    },
  });
}

// Hospital page: each measure's value against the national range, one row per measure on its own scale. null when
// no measure has a published value.
export function rangeFigure(view, ranges, n, source) {
  const valued = view.measures.filter((m) => m.hasValue);
  if (!valued.length) return null;
  const valueOf = (m) => (m.hasValue ? Number(m.valueRaw) : null);
  const above = valued.filter((m) => valueOf(m) > ranges[m.id].median);
  const takeaway = valued.length === 1
    ? fill('figRangeOne', { short: valued[0].short, side: t(above.length ? 'figSideAbove' : 'figSideBelow') })
    : fill('figRangeTakeaway', { k: String(valued.length), above: String(above.length), rest: String(valued.length - above.length) });
  const rows = view.measures.map((m) => {
    const r = ranges[m.id];
    const at = (v) => decimal(v, r.decimals);
    return { m, r, at, title: m.hasValue ? m.short : fill('figRangeNoValue', { short: m.short }) };
  });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', alt: t('figRangeAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-ranges`,
    svg: dotRanges({
      medianLabel: t('figRangeMedian'), rangeLabel: t('figRangeRange'),
      rows: rows.map(({ m, r, at, title }) => ({ title, value: valueOf(m), floor: r.floor, cap: r.cap, median: r.median, label: t('figRangeThis'), format: at })),
    }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colValue'), numeric: true }, { name: t('figColFloor'), numeric: true },
        { name: t('figRangeMedian'), numeric: true }, { name: t('figColCap'), numeric: true }, { name: t('colNotes') }],
      rows: rows.map(({ m, r, at }) => [
        m.short,
        m.hasValue ? num(m.valueText, m.valueRaw) : num(t('noValue'), null),
        num(at(r.floor), r.floor), num(at(r.median), r.median), num(at(r.cap), r.cap),
        m.footnotes.map((f) => f.text).join(' '),
      ]),
    },
  });
}

// The stepper's numbers for the median hospital (medianHospital), measure by measure: its value, CMS's floor and
// cap, the value limited to them, the fitted mean and SD, and its z-score. All as display text. The mean and SD
// show the fewest decimals, from DP up, at which every row's z-score follows from its own shown cells (fitDp).
const MAX_FIT_DP = 10;
export function stepRows(hospital, model) {
  const rows = MEASURE_IDS.map((id) => {
    const m = hospital.measures[id];
    const p = model.params[id];
    return { id, m, p, limited: toUnit(clamp(m.value, p.floor, p.cap), p.decimals) };
  });
  const reproduces = (dp) => rows.every(({ m, p, limited }) =>
    decimal(toUnit((limited - toUnit(p.mean, dp)) / toUnit(p.sd, dp), DP), DP) === cmsText(m.zText));
  let fitDp = DP;
  while (!reproduces(fitDp)) {
    if (++fitDp > MAX_FIT_DP) throw new RangeError('stepRows: no display precision reproduces the z-scores');
  }
  return rows.map(({ id, m, p, limited }) => {
    const at = (v) => decimal(v, p.decimals);
    return {
      id, short: SHORT_NAMES[id], valueText: cmsText(m.valueText), floorText: at(p.floor), capText: at(p.cap),
      limitedText: at(limited), meanText: decimal(p.mean, fitDp), sdText: decimal(p.sd, fitDp), zText: cmsText(m.zText), fitDp,
    };
  });
}

// The stepper's average step: how many z-scores, and their sum as text (each z is CMS-style text at four
// decimals, so the sum is exact at that unit and the sum divided by n rounds to the total).
export function stepSum(hospital) {
  const zs = MEASURE_IDS.map((id) => hospital.measures[id].z).filter((z) => z !== null);
  return { n: zs.length, sumText: decimal(toUnit(zs.reduce((a, b) => a + b, 0), DP), DP) };
}

// Program page: the median hospital's Total HAC Score against CMS's line, the stepper's last step.
export function lineFigure({ hospital, model, range, boundaryText, n, source, fy = hospital.fiscalYear }) {
  const { highestNo, lowestYes } = model.boundary;
  const total = cmsText(hospital.totalText);
  const words = {
    No: ['figLineNo', { total, highestNo: boundaryText.highestNo }],
    Yes: ['figLineYes', { total, lowestYes: boundaryText.lowestYes }],
    'too-close': ['figLineClose', { total, ...boundaryText }],
  }[hospital.paymentReduction];
  if (!words) throw new RangeError(`lineFigure: unexpected decision "${hospital.paymentReduction}"`);
  const label = t('figLineMedian');
  return figure({
    n, source, claimLevel: 'hypothetical', alt: t('figLineAlt'), csvName: `hacrp-fy${fy}-median-hospital`,
    takeaway: fill(...words),
    svg: ramp({
      domain: rampDomain(range, { actual: hospital.total, highestNo, lowestYes }), actual: hospital.total, band: [highestNo, lowestYes],
      labels: { actual: label, line: t('whatifRampLine') }, format: (v) => decimal(v, DP),
    }),
    table: {
      columns: [{ name: t('figColMark') }, { name: t('figColScore'), numeric: true }],
      rows: [
        [label, num(total, hospital.totalText)],
        [t('figLineHighestNo'), num(boundaryText.highestNo, highestNo)],
        [t('figLineLowestYes'), num(boundaryText.lowestYes, lowestYes)],
      ],
    },
  });
}

// Program page: the Total HAC Scores of hospitals with a Yes or No decision. scores: [{ total, yes }]. Bins have
// CMS's lowest Yes score as an edge, so each holds one decision; a bin holding both stops the build.
export function scoresFigure({ scores, boundary, counts, n, source, fy }) {
  const values = scores.map((s) => s.total);
  const edge = boundary.lowestYes;
  const bins = histogramBins(values, BINS, edge).map((b) => ({ ...b, yes: 0, no: 0 }));
  for (const s of scores) {
    const b = bins.find((x, i) => s.total >= x.x0 && (s.total < x.x1 || i === bins.length - 1));
    b[s.yes ? 'yes' : 'no'] += 1;
  }
  const decisionOf = (b) => {
    if (b.yes && b.no) throw new RangeError(`scoresFigure: the bin from ${b.x0} to ${b.x1} holds both Yes and No decisions`);
    return b.yes ? t('flagYes') : b.no ? t('flagNo') : '';
  };
  const decisions = bins.map(decisionOf);
  const decisionAt = new Map(bins.map((b, i) => [b.x0, decisions[i]]));
  const at = (v) => decimal(v, DP);
  // The histogram bins the same values the same way, so a column's bin is found by its lower edge.
  const tip = (b) => {
    const span = { from: at(b.x0), to: at(b.x1) };
    if (b.count === 0) return fill('figScoresTipNone', span);
    const decision = decisionAt.get(b.x0);
    return b.count === 1 ? fill('figScoresTipOne', { ...span, decision }) : fill('figScoresTip', { ...span, decision, count: count(b.count) });
  };
  return figure({
    n, source, alt: t('figScoresAlt'), csvName: `hacrp-fy${fy}-scores`,
    takeaway: fill('figScoresTakeaway', { yes: count(counts.yes), decided: count(counts.decided) }),
    svg: histogram({ values, bins: BINS, boundary: edge, markLabel: t('whatifRampLine'), tip }),
    table: {
      columns: [{ name: t('figColFrom'), numeric: true }, { name: t('figColTo'), numeric: true }, { name: t('figColHospitals'), numeric: true }, { name: t('figColDecision') }],
      rows: bins.map((b, i) => [num(at(b.x0), b.x0), num(at(b.x1), b.x1), num(count(b.count), b.count), decisions[i]]),
    },
  });
}

// Per state (the master's code): { hospitals, decided (scored, Yes or No), yes, na (scored, decision N/A) }.
export function stateCounts(views) {
  const out = {};
  for (const v of views) {
    const s = (out[v.state] ??= { hospitals: 0, decided: 0, yes: 0, na: 0 });
    s.hospitals += 1;
    const d = v.decision.text;
    if (v.scored && (d === 'Yes' || d === 'No')) {
      s.decided += 1;
      if (d === 'Yes') s.yes += 1;
    }
    if (v.scored && d === 'N/A') s.na += 1;
  }
  return out;
}

const shareOf = (s) => toUnit((100 * s.yes) / s.decided, SHARE_DP);
const shareText = (x) => pct(x / 100, SHARE_DP);

// Program page: per state, the hospitals CMS cut of those with a payment decision. A state whose hospitals are
// not subject to the reduction, one with no hospital in CMS's file and one with no decision are hatched, never 0.
export function statesFigure({ states, counts, n, source, fy }) {
  for (const code of Object.keys(states)) if (!Object.hasOwn(TILES, code)) throw new RangeError(`statesFigure: state code ${code} has no tile`);
  const tiles = Object.keys(TILES).map((code) => {
    const s = states[code];
    if (!s) return { code, label: t('figStatesNone') };
    if (s.decided === 0) return { code, s, label: t(s.na > 0 ? 'figStatesNA' : 'figStatesNoDecision') };
    const value = shareOf(s);
    return { code, s, value, label: fill('figStatesTile', { yes: count(s.yes), decided: count(s.decided), share: shareText(value) }) };
  });
  const shares = tiles.filter((x) => x.value !== undefined).map((x) => x.value);
  const none = num('—', null);
  return figure({
    n, source, alt: t('figStatesAlt'), csvName: `hacrp-fy${fy}-states`,
    takeaway: fill('figStatesTakeaway', {
      share: pct(counts.yes / counts.decided, SHARE_DP), low: shareText(Math.min(...shares)), high: shareText(Math.max(...shares)),
    }),
    svg: tileMap({
      id: 'states', ramp: TILE_STEPS_PCT, format: (x) => pct(x / 100, 0),
      states: Object.fromEntries(tiles.map(({ code, value, label }) => [code, value === undefined ? { hatched: true, label } : { value, label }])),
    }),
    table: {
      columns: [{ name: t('figColState') }, { name: t('figColCut'), numeric: true }, { name: t('figColDecided'), numeric: true }, { name: t('figColShare'), numeric: true }],
      rows: tiles.map(({ code, s, value, label }) => (value === undefined
        ? [code, none, none, num(label, null)]
        : [code, num(count(s.yes), s.yes), num(count(s.decided), s.decided), num(shareText(value), value)])),
    },
  });
}
