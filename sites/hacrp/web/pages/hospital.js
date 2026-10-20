// One hospital's page: what CMS reports for it in plain words, the score and decision, the measure table with
// CMS's values and footnotes, then where the data come from. Odd rows show CMS's values and add no inference.
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { distanceSentence, measureNote, smallNumber, summary } from '../sentences.js';
import { fill } from '../copy.js';
import { asofBar, decisionPill, sourceLine, t } from './parts.js';

const missing = (text) => text === '' || text === 'N/A';

// A CMS value cell: CMS's text, or a dash (with words for screen readers) where CMS published none.
const value = (text) => (missing(text)
  ? html`<span aria-hidden="true">—</span><span class="vh">${t('noValue')}</span>`
  : text);

const footnote = (f) => html`<p><span class="fn">${fill('footnoteLead', { code: f.code })}</span> ${f.text}</p>`;

function measureRow(m) {
  const note = measureNote(m);
  // The tag marks a recompute from a measured value, so a measure with no value (unscored or assigned) has none.
  const tag = m.tagged && !missing(m.valueText) && html`<p><a class="tag" href="/methods/#estimate" title="${fill('estimateTitle', { maxError: m.maxErrorText })}">${t('estimateTag')}</a></p>`;
  return html`<tr>
<th scope="row">${m.label} <span class="short">(${m.short})</span></th>
<td class="num cms" data-label="${t('colValue')}">${value(m.valueText)}</td>
<td class="num cms" data-label="${t('colZ')}">${value(m.zText)}</td>
<td class="notes">${note && html`<p>${note}</p>`}${m.footnotes.map(footnote)}${tag}</td>
</tr>`;
}

// Every CMS footnote the page quotes, once, in the order it first appears.
function footnoteLegend(view) {
  const seen = new Map();
  const lists = [(view.total ?? view.noScore).footnotes, view.decision.footnotes, ...view.measures.map((m) => m.footnotes)];
  for (const f of lists.flat()) if (!seen.has(f.code)) seen.set(f.code, f.text);
  if (!seen.size) return '';
  return html`<section class="block" aria-labelledby="fn-h">
<h2 id="fn-h" class="h-sm">${t('footnotesHeading')}</h2>
<dl class="fnlist">${[...seen].map(([code, text]) => html`<div><dt>${code}</dt><dd>${text}</dd></div>`)}</dl>
</section>`;
}

// robots: null for an indexable page, else the meta robots value.
export function hospitalPage({ view, source, robots, assets }) {
  const fy = String(view.fy);
  const title = fill('hospitalTitle', { name: view.name, city: view.city, state: view.state, fy });
  const sentences = summary(view);
  const distance = distanceSentence(view);
  const small = smallNumber(view);
  const score = view.total ?? view.noScore;

  const body = html`<article class="wrap page">
<header class="page__head">
<p class="cap kicker"><a href="/hacrp/">${fill('kicker', { subtitle: SITE.sites.hacrp.subtitle, fy })}</a></p>
<h1>${view.name}</h1>
<p class="place">${fill('place', { city: view.city, state: view.state, ccn: view.ccn })}</p>
</header>
<div class="prose">${sentences.map((s) => html`<p>${s}</p>`)}</div>
<section class="hero" aria-label="${t('heroScore')}">
<div class="hero__item"><p class="cap">${t('heroScore')}</p><p class="hero__num cms">${score.text}</p></div>
<div class="hero__item"><p class="cap">${t('heroDecision')}</p><p class="hero__pill">${decisionPill(view.status, view.decision.text)}</p>
<p class="small muted">${fill('decisionCms', { decision: view.decision.text })}</p></div>
</section>
<div class="prose">
${distance && html`<p>${distance}</p>`}
${small && html`<p class="note">${small}</p>`}
<p class="standing">${t('standing')}</p>
</div>
<section class="block" aria-labelledby="measures-h">
<h2 id="measures-h">${t('measuresHeading')}</h2>
<p>${t('measuresIntro')}</p>
<div class="printout"><div class="printout__scroll"><table class="gb gb--measures">
<thead><tr><th scope="col">${t('colMeasure')}</th><th scope="col" class="num">${t('colValue')}</th><th scope="col" class="num">${t('colZ')}</th><th scope="col">${t('colNotes')}</th></tr></thead>
<tbody>${view.measures.map(measureRow)}</tbody>
</table></div></div>
</section>
${view.whatIf && html`<section id="whatif" class="block"></section>`}
${asofBar({ fy: view.fy, periods: view.periods, source })}
${footnoteLegend(view)}
<p class="page__links"><a href="/hacrp/">${t('backToProgram')}</a></p>
${sourceLine({ fy: view.fy, source })}
</article>`;

  return page({
    title,
    description: sentences[0],
    path: view.path,
    robots,
    body,
    assets,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + view.path, isBasedOn: source.landingPage },
  });
}
