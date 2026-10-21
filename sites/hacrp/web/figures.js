// The HACRP figures (DES-31), drawn with the chart kit (web/charts/) in HACRP's words: on a hospital page, each
// measure's part of the Total HAC Score and each measure's value against the national range; on the program page,
// the median hospital against CMS's line (the formula stepper's last step), the histogram of Total HAC Scores and
// the state tile grid. Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { toUnit } from '../../../engine/js/stats.js';
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
import { TILE_STEPS_PCT } from './constants.js';
import { fill, t } from './copy.js';
import { flagText } from './whatif-text.js';

// Scores, z-scores and parts of the score are shown at CMS's decimals (DP).
const BINS = 20;
const SHARE_DP = 1;
const num = (text, value) => ({ text, value });

// Each measure's national range, from the model: CMS's floor and cap as published, and the national median of
// published values at CMS's decimals (as the what-if shows it). { [id]: { floor, cap, median, decimals } }.
export function measureRanges(model) {
  return Object.fromEntries(MEASURE_IDS.map((id) => {
    const p = model.params[id];
    return [id, { floor: p.floor, cap: p.cap, median: medianAt(p), decimals: p.decimals }];
  }));
}

// Hospital page: each scored measure's part of the Total HAC Score (its z-score divided by the number scored).
export function partsFigure(view, n, source) {
  // The plotted part is the number the view's text shows (so the bar, its table and the takeaway agree to the digit).
  const parts = view.measures.filter((m) => m.contribution !== null).map((m) => ({
    m, value: m.contributionRaw, label: m.assigned ? fill('figPartsAssigned', { short: m.short }) : m.short,
  }));
  const { largest } = view;
  const takeaway = largest
    ? fill('figPartsTakeaway', { short: largest.short, total: view.score.text, contribution: largest.contributionText })
    : fill('figPartsNone', { total: view.score.text, n: String(view.n) });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', alt: t('figPartsAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-parts`,
    svg: contribBars({ id: 'parts', rows: parts.map(({ m, value, label }) => ({ id: m.id, label, value, assigned: m.assigned })), format: (v) => signed(v, DP) }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colZ'), numeric: true }, { name: t('figColPart'), numeric: true }],
      rows: parts.map(({ m, value, label }) => [label, m.zRaw, num(m.contributionText, value)]),
    },
  });
}

// Hospital page: each measure's value against the national range, one row per measure on its own scale. null when
// no measure has a published value.
export function rangeFigure(view, ranges, n, source) {
  const rows = view.measures.map((m) => {
    const { floor, cap, median, decimals } = ranges[m.id];
    return { m, floor, cap, median, value: m.hasValue ? Number(m.valueRaw) : null, format: (v) => decimal(v, decimals) };
  });
  const valued = rows.filter((r) => r.value !== null);
  if (!valued.length) return null;
  const above = valued.filter((r) => r.value > r.median).length;
  const takeaway = valued.length === 1
    ? fill('figRangeOne', { short: valued[0].m.short, side: t(above ? 'figSideAbove' : 'figSideBelow') })
    : fill('figRangeTakeaway', { k: String(valued.length), above: String(above), rest: String(valued.length - above) });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', alt: t('figRangeAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-ranges`,
    svg: dotRanges({
      medianLabel: t('figRangeMedian'), rangeLabel: t('figRangeRange'),
      rows: rows.map(({ m, ...row }) => ({ ...row, title: m.hasValue ? m.short : fill('figRangeNoValue', { short: m.short }), label: t('figRangeThis') })),
    }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colValue'), numeric: true }, { name: t('figColFloor'), numeric: true },
        { name: t('figRangeMedian'), numeric: true }, { name: t('figColCap'), numeric: true }, { name: t('colNotes') }],
      rows: rows.map(({ m, floor, cap, median, format }) => [
        m.short,
        m.hasValue ? m.valueRaw : num(t('noValue'), null),
        num(format(floor), floor), num(format(median), median), num(format(cap), cap),
        m.footnotes.map((f) => f.text).join(' '),
      ]),
    },
  });
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
      labels: { actual: label, line: t('whatifRampLine'), lineTip: fill('line', boundaryText) }, format: (v) => decimal(v, DP),
    }),
    table: {
      columns: [{ name: t('figColMark') }, { name: t('figColScore'), numeric: true }],
      rows: [
        [label, hospital.totalText],
        [t('figLineHighestNo'), num(boundaryText.highestNo, highestNo)],
        [t('figLineLowestYes'), num(boundaryText.lowestYes, lowestYes)],
      ],
    },
  });
}

// Program page: the Total HAC Scores of hospitals with a Yes or No decision. scores: [{ total, yes }]. CMS's line is
// the gap between its highest No score and its lowest Yes score (boundary: the numbers; boundaryText: CMS's text),
// and every word about it names both. The chart draws it at the lowest Yes score, a bin edge, so a bin at or above
// it holds only Yes decisions and a bin below it only No; a decision on the wrong side of that score stops the build.
// The table lists the bins with the line between them.
export function scoresFigure({ scores, boundary, boundaryText, n, source, fy }) {
  const { highestNo, lowestYes } = boundary;
  const wrong = scores.find((s) => s.yes !== (s.total >= lowestYes));
  if (wrong) throw new RangeError(`scoresFigure: a ${wrong.yes ? 'Yes' : 'No'} decision at ${wrong.total} is on the wrong side of CMS's lowest Yes score, ${lowestYes}`);
  const bins = histogramBins(scores.map((s) => s.total), BINS, lowestYes);
  const decisionOf = (b) => (b.count === 0 ? '' : flagText(b.above ? 'Yes' : 'No'));
  const at = (v) => decimal(v, DP);
  const tip = (b) => {
    const span = { from: at(b.x0), to: at(b.x1) };
    if (b.count === 0) return fill('figScoresTipNone', span);
    const decision = decisionOf(b);
    return b.count === 1 ? fill('figScoresTipOne', { ...span, decision }) : fill('figScoresTip', { ...span, decision, count: count(b.count) });
  };
  const lineName = t('whatifRampLine');
  const binRow = (b) => [num(at(b.x0), b.x0), num(at(b.x1), b.x1), num(count(b.count), b.count), decisionOf(b)];
  const lineRow = [num(boundaryText.highestNo, highestNo), num(boundaryText.lowestYes, lowestYes), num('—', null), lineName];
  const firstAbove = bins.findIndex((b) => b.above);
  const rows = bins.map(binRow);
  rows.splice(firstAbove < 0 ? rows.length : firstAbove, 0, lineRow);
  return figure({
    n, source, alt: t('figScoresAlt'), csvName: `hacrp-fy${fy}-scores`,
    takeaway: fill('figScoresTakeaway', { yes: count(scores.filter((s) => s.yes).length), decided: count(scores.length) }),
    svg: histogram({
      binned: bins, boundary: lowestYes, markLabel: lineName, markTip: fill('line', boundaryText), markValue: [highestNo, lowestYes], tip,
    }),
    table: {
      columns: [{ name: t('figColFrom'), numeric: true }, { name: t('figColTo'), numeric: true }, { name: t('figColHospitals'), numeric: true }, { name: t('figColDecision') }],
      rows,
    },
  });
}

const shareOf = (s) => toUnit((100 * s.yes) / s.decided, SHARE_DP);
const shareText = (x) => pct(x / 100, SHARE_DP);

// Program page: per state, the hospitals CMS cut of those with a payment decision; states: stateCounts() (view.js).
// A state whose hospitals are not subject to the reduction, one with no hospital in CMS's file and one with no
// decision are hatched, never 0. The national share is the states' own total.
export function statesFigure({ states, n, source, fy }) {
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
  const total = (k) => Object.values(states).reduce((sum, s) => sum + s[k], 0);
  return figure({
    n, source, alt: t('figStatesAlt'), csvName: `hacrp-fy${fy}-states`,
    takeaway: fill('figStatesTakeaway', {
      share: pct(total('yes') / total('decided'), SHARE_DP), low: shareText(Math.min(...shares)), high: shareText(Math.max(...shares)),
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
