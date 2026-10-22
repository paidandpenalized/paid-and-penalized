// The HACRP Methods page (/hacrp/methods/): the site's own process, shown rather than told. The top: the title, the
// lede and the self-check's summary card under its stamp. Then, beside a contents column: the pipeline from CMS's
// file to the pages with the newest run's real numbers, the check drawn (every recomputed score against CMS's, every
// decision against the line this site finds, each year), the formula, what comes from CMS and what this site works
// out, the periods behind each year's cut, the baseline, how to read a penalty, the pinned sources, what changed, the
// glossary, and a link to the family's page for feedback, privacy and AI.
import { stamp, typeset } from '../../../../web/render/components.js';
import { count, decimal, isoDate, ordinal } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { counter } from '../../../../web/charts/figure.js';
import { LINE_PERCENTILE, SCORE_TOLERANCE } from '../../../../engine/js/hacrp/history.js';
import { CUTOFF_PERCENTILE, REDUCTION_TEXT, SHORT_NAMES, SIR_BASE_YEAR, SIR_EXPECTED_TEXT, SIR_NEXT_BASE_YEAR, SIR_NEXT_FY, WINSOR_HIGH, WINSOR_LOW } from '../constants.js';
import { fill, fillKeep, t } from '../methods/copy.js';
import { periodsFigure, pipeline, proofFigure, receipt, receipts, sidesFigure } from '../methods-figures.js';
import { kicker, siteHeader } from './parts.js';

export const METHODS_PATH = `${SITE.sites.hacrp.path}methods/`;

const ord = (n) => ordinal(n);
const para = (text) => html`<p>${text}</p>`;

// A section of the page: its heading, words, and (optionally) a figure beside them.
const sec = ({ id, heading, body, fig = null }) => html`<section class="msec${fig ? ' msec--fig' : ''}" id="${id}" aria-labelledby="${id}-h">
<div class="msec__text">
<h2 class="msec__title" id="${id}-h">${heading}</h2>
${body}
</div>
${fig ? html`<div class="msec__fig">${fig}</div>` : ''}
</section>`;

// The rows CMS footnoted that the public parts don't add up to, by year, if any.
function withheldNote(checks) {
  const years = checks.filter((c) => c.check.withheld.length);
  if (!years.length) return '';
  const n = years.reduce((s, c) => s + c.check.withheld.length, 0);
  return para(fill('proofText3', { years: listText(years.map((c) => `FY${c.fy}`)), short: SHORT_NAMES.PSI90, n: count(n) }));
}

// A year's line counts as above the 75th percentile when it sits more than this share of the scores past it (a
// display threshold: one or two hospitals either way is the arithmetic of whole hospitals, not a different line).
const ABOVE_BY = 0.005;
// "A", "A and B", "A, B and C".
const listText = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${t('and')} ${xs[xs.length - 1]}`);

// What the decision check found beyond order: the years the line lands on the 75th percentile of the published
// scores, the years it sits above it, and the most hospitals ever tied exactly at the line.
function sidesNotes(checks) {
  const decided = checks.filter((c) => c.check.yes);
  const on = decided.filter((c) => c.check.p75InGap).map((c) => `FY${c.fy}`);
  const above = decided.filter((c) => !c.check.p75InGap && c.check.linePct > LINE_PERCENTILE + ABOVE_BY).map((c) => `FY${c.fy}`);
  const ties = [...decided].sort((a, b) => b.check.atLine - a.check.atLine)[0];
  return html`${on.length ? para(fill('sidesOn', { years: listText(on), percentile: ord(CUTOFF_PERCENTILE) })) : ''}${above.length ? para(fill('sidesAbove', { years: listText(above), percentile: ord(CUTOFF_PERCENTILE) })) : ''}${ties && ties.check.atLine > 1 ? para(fill('sidesTies', { fy: String(ties.fy), n: count(ties.check.atLine), line: decimal(ties.check.highestNo, 4) })) : ''}`;
}

// The glossary's entries, in reading order: [term key, definition key, values].
const GLOSSARY = (v) => [
  ['glHac', 'glHacIs'], ['glHai', 'glHaiIs'], ['glPsi', 'glPsiIs', null, { short: SHORT_NAMES.PSI90 }], ['glNhsn', 'glNhsnIs'],
  ['glSir', 'glSirIs', { one: SIR_EXPECTED_TEXT }], ['glPredicted', 'glPredictedIs', { one: SIR_EXPECTED_TEXT }], ['glSd', 'glSdIs'],
  ['glZ', 'glZIs'], ['glWinsor', 'glWinsorIs', { low: ord(WINSOR_LOW), high: ord(WINSOR_HIGH) }], ['glTotal', 'glTotalIs'],
  ['glLine', 'glLineIs', { percentile: ord(CUTOFF_PERCENTILE) }], ['glCut', 'glCutIs', { pct: REDUCTION_TEXT }], ['glSubject', 'glSubjectIs'],
  ['glFy', 'glFyIs'], ['glPeriod', 'glPeriodIs'], ['glAssigned', 'glAssignedIs'], ['glMaryland', 'glMarylandIs'], ['glCcn', 'glCcnIs'],
  ['glMedian', 'glMedianIs'], ['glDomain', 'glDomainIs', { eqFy: String(v.eqFy) }],
];

// checks: [{ fy, rule, check }] oldest first (yearCheck results); years: [{ fy, periods }] oldest first; newest: the
// newest year's { rows (CMS's file), source, pin (its manifest entry), measures, pages }; pins: the manifest entries
// the HACRP pages read; changes: [{ date, items }] newest first; estimate: { tolerance, tagged, maxError };
// boundaryText; eqFy, zFy: the fiscal years the equal-weight score and the z-scores began.
export function methodsPage({ fy, checks, years, newest, pins, changes, estimate, boundaryText, eqFy, zFy, robots, assets, searchUrl }) {
  const { subtitle } = SITE.sites.hacrp;
  const figureNo = counter();
  const last = checks[checks.length - 1];
  const sum = (k) => checks.reduce((s, c) => s + (typeof c.check[k] === 'number' ? c.check[k] : c.check[k].length), 0);
  const miss = Math.max(...checks.map((c) => c.check.maxError));
  const wrong = sum('wrongSide');
  const source = newest.sourceLine;
  const limit = decimal(SCORE_TOLERANCE, 3);

  const top = html`<header class="page__head meth__top">
<div class="meth__intro">
${kicker(fy)}
<h1 class="meth__title">${t('methodsTitle')}</h1>
<p class="meth__lede">${t('methodsLede')}</p>
<p class="meth__lede2">${t('methodsLede2')}</p>
</div>
<div class="meth__card">
${receipt(checks)}
${stamp({ label: t('checkStamp') })}
</div>
</header>`;

  const sections = [
    { id: 'pipeline', heading: t('pipeHeading'), body: html`${para(t('pipeText'))}
${pipeline({ rows: newest.rows, source: newest.source, pin: newest.pin, measures: newest.measures, check: last.check, pages: newest.pages })}` },
    { id: 'check', heading: t('proofHeading'), body: html`${para(fill('proofText', { limit }))}${para(t('proofText2'))}${withheldNote(checks)}`, fig: proofFigure(checks, { n: figureNo(), source }) },
    { id: 'decisions', heading: t('sidesHeading'), body: html`${para(t('sidesText'))}${para(t('sidesText2'))}${sidesNotes(checks)}`, fig: sidesFigure(checks, { n: figureNo(), source }) },
    { id: 'formula', heading: t('formulaHeading'), body: html`${para(t('formulaText'))}
<dl class="formula">
<dt>${t('formulaLimited')}</dt><dd>${fill('formulaLimitedIs', { low: ord(WINSOR_LOW), high: ord(WINSOR_HIGH) })}</dd>
<dt>${t('formulaZ')}</dt><dd>${t('formulaZIs')}</dd>
<dt>${t('formulaTotal')}</dt><dd>${t('formulaTotalIs')}</dd>
<dt>${t('formulaCut')}</dt><dd>${fill('formulaCutIs', { percentile: ord(CUTOFF_PERCENTILE) })}</dd>
</dl>
${para(t('formulaText2'))}${para(fill('formulaText3', { eqFy: String(eqFy), zFy: String(zFy) }))}` },
    { id: 'estimate', heading: t('sourceHeading'), body: html`${para(t('sourceText'))}
<div class="printout"><div class="printout__scroll"><table class="gb takes">
<thead><tr><th scope="col">${t('sourceColShown')}</th><th scope="col">${t('sourceColFrom')}</th><th scope="col">${t('sourceColLabel')}</th></tr></thead>
<tbody>${[
    ['srcRow1', 'srcRow1From', 'srcRow1Label', 'cms'],
    ['srcRow2', fillKeep('srcRow2From', boundaryText, ['highestNo', 'lowestYes']), 'srcRow2Label', 'cms'],
    ['srcRow3', 'srcRow3From', 'srcRow3Label', 'site'],
    ['srcRow4', 'srcRow4From', 'srcRow4Label', 'site'],
    ['srcRow5', 'srcRow5From', 'srcRow5Label', 'hyp'],
    ['srcRow6', 'srcRow6From', 'srcRow6Label', 'hyp'],
    ['srcRow7', 'srcRow7From', 'srcRow7Label', 'cms'],
  ].map(([what, from, label, kind]) => html`<tr><th scope="row">${t(what)}</th><td>${typeof from === 'string' ? t(from) : from}</td><td><span class="takes__tag takes__tag--${kind}">${t(label)}</span></td></tr>`)}</tbody>
</table></div></div>
<h3 class="msec__sub">${t('estimateHeading')}</h3>
${para(fill('estimateText', { tolerance: decimal(estimate.tolerance, 3), fy: String(fy), tagged: estimate.tagged, maxError: decimal(estimate.maxError, 4) }))}
<p><a href="/methods/#estimate">${t('estimateFamily')}</a></p>` },
    { id: 'periods', heading: t('periodsHeading'), body: html`${para(fill('periodsText', { short: SHORT_NAMES.PSI90 }))}${para(t('periodsText2'))}`, fig: periodsFigure(years, { n: figureNo(), source }) },
    { id: 'baseline', heading: t('baselineHeading'), body: html`${para(fill('baselineText', { baseYear: String(SIR_BASE_YEAR) }))}${para(fill('baselineText2', { nextBase: String(SIR_NEXT_BASE_YEAR), nextFy: String(SIR_NEXT_FY) }))}` },
    { id: 'reading', heading: t('readHeading'), body: html`<ol class="reading">${['read1', 'read2', 'read3', 'read4', ['read5', { short: SHORT_NAMES.PSI90 }], ['read6', { pct: REDUCTION_TEXT }], 'read7'].map((k) => html`<li>${Array.isArray(k) ? fill(k[0], k[1]) : t(k)}</li>`)}</ol>` },
    { id: 'sources', heading: t('sourcesHeading'), body: html`${para(t('sourcesText'))}${receipts(pins)}${para(t('sourcesCode'))}` },
    { id: 'changed', heading: t('changedHeading'), body: html`${para(t('changedText'))}
<ol class="changes" role="list">${changes.map((c) => html`<li><p class="changes__date">${isoDate(c.date)}</p><ul>${c.items.map((i) => html`<li>${typeset(i)}</li>`)}</ul></li>`)}</ol>
${para(t('changedCorrections'))}` },
    { id: 'glossary', heading: t('glossaryHeading'), body: html`<dl class="glossary">${GLOSSARY({ eqFy }).map(([term, def, values, termValues]) => html`<div class="glossary__item"><dt>${termValues ? fill(term, termValues) : t(term)}</dt><dd>${values ? fill(def, values) : t(def)}</dd></div>`)}</dl>` },
    { id: 'more', heading: t('familyHeading'), body: html`<p>${t('familyText')} <a href="/methods/">${t('familyLink')}</a>.</p>
<h3 class="msec__sub">${t('reuseHeading')}</h3>${para(t('reuseText'))}
<h3 class="msec__sub">${t('accessHeading')}</h3>${para(t('accessText'))}` },
  ];

  const body = html`<article class="wrap page page--meth meth">
${top}
<div class="meth__body">
<nav class="meth__toc" aria-labelledby="toc-h">
<p class="meth__toc-h cap" id="toc-h">${t('contentsHeading')}</p>
<ol>${sections.map((s, i) => html`<li><a href="#${s.id}"><span class="meth__toc-n">${String(i + 1)}</span>${s.heading}</a></li>`)}</ol>
</nav>
<div class="meth__main">
${sections.map(sec)}
</div>
</div>
</article>`;

  return page({
    title: `${t('methodsPageTitle')} · ${SITE.sites.hacrp.title} · ${SITE.name}`,
    description: t('methodsDescription'),
    path: METHODS_PATH,
    robots,
    body,
    scripts: [assets.js.figure, assets.js.cite, assets.js.topbar, assets.js['hacrp-search']],
    assets,
    topbar: siteHeader({ fy, current: 'methods', searchUrl }),
  });
}
