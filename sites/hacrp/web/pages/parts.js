// HACRP's words for the shared page parts (web/render/components.js) the HACRP pages use: the decision pill, the
// as-of bar, the kicker, the citation (which carries the source line) and the data links.
import { asofBar as asofShell, citation as citationShell, keepWhole, lastCall, pill, printout } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { html } from '../../../../web/render/html.js';
import { isoDate, longDate } from '../../../../web/render/format.js';
import { programHeader } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { SHORT_NAMES } from '../constants.js';
import { fill, fillKeep, sourcePlain, t } from '../copy.js';
import { fill as pfill } from '../program/copy.js';
import { DICTIONARY_PAGE, csvPath } from '../links.js';
import { pillOf } from '../whatif-text.js';

// The word carries the decision; the ink repeats it. N/A is hatched. The row CMS marked Yes with no score shows
// CMS's literal value: nothing about the cut is inferred for it. The what-if's head uses the same pills (pillOf).
const FLAGS = { maryland: 'N/A', yes: 'Yes' };
export function decisionPill(status, decision) {
  if (status === 'yes-no-score') return pill({ kind: 'pen', label: fill('pillCms', { decision }) });
  return pill(pillOf(FLAGS[status] ?? 'No'));
}

// Whether the pill already shows CMS's literal decision text, so the page needn't repeat it beside the pill.
export const pillShowsCmsValue = (status) => status === 'maryland' || status === 'yes-no-score';

// Each fact is one row of the strip's list: its term (copy key …Label) and its value. A date (or a short name) never
// breaks across lines. Built once for the pages of a build that share the fiscal year, periods and source.
// On a hospital page, the sources of its record's facts: typeFy, the IPPS impact file's year when the record shows a
// Type (teaching, urban and special status from that file, beds from Provider of Services), else null; geocoded, a
// map dot from the Census Bureau's geocoder.
export const asofBar = lastCall(({ fy, periods, source, typeFy = null, geocoded = false }) => [fy, periods, source, typeFy, geocoded], ({ fy, periods, source, typeFy = null, geocoded = false }) => {
  const period = (key, { start, end }) => fillKeep(key, { start: longDate(start), end: longDate(end) }, ['start', 'end']);
  return asofShell({
    label: t('asofHeading'),
    items: [
      { label: t('asofFyLabel'), value: fill('asofFy', { fy: String(fy) }) },
      { label: fillKeep('asofPsiLabel', { short: SHORT_NAMES.PSI90 }, ['short']), value: period('asofPsi', periods.psi90) },
      { label: t('asofHaiLabel'), value: period('asofHai', periods.hai) },
      { label: t('asofLatestLabel'), value: fill('asofLatest', { fy: String(fy), next: String(fy + 1) }) },
      { label: t('asofReleasedLabel'), value: fillKeep('asofReleased', { date: isoDate(source.pdcReleased) }, ['date']) },
      ...(typeFy ? [{ label: t('asofTypeLabel'), value: fill('asofType', { fy: String(typeFy) }) }, { label: t('asofBedsLabel'), value: t('asofBeds') }] : []),
      ...(geocoded ? [{ label: t('asofMapLabel'), value: t('asofMap') }] : []),
    ],
  });
});

// The program page's sections the top bar's nav links to, by id (program.js gives each section its id), then Methods.
export const SECTIONS = Object.freeze(['how', 'fy', 'map', 'hospitals']);

// The HACRP top bar (layout.js programHeader): the program's name and edition tag, the search (markup, or '') and
// the numbered nav to the program page's sections and Methods. current: the nav item to mark (an id), or null.
// Built once per build for each current item.
export const siteHeader = lastCall(({ fy, current, searchUrl }) => [fy, current, searchUrl], ({ fy, current = null, searchUrl = null }) => {
  const { path, title, subtitle } = SITE.sites.hacrp;
  const fyText = String(fy);
  const labels = { how: t('navHow'), fy: fill('navFy', { fy: fyText }), map: t('navMap'), hospitals: t('navHospitals') };
  return programHeader({
    name: title,
    href: path,
    tag: fill('edition', { subtitle, fy: fyText }),
    nav: [...SECTIONS.map((id) => ({ id, label: labels[id], href: `${path}#${id}` })), { id: 'methods', label: SHARED.methods, href: '/methods/' }],
    current,
    search: searchUrl ? searchBox(searchUrl) : '',
  });
});

// A search box: a combobox over the hospitals asset (data-src), with the places the site has pages for, that
// client/search.js mounts and shows; hidden without JavaScript, where the nav's "Every hospital" and the data links
// stand in. The visible "Find" begins the box's name, which goes on for screen readers. id: the box's own prefix
// (a page may hold the top bar's and a larger one in its hero); hero: the larger box's words and class.
export function searchBox(searchUrl, { id = 'omni', hero = false } = {}) {
  return html`<form class="omni${hero ? ' omni--hero' : ''}" role="search" aria-label="${t('searchHeading')}" data-src="${searchUrl}" hidden>
<label class="omni__field" for="${id}-q"><span class="omni__label cap">${t('searchFind')}<span class="vh"> ${t(hero ? 'heroFindRest' : 'searchFindRest')}</span></span><input id="${id}-q" type="search" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${t(hero ? 'heroPlaceholder' : 'searchPlaceholder')}"></label>
<ul class="omni__list" id="${id}-list" role="listbox" aria-label="${t('searchHeading')}" hidden></ul>
<p class="vh" role="status" aria-live="polite"></p>
</form>`;
}

// The kicker over a HACRP page's heading, linked to the program page (the program page's own kicker is not a link).
export const kicker = (fy) => html`<p class="cap kicker"><a href="${SITE.sites.hacrp.path}">${fill('kicker', { subtitle: SITE.sites.hacrp.subtitle, fy: String(fy) })}</a></p>`;

// The citation block: the site, the page's title, its canonical URL and the source line. No access date: the page
// has no clock. title: the page title without the site's name.
export function citation({ fy, title, path, source }) {
  const text = fill('citeText', {
    site: SITE.name,
    title,
    url: SITE.origin + path,
    source: sourcePlain({ fy, source }),
  });
  // The dataset id would break at its hyphen, and the release date at its spaces; the URL may still break anywhere.
  return citationShell({ heading: t('citeHeading'), text: keepWhole(text, [`(${source.id})`, isoDate(source.pdcReleased)]), button: t('citeCopy'), copied: t('citeCopied'), failed: t('citeFailed') });
}

// A link that prints its full address after its words. A site path carries the address in data-print-href, which
// print.css prints; print.css prints an absolute link's own href.
export const printLink = (href, text) => (href.startsWith('/')
  ? html`<a href="${href}" data-print-href="${SITE.origin + href}">${text}</a>`
  : html`<a href="${href}">${text}</a>`);

// The plain links to the dataset file, its dictionary (the page; the Markdown file sits beside the CSV) and CMS's
// dataset page (source: the manifest entry). Built once for the pages that share them.
export const dataLinks = lastCall((fy, source) => [fy, source], (fy, source) => html`<p class="data-links">${printLink(csvPath(fy), t('dataCsv'))} · ${printLink(DICTIONARY_PAGE, t('dataDictionary'))} · ${printLink(source.landingPage, t('datasetLink'))}</p>`);

// The table of every hospital (or a place's: area, its CCNs): client/table.js fills it from the hospitals asset
// (data-src) and shows it;
// without JavaScript, a sentence and the CSV link. On a phone the column heads are hidden and a Sort by menu (the same
// keys, each way) stands in for them.
const COLUMNS = [['name', 'tableColName'], ['city', 'tableColCity'], ['state', 'tableColState'], ['score', 'tableColScore'], ['decision', 'tableColDecision']];
export const hospitalTable = ({ fy, searchUrl, source, heading = t('tableHeading'), intro = t('tableIntro'), area = null }) => html`<section class="block hospitals" aria-labelledby="hospitals-h" id="hospitals">
<h2 id="hospitals-h">${heading}</h2>
<p class="ht-nojs">${t('tableNoScript')}</p>
<p class="ht-retry" role="status"></p>
<div class="ht" data-src="${searchUrl}"${area ? html` data-area="${area}"` : ''} hidden>
<p>${intro}</p>
<div class="ht__controls">
${area ? '' : html`<p class="ht__field"><label for="ht-state">${t('tableState')}</label> <select id="ht-state"><option value="">${t('tableAllStates')}</option></select></p>
`}<p class="ht__field"><label for="ht-name">${t('tableName')}</label> <input id="ht-name" type="search" autocomplete="off"></p>
<p class="ht__field ht__sort"><label for="ht-sort">${t('tableSortBy')}</label> <select id="ht-sort">${COLUMNS.flatMap(([key, label]) => [1, -1].map((dir) => html`<option value="${key}:${dir}"${key === 'state' && dir === 1 ? html` selected` : ''}>${fill(dir > 0 ? 'tableSortUp' : 'tableSortDown', { column: t(label) })}</option>`))}</select></p>
</div>
<p class="small" id="ht-count" aria-live="polite"></p>
${printout(html`<table class="gb gb--hospitals">
<caption class="vh" id="hospitals-cap">${t('tableCaption')}</caption>
<thead><tr>${COLUMNS.map(([key, label]) => html`<th scope="col" data-key="${key}"${key === 'state' ? html` aria-sort="ascending"` : ''}${key === 'score' ? html` class="num"` : ''}><button type="button" class="fig__sort">${t(label)}</button></th>`)}</tr></thead>
<tbody></tbody>
</table>`)}
<p class="fig__actions"><button type="button" class="fig__btn" id="ht-all" hidden></button></p>
</div>
${dataLinks(fy, source)}
</section>`;

// A Part's head, after Thirty Day Readmissions: the tag, the heading in the display face and a line under it.
export const partHead = ({ n, id, heading, intro }) => html`<header class="part__head">
<p class="part__tag">${pfill('partTag', { n: String(n) })}</p>
<h2 class="part__title" id="${id}-h">${heading}</h2>
${intro && html`<p class="part__intro">${intro}</p>`}
</header>`;

