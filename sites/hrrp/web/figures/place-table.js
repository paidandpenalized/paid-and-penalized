// The two tables at the foot of a place page, in the old state page's look (Thirty Day Readmissions web/src/js/views/scope.js,
// explorer.js): the places inside it ("Metro areas": name, hospitals, penalized, average cut, cut 1% or more, estimated dollars;
// 25 to a page; a state's "Outside metro areas" row is not a link) and "Hospitals in {name}" (every hospital, largest cut first,
// with the filters). Every row is in the page; the page's script (client/place-tables.js) unhides the pager, the filters and the
// copy buttons. Data from place-table-data.js; the CSV links are plain downloads. After figures/neighbors.js and map.js everyStateBlock.
import { CONDS } from '../../../../engine/js/hrrp/formula.js';
import { BED_BANDS, TEACH_LABEL } from '../../../../engine/js/hrrp/filters.js';
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { GE_CUT_PCT, PAGE_SIZE } from '../constants.js';
import { conditionShort } from '../derive.js';
import { csvPath } from '../links.js';
import { fmtInt, fmtMoney, fmtPct } from '../numbers.js';
import { fill, t } from '../place/copy.js';
import { filterControls } from './explore.js';
import { pagerNav, statusTemplate } from './pager.js';
import { SORT_KEYS } from './place-table-data.js';
import { hospitalRow } from './place-row.js';

const COL_KEY = { Division: 'kidsColDivision', State: 'kidsColState', 'Metro area': 'kidsColMetro' };

// ---------- the places inside ----------

const kidRow = (r) => html`<tr><th scope="row">${r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label}</th><td class="num">${fmtInt(r.s.n)}</td><td class="num">${r.s.pctPen == null ? '—' : fmtPct(r.s.pctPen, 0)}</td><td class="num">${fmtPct(r.s.meanRed, 2)}</td><td class="num">${fmtInt(r.s.nGe1)}</td><td class="num">${r.nEstimated ? fmtMoney(r.s.penTotal) : '—'}</td></tr>`;

// kids: view.children (place-table-data childTable); fy: the edition's year (the CSV's folder).
export function kidsTable(kids, { fy }) {
  const csvHref = csvPath(fy, kids.csvName);
  return html`<section class="place__tbl" aria-labelledby="kids-h" data-kids data-csv="${csvHref}">
<h2 id="kids-h">${kids.title}</h2>
<p class="small muted">${kids.crossState ? t('kidsIntro') : t('kidsIntroOther')}</p>
${printout(html`<table class="gb kids__table" data-page-size="${PAGE_SIZE}" aria-labelledby="kids-h">
<thead><tr><th scope="col">${t(COL_KEY[kids.column])}</th><th scope="col" class="num">${t('kidsColHospitals')}</th><th scope="col" class="num" title="${t('kidsPenalizedTitle')}">${t('kidsColPenalized')}</th><th scope="col" class="num">${t('kidsColAvg')}</th><th scope="col" class="num">${fill('kidsColGe1', { pct: String(GE_CUT_PCT) })}</th><th scope="col" class="num">${t('kidsColDollars')}</th></tr></thead>
${kids.pages.map((page, i) => html`<tbody data-page="${i + 1}">${page.map(kidRow)}</tbody>
`)}</table>`)}
${kids.pages.length > 1 ? pagerNav({ cls: 'kids', label: t('kidsPager'), pages: kids.pages }) : ''}
<p class="fig__actions"><a class="fig__btn" href="${csvHref}" download>${t('kidsDownload')}</a> <button type="button" class="fig__btn" data-copy hidden>${t('kidsCopy')}</button> <span class="small" role="status" data-copy-status data-copied="${t('csvCopied')}" data-failed="${t('csvFailed')}"></span></p>
</section>`;
}

// ---------- the area's hospitals ----------

const sortWord = (key) => t(`hosSort${key[0].toUpperCase()}${key.slice(1)}`);
const WORDS = () => ({
  filters: t('hosFilters'), any: t('hosAny'), text: t('hosText'), state: t('hosState'), peer: t('hosPeer'), group: (n) => fill('peerGroup', { n: String(n) }),
  cond: t('hosCond'), teach: t('hosTeach'), beds: t('hosBeds'), location: t('hosLocation'), urban: t('hosUrban'), rural: t('hosRural'),
  penalized: t('hosPenalized'), sort: t('hosSort'), sortBy: sortWord,
});

function controls(table, { conditions }) {
  const peers = [...new Set(table.rows.map((r) => r.h.peer).filter((p) => p != null))].sort((a, b) => a - b);
  const teach = Object.keys(TEACH_LABEL).filter((k) => table.rows.some((r) => r.h.teach === k)).map((value) => ({ value, label: TEACH_LABEL[value] }));
  return filterControls({
    prefix: 'ph', w: WORDS(), states: table.states, peers, conds: CONDS.map((k) => ({ short: conditionShort(conditions, k) })), teach, beds: BED_BANDS, sorts: SORT_KEYS, hidden: true,
  });
}

// table: view.hospitals (place-table-data hospitalsTable); name: the place; conditions: the edition's; fy: the edition's year; rowsUrl: the
// rows asset's path (null: none, the table stays the first page). Only the first page of rows is in the page: the script reads the rest
// from the asset when the table comes near the screen, and a reader without it has the CSV. A table that fits on one page has every
// row already and names no asset, so the script fetches nothing for it.
export function hospitalsSection(table, { name, conditions, fy, rowsUrl = null }) {
  const csvHref = csvPath(fy, table.csvName);
  const first = table.rows.slice(0, PAGE_SIZE);
  const more = table.rows.length > first.length;
  const scope = table.cbsa ? html` data-cbsa="${table.cbsa}"` : html` data-states="${table.states.join(',')}"`;
  return html`<section class="ht place__tbl ph" aria-labelledby="ph-h" data-ph data-csv="${csvHref}" data-page-size="${PAGE_SIZE}"${rowsUrl && more ? html` data-src="${rowsUrl}"` : ''}${scope}>
<h2 id="ph-h">${fill('hosHeading', { name })}</h2>
<p class="small muted">${t('hosIntro')}</p>
${controls(table, { conditions })}
<p class="small ph__status" role="status" aria-live="polite" data-template="${statusTemplate()}" hidden></p>
${printout(html`<table class="gb ph__table">
<caption class="vh">${fill('hosCaption', { name })}</caption>
<thead><tr><th scope="col">${t('hosColHospital')}</th><th scope="col" class="num">${t('hosColCut')}</th><th scope="col" class="num">${t('hosColDollars')}</th><th scope="col" class="num">${t('hosColPeer')}</th><th scope="col">${t('hosColConds')}</th><th scope="col" class="num">${t('hosColBeds')}</th></tr></thead>
<tbody>${first.map((r) => hospitalRow(r, conditions))}</tbody>
</table>`)}
${more ? html`<p class="small ph__more">${fill('hosMore', { shown: fmtInt(first.length), n: fmtInt(table.rows.length) })}</p>` : ''}
<p class="ht-empty" hidden>${t('hosEmpty')}</p>
<p class="fig__actions"><button type="button" class="fig__btn" data-prev hidden>${t('hosPrev')}</button> <button type="button" class="fig__btn" data-next hidden>${t('hosNext')}</button> <a class="fig__btn" href="${csvHref}" download>${t('hosDownload')}</a> <button type="button" class="fig__btn" data-copy hidden>${t('hosCopy')}</button> <span class="small" role="status" data-copy-status data-copied="${t('csvCopied')}" data-failed="${t('csvFailed')}"></span></p>
</section>`;
}
