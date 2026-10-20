// HACRP's words for the shared page parts (web/render/components.js) both HACRP pages use: the decision pill, the
// as-of bar and the source line.
import { asofBar as asofShell, pill, sourceLine as sourceShell } from '../../../../web/render/components.js';
import { isoDate, longDate } from '../../../../web/render/format.js';
import { REDUCTION_TEXT, SHORT_NAMES } from '../constants.js';
import { fill } from '../copy.js';

export const t = (key) => fill(key);

// The word carries the decision; the ink repeats it. N/A is hatched. The row CMS marked Yes with no score shows
// CMS's literal value: nothing about the cut is inferred for it.
export function decisionPill(status, decision) {
  if (status === 'maryland') return pill({ kind: 'na', label: t('pillNA') });
  if (status === 'yes-no-score') return pill({ kind: 'pen', label: fill('pillCms', { decision }) });
  if (status === 'yes') return pill({ kind: 'pen', label: fill('pillYes', { pct: REDUCTION_TEXT }) });
  return pill({ label: t('pillNo') });
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

export function sourceLine({ fy, source }) {
  return sourceShell({
    text: fill('source', { fy: String(fy), id: source.id, date: isoDate(source.pdcReleased) }),
    href: source.landingPage,
    linkText: t('datasetLink'),
  });
}
