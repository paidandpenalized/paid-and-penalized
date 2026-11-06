// The two tables at the foot of a place page, in the old state page's look (Thirty Day Readmissions web/src/js/views/scope.js,
// explorer.js): the places inside it ("Metro areas": name, hospitals, penalized, average cut, cut 1% or more, estimated dollars;
// 25 to a page; a state's "Outside metro areas" row is not a link) and "Hospitals in {name}" (every hospital, largest cut first,
// with the filters). Every row is in the page; the page's script (client/place-tables.js) unhides the pager, the filters and the
// copy buttons. Data from place-table-data.js; the CSV links are plain downloads. After figures/neighbors.js and map.js everyStateBlock.
import { CAP_PCT, CONDS } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL } from '../../../../engine/js/hrrp/filters.js';
import { printout } from '../../../../web/render/components.js';
import { listText, placeText } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { EXPLORE_PAGE_SIZE, GE_CUT_PCT, PLACE_KIDS_PAGE_SIZE } from '../constants.js';
import { conditionShort } from '../derive.js';
import { csvPath, hospitalPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../place/copy.js';
import { countedNames, glyph } from './picture.js';

const COL_KEY = { Division: 'kidsColDivision', State: 'kidsColState', 'Metro area': 'kidsColMetro' };
const LETTER = { counted: 'c', below: 'b', few: 'f', none: 'n' };

// ---------- the places inside ----------

const kidRow = (r) => html`<tr><th scope="row">${r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label}</th><td class="num">${fmtInt(r.s.n)}</td><td class="num">${r.s.pctPen == null ? '—' : fmtPct(r.s.pctPen, 0)}</td><td class="num">${fmtPct(r.s.meanRed, 2)}</td><td class="num">${fmtInt(r.s.nGe1)}</td><td class="num">${r.nEstimated ? fmtMoney(r.s.penTotal) : '—'}</td></tr>`;

// kids: view.children (place-table-data childTable); fy: the edition's year (the CSV's folder); crossState: the table has a metro
// area across a state line (its words say the counts are this state's).
export function kidsTable(kids, { fy, crossState }) {
  const csvHref = csvPath(fy, kids.csvName);
  const multi = kids.pages.length > 1;
  return html`<section class="place__kids place__tbl" aria-labelledby="kids-h" data-kids data-csv="${csvHref}">
<h2 id="kids-h">${kids.title}</h2>
<p class="small muted">${crossState ? t('kidsIntro') : t('kidsIntroOther')}</p>
${printout(html`<table class="gb kids__table" data-page-size="${PLACE_KIDS_PAGE_SIZE}" aria-labelledby="kids-h">
<thead><tr><th scope="col">${t(COL_KEY[kids.column])}</th><th scope="col" class="num">${t('kidsColHospitals')}</th><th scope="col" class="num" title="${t('kidsPenalizedTitle')}">${t('kidsColPenalized')}</th><th scope="col" class="num">${t('kidsColAvg')}</th><th scope="col" class="num">${fill('kidsColGe1', { pct: String(GE_CUT_PCT) })}</th><th scope="col" class="num">${t('kidsColDollars')}</th></tr></thead>
${kids.pages.map((page, i) => html`<tbody data-page="${i + 1}">${page.map(kidRow)}</tbody>
`)}</table>`)}
${multi ? html`<nav class="seg kids__pager" aria-label="${t('kidsPager')}" hidden>${kids.pages.map((_, i) => html`<button type="button" class="btn" data-to-page="${i + 1}" aria-pressed="${i === 0 ? 'true' : 'false'}">${fill('kidsPage', { n: String(i + 1) })}</button>`)}</nav>
<p class="small kids__status" role="status" data-template="${fill('kidsStatus', { from: '{from}', to: '{to}', n: '{n}' })}" hidden></p>` : ''}
<p class="fig__actions"><a class="fig__btn" href="${csvHref}" download>${t('kidsDownload')}</a> <button type="button" class="fig__btn" data-copy hidden>${t('kidsCopy')}</button> <span class="small" role="status" data-copy-status data-copied="${t('csvCopied')}" data-failed="${t('csvFailed')}"></span></p>
</section>`;
}

// ---------- the area's hospitals ----------

const option = (value, label) => html`<option value="${value}">${label}</option>`;
const field = (id, label, control) => html`<p class="ht__field"><label for="${id}">${label}</label> ${control}</p>`;
const select = (id, any, options) => html`<select id="${id}">${option('', any)}${options}</select>`;

// The row's attributes the script filters and sorts on (blank ones are left out). The state only where the table spans states.
function attrs(r, spans) {
  const { h } = r;
  return html`${h.alias ? html` data-alias="${h.alias}"` : ''}${spans ? html` data-st="${h.st}"` : ''} data-red="${String(h.red)}"${h.pen != null ? html` data-pen="${String(h.pen)}"` : ''}${h.beds != null ? html` data-beds="${String(h.beds)}"` : ''} data-peer="${String(h.peer)}"${h.teach ? html` data-teach="${h.teach}"` : ''}${h.urban != null ? html` data-urban="${h.urban ? 'urban' : 'rural'}"` : ''} data-paf="${String(h.paf)}" data-conds="${r.states.map((s) => LETTER[s]).join('')}"`;
}

function hospitalRow(r, { conditions, spans }) {
  const { h } = r;
  const names = countedNames(r, conditions);
  return html`<tr${attrs(r, spans)}><th scope="row"><a href="${hospitalPath(h.id)}">${h.name}</a><span class="nb__place">${placeText({ city: h.city, state: h.st })}</span></th><td class="num nb__cut"><span class="nb__bar" style="--w: ${Math.min(100, (h.red / CAP_PCT) * 100).toFixed(1)}" aria-hidden="true"></span><span>${fmtPct(h.red)}</span></td><td class="num">${fmtMoney(h.pen)}</td><td class="num">${String(h.peer)}</td><td><span class="pen__glyph">${glyph(r, r.rank, conditions, 'ph')}</span><span class="vh">${names.length ? fill('hosCondsSpoken', { list: listText(names) }) : t('hosCondsNone')}</span></td><td class="num">${h.beds == null ? '—' : fmtInt(h.beds)}</td></tr>`;
}

function controls(table, { conditions }) {
  const any = t('hosAny');
  const peers = [...new Set(table.rows.map((r) => r.h.peer).filter((p) => p != null))].sort((a, b) => a - b);
  const teach = Object.keys(TEACH_LABEL).filter((k) => table.rows.some((r) => r.h.teach === k));
  return html`<div class="ht__controls ph__controls" role="group" aria-label="${t('hosFilters')}" hidden>
${field('ph-text', t('hosText'), html`<input id="ph-text" type="search" autocomplete="off">`)}
${table.spansStates ? field('ph-state', t('hosState'), select('ph-state', any, table.states.map((s) => option(s, s)))) : ''}
${field('ph-peer', t('hosPeer'), select('ph-peer', any, peers.map((p) => option(p, fill('hosGroup', { n: String(p) })))))}
${field('ph-cond', t('hosCond'), select('ph-cond', any, CONDS.map((k, i) => option(String(i), conditionShort(conditions, k)))))}
${field('ph-teach', t('hosTeach'), select('ph-teach', any, teach.map((k) => option(k, TEACH_LABEL[k]))))}
${field('ph-beds', t('hosBeds'), select('ph-beds', any, BED_BANDS.map((b) => option(b, b))))}
${field('ph-loc', t('hosLocation'), select('ph-loc', any, [option('urban', t('hosUrban')), option('rural', t('hosRural'))]))}
<p class="ht__field ht__check"><label><input id="ph-pen" type="checkbox"> ${t('hosPenalized')}</label></p>
${field('ph-sort', t('hosSort'), html`<select id="ph-sort">${option('cut', t('hosSortCut'))}${option('dollars', t('hosSortDollars'))}${option('name', t('hosSortName'))}${option('beds', t('hosSortBeds'))}</select>`)}
</div>`;
}

// table: view.hospitals (place-table-data hospitalsTable); name: the place; conditions: the edition's; fy: the edition's year.
export function hospitalsSection(table, { name, conditions, fy }) {
  const csvHref = csvPath(fy, table.csvName);
  const spans = table.spansStates;
  return html`<section class="ht place__tbl ph" aria-labelledby="ph-h" data-ph data-csv="${csvHref}" data-page-size="${EXPLORE_PAGE_SIZE}">
<h2 id="ph-h">${fill('hosHeading', { name })}</h2>
<p class="small muted">${t('hosIntro')}</p>
${controls(table, { conditions })}
<p class="small ph__status" role="status" aria-live="polite" data-template="${fill('hosStatus', { from: '{from}', to: '{to}', n: '{n}' })}" hidden></p>
${printout(html`<table class="gb ph__table">
<caption class="vh">${fill('hosCaption', { name })}</caption>
<thead><tr><th scope="col">${t('hosColHospital')}</th><th scope="col" class="num">${t('hosColCut')}</th><th scope="col" class="num">${t('hosColDollars')}</th><th scope="col" class="num">${t('hosColPeer')}</th><th scope="col">${t('hosColConds')}</th><th scope="col" class="num">${t('hosColBeds')}</th></tr></thead>
<tbody>${table.rows.map((r) => hospitalRow(r, { conditions, spans }))}</tbody>
</table>`)}
<p class="ht-empty" hidden>${t('hosEmpty')}</p>
<p class="fig__actions"><button type="button" class="fig__btn" data-prev hidden>${t('hosPrev')}</button> <button type="button" class="fig__btn" data-next hidden>${t('hosNext')}</button> <a class="fig__btn" href="${csvHref}" download>${t('hosDownload')}</a> <button type="button" class="fig__btn" data-copy hidden>${t('hosCopy')}</button> <span class="small" role="status" data-copy-status data-copied="${t('csvCopied')}" data-failed="${t('csvFailed')}"></span></p>
</section>`;
}
