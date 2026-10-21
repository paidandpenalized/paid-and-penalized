// HACRP's words for the shared page parts (web/render/components.js) both HACRP pages use: the decision pill, the
// as-of bar, the citation (which carries the source line) and the data links.
import { asofBar as asofShell, citation as citationShell, pill } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { isoDate, longDate } from '../../../../web/render/format.js';
import { SITE } from '../../../../web/site.js';
import { SHORT_NAMES } from '../constants.js';
import { fill, sourceText, t } from '../copy.js';
import { csvPath, dictionaryPath } from '../links.js';
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

export function asofBar({ fy, periods, source }) {
  return asofShell({
    label: t('asofHeading'),
    items: [
      fill('asofFy', { fy: String(fy) }),
      fill('asofPsi', { short: SHORT_NAMES.PSI90, start: longDate(periods.psi90.start), end: longDate(periods.psi90.end) }),
      fill('asofHai', { start: longDate(periods.hai.start), end: longDate(periods.hai.end) }),
      fill('asofLatest', { fy: String(fy), next: String(fy + 1) }),
      fill('asofReleased', { date: isoDate(source.pdcReleased) }),
    ],
  });
}

// The citation block: the site, the page's title, its canonical URL and the source line. No access date: the page
// has no clock. title: the page title without the site's name.
export function citation({ fy, title, path, source }) {
  const text = fill('citeText', {
    site: SITE.name,
    title,
    url: SITE.origin + path,
    source: sourceText({ fy, source }),
  });
  return citationShell({ heading: t('citeHeading'), text, button: t('citeCopy'), copied: t('citeCopied'), failed: t('citeFailed') });
}

// The plain links to the dataset file, its dictionary and CMS's dataset page (source: the manifest entry).
export const dataLinks = (fy, source) => html`<p class="data-links"><a href="${csvPath(fy)}">${t('dataCsv')}</a> · <a href="${dictionaryPath(fy)}">${t('dataDictionary')}</a> · <a href="${source.landingPage}">${t('datasetLink')}</a></p>`;
