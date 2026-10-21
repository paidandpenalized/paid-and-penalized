// One hospital's page: the score and decision (the lede), what CMS reports in plain words, the measure table with
// CMS's values and footnotes, two figures and the what-if (scored hospitals only), then where the data come from.
// Odd rows show CMS's values and add no inference.
import { footnoteLegend, footnoteNote, printout } from '../../../../web/render/components.js';
import { isoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { distanceSentence, largestSentence, measureNote, smallNumber, summary } from '../sentences.js';
import { fill, fillKeep, heroLineText, sourceText, t } from '../copy.js';
import { partsFigure, rangeFigure } from '../figures.js';
import { asofBar, citation, dataLinks, decisionPill, kicker, pillShowsCmsValue, printLink, siteHeader } from './parts.js';
import { whatIfSection } from './whatif.js';

// The fonts a hospital page preloads: the default set with the mono's 700 (the hero number) in place of its 400.
const HERO_FONTS = ['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-700'];

// A CMS value cell: CMS's text, or a dash (with words for screen readers) where CMS published none.
const value = (text, published) => (published
  ? text
  : html`<span aria-hidden="true">—</span><span class="vh">${t('noValue')}</span>`);

// The hero's number, its decimal point in a span the CSS pulls in: a monospace point takes a full cell, which opens
// a gap at hero size. The digits stay tabular, and the text is CMS's, unchanged.
function heroNumber(text) {
  const at = text.indexOf('.');
  return at < 0 ? text : html`${text.slice(0, at)}<span class="dp">.</span>${text.slice(at + 1)}`;
}

// The place line's parts ("Boaz, AL", "CCN 010005", then the data's release), each with the separator before it, so a
// line can break before a separator but never leave one at a line's end. The short parts stay whole; the release
// part may wrap between its words (it is wider than a 320px phone), its separator glued to its first word and its
// date kept whole.
function placeLine(view, source) {
  const place = fill('place', { city: view.city, state: view.state, ccn: view.ccn }).split(' · ');
  const data = fillKeep('placeData', { date: isoDate(source.pdcReleased) }, ['date']);
  return html`${place.map((part, i) => html`${i ? ' ' : ''}<span class="nw">${i ? '· ' : ''}${part}</span>`)} <span>·\u00a0${data}</span>`;
}

const footnote = (f) => footnoteNote({ lead: fill('footnoteLead', { code: f.code }), text: f.text });

// A measure's notes: this site's note (measureNote(m)), CMS's footnotes and the estimate tag ('' when it has none). The
// tag marks a recompute from a measured value, so a measure with no value (unscored or assigned) has none.
function measureNotes(m, note) {
  const tag = m.tagged && m.hasValue && html`<details class="est"><summary>${t('estimateTag')}</summary>
<p class="est__body small">${fill('estimateNote', { maxError: m.maxErrorText })} <a href="/methods/#estimate">${t('estimateMore')}</a></p></details>`;
  return html`${note && html`<p>${note}</p>`}${m.footnotes.map(footnote)}${tag}`;
}

// notes: the row's Notes cell, or null when the table has no Notes column (no measure has a note).
function measureRow(m, notes) {
  return html`<tr>
<th scope="row">${m.label} <span class="short">(${m.short})</span></th>
<td class="num cms" data-label="${t('colValue')}">${value(m.valueText, m.hasValue)}</td>
<td class="num cms" data-label="${t('colZ')}">${value(m.zText, m.hasZ)}</td>
${notes !== null && html`<td class="notes">${notes}</td>
`}</tr>`;
}

// The measure table, with a Notes column only when some measure has a note; the column takes the page's width only
// for prose (this site's note or CMS's footnotes), not for estimate tags alone. Without prose, its rules end with it.
function measureTable(measures) {
  const notes = measures.map(measureNote);
  const cells = measures.map((m, i) => measureNotes(m, notes[i]));
  const withNotes = cells.some((cell) => String(cell) !== '');
  const prose = measures.some((m, i) => notes[i] || m.footnotes.length);
  return printout(html`<table class="gb gb--measures${prose ? ' gb--notes' : ''}" aria-labelledby="measures-h">
<thead><tr><th scope="col">${t('colMeasure')}</th><th scope="col" class="num">${t('colValue')}</th><th scope="col" class="num">${t('colZ')}</th>${withNotes && html`<th scope="col">${t('colNotes')}</th>`}</tr></thead>
<tbody>${measures.map((m, i) => measureRow(m, withNotes ? cells[i] : null))}</tbody>
</table>`, { fit: !prose });
}

// Every CMS footnote the page quotes, once, in the order it first appears.
const legend = (view) => footnoteLegend({
  heading: t('footnotesHeading'),
  lists: [view.score.footnotes, view.decision.footnotes, ...view.measures.map((m) => m.footnotes)],
});

// The what-if for a scored hospital, CMS's values to start, shared by link (pages/whatif.js has its page data). Its
// bars are the page's figure n: each measure's part of the score, live as the reader changes a value.
function whatIfBlock(view, whatif, source, assets, n) {
  const script = assets.js['hacrp-hospital'];
  if (!script) throw new TypeError('hospitalPage: assets.js must hold the hacrp-hospital module for the what-if');
  const page = { name: view.name, fy: view.fy, path: view.path, source, boundaryText: view.boundaryText, baseline: 'cms', share: true };
  const wrapBars = (chart) => partsFigure(view, n, sourceText({ fy: view.fy, source }), chart);
  return { body: whatIfSection(whatif, page, 'hacrp-hospital', wrapBars), script };
}

// A scored hospital's figures before the what-if: each measure's value against the national range (when any
// measure has a published value). The what-if's bars follow as the next number.
function figures(view, ranges, source) {
  if (!view.scored) return [];
  if (!ranges) throw new TypeError('hospitalPage: a scored hospital needs ranges (measureRanges in figures.js)');
  const line = sourceText({ fy: view.fy, source });
  return [rangeFigure(view, ranges, 1, line)].filter(Boolean);
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
  const figs = figures(view, ranges, source);
  const what = view.scored && whatif ? whatIfBlock(view, whatif, source, assets, figs.length + 1) : null;

  const body = html`<article class="wrap page page--article">
<header class="page__head">
${kicker(fy)}
<h1>${view.name}</h1>
<p class="place">${placeLine(view, source)}</p>
</header>
<section class="hero" aria-label="${t('heroLabel')}">
<div class="hero__item"><p class="cap">${t('heroScore')}</p>${view.scored
    ? html`<p class="hero__num cms">${heroNumber(view.score.text)}</p>${view.status !== 'maryland' && html`
<p class="hero__ref">${heroLineText(view.boundaryText)}</p>`}`
    : html`<p class="hero__none"><span>${t('noScore')}</span></p>`}</div>
<div class="hero__item hero__item--decision"><p class="cap">${t('heroDecision')}</p><p class="hero__pill">${decisionPill(view.status, view.decision.text)}</p>
${!pillShowsCmsValue(view.status) && html`<p class="small muted">${fill('decisionCms', { decision: view.decision.text })}</p>`}</div>
${view.scored && html`<p class="hero__note">${t('notAGrade')}</p>`}
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
<p class="page__links">${printLink(home, t('backToProgram'))}</p>
${asofBar({ fy: view.fy, periods: view.periods, source })}
${legend(view)}
${dataLinks(view.fy, source)}
${citation({ fy: view.fy, title: heading, path: view.path, source })}
</article>`;

  return page({
    title,
    description: fill('hospitalDescription', where),
    path: view.path,
    robots,
    body,
    scripts: [...(figs.length || what ? [assets.js.figure] : []), assets.js.cite, assets.js.topbar, ...(what ? [what.script] : [])],
    assets,
    topbar: siteHeader({ fy: view.fy, current: 'hospitals' }),
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + view.path, isBasedOn: source.landingPage },
    // The hero's number is IBM Plex Mono 700, the most important glyphs on the page, which would otherwise swap in late.
    preloadFonts: HERO_FONTS,
  });
}
