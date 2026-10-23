// The HACRP Methods page (/hacrp/methods/): the site's own process, shown rather than told. The top: the title, the
// lede and the self-check's summary card under its stamp. Then, beside a contents column: the pipeline from CMS's
// file to the pages with the newest run's real numbers, the check drawn (every recomputed score against CMS's, every
// decision against the line this site finds, each year), the formula, what comes from CMS and what this site works
// out, the periods behind each year's cut, the baseline, how to read a penalty, the pinned sources, what changed, the
// glossary, and a link to the family's page for feedback, privacy and AI.
import { printout, stamp, typeset } from '../../../../web/render/components.js';
import { count, decimal, isoDate, listText, ordinal } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { counter } from '../../../../web/charts/figure.js';
import { CUTOFF_PERCENTILE, FACT_SHEET_CUT, REDUCTION_TEXT, SHORT_NAMES, SIR_BASE_YEAR, SIR_EXPECTED_TEXT, SIR_NEXT_BASE_YEAR, SIR_NEXT_FY, WINSOR_HIGH, WINSOR_LOW } from '../constants.js';
import { fyLabel } from '../copy.js';
import { fill, fillKeep, t } from '../methods/copy.js';
import { assumptionsTable, backtestPlaceholder, checkTotals, dollarChecks, dollarsOrderFigure, dollarsPipeline, limitText, periodsFigure, pipeline, proofFigure, receipt, receipts, sidesFigure } from '../methods-figures.js';
import { moneySourceText } from '../money-figures.js';
import { COUNT_NOTE, DOLLARS_HREF, METHODS_PATH } from '../links.js';
import { kicker, siteHeader } from './parts.js';

export { METHODS_PATH };

const para = (text) => html`<p>${text}</p>`;

// A section of the page: its heading, words, and (optionally) a figure beside them.
const sec = ({ id, heading, body, fig = null }) => html`<section class="msec${fig ? ' msec--fig' : ''}" id="${id}" aria-labelledby="${id}-h">
<div class="msec__text">
<h2 class="msec__title" id="${id}-h">${heading}</h2>
${body}
</div>
${fig ? html`<div class="msec__fig">${fig}</div>` : ''}
</section>`;

// The rows whose total the public parts don't add up to because CMS withheld a part, by year, if any.
function withheldNote(checks) {
  const { withheld } = checkTotals(checks);
  if (!withheld) return '';
  const years = checks.filter((c) => c.check.withheld.length).map((c) => fyLabel(c.fy));
  return para(fill('proofText3', { years: listText(years), short: SHORT_NAMES.PSI90, n: count(withheld) }));
}

// CMS's fact-sheet count against the updated cut list's, for the year CMS updated its list (the roll call links
// here); nothing when the history lacks that year or the counts agree.
function countNote(checks) {
  const year = checks.find((c) => c.fy === FACT_SHEET_CUT.fy);
  if (!year || year.check.yes === FACT_SHEET_CUT.cut) return '';
  return html`<p id="${COUNT_NOTE}">${fill('sidesCount', { fy: String(FACT_SHEET_CUT.fy), sheet: count(FACT_SHEET_CUT.cut), n: count(year.check.yes) })}</p>`;
}

// A year's line counts as well above the 75th percentile when more than this share of the decided hospitals scored
// above the percentile and were not cut (a display threshold: a handful of hospitals either way is not a different
// line).
export const ABOVE_BY = 0.005;

// "3" or "1 to 7": the range of a count across years.
const countRange = (ns) => {
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  return lo === hi ? count(lo) : fill('valueRange', { from: count(lo), to: count(hi) });
};

// What the decision check found beyond order: CMS's rule for the line, the years the published scores reproduce the
// cut exactly, the years CMS's line sits a few hospitals above the percentile and the years it sits well above it,
// and the most hospitals ever tied exactly at the line.
function sidesNotes(checks) {
  const decided = checks.filter((c) => c.check.yes);
  const on = decided.filter((c) => c.check.p75InGap);
  // Off the percentile: CMS's line above it (some hospitals above the percentile not cut), or below it (none above it
  // uncut, so CMS cut some at or below it; a year it cut every hospital it decided on has no uncut one at all).
  const off = decided.filter((c) => !c.check.p75InGap);
  const higher = off.filter((c) => c.check.aboveNotCut > 0);
  const lower = off.filter((c) => !(c.check.aboveNotCut > 0));
  const isWell = (c) => c.check.aboveNotCut / c.check.decided > ABOVE_BY;
  const well = higher.filter(isWell);
  const few = higher.filter((c) => !isWell(c));
  const years = (cs) => listText(cs.map((c) => fyLabel(c.fy)));
  const range = (cs) => countRange(cs.map((c) => c.check.aboveNotCut));
  const ties = [...decided].sort((a, b) => b.check.atLine - a.check.atLine)[0];
  return html`${para(fill('sidesRule', { percentile: ordinal(CUTOFF_PERCENTILE) }))}${on.length ? para(fill('sidesOn', { years: years(on) })) : ''}${few.length ? para(fill('sidesFew', { years: years(few), n: range(few) })) : ''}${well.length ? para(fill('sidesWell', { years: years(well), n: range(well) })) : ''}${lower.length ? para(fill('sidesLower', { years: years(lower) })) : ''}${off.length ? para(t('sidesWhy')) : ''}${ties && ties.check.atLine > 1 ? para(fill('sidesTies', { fy: String(ties.fy), n: count(ties.check.atLine), line: decimal(ties.check.highestNo, 4) })) : ''}`;
}

// How this site estimates the dollars: the words, the payment order drawn on the year's proportions, the formula as
// the pipeline with the real national numbers, the assumptions, the national checks as a tape and the back-test's
// place. Its id is the one every dollar figure's estimate tag links to (links.js DOLLARS_HREF).
export const DOLLARS_ID = DOLLARS_HREF.split('#')[1];
function dollarsSection(dollars, { fy, n, sourceOf }) {
  const { headline, national, checks, assumptions } = dollars;
  // A cut hospital CMS scored without a score, with an estimate: on its own page, outside the totals.
  const noScore = national.cut - headline.cut;
  const totals = { cut: count(headline.cut), yes: count(headline.yes), missing: count(headline.yesUnestimated) };
  const source = moneySourceText({ fy, source: sourceOf });
  return {
    id: DOLLARS_ID, heading: t('dollarsHeading'), body: html`${para(fill('dollarsText', { fy: String(fy) }))}
${para(fill('dollarsOrder', { pct: REDUCTION_TEXT }))}
${dollarsOrderFigure(headline, { n, source, fy })}
${para(noScore > 1 ? fill('dollarsTotals', { ...totals, noScore: count(noScore) }) : fill(noScore === 1 ? 'dollarsTotalsOne' : 'dollarsTotalsNone', totals))}
${para(t('dollarsMaryland'))}
<h3 class="msec__sub">${t('dollarsFormulaSub')}</h3>
${dollarsPipeline(headline)}
<h3 class="msec__sub">${t('assumeSub')}</h3>
${para(t('assumeText'))}
${assumptionsTable({ fy, volumeFy: assumptions.volumeFy })}
<h3 class="msec__sub">${t('dchecksSub')}</h3>
${para(t('dchecksText'))}
${dollarChecks(checks)}
<h3 class="msec__sub">${t('backtestSub')}</h3>
${para(t('backtestText'))}
${backtestPlaceholder()}`,
  };
}

// The glossary's entries, in reading order: [term key, definition key, values].
const GLOSSARY = (v) => [
  ['glHac', 'glHacIs'], ['glHai', 'glHaiIs'], ['glPsi', 'glPsiIs', null, { short: SHORT_NAMES.PSI90 }], ['glNhsn', 'glNhsnIs'],
  ['glSir', 'glSirIs', { one: SIR_EXPECTED_TEXT }], ['glPredicted', 'glPredictedIs', { one: SIR_EXPECTED_TEXT }], ['glSd', 'glSdIs'],
  ['glZ', 'glZIs'], ['glWinsor', 'glWinsorIs', { low: ordinal(WINSOR_LOW), high: ordinal(WINSOR_HIGH) }], ['glTotal', 'glTotalIs'],
  ['glLine', 'glLineIs', { percentile: ordinal(CUTOFF_PERCENTILE) }], ['glCut', 'glCutIs', { pct: REDUCTION_TEXT }], ['glSubject', 'glSubjectIs'], ['glDecided', 'glDecidedIs'],
  ['glFy', 'glFyIs'], ['glPeriod', 'glPeriodIs'], ['glAssigned', 'glAssignedIs'], ['glMaryland', 'glMarylandIs'], ['glCcn', 'glCcnIs'],
  ['glMedian', 'glMedianIs'], ['glDomain', 'glDomainIs', { eqFy: String(v.eqFy) }],
];

// checks: [{ fy, rule, check }] oldest first (yearCheck results); years: [{ fy, periods }] oldest first; newest: the
// newest year's { rows (CMS's file), source, pin (its manifest entry), measures, pages }; pins: the manifest entries
// the HACRP pages read; changes: [{ date, items }] newest first; estimate: { tolerance, tagged, maxError };
// boundaryText; eqFy, zFy: the fiscal years the equal-weight score and the z-scores began. dollars: the dollar
// estimates (data.js dollarsData), for the section on how this site estimates them; null for none.
export function methodsPage({ fy, checks, years, newest, pins, changes, estimate, boundaryText, eqFy, zFy, robots, assets, searchUrl, dollars = null }) {
  const { subtitle } = SITE.sites.hacrp;
  const figureNo = counter();
  const last = checks[checks.length - 1];
  const source = newest.sourceLine;

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
    { id: 'check', heading: t('proofHeading'), body: html`${para(fill('proofText', { limit: limitText }))}${para(t('proofText2'))}${withheldNote(checks)}`, fig: proofFigure(checks, { n: figureNo(), source }) },
    { id: 'decisions', heading: t('sidesHeading'), body: html`${para(t('sidesText'))}${para(t('sidesText2'))}${sidesNotes(checks)}${countNote(checks)}`, fig: sidesFigure(checks, { n: figureNo(), source }) },
    { id: 'formula', heading: t('formulaHeading'), body: html`${para(t('formulaText'))}
<dl class="formula">
<dt>${t('formulaLimited')}</dt><dd>${fill('formulaLimitedIs', { low: ordinal(WINSOR_LOW), high: ordinal(WINSOR_HIGH) })}</dd>
<dt>${t('formulaZ')}</dt><dd>${t('formulaZIs')}</dd>
<dt>${t('formulaTotal')}</dt><dd>${t('formulaTotalIs')}</dd>
<dt>${t('formulaCut')}</dt><dd>${fill('formulaCutIs', { percentile: ordinal(CUTOFF_PERCENTILE) })}</dd>
</dl>
${para(t('formulaText2'))}${para(fill('formulaText3', { eqFy: String(eqFy), zFy: String(zFy) }))}` },
    { id: 'estimate', heading: t('sourceHeading'), body: html`${para(t('sourceText'))}
${printout(html`<table class="gb takes">
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
</table>`)}
<h3 class="msec__sub">${t('estimateHeading')}</h3>
${para(estimate.tagged ? fill('estimateText', { tolerance: decimal(estimate.tolerance, 3), fy: String(fy), tagged: estimate.tagged, maxError: decimal(estimate.maxError, 4) }) : fill('estimateNone', { tolerance: decimal(estimate.tolerance, 3), fy: String(fy) }))}
<p><a href="/methods/#estimate">${t('estimateFamily')}</a></p>` },
    ...(dollars ? [dollarsSection(dollars, { fy, n: figureNo(), sourceOf: newest.source })] : []),
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
