// Step 2, how the scenario works: in the words column, the step's heading and lede, Urban Institute's three cases (the
// page's case marked, CMS's count noted at the low case), the way into "mitigation", and the four worksheets as pop-outs
// (native popovers, opened by each link's button; Esc, a click outside or the close button shuts them; a browser without
// popovers shows them here as text); beside it, the stage: Figure 2, the chain (chain.js) at the middle case and the
// default use rate. client/how.js redraws the chain and the worksheets when the case or the use rate moves.
import { figure, num } from '../../../../web/charts/figure.js';
import { count, decimal, money } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { DEFAULT_SCENARIO, SCENARIOS } from '../constants.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH } from '../links.js';
import { LINKS, TABLE_ROWS, chainHtml, statusText, worksheetBody } from './chain.js';
import { declineRange, serverTotals } from './model.js';
import { scenWord } from './ranges.js';

// What the chain and the worksheets read besides the totals: the cost reports' year, the two fixed shares of the care
// and the what-if's top use rate (params: the drawings keep room for the largest amounts it allows), and each case's
// range of state declines. data: loadMedicaid()'s result.
export const howModel = (data) => ({
  fy: data.meta.fy,
  params: { uninsured_share: data.params.uninsured_share, care_still_used: data.params.care_still_used, use_max: data.params.use_max },
  declines: declineRange(data.states),
});

// Urban's three cases, each with its national enrollment decline (the file's scenarios, in thousands), its mitigation
// and its gist; the selected case marked, and the low case carrying CMS's count.
function cases(data, selected) {
  const enrollees = Object.fromEntries(data.scenarios.map((s) => [s.id, s.decline_enrollment]));
  return html`<ul class="wr-cases" role="list">${SCENARIOS.map((s) => html`<li class="wr-case" data-scen="${s}"${s === selected ? html` aria-current="true"` : ''}>
<p class="wr-case__name"><b>${scenWord(s)}</b> <span class="wr-case__n">${fill('stripEnrollees', { n: decimal(enrollees[s] / 1000, 1) })}</span></p>
<p class="wr-case__mit">${t(`stripMit_${s}`)}</p>
<p class="wr-case__d">${t(`caseDesc_${s}`)}</p>${s === 'low' ? html`
<p class="wr-case__note">${t('caseOfficial')}</p>` : ''}
</li>`)}</ul>`;
}

// What "mitigation" means, at the head of the second worksheet, with the three cases in brief.
const mitigation = (data, selected) => html`<div class="wr-mitig">
<p class="wr-mitig__h">${t('mitHead')}</p>
<p>${t('mitText')}</p>
<p>${t('mitMap')}</p>
<p>${t('mitStates')}</p>
<ul class="wr-mitig__cases" role="list">${SCENARIOS.map((s) => html`<li class="wr-mitcase" data-scen="${s}"${s === selected ? html` aria-current="true"` : ''}><b>${scenWord(s)}</b> ${fill('stripEnrollees', { n: decimal(data.scenarios.find((x) => x.id === s).decline_enrollment / 1000, 1) })} · ${t(`stripMit_${s}`)}</li>`)}</ul>
</div>`;

// Link n's worksheet: a popover holding its lines, titled, with its close button and the way to Methods.
function worksheet(n, view, data) {
  const { lines: [from, to] } = LINKS[n - 1];
  const id = `wr-ws-${n}`;
  return html`<div class="wr-ws" id="${id}" popover role="dialog" aria-labelledby="${id}-t">
<div class="wr-ws__head"><p class="wr-ws__t" id="${id}-t">${fill('wsTitle', { from: count(from), to: count(to), what: t(`link${n}Lab`) })}</p><button type="button" class="wr-ws__x" popovertarget="${id}" popovertargetaction="hide" aria-label="${t('wsClose')}">${t('wsCloseMark')}</button></div>
${n === 2 ? mitigation(data, view.scenario) : ''}
<table class="wr-ws__lines"><thead class="vh"><tr><th scope="col">${t('wsLine')}</th><th scope="col">${t('wsWhat')}</th><th scope="col">${t('wsAmount')}</th></tr></thead>
<tbody class="wr-ws__body" data-ws-body="${n}">${worksheetBody(n, view)}</tbody></table>
<p class="wr-ws__foot small"><span data-how-status>${statusText(view)}</span> · <a href="${METHODS_PATH}">${t('wsMethods')}</a></p>
</div><!-- /wr-ws -->`;
}

// Figure 2's table: every amount the chain draws, in each case (data-how names each cell for the script).
const tableOf = (totals) => ({
  columns: [{ name: t('chainTableRow') }, ...SCENARIOS.map((s) => ({ name: scenWord(s), numeric: true }))],
  rows: TABLE_ROWS.map(([label, key, sign]) => [t(label), ...SCENARIOS.map((s) => {
    const v = sign * totals[s][key];
    return { ...num(money(v), v), data: { how: `${key} ${s}` } };
  })]),
});

// The step. data: loadMedicaid()'s result; label: its heading (the section menu's label).
export function howStep({ data, label }) {
  const fy = data.meta.fy;
  const view = { totals: serverTotals(data), scenario: DEFAULT_SCENARIO, use: data.params.use_default, how: howModel(data) };
  const inScenario = [...data.hospitals.values()].filter((row) => row[data.columns.indexOf('cls')] === 'scenario').length;
  return html`<section class="step wr-step wr-how" id="how" aria-labelledby="how-h">
<div class="wr-step__words">
<h2 class="wr-sec" id="how-h">${label} ${scenarioTag(fy)}</h2>
<p class="wr-how__big">${t('howBig')}</p>
<p class="small">${t('howLede')}</p>
<p class="cap wr-how__cases">${t('casesHead')}</p>
${cases(data, view.scenario)}
<p class="small"><button type="button" class="wr-mit" popovertarget="wr-ws-2">${t('mitOpen')}</button></p>
<p class="small muted">${t('howHint')}</p>
${LINKS.map(({ n }) => worksheet(n, view, data))}
</div>
<div class="wr-step__stage">
${figure({
    n: 2,
    takeaway: fill('howTakeaway', { n: count(inScenario) }),
    chart: chainHtml(view),
    source: html`${fill('figSource', { fy: String(fy) })} ${scenarioTag(fy)}`,
    claimLevel: 'hypothetical',
    table: tableOf(view.totals),
    csvName: 'work-requirement-chain',
  })}
</div>
</section>`;
}
