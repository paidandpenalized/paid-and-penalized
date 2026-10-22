// The hospital page's what-if bars as a figure (each measure's part of the Total HAC Score; the page's other figures
// are in hospital-figures.js, the program and place pages' in program-figures.js). Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { contribBars } from '../../../web/charts/contribBars.js';
import { figure, num } from '../../../web/charts/figure.js';
import { signed } from '../../../web/render/format.js';
import { fill, t } from './copy.js';

// Scores, z-scores and parts of the score are shown at CMS's decimals (DP).

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
