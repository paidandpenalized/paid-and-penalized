// The HACRP program page (/hacrp/): what the program is, its measures and periods, CMS's line, the formula
// stepper on the median hospital, the sandbox, this year's counts with their figures, the table of every hospital,
// a hospital search and links out. Every number comes from the emitted data or a method constant.
import { printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { cmsText, count, longDate, ordinal } from '../../../../web/render/format.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { CUTOFF_PERCENTILE, REDUCTION_TEXT, WINSOR_HIGH, WINSOR_LOW } from '../constants.js';
import { fill, sourceText, t } from '../copy.js';
import { lineFigure, scoresFigure, statesFigure } from '../figures.js';
import { LINKS, csvPath, dictionaryPath } from '../links.js';
import { stepRows, stepSum } from '../stepper.js';
import { asofBar, citation, sourceLine } from './parts.js';
import { whatIfSection } from './whatif.js';

export const PATH = SITE.sites.hacrp.path;

const link = (href, text, note) => html`<li><a href="${href}">${text}</a>${note && html` <span class="muted">${note}</span>`}</li>`;

// The sandbox: the what-if on the synthetic median hospital, from its own values, with no link to share (its page
// data, pages/whatif.js, take the same shape as a hospital page's). Its label is the section's, under the heading.
function sandbox(whatif, { fy, boundaryText, source }) {
  const page = { name: null, fy, path: PATH, source, boundaryText, baseline: 'sandbox', share: false };
  return whatIfSection(whatif, page, 'hacrp-program');
}

const stepTable = (caption, step, columns, rows) => printout(html`<table class="gb gb--steps">
<caption class="vh">${caption}</caption>
<thead><tr><th scope="col">${t('colMeasure')}</th>${columns.map((c) => html`<th scope="col" class="num">${t(c)}</th>`)}</tr></thead>
<tbody>${rows.map(([r, cells]) => html`<tr data-measure="${r.id}" data-step="${step}"><th scope="row">${r.short}</th>${cells.map((c) => html`<td class="num">${c}</td>`)}</tr>`)}</tbody>
</table>`);

// The formula, step by step, on the median hospital (whatif.hospital, from medianHospital): value, limited to
// CMS's floor and cap, z-score from the fitted mean and SD, the average, and the line (a numbered figure).
function stepper({ hospital, model, range }, { boundaryText, n, line, fy }) {
  const rows = stepRows(hospital, model);
  const { n: zCount, sumText: sum } = stepSum(hospital);
  return html`<section class="block" aria-labelledby="steps-h">
<h2 id="steps-h">${t('stepsHeading')}</h2>
<p>${t('stepsIntro')}</p>
<ol class="steps">
<li><p>${t('stepValue')} ${fill('stepLimit', { low: ordinal(WINSOR_LOW), high: ordinal(WINSOR_HIGH) })}</p>
${stepTable(t('stepTableValue'), 'value', ['stepColValue', 'stepColFloor', 'stepColCap', 'stepColLimited'], rows.map((r) => [r, [r.valueText, r.floorText, r.capText, r.limitedText]]))}</li>
<li><p>${t('stepZ')}</p>
${stepTable(t('stepTableZ'), 'z', ['stepColLimited', 'stepColMean', 'stepColSd', 'colZ'], rows.map((r) => [r, [r.limitedText, r.meanText, r.sdText, r.zText]]))}</li>
<li><p>${fill('stepAverage', { n: String(zCount), sum, total: cmsText(hospital.totalText) })}</p></li>
<li><p>${t('stepLine')}</p>
${lineFigure({ hospital, model, range, boundaryText, n, source: line, fy })}</li>
</ol>
<p class="small muted">${t('stepRounded')}</p>
</section>`;
}

// The table of every hospital: client/program.js fills it from the hospitals asset (data-src) and shows it;
// without JavaScript, a sentence and the CSV link.
const COLUMNS = [['name', 'tableColName'], ['city', 'tableColCity'], ['state', 'tableColState'], ['score', 'tableColScore'], ['decision', 'tableColDecision']];
const hospitalTable = ({ fy, searchUrl }) => html`<section class="block hospitals" aria-labelledby="hospitals-h" id="hospitals">
<h2 id="hospitals-h">${t('tableHeading')}</h2>
<p class="ht-nojs">${t('tableNoScript')}</p>
<p><a href="${csvPath(fy)}">${t('dataCsv')}</a> · <a href="${dictionaryPath(fy)}">${t('dataDictionary')}</a></p>
<div class="ht" data-src="${searchUrl}" hidden>
<p>${t('tableIntro')}</p>
<div class="ht__controls">
<p class="ht__field"><label for="ht-state">${t('tableState')}</label> <select id="ht-state"><option value="">${t('tableAllStates')}</option></select></p>
<p class="ht__field"><label for="ht-name">${t('tableName')}</label> <input id="ht-name" type="search" autocomplete="off"></p>
</div>
<p class="small" id="ht-count" aria-live="polite"></p>
${printout(html`<table class="gb gb--hospitals">
<caption class="vh">${t('tableCaption')}</caption>
<thead><tr>${COLUMNS.map(([key, label]) => html`<th scope="col" data-key="${key}"${key === 'state' ? html` aria-sort="ascending"` : ''}${key === 'score' ? html` class="num"` : ''}><button type="button" class="fig__sort">${t(label)}</button></th>`)}</tr></thead>
<tbody></tbody>
</table>`)}
<p class="fig__actions"><button type="button" class="fig__btn" id="ht-all" hidden></button></p>
</div>
</section>`;

// counts: { decided, yes, scored }, for the counts sentences. boundaryText: CMS's text for the line's two scores.
// measures: [{ id, label, short }]. searchUrl: the hospitals asset the search reads (generate.js, hospitalRows).
// robots: null for an indexable page. whatif: { hospital, model, estimate, range } for the stepper and the sandbox
// (hospital: medianHospital(model); range from scoreRange() in generate.js); without it the page has neither.
// scores: [{ total, yes }] of the hospitals with a Yes/No decision, with boundary (the model's numbers for the
// line), for the histogram; states: stateCounts() (view.js), for the tile grid; each figure is left out without its
// data, and takes its numbers from its own data. Figures are numbered in page order.
export function programPage({ fy, counts, boundaryText, measures, periods, searchUrl, source, robots, assets, whatif = null, scores = null, boundary = null, states = null }) {
  const { title, subtitle } = SITE.sites.hacrp;
  const fyText = String(fy);
  const heading = fill('programTitle', { fy: fyText });
  const hai = measures.filter((m) => m.id !== 'PSI90').map((m) => m.short).join(', ');
  const psi = measures.find((m) => m.id === 'PSI90');
  const what = whatif && sandbox(whatif, { fy, boundaryText, source });
  const line = sourceText({ fy, source });
  let n = 0;
  const steps = whatif && stepper(whatif, { boundaryText, n: ++n, line, fy });
  const histogram = scores && scoresFigure({ scores, boundary, n: ++n, source: line, fy });
  const tiles = states && statesFigure({ states, n: ++n, source: line, fy });

  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${title}</h1>
<p class="subtitle">${subtitle}</p>
<p class="dek">${t('dek')}</p>
</header>
<section class="block search" aria-labelledby="search-h" data-src="${searchUrl}" hidden>
<h2 id="search-h" class="h-sm">${t('searchHeading')}</h2>
<label for="hospital-search">${t('searchLabel')}</label>
<input id="hospital-search" type="search" list="hospital-names" autocomplete="off" aria-describedby="search-hint">
<datalist id="hospital-names"></datalist>
<p id="search-hint" class="small muted">${t('searchHint')}</p>
</section>
<section class="block" aria-labelledby="what-h">
<h2 id="what-h">${t('whatHeading')}</h2>
<p>${t('whatScore')} ${t('whatWho')}</p>
<p>${fill('whatCut', { percentile: ordinal(CUTOFF_PERCENTILE), pct: REDUCTION_TEXT })}</p>
<p>${t('whatRelative')}</p>
</section>
<section class="block" aria-labelledby="measures-h">
<h2 id="measures-h">${t('measuresHeading')}</h2>
<p>${t('programMeasures')} ${t('programMeasuresZ')}</p>
<ul class="measure-list">${measures.map((m) => html`<li>${m.label} <span class="short">(${m.short})</span></li>`)}</ul>
</section>
<section class="block" aria-labelledby="periods-h">
<h2 id="periods-h">${t('periodsHeading')}</h2>
<ul class="measure-list">
<li>${fill('periodPsi', { label: psi.label, short: psi.short, start: longDate(periods.psi90.start), end: longDate(periods.psi90.end) })}</li>
<li>${fill('periodHai', { shorts: hai, start: longDate(periods.hai.start), end: longDate(periods.hai.end) })}</li>
</ul>
</section>
<section class="block" aria-labelledby="line-h">
<h2 id="line-h">${t('lineHeading')}</h2>
<p class="line">${fill('line', boundaryText)} ${t('lineMaryland')}</p>
<p>${t('lineRelative')}</p>
</section>
${steps}
${what}
<section class="block" aria-labelledby="counts-h">
<h2 id="counts-h">${fill('countsHeading', { fy: fyText })}</h2>
<p>${fill('countDecided', { yes: count(counts.yes), decided: count(counts.decided) })}</p>
<p>${fill('countScored', { scored: count(counts.scored) })}</p>
<p class="standing">${t('standing')}</p>
${histogram}
${tiles}
</section>
${hospitalTable({ fy, searchUrl })}
<section class="block" aria-labelledby="links-h">
<h2 id="links-h">${t('linksHeading')}</h2>
<ul class="links" role="list">
${link(LINKS.cmsProgram, t('linkCmsProgram'))}
${link(source.landingPage, t('linkPdc'))}
${link(LINKS.careCompare, t('linkCareCompare'), t('linkCareCompareNote'))}
${link(LINKS.leapfrog, t('linkLeapfrog'), t('linkLeapfrogNote'))}
</ul>
</section>
${asofBar({ fy, periods, source })}
${citation({ fy, title: heading, path: PATH, source })}
${sourceLine({ fy, source })}
</article>`;

  return page({
    title: `${heading} · ${SITE.name}`,
    description: fill('programDescription', { fy: fyText }),
    path: PATH,
    robots,
    body,
    scripts: [...(steps || histogram || tiles ? [assets.js.figure] : []), assets.js.cite, assets.js['hacrp-program']],
    assets,
  });
}
