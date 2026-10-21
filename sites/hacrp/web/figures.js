// The HACRP figures (DES-31), drawn with the chart kit (web/charts/) in HACRP's words: on a hospital page, each
// measure's part of the Total HAC Score and each measure's value against the national range; on the program page,
// the histogram of Total HAC Scores and the state tile grid. Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { has } from '../../../engine/js/has.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { toUnit } from '../../../engine/js/stats.js';
import { contribBars } from '../../../web/charts/contribBars.js';
import { dotRanges } from '../../../web/charts/dotRange.js';
import { figure } from '../../../web/charts/figure.js';
import { histogram, histogramBins } from '../../../web/charts/histogram.js';
import { TILES } from '../../../web/charts/states.js';
import { tileMap } from '../../../web/charts/tileMap.js';
import { cmsText, count, decimal, pct, signed } from '../../../web/render/format.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { FEW_DECIDED, TILE_STEPS_PCT } from './constants.js';
import { fill, t } from './copy.js';
import { flagText } from './whatif-text.js';

// Scores, z-scores and parts of the score are shown at CMS's decimals (DP).
const BINS = 20;
// The wide variant's viewBox width, for screens 560px and up (figure.js svgWide).
const WIDE = 560;
const SHARE_DP = 1;
const num = (text, value) => ({ text, value });
// A chart drawn twice, phone wide and WIDE, for figure()'s svg and svgWide.
const variants = (draw) => ({ svg: draw(undefined), svgWide: draw(WIDE) });

// Each measure's national range, from the model: CMS's floor and cap as published, and the national median of
// published values at CMS's decimals (as the what-if shows it). { [id]: { floor, cap, median, decimals } }.
export function measureRanges(model) {
  return Object.fromEntries(MEASURE_IDS.map((id) => {
    const p = model.params[id];
    return [id, { floor: p.floor, cap: p.cap, median: medianAt(p), decimals: p.decimals }];
  }));
}

// Hospital page: each scored measure's part of the Total HAC Score (its z-score divided by the number scored). chart:
// the what-if's live bars to frame in place of the static bar chart. The takeaway and the table's part column are
// CMS's values; with the live bars, the table gains a Hypothetical column that follows them (the what-if's script
// fills each cell it marks data-wi="part-<id>": "same" until the part moves).
export function partsFigure(view, n, source, chart = null) {
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
    ...(chart ? { chart } : { svg: contribBars({ id: 'parts', rows: parts.map(({ m, value, label }) => ({ id: m.id, label, value, assigned: m.assigned })), format: (v) => signed(v, DP) }) }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colZ'), numeric: true }, { name: t('figColPart'), numeric: true },
        ...(chart ? [{ name: t('whatifHypothetical'), numeric: true }] : [])],
      rows: parts.map(({ m, value, label }) => [label, m.zRaw, num(m.contributionText, value),
        ...(chart ? [{ text: t('whatifSame'), value, data: { wi: `part-${m.id}`, same: '' } }] : [])]),
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
  const notes = rows.some(({ m }) => m.footnotes.length);
  const above = valued.filter((r) => r.value > r.median).length;
  const takeaway = valued.length === 1
    ? fill('figRangeOne', { short: valued[0].m.short, side: t(above ? 'figSideAbove' : 'figSideBelow') })
    : fill('figRangeTakeaway', { k: String(valued.length), above: String(above), rest: String(valued.length - above) });
  return figure({
    n, takeaway, source, claimLevel: 'recomputed', alt: t('figRangeAlt'), csvName: `hacrp-fy${view.fy}-${view.ccn.toLowerCase()}-ranges`,
    key: [{ swatch: 'this', label: t('figRangeThis') }, { swatch: 'median', label: t('figRangeMedian') }, { swatch: 'same', label: t('figRangeSame') }],
    svg: dotRanges({
      medianLabel: t('figRangeMedian'), sameLabel: t('figRangeSame'),
      rows: rows.map(({ m, ...row }) => ({ ...row, title: m.short, label: t('figRangeThis'), note: m.hasValue ? null : t('noValue') })),
    }),
    // A Notes column (CMS's footnotes) only when some measure has one.
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('colValue'), numeric: true }, { name: t('figColFloor'), numeric: true },
        { name: t('figRangeMedian'), numeric: true }, { name: t('figColCap'), numeric: true }, ...(notes ? [{ name: t('colNotes') }] : [])],
      rows: rows.map(({ m, floor, cap, median, format }) => [
        m.short,
        m.hasValue ? m.valueRaw : num(t('noValue'), null),
        num(format(floor), floor), num(format(median), median), num(format(cap), cap),
        ...(notes ? [m.footnotes.map((f) => f.text).join(' ')] : []),
      ]),
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
  const yes = scores.filter((s) => s.yes).length;
  const no = scores.length - yes;
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
    takeaway: fill('figScoresTakeaway', { yes: count(yes), decided: count(scores.length) }),
    ...variants((width) => histogram({
      binned: bins, boundary: lowestYes, markLabel: lineName, markTip: fill('line', boundaryText), markValue: [highestNo, lowestYes], tip,
      xTitle: t('figColScore'), yTitle: t('figColHospitals'),
      groups: { below: fill('figScoresNotCut', { n: count(no) }), above: fill('figScoresCut', { n: count(yes) }) }, width,
    })),
    table: {
      columns: [{ name: t('figColFrom'), numeric: true }, { name: t('figColTo'), numeric: true }, { name: t('figColHospitals'), numeric: true }, { name: t('figColDecision') }],
      rows,
    },
  });
}

const shareOf = (s) => toUnit((100 * s.yes) / s.decided, SHARE_DP);
const shareText = (x) => pct(x / 100, SHARE_DP);

// Program page: per state, the hospitals CMS cut of those with a payment decision; states: stateCounts() (view.js).
// A state whose hospitals are not subject to the reduction is hatched; one with no hospital in CMS's file, or none
// with a decision, is an empty tile; never 0. A code with no tile (a territory such as GU) is not drawn: its row is in the table
// and a note under the grid names it. The national share is the states' own total; the range spans the table's rows.
export function statesFigure({ states, n, source, fy }) {
  const entry = (code) => {
    const s = states[code];
    if (!s) return { code, label: t('figStatesNone'), empty: true };
    if (s.decided === 0) return s.na > 0 ? { code, s, label: t('figStatesNA'), hatched: true } : { code, s, label: t('figStatesNoDecision'), empty: true };
    const value = shareOf(s);
    const few = s.decided < FEW_DECIDED;
    return { code, s, value, few, label: fill('figStatesTile', { yes: count(s.yes), decided: count(s.decided), share: shareText(value) }) };
  };
  const tiles = Object.keys(TILES).map(entry);
  const offGrid = Object.keys(states).filter((code) => !has(TILES, code)).sort().map(entry);
  const listed = [...tiles, ...offGrid];
  const shares = listed.filter((x) => x.value !== undefined).map((x) => x.value);
  const none = num('—', null);
  const total = (k) => Object.values(states).reduce((sum, s) => sum + s[k], 0);
  // A share that rests on few decisions prints its counts, not a percentage that would read as precise.
  const tileText = ({ s, value, few }) => (few ? fill('figStatesFewText', { yes: count(s.yes), decided: count(s.decided) }) : shareText(value));
  const legend = {
    title: t('figColShare'), high: shareText(Math.max(...shares)), zero: t('figStatesZero'),
    few: fill('figStatesFew', { n: count(FEW_DECIDED) }),
  };
  return figure({
    n, source, alt: t('figStatesAlt'), csvName: `hacrp-fy${fy}-states`,
    takeaway: fill('figStatesTakeaway', {
      share: pct(total('yes') / total('decided'), SHARE_DP), low: shareText(Math.min(...shares)), high: shareText(Math.max(...shares)),
    }),
    ...variants((width) => tileMap({
      id: width === WIDE ? 'states-wide' : 'states', ramp: TILE_STEPS_PCT, format: (x) => pct(x / 100, 0), width, showValues: width === WIDE, legend,
      states: Object.fromEntries(tiles.map((x) => [x.code, x.value === undefined
        ? { hatched: x.hatched, empty: x.empty, label: x.label }
        : { value: x.value, label: x.label, few: x.few, text: tileText(x) }])),
    })),
    note: offGrid.length ? fill('figStatesOffGrid', { codes: offGrid.map((x) => x.code).join(', ') }) : null,
    table: {
      columns: [{ name: t('figColState') }, { name: t('figColCut'), numeric: true }, { name: t('figColDecided'), numeric: true }, { name: t('figColShare'), numeric: true }],
      rows: listed.map(({ code, s, value, label }) => (value === undefined
        ? [code, none, none, num(label, null)]
        : [code, num(count(s.yes), s.yes), num(count(s.decided), s.decided), num(shareText(value), value)])),
    },
  });
}
