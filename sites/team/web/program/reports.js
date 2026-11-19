// Part 7, where a hospital's own numbers are: who in the TEAM Portal can open CMS's reports (CMS's roles; where those people
// usually sit is this site's observation, said as such), beside the table of where CMS puts each number the calculator
// asks for. Then the line on CJR-X (its list's size, the emitted file's) and the page's close: Methods and the as-of line.
import { asofBar } from '../../../../web/render/components.js';
import { count, isoDate, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { CITES, CJRX_DAYS, CJRX_START, PORTAL } from '../constants.js';
import { fill, t } from '../copy.js';
import { METHODS_PATH } from '../links.js';
import { cited, partOf } from '../pages/parts.js';

// The table's rows: the calculator input, where CMS puts it and how often, each a copy key's words.
const ROWS = Object.freeze(['findPrices', 'findBase', 'findSpend', 'findTarget', 'findQuality']);
const COLUMNS = Object.freeze(['findColInput', 'findColWhere', 'findColWhen']);

// A table that keeps its columns on a wide screen and stacks each row into a card on a narrow one (each cell then
// labeled by its column: data-label, styles.css), scrolling sideways in the family's printout frame in between.
const reportsTable = () => html`<div class="tm-table" role="region" aria-labelledby="find-cap" tabindex="0">
<table class="gb tm-find">
<caption id="find-cap">${t('findCaption')}</caption>
<thead><tr>${COLUMNS.map((c) => html`<th scope="col">${t(c)}</th>`)}</tr></thead>
<tbody>${ROWS.map((r) => html`<tr><th scope="row">${t(r)}</th><td data-label="${t('findColWhere')}">${t(`${r}Where`)}</td><td data-label="${t('findColWhen')}">${t(`${r}When`)}</td></tr>`)}</tbody>
</table>
</div>
<p class="source">${fill('findSource', { cite: CITES.reports })}</p>`;

// Part 7. n: the Part's number.
export function reportsPart({ n }) {
  const words = html`${cited(fill('findRoles', { primary: spelled(PORTAL.primary), custodians: spelled(PORTAL.custodians) }), CITES.portal)}
<p class="tm-aside">${t('findWhere')}</p>`;
  return partOf({ id: 'find', n, heading: t('findHeading'), words, fig: html`<figure class="tm-tablefig">${reportsTable()}</figure>` });
}

// The note on CJR-X after the Parts: a callout, as the patient note is.
export const cjrxLine = (team) => html`<div class="tm-coda"><aside class="tm-patient tm-nextbox" aria-labelledby="next-h">
<h2 class="tm-patient__h" id="next-h">${t('nextHeading')}</h2>
<p class="tm-next">${fill('cjrx', { date: isoDate(CJRX_START), days: String(CJRX_DAYS), n: count(team.counts.cjrxListed) })}</p>
</aside></div>`;

// The close: the link to Methods, and the as-of line (each data source and its date).
export function close(team) {
  const [from, to] = team.meta.mupYears.map(String);
  return html`<p class="tm-methods">${t('methodsLine')} <a href="${METHODS_PATH}">${t('methodsLink')}</a></p>
<div class="tm-end">
<p class="cap kicker tm-asof__k" aria-hidden="true">${t('asofHeading')}</p>
${asofBar({
    label: t('asofHeading'),
    items: [
      { label: t('asofList'), value: isoDate(team.meta.listAsOf) },
      { label: t('asofPrices'), value: isoDate(team.meta.pricesDated) },
      { label: t('asofCjrx'), value: isoDate(team.meta.cjrxAsOf) },
      { label: t('asofEpisodes'), value: fill('asofEpisodesValue', { from, to }) },
      { label: t('asofQuality'), value: isoDate(team.meta.qualityReleased) },
    ],
  })}
</div>`;
}
