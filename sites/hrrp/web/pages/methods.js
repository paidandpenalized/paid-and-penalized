// Ported from Thirty Day Readmissions (web/src/js/views/methods.js at 33d1959). The Readmissions Methods page so far:
// the kicker and heading, About, the formula (both formulas as preformatted blocks, the neutrality modifier at four
// decimals), the peer-group medians table and the replication sentence, the dollar estimate's method with its modeled
// totals, accuracy line and assumptions (the section every estimate tag links to, #methods-dollars), how to read a
// penalty, places, history with the annual totals and their sources, feedback and privacy (the family's page holds the
// privacy claims), accessibility, the pinned files and reuse; the sources list and the 14-term glossary sit beside them.
import { COPY as SHARED } from '../../../../web/copy.js';
import { fillAround, fillCopy } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, feedbackFor, page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { DOLLARS_HREF, METHODS_PATH } from '../links.js';
import { printout } from '../../../../web/render/components.js';
import { mediansTable } from '../figures/how.js';
import { fill, t } from '../methods/copy.js';
import { shellOf } from './parts.js';

const DOLLARS_ID = DOLLARS_HREF.split('#')[1];
// The glossary's 14 terms, in reading order: [term key, definition key or a view.glossary key].
const GLOSSARY = [
  ['termReadmission', 'defReadmission'], ['termErr', 'defErr'], ['termPeer', 'defPeer'], ['termDual', 'defDual'], ['termNeutrality', 'defNeutrality'],
  ['termWeight', 'defWeight'], ['termPaf', 'paf'], ['termBase', 'defBase'], ['termFfs', 'defFfs'], ['termIpps', 'defIpps'], ['termCcn', 'defCcn'],
  ['termTeach', 'teach'], ['termBeds', 'defBeds'], ['termCbsa', 'defCbsa'],
];

const section = (id, heading, body) => html`<section class="meth__sec" id="${id}" aria-labelledby="${id}-h">
<h2 id="${id}-h">${heading}</h2>
${body}
</section>`;

// view: methodsView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function methodsPage({ view, robots, assets }) {
  const feedback = externalLink(feedbackFor({ path: METHODS_PATH }), t('feedbackLink'));
  const more = fillAround((marks) => fill('moreText', marks), {
    privacy: html`<a href="${SITE.pages.privacy}">${t('morePrivacy')}</a>`,
    accessibility: html`<a href="${SITE.pages.accessibility}">${t('moreAccessibility')}</a>`,
  });
  const body = html`<article class="wrap page page--meth meth">
<header class="page__head">
<p class="cap kicker">${t('kicker')}</p>
<h1>${t('heading')}</h1>
</header>
<div class="meth__grid">
<div class="prose">
${section('about', t('aboutHeading'), html`<p>${view.about.intro}</p>
<p>${fillAround((marks) => fill('aboutBy', marks), { feedback })}</p>`)}
${section('formula', t('formulaHeading'), html`<p>${view.formula.intro}</p>
<pre class="formula">${t('formulaCut')}</pre>
<p>${t('formulaBelow')}</p>
<p>${view.formula.cap}</p>
${mediansTable({ meta: view.meta, conditions: view.conditions, edition: view.edition })}
<p>${view.formula.replication}</p>`)}
${section(DOLLARS_ID, t('dollarsHeading'), html`<p>${t('dollarsIntro')}</p>
<pre class="formula">${t('dollarsFormula')}</pre>
<p>${view.dollars}</p>
${view.totals && html`<p>${view.totals.text}${view.totals.url && html` ${externalLink(view.totals.url, t('cmsSourceLink'))}`}</p>`}
${view.accuracy && html`<h3>${t('accuracyHeading')}</h3>
<p>${view.accuracy}</p>`}
<h3>${t('assumeHeading')}</h3>
<p>${t('assumeIntro')}</p>
${printout(html`<table class="gb assume">
<thead><tr><th scope="col">${t('assumeColA')}</th><th scope="col">${t('assumeColE')}</th></tr></thead>
<tbody>${view.assumptions.map(([a, e]) => html`<tr><th scope="row">${a}</th><td>${e}</td></tr>`)}</tbody>
</table>`)}
<p>${t('assumeClosing')}</p>`)}
${section('read', t('readHeading'), html`<ul>
<li>${t('readRelative')}</li>
<li>${view.read.readmission}</li>
<li>${view.read.small}</li>
<li>${view.read.ma}</li>
<li>${view.read.window}</li>
<li>${fillCopy(SHARED, 'notInHrrp')}</li>
</ul>`)}
${section('places', t('placesHeading'), html`${view.places && html`<p>${view.places}</p>`}<p>${t('placesText')}</p>`)}
${section('history', t('historyHeading'), html`<p>${view.history}</p>
<p>${view.historyListed}</p>
<p>${view.historyTotals.text}${view.historyTotals.noTotal && html` ${view.historyTotals.noTotal}`}</p>
${printout(html`<table class="gb">
<thead><tr><th scope="col">${t('historyColYear')}</th><th scope="col" class="num">${t('historyColTotal')}</th><th scope="col">${t('historyColSource')}</th></tr></thead>
<tbody>${view.historyTotals.rows.map((r) => html`<tr><th scope="row">${r.fy}</th><td class="num">${r.total ?? t('historyNone')}</td><td>${r.source ? (r.source.url && r.source.name ? externalLink(r.source.url, r.source.name) : r.source.name ?? '') : ''}</td></tr>`)}</tbody>
</table>`)}`)}
${section('more', t('moreHeading'), html`<p>${view.feedback}</p>
<p>${more}</p>`)}
${section('access', t('accessHeading'), html`<p>${t('accessText')}</p>`)}
${section('pins', t('pinsHeading'), html`<p>${t('pinsText')}</p>
${printout(html`<table class="gb receipts">
<thead><tr><th scope="col">${t('pinColFile')}</th><th scope="col" class="num">${t('pinColBytes')}</th><th scope="col">${t('pinColHash')}</th><th scope="col">${t('pinColGot')}</th></tr></thead>
<tbody>${view.pins.map((p) => html`<tr><th scope="row">${p.url ? externalLink(p.url, p.title) : p.title}</th><td class="num">${p.bytes}</td><td><code>${p.hash}</code></td><td>${p.retrieved}</td></tr>`)}</tbody>
</table>`)}`)}
${section('reuse', t('reuseHeading'), html`<p>${view.reuse}</p>`)}
</div>
<aside class="meth__side">
<h2>${t('sourcesHeading')}</h2>
<ul class="sources">
${view.sources.files.map((s) => html`<li>${s.url ? externalLink(s.url, s.name) : s.name}</li>
`)}<li>${view.sources.supplemental}</li>
<li>${view.sources.rules}</li>
</ul>
<h2>${t('glossaryHeading')}</h2>
<dl class="glossary">
${GLOSSARY.map(([term, def]) => html`<dt>${t(term)}</dt>
<dd>${view.glossary[def] ?? t(def)}</dd>
`)}</dl>
</aside>
</div>
</article>`;
  return page({
    title: `${view.heading} · ${SITE.name}`,
    description: view.description,
    path: METHODS_PATH,
    robots,
    body,
    assets,
    ...shellOf({ edition: view.edition, current: 'methods' }),
  });
}
