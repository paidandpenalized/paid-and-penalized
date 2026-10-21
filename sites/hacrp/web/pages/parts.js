// HACRP's words for the shared page parts (web/render/components.js) both HACRP pages use: the decision pill, the
// as-of bar, the citation (which carries the source line) and the data links.
import { asofBar as asofShell, citation as citationShell, fillCopyKeep, keepWhole, pill } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { isoDate, longDate } from '../../../../web/render/format.js';
import { SITE } from '../../../../web/site.js';
import { SHORT_NAMES } from '../constants.js';
import { COPY, fill, sourceText, t } from '../copy.js';
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

// One as-of fact as { label, value }, split from its copy entry: the words before the first ": " (or, with no colon,
// before the first placeholder) are the label, the rest the value. No words are added; the list stands in for the
// colon. Each value in `keep` stays whole (fillCopyKeep).
function fact(key, values, keep = []) {
  const text = COPY[key].text;
  const colon = text.indexOf(': ');
  const cut = colon >= 0 ? colon : text.indexOf('{');
  const parts = { label: text.slice(0, cut).trim(), value: text.slice(colon >= 0 ? colon + 2 : cut) };
  const half = (part) => {
    const names = Object.keys(values).filter((n) => parts[part].includes(`{${n}}`));
    return fillCopyKeep(parts, part, Object.fromEntries(names.map((n) => [n, values[n]])), keep.filter((n) => names.includes(n)));
  };
  return { label: half('label'), value: half('value') };
}

// Each fact is one row of the strip's list; a date (or a short name) never breaks across lines.
export function asofBar({ fy, periods, source }) {
  return asofShell({
    label: t('asofHeading'),
    items: [
      fact('asofFy', { fy: String(fy) }),
      fact('asofPsi', { short: SHORT_NAMES.PSI90, start: longDate(periods.psi90.start), end: longDate(periods.psi90.end) }, ['short', 'start', 'end']),
      fact('asofHai', { start: longDate(periods.hai.start), end: longDate(periods.hai.end) }, ['start', 'end']),
      fact('asofLatest', { fy: String(fy), next: String(fy + 1) }),
      fact('asofReleased', { date: isoDate(source.pdcReleased) }, ['date']),
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
  // The dataset id would break at its hyphen, and the release date at its spaces; the URL may still break anywhere.
  return citationShell({ heading: t('citeHeading'), text: keepWhole(text, [`(${source.id})`, isoDate(source.pdcReleased)]), button: t('citeCopy'), copied: t('citeCopied'), failed: t('citeFailed') });
}

// A link that prints its full address after its words (print.css reads data-print-href).
export const printLink = (href, text) => html`<a href="${href}" data-print-href="${href.startsWith('/') ? SITE.origin + href : href}">${text}</a>`;

// The plain links to the dataset file, its dictionary (the page; the Markdown file sits beside the CSV) and CMS's
// dataset page (source: the manifest entry).
export const dataLinks = (fy, source) => html`<p class="data-links">${printLink(csvPath(fy), t('dataCsv'))} · ${printLink(DICTIONARY_PAGE, t('dataDictionary'))} · ${printLink(source.landingPage, t('datasetLink'))}</p>`;
