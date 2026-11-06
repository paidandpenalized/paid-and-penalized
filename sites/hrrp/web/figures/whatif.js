// A hospital page's what-if: one slider for each condition the hospital is measured on, "Reset" and "Bring all to median", the
// hypothetical cut, factor and dollars beside the actual ones, and under them the waterfall of the parts of the cut at those
// ratios (figures/waterfall.js, drawn by the same code in the browser as the sliders move: client/hospital.js). Each row says its
// escape value, the ratio that reaches the median, and what reaching it alone would save. Without the script the sliders are
// disabled at the actual ratios and the figure reads as the page was built. Data from figures/whatif-data.js; words in hospital/copy.js.
import { MIN_DISCHARGES } from '../../../../engine/js/hrrp/formula.js';
import { figure, num } from '../../../../web/charts/figure.js';
import { formField } from '../../../../web/render/components.js';
import { html, jsonScript } from '../../../../web/render/html.js';
import { fill, t } from '../hospital/copy.js';
import { estimateTag } from '../pages/parts.js';
import { factor4, fmtMoney, fmtPct, ratio } from '../numbers.js';
import { waterfallPair } from './waterfall.js';
import { WI_STEP, resultWords } from './whatif-data.js';

// The page data's script id.
export const WHATIF_DATA_ID = 'hrrp-hospital';

// The words under a slider about getting its condition to the median.
export function escapeWords(row) {
  if (!row.over) return t('wiEscapeAlready');
  const e = row.escape;
  const median = ratio(e.ratio);
  if (e.noWeight) return fill('wiEscapeNoWeight', { median });
  if (e.saveCut <= 0) return fill(e.atCap ? 'wiEscapeNothingCap' : 'wiEscapeNothing', { median });
  return e.saveDollars === null ? fill('wiEscapeNoDollars', { median, cut: fmtPct(e.saveCut) })
    : fill('wiEscape', { median, cut: fmtPct(e.saveCut), dollars: fmtMoney(e.saveDollars) });
}

const slider = (row) => {
  const id = `wi-${row.cond.toLowerCase().replace(/_/g, '-')}`;
  return html`<li class="wi__row" data-cond="${row.cond}">
<label class="wi__name" for="${id}"><b>${row.short}</b><small>${fill('wiSliderMedian', { median: ratio(row.med, 3) })}</small></label>
<input class="wi__range" type="range" id="${id}" data-wi="range" min="${row.min}" max="${row.max}" step="${WI_STEP}" value="${row.err}" aria-label="${fill('wiSliderHint', { short: row.short })}">
<output class="wi__val" for="${id}" data-wi="val">${ratio(row.err, 3)}</output>
<p class="small wi__escape">${escapeWords(row)}</p>
</li>`;
};

// The page's data for the script: the starting state's page data and the hospital's worksheet row (figures/whatif-data.js client).
export const whatIfScriptData = (wi) => jsonScript(WHATIF_DATA_ID, wi.client);

// wi: whatIfData(); view: hospitalView()'s result (the edition, the CCN, the dollars); n: the figure's number.
export function whatIfFigure(wi, { view, n }) {
  const words = resultWords(wi.start);
  const priced = wi.start.pen !== null;
  const fields = html`${formField({ no: 'W1', label: t('wiFieldCut'), value: html`<span data-wi="cut">${words.cut}</span>`, size: null, cls: 'wi__big', note: fill('wiActual', { value: fmtPct(wi.start.actualCut) }) })}
${formField({ no: 'W2', label: t('wiFieldFactor'), value: html`<span data-wi="factor">${words.factor}</span>`, note: fill('wiActual', { value: factor4(wi.start.actualPaf) }) })}
${formField({ no: 'W3', label: t('wiFieldDollars'), value: html`<span data-wi="dollars">${words.dollars}</span>${priced ? estimateTag : ''}`, note: priced ? fill('wiActualDollars', { value: fmtMoney(wi.start.pen) }) : t('wiNoEstimate') })}`;
  const chart = html`<div class="wi" data-hosp-whatif>
<p class="small muted wi__nojs" data-wi="nojs">${t('wiNoScript')}</p>
<div class="wi__controls">
<fieldset class="wi__fields" data-wi="fields" disabled>
<legend class="vh">${t('wiSlidersLabel')}</legend>
<ul class="wi__rows" role="list">
${wi.sliders.map(slider)}</ul>
</fieldset>
<p class="wi__btns" data-wi="buttons" hidden><button type="button" class="fig__btn" data-wi="reset">${t('wiReset')}</button> <button type="button" class="fig__btn" data-wi="median" aria-describedby="wi-median-help">${t('wiToMedian')}</button></p>
<p class="small muted wi__help" id="wi-median-help" data-wi="help" hidden>${t('wiToMedianHelp')}</p>
</div>
<div class="form wi__out" role="group" aria-label="${t('wiResultsLabel')}">
${fields}
</div>
<p class="vh" role="status" data-wi="live"></p>
<h3 class="wi__title">${t('wiPartsTitle')}</h3>
<div class="wi__parts" data-wi="parts">${waterfallPair(wi.wf, t('wiWfAlt'))}</div>
</div>`;
  const dash = num(t('cellNone'), null);
  return figure({
    n,
    takeaway: fill('wiTakeaway', { edition: view.edition }),
    source: t('wiSource'),
    claimLevel: 'estimate',
    csvName: `hrrp-${view.ccn.toLowerCase()}-what-if`,
    chart,
    table: {
      columns: [{ name: t('wiColCond') }, { name: t('wiColRatio'), numeric: true }, { name: t('wiColEscape'), numeric: true },
        { name: t('wiColSaveCut'), numeric: true }, { name: t('wiColSaveDollars'), numeric: true }],
      rows: wi.sliders.map((row) => [
        row.short, num(ratio(row.err), row.err),
        row.over ? num(ratio(row.escape.ratio), row.escape.ratio) : dash,
        row.over && row.escape.saveCut !== null ? num(fmtPct(row.escape.saveCut), row.escape.saveCut) : dash,
        row.over && row.escape.saveDollars !== null ? num(fmtMoney(row.escape.saveDollars), row.escape.saveDollars) : dash,
      ]),
    },
  });
}

// The block when no condition was measured: a sentence and no figure number.
export const whatIfNone = () => html`<p class="muted hosp__nowi">${fill('wiNone', { minCases: String(MIN_DISCHARGES) })}</p>`;
