// Ported from Thirty Day Readmissions (web/src/js/views/hospital.js at 33d1959), after HACRP's hospital page (the
// record card, the stamp, the verdict beside it). The top of a hospital's page: the breadcrumb, the record card
// (name, place, metro area, type, peer group, stars) beside the verdict (the stamps, the summary, the inactive note,
// the factor and the estimated dollars, the rank, the report link). The figures that follow come in a later batch.
import { estTag, formField, formTitle, stamp } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, feedbackFor, page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { t } from '../hospital/copy.js';
import { DOLLARS_HREF, hospitalPath } from '../links.js';
import { breadcrumb, followed, shellOf } from './parts.js';

const starsValue = (stars) => (stars.n === null ? stars.text
  : html`<span class="stars" aria-hidden="true">${stars.filled}<span class="stars__off">${stars.empty}</span></span><span class="vh">${stars.text}</span>`);

// The record card, Thirty Day Readmissions' red-ruled form: a title bar, then six numbered fields.
function recordCard(view) {
  const link = (href, text, external = false) => (external ? externalLink(href, text) : html`<a href="${href}">${text}</a>`);
  const name = formField({
    no: 1, label: t('fieldHospital'), value: view.name, as: 'h1', cls: 'hosp__name', wide: true,
    note: view.alias && html`<span class="hosp__alias">${view.alias}</span>`,
  });
  const fields = [
    { label: t('fieldLocation'), value: view.location, note: view.county, fieldCls: 'f-loc' },
    { label: t('fieldMetro'), value: view.metro.value, note: link(view.metro.href, view.metro.linkText), fieldCls: 'f-metro' },
    { label: t('fieldType'), value: view.type, size: 'sm', fieldCls: 'f-type' },
    { label: t('fieldPeer'), value: view.peer.value, note: view.peer.note, fieldCls: 'f-peer' },
    { label: t('fieldStars'), value: starsValue(view.stars), note: link(view.stars.href, t('starsLink'), true), fieldCls: 'f-stars' },
  ].map((spec, i) => formField({ no: i + 2, ...spec }));
  return html`<div class="form hosp__id">
${formTitle(view.record.left, view.record.right)}
${name}
<div class="hosp__fields">
${fields.map((markup) => html`${markup}
`)}</div>
</div>`;
}

function verdict(view, path) {
  const dollars = view.dollars;
  const tag = estTag({ href: DOLLARS_HREF, label: t('estimateLabel'), text: t('estimate') });
  return html`<section class="hosp__verdict" aria-label="${t('verdictLabel')}">
<div class="hosp__stamps">
${view.stamps.map((s) => stamp(s))}
</div>
<p class="hosp__summary">${view.summary}</p>
${view.inactive && html`<p class="hosp__inactive">${view.inactive}</p>`}
<div class="form hosp__nums">
${formField({ no: 'A', label: t('fieldFactor'), value: view.factor.value, note: view.factor.note })}
${formField({ no: 'B', label: t('fieldDollars'), value: dollars.estimated ? html`${dollars.value}${tag}` : dollars.value, note: dollars.note })}
</div>
<p class="hosp__rank">${view.rank}</p>
<p class="hosp__reportline">${externalLink(feedbackFor({ path }), t('report'))}</p>
</section>`;
}

// view: hospitalView()'s result; robots: null for an indexable page, else the meta robots value; assets: the build's paths.
export function hospitalPage({ view, robots, assets }) {
  const path = hospitalPath(view.ccn);
  const title = `${view.heading} · ${SITE.name}`;
  const body = html`<article class="wrap page page--hosp hosp">
${breadcrumb(view.crumbs, view.name)}
<div class="hosp__top">
${recordCard(view)}
${verdict(view, path)}
</div>
<p class="small muted hosp__source">${view.source}</p>
</article>`;
  return page({
    title,
    description: view.description,
    path,
    robots,
    body,
    assets,
    ...shellOf({ edition: view.edition, current: 'explore', hospital: followed(view) }),
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + path },
  });
}
