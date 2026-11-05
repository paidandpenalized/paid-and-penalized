// Ported from Thirty Day Readmissions (web/src/js/views/methods.js at 33d1959). The Readmissions Methods page so far:
// the kicker and heading, About, the formula (both formulas as preformatted blocks, the neutrality modifier at four
// decimals) and the replication sentence, the dollar estimate's method (the section every estimate tag links to), how to
// read a penalty, places, history, the family's pages on feedback and privacy, then the sources and a short glossary
// beside them. The assumptions behind the dollars, the checks drawn and the full glossary come in a later batch.
import { COPY as SHARED } from '../../../../web/copy.js';
import { fillAround, fillCopy } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, feedbackFor, page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { DOLLARS_HREF, METHODS_PATH } from '../links.js';
import { fill, t } from '../methods/copy.js';
import { shellOf } from './parts.js';

const DOLLARS_ID = DOLLARS_HREF.split('#')[1];
const GLOSSARY = [['termPeer', 'defPeer'], ['termDual', 'defDual'], ['termNeutrality', 'defNeutrality'], ['termFfs', 'defFfs'], ['termCcn', 'defCcn'], ['termCbsa', 'defCbsa']];

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
<p>${view.formula.cap}</p>
<p>${view.formula.replication}</p>`)}
${section(DOLLARS_ID, t('dollarsHeading'), html`<p>${t('dollarsIntro')}</p>
<pre class="formula">${t('dollarsFormula')}</pre>
<p>${view.dollars}</p>`)}
${section('read', t('readHeading'), html`<ul>
<li>${t('readRelative')}</li>
<li>${view.small}</li>
<li>${view.window}</li>
<li>${fillCopy(SHARED, 'notInHrrp')}</li>
</ul>`)}
${section('places', t('placesHeading'), html`<p>${t('placesText')}</p>`)}
${section('history', t('historyHeading'), html`<p>${view.history}</p>`)}
${section('more', t('moreHeading'), html`<p>${more}</p>`)}
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
<dd>${t(def)}</dd>
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
