// HACRP's words for the shared page parts (web/render/components.js) the HACRP pages use: the decision pill, the
// as-of bar, the kicker, the citation (which carries the source line) and the data links.
import { asofBar as asofShell, citation as citationShell, keepWhole, lastCall, pill } from '../../../../web/render/components.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { html } from '../../../../web/render/html.js';
import { isoDate, longDate } from '../../../../web/render/format.js';
import { programHeader } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { SHORT_NAMES } from '../constants.js';
import { fill, fillKeep, sourcePlain, t } from '../copy.js';
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
export const asofBar = lastCall(({ fy, periods, source }) => [fy, periods, source], ({ fy, periods, source }) => {
  const period = (key, { start, end }) => fillKeep(key, { start: longDate(start), end: longDate(end) }, ['start', 'end']);
  return asofShell({
    label: t('asofHeading'),
    items: [
      { label: t('asofFyLabel'), value: fill('asofFy', { fy: String(fy) }) },
      { label: fillKeep('asofPsiLabel', { short: SHORT_NAMES.PSI90 }, ['short']), value: period('asofPsi', periods.psi90) },
      { label: t('asofHaiLabel'), value: period('asofHai', periods.hai) },
      { label: t('asofLatestLabel'), value: fill('asofLatest', { fy: String(fy), next: String(fy + 1) }) },
      { label: t('asofReleasedLabel'), value: fillKeep('asofReleased', { date: isoDate(source.pdcReleased) }, ['date']) },
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

// The top bar's search: a combobox over the hospitals asset (data-src) that client/search.js mounts and shows; hidden
// without JavaScript, where the nav's "Every hospital" and the data links stand in. The visible "Find" begins the
// box's name, which goes on for screen readers.
function searchBox(searchUrl) {
  return html`<form class="omni" role="search" aria-label="${t('searchHeading')}" data-src="${searchUrl}" hidden>
<label class="omni__field" for="omni-q"><span class="omni__label cap">${t('searchFind')}<span class="vh"> ${t('searchFindRest')}</span></span><input id="omni-q" type="search" role="combobox" aria-expanded="false" aria-controls="omni-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${t('searchPlaceholder')}"></label>
<ul class="omni__list" id="omni-list" role="listbox" aria-label="${t('searchHeading')}" hidden></ul>
<p class="vh" role="status" aria-live="polite"></p>
</form>`;
}

// A section whose words explain a figure: the words (its heading first) on the left and the figure on the right from
// 980px, stacked under that (pages.css .split). Without a figure, a plain section. label: the heading's id.
export const split = ({ label, text, figure = null, id = null }) => (figure
  ? html`<section class="block split"${id ? html` id="${id}"` : ''} aria-labelledby="${label}">
<div class="split__text">
${text}
</div>
<div class="split__fig">
${figure}
</div>
</section>`
  : html`<section class="block"${id ? html` id="${id}"` : ''} aria-labelledby="${label}">
${text}
</section>`);

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
