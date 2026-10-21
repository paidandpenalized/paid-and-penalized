// One hospital's page, after Thirty Day Readmissions' hospital view: the record card (name, place, type, CMS's score
// and decision, Care Compare's stars) beside the verdict (a stamp, the plain summary, CMS's line and the distance to
// it, and the state map), then what CMS's notes say, the measure table with CMS's values and footnotes, the figures
// and the what-if (scored hospitals only), then where the data come from. Odd rows show CMS's values and add no
// inference.
import { STATE_NAMES, stateMap } from '../../../../web/charts/geo.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { footnoteLegend, footnoteNote, formField, formTitle, printout, stamp } from '../../../../web/render/components.js';
import { count, isoDate } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { CARE_COMPARE_STARS, REDUCTION_TEXT } from '../constants.js';
import { largestSentence, leadSentences, measureNote, noteSentences, smallNumber } from '../sentences.js';
import { fill, fillKeep, heroLineText, sourceText, t } from '../copy.js';
import { partsFigure, rangeFigure } from '../figures.js';
import { careCompareHref } from '../links.js';
import { asofBar, citation, dataLinks, decisionPill, pillShowsCmsValue, printLink, siteHeader } from './parts.js';
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

// The state map's four placements on a hospital page, for the owner to choose among (preview pages show each).
export const MAP_PLACEMENTS = Object.freeze(['a', 'b', 'c', 'd']);

// The record card's Type field: what the master knows, in the site's words (the ownership as the master writes it);
// null when it knows nothing.
const TEACH = { major: 'typeTeachMajor', minor: 'typeTeachMinor', none: 'typeTeachNone' };
function typeText({ teach, beds, own, urban, types }) {
  const parts = [
    TEACH[teach] && t(TEACH[teach]),
    Number.isInteger(beds) && fill('typeBeds', { beds: count(beds) }),
    own,
    urban === null ? null : t(urban ? 'typeUrban' : 'typeRural'),
    ...types.filter((code) => /^[A-Z]+$/.test(code)).map((code) => t(`type${code}`)),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// Care Compare's stars: the rating as filled and empty stars (hidden from screen readers, which hear "4 of 5 stars"),
// or CMS's own words where it published no rating, with CMS's footnotes. null when Care Compare doesn't list the
// hospital.
function starsField(view, no, careSource) {
  const cc = view.careCompare;
  if (!cc || !careSource) return null;
  const n = /^[1-9]$/.test(cc.rating) ? Number(cc.rating) : null;
  const value = n !== null && n <= CARE_COMPARE_STARS
    ? html`<span class="stars" aria-hidden="true">${'\u2605'.repeat(n)}<span class="stars__off">${'\u2606'.repeat(CARE_COMPARE_STARS - n)}</span></span><span class="vh">${fill('stars', { n: String(n), max: String(CARE_COMPARE_STARS) })}</span>`
    : cc.rating;
  const note = html`${fillKeep('starsNote', { date: isoDate(careSource.modified) }, ['date'])}${cc.footnotes.map((f) => html`<br>${fill('footnoteLead', { code: f.code })} ${f.text}`)}<br><a href="${careCompareHref(view.ccn)}" target="_blank" rel="noopener">${t('starsLink')}<span class="vh">${SHARED.newTab}</span></a>`;
  return formField({ no, label: t('fieldStars'), value, note, size: n === null ? 'sm' : null });
}

// The record card, Thirty Day Readmissions' red-ruled form: a title bar, then numbered fields. mapField: the state map
// as a field beside Location (placement a), or null.
function recordCard(view, { careSource, masterFy, mapField }) {
  const fy = String(view.fy);
  const location = view.zip ? fill('location', { city: view.city, state: view.state, zip: view.zip }) : fill('locationNoZip', { city: view.city, state: view.state });
  const type = typeText(view.profile);
  // Each field as (its number) => markup, numbered in order; a field with nothing to show is left out.
  const fields = [
    (no) => formField({ no, label: t('fieldHospital'), value: view.name, as: 'h1', cls: 'hosp__name', wide: true }),
    (no) => formField({ no, label: t('fieldLocation'), value: location, note: view.county }),
    mapField,
    type && ((no) => formField({ no, label: t('fieldType'), value: type, size: 'sm', note: masterFy ? fill('typeNote', { fy: String(masterFy) }) : null })),
    view.scored
      ? (no) => formField({ no, label: t('fieldScore'), value: heroNumber(view.score.text), size: 'big', cls: 'cms hosp__score', note: view.status === 'maryland' ? t('scoreNote') : html`${t('scoreNote')}<br>${heroLineText(view.boundaryText)}` })
      : (no) => formField({ no, label: t('fieldScore'), value: html`<span class="hosp__none"><span>${t('noScore')}</span></span>`, as: 'div' }),
    (no) => formField({ no, label: t('heroDecision'), value: decisionPill(view.status, view.decision.text), as: 'div', cls: 'hero__pill', note: !pillShowsCmsValue(view.status) && fill('decisionCms', { decision: view.decision.text }) }),
    (no) => starsField(view, no, careSource),
  ].filter(Boolean);
  let no = 0;
  return html`<div class="form hosp__id">
${formTitle(fill('recordTitle', { fy }), fill('recordCcn', { ccn: view.ccn }))}
${fields.map((field) => {
    const markup = field(no + 1);
    if (markup) no++;
    return markup && html`${markup}
`;
  })}</div>`;
}

// The stamp: the cut in the penalty ink; no cut, no score and not subject in ink. The row CMS marked Yes with no score
// carries CMS's literal value.
function stampOf(view) {
  switch (view.status) {
    case 'yes': return stamp({ label: fill('stampYes', { pct: REDUCTION_TEXT }) });
    case 'no': return stamp({ label: t('stampNo'), ink: true });
    case 'maryland': return stamp({ label: t('stampNA'), ink: true });
    case 'yes-no-score': return stamp({ label: fill('stampCms', { decision: view.decision.text }) });
    default: return stamp({ label: t('stampNoScore'), ink: true });
  }
}

// The numbers card beside the record: CMS's line (every scored hospital) and this site's distance to it (a Yes or No
// decision); null for a hospital with no score.
function numbersCard(view) {
  if (!view.scored) return null;
  const { highestNo, lowestYes } = view.boundaryText;
  const d = view.distance;
  return html`<div class="form hosp__nums">
${formField({ no: 'A', label: t('lineHeading'), value: fillKeep('numLine', { highestNo, lowestYes }, [['highestNo', 'lowestYes']]), size: 'sm', note: view.status === 'maryland' ? t('lineMaryland') : t('numLineNote') })}
${d && formField({ no: 'B', label: t('fieldDistance'), value: d.text, note: d.to === 'highestNo' ? fill('numDistanceYes', { highestNo }) : fill('numDistanceNo', { lowestYes }) })}
</div>`;
}

// The state outline with the hospital's dot, and how the dot was placed; null where geo.js draws no map (a territory,
// no point, or a point the outline doesn't hold).
const PLACED = { address: 'mapAddress', zip: 'mapZip', county: 'mapCounty' };
export function locatorMap(view, shapes) {
  if (!shapes || !view.point) return null;
  const svg = stateMap({ shapes, code: view.state, point: view.point, label: fill('mapLabel', { state: STATE_NAMES[view.state] ?? view.state }) });
  if (!svg) return null;
  return { svg, caption: PLACED[view.geo] ? t(PLACED[view.geo]) : null };
}

// robots: null for an indexable page, else the meta robots value. ranges: each measure's national range
// (measureRanges(model) in figures.js), required for a scored hospital. whatif: { hospital, model, estimate, range }
// for the what-if (range from scoreRange() in generate.js); a hospital with no score never gets one.
// searchUrl: the hospitals asset the top bar's search reads (null: no search box). shapes: stateShapes(topology) for
// the state map (null: none). careSource: Care Compare's manifest facts ({ modified }) for the stars' note.
// masterFy: the hospital master's fiscal year, for the Type field's note.
// mapPlacement: where the state map goes (MAP_PLACEMENTS): a, a record field beside Location; b, beside the record
// card (a third column on wide screens); c, under the stamp (the default); d, a full-width strip under the top.
export function hospitalPage({ view, source, robots, assets, ranges = null, whatif = null, searchUrl = null, shapes = null, careSource = null, masterFy = null, mapPlacement = 'c' }) {
  if (!MAP_PLACEMENTS.includes(mapPlacement)) throw new RangeError(`hospitalPage: map placement "${mapPlacement}" is not one of ${MAP_PLACEMENTS.join(', ')}`);
  const fy = String(view.fy);
  const where = { name: view.name, city: view.city, state: view.state, fy };
  const heading = fill('hospitalTitle', where);
  const title = `${heading} · ${SITE.name}`;
  const largest = largestSentence(view);
  const small = smallNumber(view);
  const home = SITE.sites.hacrp.path;
  const figs = figures(view, ranges, source);
  const what = view.scored && whatif ? whatIfBlock(view, whatif, source, assets, figs.length + 1) : null;
  const map = locatorMap(view, shapes);
  const caption = (cls) => map.caption && html`<figcaption class="${cls}">${map.caption}</figcaption>`;
  const at = (placement) => (map && mapPlacement === placement);
  const mapField = at('a') && ((no) => formField({ no, label: t('fieldMap'), value: map.svg, as: 'div', cls: 'hosp__map-field', note: map.caption }));

  const body = html`<article class="wrap page page--article hosp">
<div class="hosp__top hosp__top--${mapPlacement}">
${recordCard(view, { careSource, masterFy, mapField })}
${at('b') && html`<figure class="hosp__map hosp__map--side">${map.svg}${caption('small muted')}</figure>`}
<section class="hosp__verdict" aria-label="${t('heroLabel')}">
${stampOf(view)}
${leadSentences(view).map((s, i) => html`<p class="${i ? 'hosp__why' : 'hosp__summary'}">${s}</p>`)}
${view.scored && html`<p class="hosp__note">${t('notAGrade')}</p>`}
${numbersCard(view)}
${at('c') && html`<figure class="hosp__map">${map.svg}${caption('small muted')}</figure>`}
<p class="small muted">${fillKeep('placeData', { date: isoDate(source.pdcReleased) }, ['date'])}</p>
</section>
</div>
${at('d') && html`<figure class="hosp__strip">${map.svg}<figcaption><span class="hosp__strip-place">${fill('mapStrip', { city: view.city, state: STATE_NAMES[view.state] ?? view.state })}</span> ${map.caption}</figcaption></figure>`}
<div class="prose">
${noteSentences(view).map((s) => html`<p>${s}</p>`)}
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
    scripts: [...(figs.length || what ? [assets.js.figure] : []), assets.js.cite, assets.js.topbar, ...(searchUrl ? [assets.js['hacrp-search']] : []), ...(what ? [what.script] : [])],
    assets,
    topbar: siteHeader({ fy: view.fy, current: 'hospitals', searchUrl }),
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + view.path, isBasedOn: source.landingPage },
    // The hero's number is IBM Plex Mono 700, the most important glyphs on the page, which would otherwise swap in late.
    preloadFonts: HERO_FONTS,
  });
}
