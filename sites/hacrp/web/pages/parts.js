// Pieces both HACRP pages use: the decision pill, the as-of bar and the source line.
import { html } from '../../../../web/render/html.js';
import { isoDate, longDate, pct } from '../../../../web/render/format.js';
import { REDUCTION_PCT, SHORT_NAMES } from '../constants.js';
import { COPY, fill } from '../copy.js';

export const t = (key) => fill(key);

// The word carries the decision; the ink repeats it. Yes (with or without a score) is the cut, N/A is hatched.
export function decisionPill(status) {
  if (status === 'maryland') return html`<span class="pill pill--na">${t('pillNA')}</span>`;
  if (status === 'yes' || status === 'yes-no-score') {
    return html`<span class="pill pill--pen">${fill('pillYes', { pct: pct(REDUCTION_PCT / 100, 0) })}</span>`;
  }
  return html`<span class="pill">${t('pillNo')}</span>`;
}

export function asofBar({ fy, periods, source }) {
  const items = [
    fill('asofFy', { fy: String(fy) }),
    fill('asofPsi', { short: SHORT_NAMES.PSI90, start: longDate(periods.psi90.start), end: longDate(periods.psi90.end) }),
    fill('asofHai', { start: longDate(periods.hai.start), end: longDate(periods.hai.end) }),
    fill('asofLatest', { fy: String(fy), next: String(fy + 1) }),
    fill('asofReleased', { date: isoDate(source.pdcReleased) }),
  ];
  return html`<aside class="asof" aria-label="${COPY.asofHeading.text}">
<ul class="asof__list" role="list">${items.map((item) => html`<li>${item}</li>`)}</ul>
</aside>`;
}

export function sourceLine({ fy, source }) {
  const text = fill('source', { fy: String(fy), id: source.id, date: isoDate(source.pdcReleased) });
  return html`<p class="source">${text} <a href="${source.landingPage}">${t('datasetLink')}</a></p>`;
}
