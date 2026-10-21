// The HACRP program page (/hacrp/): what the program is, its measures and periods, CMS's line, this year's counts,
// a hospital search and links out. Every number comes from the emitted data or a method constant.
import { html, jsonScript } from '../../../../web/render/html.js';
import { count, longDate, ordinal } from '../../../../web/render/format.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { renderWhatIf } from '../../../../web/whatif/render.js';
import { CUTOFF_PERCENTILE, REDUCTION_TEXT } from '../constants.js';
import { fill } from '../copy.js';
import { LINKS } from '../links.js';
import { initialState, solverOf, viewModel } from '../whatif-state.js';
import { whatIfTexts } from '../whatif-text.js';
import { asofBar, sourceLine, t } from './parts.js';

export const PATH = SITE.sites.hacrp.path;

const link = (href, text, note) => html`<li><a href="${href}">${text}</a>${note && html` <span class="muted">${note}</span>`}</li>`;

// The sandbox: the what-if on the synthetic median hospital, from its own values, with no link to share. Its page
// data (for client/program.js) take the same shape as a hospital page's: the record, the model and the estimate
// tags (never the whole file), the fields the texts need, and the ramp's national range of scores.
function sandbox({ hospital, model, estimate, range }, { fy, boundaryText, source }) {
  const page = { name: null, fy, path: PATH, source: { id: source.id, pdcReleased: source.pdcReleased }, boundaryText, baseline: 'sandbox' };
  const vm = viewModel(initialState(hospital, model), hospital, model, estimate);
  return html`<p class="cap sandbox-label">${t('sandboxLabel')}</p>
${renderWhatIf({ vm, texts: whatIfTexts({ hospital, model, ...page }), share: false, range, solver: solverOf(hospital, model) })}
${jsonScript('hacrp-program', { hospital, model, estimate, page, range })}`;
}

// counts: { decided, yes, scored }. boundaryText: CMS's text for the line's two scores. measures: [{ id, label,
// short }]. searchUrl: the hospitals asset the search reads (generate.js, hospitalRows). robots: null for an
// indexable page. whatif: { hospital, model, estimate, range } for the sandbox (hospital: medianHospital(model);
// range from scoreRange() in generate.js); without it the page has none.
export function programPage({ fy, counts, boundaryText, measures, periods, searchUrl, source, robots, assets, whatif = null }) {
  const { title, subtitle } = SITE.sites.hacrp;
  const fyText = String(fy);
  const hai = measures.filter((m) => m.id !== 'PSI90').map((m) => m.short).join(', ');
  const psi = measures.find((m) => m.id === 'PSI90');
  const what = whatif && sandbox(whatif, { fy, boundaryText, source });

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
<p>${t('whatScore')}</p>
<p>${fill('whatCut', { percentile: ordinal(CUTOFF_PERCENTILE), pct: REDUCTION_TEXT })}</p>
<p>${t('whatRelative')}</p>
</section>
<section class="block" aria-labelledby="measures-h">
<h2 id="measures-h">${t('measuresHeading')}</h2>
<p>${t('programMeasures')}</p>
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
${what}
<section class="block" aria-labelledby="counts-h">
<h2 id="counts-h">${fill('countsHeading', { fy: fyText })}</h2>
<p>${fill('countDecided', { yes: count(counts.yes), decided: count(counts.decided) })}</p>
<p>${fill('countScored', { scored: count(counts.scored) })}</p>
<p class="standing">${t('standing')}</p>
</section>
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
${sourceLine({ fy, source })}
</article>`;

  return page({
    title: `${fill('programTitle', { fy: fyText })} · ${SITE.name}`,
    description: fill('programDescription', { fy: fyText }),
    path: PATH,
    robots,
    body,
    scripts: [assets.js['hacrp-program']],
    assets,
  });
}
