// The HACRP program page (/hacrp/): what the program is, its measures and periods, CMS's line, this year's counts,
// a hospital search and links out. Every number comes from the emitted data or a method constant.
import { html, jsonScript } from '../../../../web/render/html.js';
import { count, longDate, pct } from '../../../../web/render/format.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { CUTOFF_PERCENTILE, REDUCTION_PCT, SHORT_NAMES } from '../constants.js';
import { fill } from '../copy.js';
import { LINKS } from '../links.js';
import { asofBar, sourceLine, t } from './parts.js';

export const PATH = '/hacrp/';
export const SEARCH_ID = 'hacrp-search-data';

const ordinal = (n) => {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th');
};

const link = (href, text, note) => html`<li><a href="${href}">${text}</a>${note && html` <span class="muted">${note}</span>`}</li>`;

// counts: { decided, yes, scored }. boundaryText: CMS's text for the line's two scores. measures: [{ id, label,
// short }]. search: [[ccn (lowercase), name, city, state]]. robots: null for an indexable page.
export function programPage({ fy, counts, boundaryText, measures, periods, search, source, robots, assets }) {
  const { title, subtitle } = SITE.sites.hacrp;
  const fyText = String(fy);
  const hai = measures.filter((m) => m.id !== 'PSI90').map((m) => SHORT_NAMES[m.id]).join(', ');
  const psi = measures.find((m) => m.id === 'PSI90');

  const body = html`<article class="wrap page">
<header class="page__head">
<h1>${title}</h1>
<p class="subtitle">${subtitle}</p>
<p class="dek">${t('dek')}</p>
</header>
<section class="block search" aria-labelledby="search-h" hidden>
<h2 id="search-h" class="h-sm">${t('searchHeading')}</h2>
<label for="hospital-search">${t('searchLabel')}</label>
<input id="hospital-search" type="search" list="hospital-names" autocomplete="off" aria-describedby="search-hint">
<datalist id="hospital-names"></datalist>
<p id="search-hint" class="small muted">${t('searchHint')}</p>
</section>
<section class="block" aria-labelledby="what-h">
<h2 id="what-h">${t('whatHeading')}</h2>
<p>${t('whatScore')}</p>
<p>${fill('whatCut', { percentile: ordinal(CUTOFF_PERCENTILE), pct: pct(REDUCTION_PCT / 100, 0) })}</p>
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
<p class="line">${fill('line', boundaryText)}</p>
<p>${t('lineRelative')}</p>
</section>
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
</article>
${jsonScript(SEARCH_ID, search)}`;

  return page({
    title: `${fill('programTitle', { fy: fyText })} · ${SITE.name}`,
    description: t('dek'),
    path: PATH,
    robots,
    body,
    scripts: [assets.js['hacrp-program']],
    assets,
  });
}
