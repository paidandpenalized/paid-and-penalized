// Ported from Thirty Day Readmissions (web/src/js/views/home.js at 33d1959), after HACRP's program page. The Readmissions
// program page so far: the top (the kicker, the name, the deck with this year's count, the places to try) beside the
// At-a-glance record card under its stamp, then the six Parts the section menu opens, each a numbered heading until its
// figures are drawn. The page has no search box yet: the box needs the browser script that reads the hospitals file,
// which this site does not have; the suggestions below the deck stand in.
import { estTag, fillAround, formField, formTitle, stamp } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { DOLLARS_HREF, PROGRAM_PATH } from '../links.js';
import { fill, t } from '../program/copy.js';
import { SECTIONS, labelOf, shellOf } from './parts.js';

function top(view) {
  const { deck, card } = view;
  const tag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });
  const hints = fillAround((marks) => fill('heroTry', marks), {
    state: html`<a href="${view.try.state.path}">${view.try.state.name}</a>`,
    metro: html`<a href="${view.try.metro.path}">${view.try.metro.name}</a>`,
    every: html`<a href="#explore">${t('heroEvery')}</a>`,
    how: html`<a href="#how">${t('heroHow')}</a>`,
  });
  return html`<header class="page__head prog__top">
<div class="prog__intro stack">
<p class="cap kicker prog__kicker">${view.kicker}</p>
<h1 class="prog__title">${SITE.sites.hrrp.title}</h1>
<p class="prog__deck">${deck.lead}<strong>${deck.count}</strong>${deck.mid}${deck.share}</p>
<p class="prog__try">${hints}</p>
</div>
<div class="prog__card stack">
<div class="form prog__summary">
${formTitle(card.left, card.right)}
${card.fields.map((f, i) => html`${formField({ no: i + 1, label: f.label, value: f.estimated ? html`${f.value}${tag}` : f.value, note: f.note })}
`)}</div>
${stamp({ label: card.stamp })}
</div>
</header>`;
}

// A Part: its number, its heading, and (later) its figures.
const part = (id, n, label) => html`<section class="part" id="${id}" aria-labelledby="${id}-h">
<div class="part__head">
<p class="part__tag">${fill('partTag', { n: String(n) })}</p>
<h2 class="part__title" id="${id}-h">${label}</h2>
</div>
</section>`;

// view: programView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function programPage({ view, robots, assets }) {
  const body = html`<article class="wrap page page--prog prog">
${top(view)}
${SECTIONS.map((id, i) => part(id, i + 1, labelOf(id, view.edition)))}
</article>`;
  return page({
    title: `${view.heading} · ${SITE.name}`,
    description: view.description,
    path: PROGRAM_PATH,
    robots,
    body,
    assets,
    ...shellOf({ edition: view.edition }),
  });
}
