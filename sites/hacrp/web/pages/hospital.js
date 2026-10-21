// One hospital's page: the score and decision (the lede), what CMS reports in plain words, the measure table with
// CMS's values and footnotes, two figures and the what-if (scored hospitals only), then where the data come from.
// Odd rows show CMS's values and add no inference.
import { footnoteLegend, footnoteNote, printout } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { distanceSentence, largestSentence, measureNote, smallNumber, summary } from '../sentences.js';
import { fill, sourceText, t } from '../copy.js';
import { partsFigure, rangeFigure } from '../figures.js';
import { asofBar, citation, dataLinks, decisionPill, pillShowsCmsValue, sourceLine } from './parts.js';
import { whatIfSection } from './whatif.js';

// A CMS value cell: CMS's text, or a dash (with words for screen readers) where CMS published none.
const value = (text, published) => (published
  ? text
  : html`<span aria-hidden="true">—</span><span class="vh">${t('noValue')}</span>`);

const footnote = (f) => footnoteNote({ lead: fill('footnoteLead', { code: f.code }), text: f.text });

// A measure's notes: this site's note, CMS's footnotes and the estimate tag ('' when it has none). The tag marks a
// recompute from a measured value, so a measure with no value (unscored or assigned) has none.
function measureNotes(m) {
  const note = measureNote(m);
  const tag = m.tagged && m.hasValue && html`<details class="est"><summary>${t('estimateTag')}</summary>
<p class="est__body small">${fill('estimateNote', { maxError: m.maxErrorText })} <a href="/methods/#estimate">${t('estimateMore')}</a></p></details>`;
  return html`${note && html`<p>${note}</p>`}${m.footnotes.map(footnote)}${tag}`;
}

// withNotes: the table has a Notes column (some measure has a note), so every row carries the cell.
function measureRow(m, withNotes) {
  return html`<tr>
<th scope="row">${m.label} <span class="short">(${m.short})</span></th>
<td class="num cms" data-label="${t('colValue')}">${value(m.valueText, m.hasValue)}</td>
<td class="num cms" data-label="${t('colZ')}">${value(m.zText, m.hasZ)}</td>
${withNotes && html`<td class="notes">${measureNotes(m)}</td>
`}</tr>`;
}

// The measure table, with a Notes column only when some measure has a note; the column takes the page's width only
// for prose (this site's note or CMS's footnotes), not for estimate tags alone.
function measureTable(measures) {
  const withNotes = measures.some((m) => String(measureNotes(m)) !== '');
  const prose = measures.some((m) => measureNote(m) || m.footnotes.length);
  return printout(html`<table class="gb gb--measures${prose ? ' gb--notes' : ''}">
<thead><tr><th scope="col">${t('colMeasure')}</th><th scope="col" class="num">${t('colValue')}</th><th scope="col" class="num">${t('colZ')}</th>${withNotes && html`<th scope="col">${t('colNotes')}</th>`}</tr></thead>
<tbody>${measures.map((m) => measureRow(m, withNotes))}</tbody>
</table>`);
}

// Every CMS footnote the page quotes, once, in the order it first appears.
const legend = (view) => footnoteLegend({
  heading: t('footnotesHeading'),
  lists: [view.score.footnotes, view.decision.footnotes, ...view.measures.map((m) => m.footnotes)],
});

// The what-if for a scored hospital, CMS's values to start, shared by link (pages/whatif.js has its page data).
function whatIfBlock(view, whatif, source, assets) {
  const script = assets.js['hacrp-hospital'];
  if (!script) throw new TypeError('hospitalPage: assets.js must hold the hacrp-hospital module for the what-if');
  const page = { name: view.name, fy: view.fy, path: view.path, source, boundaryText: view.boundaryText, baseline: 'cms', share: true };
  return { body: whatIfSection(whatif, page, 'hacrp-hospital'), script };
}

// A scored hospital's figures, numbered in page order: each measure's part of the score, then each measure's value
// against the national range (when any measure has a published value).
function figures(view, ranges, source) {
  if (!view.scored) return [];
  if (!ranges) throw new TypeError('hospitalPage: a scored hospital needs ranges (measureRanges in figures.js)');
  const line = sourceText({ fy: view.fy, source });
  return [partsFigure(view, 1, line), rangeFigure(view, ranges, 2, line)].filter(Boolean);
}

// robots: null for an indexable page, else the meta robots value. ranges: each measure's national range
// (measureRanges(model) in figures.js), required for a scored hospital. whatif: { hospital, model, estimate, range }
// for the what-if (range from scoreRange() in generate.js); a hospital with no score never gets one.
export function hospitalPage({ view, source, robots, assets, ranges = null, whatif = null }) {
  const fy = String(view.fy);
  const where = { name: view.name, city: view.city, state: view.state, fy };
  const heading = fill('hospitalTitle', where);
  const title = `${heading} · ${SITE.name}`;
  const largest = largestSentence(view);
  const sentences = summary(view);
  const distance = distanceSentence(view);
  const small = smallNumber(view);
  const home = SITE.sites.hacrp.path;
  const what = view.scored && whatif ? whatIfBlock(view, whatif, source, assets) : null;
  const figs = figures(view, ranges, source);

  const body = html`<article class="wrap page">
<header class="page__head">
<p class="cap kicker"><a href="${home}">${fill('kicker', { subtitle: SITE.sites.hacrp.subtitle, fy })}</a></p>
<h1>${view.name}</h1>
<p class="place">${fill('place', { city: view.city, state: view.state, ccn: view.ccn })}</p>
</header>
<section class="hero" aria-label="${t('heroLabel')}">
<div class="hero__item"><p class="cap">${t('heroScore')}</p>${view.scored
    ? html`<p class="hero__num cms">${view.score.text}</p>`
    : html`<p class="hero__none"><span>${t('noScore')}</span></p>`}</div>
<div class="hero__item"><p class="cap">${t('heroDecision')}</p><p class="hero__pill">${decisionPill(view.status, view.decision.text)}</p>
${!pillShowsCmsValue(view.status) && html`<p class="small muted">${fill('decisionCms', { decision: view.decision.text })}</p>`}</div>
</section>
<div class="prose">
${sentences.map((s) => html`<p>${s}</p>`)}
${distance && html`<p>${distance}</p>`}
${small && html`<p class="note">${small}</p>`}
<p class="standing">${t('standing')}</p>
</div>
<section class="block" aria-labelledby="measures-h">
<h2 id="measures-h">${t('measuresHeading')}</h2>
<p>${t('measuresIntro')}</p>
${largest && html`<p>${largest}</p>`}
${measureTable(view.measures)}
${figs}
</section>
${what?.body}
${asofBar({ fy: view.fy, periods: view.periods, source })}
${dataLinks(view.fy)}
${legend(view)}
<p class="page__links"><a href="${home}">${t('backToProgram')}</a></p>
${citation({ fy: view.fy, title: heading, path: view.path, source })}
${sourceLine({ fy: view.fy, source })}
</article>`;

  return page({
    title,
    description: fill('hospitalDescription', where),
    path: view.path,
    robots,
    body,
    scripts: [...(figs.length ? [assets.js.figure] : []), assets.js.cite, ...(what ? [what.script] : [])],
    assets,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + view.path, isBasedOn: source.landingPage },
  });
}
