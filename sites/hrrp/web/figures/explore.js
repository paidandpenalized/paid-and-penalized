// The program page's "Every hospital" Part: the filter controls and an empty table shell. The rows are not in the page:
// the page's browser script reads them from the hospitals asset (data-src; figures/explore-data.js hospitalsAsset) and
// fills the table, so the page's HTML holds no row. Without a script the shell stays hidden and a sentence says where the
// hospitals are. After sites/hacrp/web/pages/parts.js hospitalTable.
import { html } from '../../../../web/render/html.js';
import { printout } from '../../../../web/render/components.js';
import { fill, t } from '../program/copy.js';

const option = (value, label) => html`<option value="${value}">${label}</option>`;
const field = (id, label, control) => html`<p class="ht__field"><label for="${id}">${label}</label> ${control}</p>`;
const select = (id, any, options) => html`<select id="${id}">${option('', any)}${options}</select>`;

// controls: explore-data.js exploreControls(); url: the hospitals asset's path (null: none, the shell has no source).
export function explorePart(controls, { url = null } = {}) {
  const any = t('exploreAny');
  return html`<p class="part__intro">${t('exploreIntro')}</p>
<p class="ht-nojs">${t('exploreNoScript')}</p>
<p class="ht-retry" role="status"></p>
<div class="ht explore" id="explore-table"${url ? html` data-src="${url}"` : ''} data-page-size="${controls.pageSize}" hidden>
<div class="ht__controls" role="group" aria-label="${t('exploreFilters')}">
${field('ex-text', t('exploreText'), html`<input id="ex-text" type="search" autocomplete="off">`)}
${field('ex-state', t('exploreState'), select('ex-state', any, controls.states.map((s) => option(s, s))))}
${field('ex-peer', t('explorePeer'), select('ex-peer', any, controls.peers.map((p) => option(p, fill('exploreGroup', { n: String(p) })))))}
${field('ex-cond', t('exploreCond'), select('ex-cond', any, controls.conds.map((c) => option(c.key, c.short))))}
${field('ex-teach', t('exploreTeach'), select('ex-teach', any, controls.teach.map((c) => option(c.value, c.label))))}
${field('ex-beds', t('exploreBeds'), select('ex-beds', any, controls.beds.map((b) => option(b, b))))}
${field('ex-loc', t('exploreLocation'), select('ex-loc', any, [option('urban', t('exploreUrban')), option('rural', t('exploreRural'))]))}
<p class="ht__field ht__check"><label><input id="ex-pen" type="checkbox"> ${t('explorePenalized')}</label></p>
${field('ex-sort', t('exploreSort'), html`<select id="ex-sort">${controls.sorts.map((s) => option(`${s.key}:${s.dir}`, t(s.copy)))}</select>`)}
</div>
<p class="small" id="ex-status" aria-live="polite" data-template="${fill('exploreStatus', { from: '{from}', to: '{to}', n: '{n}' })}"></p>
${printout(html`<table class="gb gb--hospitals explore__table">
<caption class="vh">${t('exploreCaption')}</caption>
<thead><tr><th scope="col">${t('exploreColHospital')}</th><th scope="col" class="num">${t('exploreColCut')}</th><th scope="col" class="num">${t('exploreColDollars')}</th><th scope="col">${t('exploreColPeer')}</th><th scope="col">${t('exploreColConds')}</th><th scope="col" class="num">${t('exploreColBeds')}</th></tr></thead>
<tbody></tbody>
</table>`)}
<p class="ht-empty" id="ex-empty" hidden>${t('exploreEmpty')}</p>
<p class="fig__actions"><button type="button" class="fig__btn" id="ex-prev" hidden>${t('explorePrev')}</button> <button type="button" class="fig__btn" id="ex-next" hidden>${t('exploreNext')}</button> <button type="button" class="fig__btn" id="ex-copy" hidden>${t('exploreCopy')}</button> <button type="button" class="fig__btn" id="ex-csv" hidden>${t('exploreDownload')}</button></p>
</div>`;
}
