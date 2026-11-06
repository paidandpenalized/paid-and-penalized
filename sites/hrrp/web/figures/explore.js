// The program page's "Every hospital" Part: the filter controls and an empty table shell. The rows are not in the page:
// the page's browser script (client/place-tables.js, the code the place pages' hospitals tables use) reads them from the rows
// asset (data-src; figures/place-table-data.js placeRowsAsset) and fills the table, so the page's HTML holds no row. Without a
// script the shell stays hidden and a sentence points to the full hospitals CSV; with one, that sentence goes and a line takes its
// place (data-nojs and data-note name the two), saying the list is loading, or that it did not load and a touch tries again.
// After sites/hacrp/web/pages/parts.js hospitalTable. filterControls is the filter row both hospitals tables use.
import { html } from '../../../../web/render/html.js';
import { printout } from '../../../../web/render/components.js';
import { fill, t } from '../program/copy.js';
import { statusTemplate } from './pager.js';

export const option = (value, label) => html`<option value="${value}">${label}</option>`;
export const field = (id, label, control) => html`<p class="ht__field"><label for="${id}">${label}</label> ${control}</p>`;
export const select = (id, any, options) => html`<select id="${id}">${option('', any)}${options}</select>`;

// The filter row of a hospitals table. prefix: the control ids' start (the script reads #{prefix}-text, -state, -peer, -cond, -teach,
// -beds, -loc, -pen, -sort); w: the page's words { filters, any, text, state, peer, group(n), cond, teach, beds, location, urban,
// rural, penalized, sort, sortBy(key) }; states: the state codes to filter by (none or one: no state filter); peers: the peer groups;
// conds: [{ short }] in program order; teach: [{ value, label }]; beds: the bed bands; sorts: the sort keys, in the order offered.
export function filterControls({ prefix, w, states, peers, conds, teach, beds, sorts, hidden = false }) {
  const id = (name) => `${prefix}-${name}`;
  return html`<div class="ht__controls ph__controls" role="group" aria-label="${w.filters}"${hidden ? html` hidden` : ''}>
${field(id('text'), w.text, html`<input id="${id('text')}" type="search" autocomplete="off">`)}
${states.length > 1 ? field(id('state'), w.state, select(id('state'), w.any, states.map((s) => option(s, s)))) : ''}
${field(id('peer'), w.peer, select(id('peer'), w.any, peers.map((p) => option(p, w.group(p)))))}
${field(id('cond'), w.cond, select(id('cond'), w.any, conds.map((c, i) => option(String(i), c.short))))}
${field(id('teach'), w.teach, select(id('teach'), w.any, teach.map((c) => option(c.value, c.label))))}
${field(id('beds'), w.beds, select(id('beds'), w.any, beds.map((b) => option(b, b))))}
${field(id('loc'), w.location, select(id('loc'), w.any, [option('urban', w.urban), option('rural', w.rural)]))}
<p class="ht__field ht__check"><label><input id="${id('pen')}" type="checkbox"> ${w.penalized}</label></p>
${field(id('sort'), w.sort, html`<select id="${id('sort')}">${sorts.map((k) => option(k, w.sortBy(k)))}</select>`)}
</div>`;
}

const sortWord = (key) => t(`exploreSort${key[0].toUpperCase()}${key.slice(1)}`);
const WORDS = () => ({
  filters: t('exploreFilters'), any: t('exploreAny'), text: t('exploreText'), state: t('exploreState'), peer: t('explorePeer'),
  group: (n) => fill('exploreGroup', { n: String(n) }), cond: t('exploreCond'), teach: t('exploreTeach'), beds: t('exploreBeds'),
  location: t('exploreLocation'), urban: t('exploreUrban'), rural: t('exploreRural'), penalized: t('explorePenalized'), sort: t('exploreSort'), sortBy: sortWord,
});

// controls: explore-data.js exploreControls(); url: the rows asset's path (null: none, the shell has no source).
export function explorePart(controls, { url = null } = {}) {
  return html`<p class="part__intro">${t('exploreIntro')}</p>
<p class="ht-nojs" id="ex-nojs">${t('exploreNoScript')} <a href="${controls.csvHref}" download>${t('exploreNoScriptCsv')}</a></p>
<p class="ht-retry small" id="ex-note" role="status" data-loading="${t('exploreLoading')}" data-text="${t('exploreRetry')}"></p>
<div class="ht explore ph" id="explore-table" data-ph data-all data-prefix="ex" data-nojs="ex-nojs" data-note="ex-note" data-csv="${controls.csvHref}"${url ? html` data-src="${url}"` : ''} data-page-size="${controls.pageSize}" hidden>
${filterControls({ prefix: 'ex', w: WORDS(), states: controls.states, peers: controls.peers, conds: controls.conds, teach: controls.teach, beds: controls.beds, sorts: controls.sorts })}
<p class="small ph__status" id="ex-status" aria-live="polite" data-template="${statusTemplate()}"></p>
${printout(html`<table class="gb gb--hospitals explore__table ph__table">
<caption class="vh">${t('exploreCaption')}</caption>
<thead><tr><th scope="col">${t('exploreColHospital')}</th><th scope="col" class="num">${t('exploreColCut')}</th><th scope="col" class="num">${t('exploreColDollars')}</th><th scope="col" class="num">${t('exploreColPeer')}</th><th scope="col">${t('exploreColConds')}</th><th scope="col" class="num">${t('exploreColBeds')}</th></tr></thead>
<tbody></tbody>
</table>`)}
<p class="ht-empty" id="ex-empty" hidden>${t('exploreEmpty')}</p>
<p class="fig__actions"><button type="button" class="fig__btn" data-prev hidden>${t('explorePrev')}</button> <button type="button" class="fig__btn" data-next hidden>${t('exploreNext')}</button> <button type="button" class="fig__btn" data-copy hidden>${t('exploreCopy')}</button> <button type="button" class="fig__btn" data-download hidden>${t('exploreDownload')}</button> <a class="fig__btn" href="${controls.csvHref}" download>${t('exploreDownloadAll')}</a> <span class="small" role="status" data-copy-status data-copied="${t('exploreCopied')}" data-failed="${t('exploreCopyFailed')}" data-download-failed="${t('exploreDownloadFailed')}"></span></p>
</div>`;
}
