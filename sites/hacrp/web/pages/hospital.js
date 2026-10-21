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
import { asofBar, citation, dataLinks, decisionPill, pillShowsCmsValue, printLink, siteHeader, split } from './parts.js';
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

// The state map's placements on a hospital page, for the owner to choose among (preview pages show each):
//   e  in the Hospital field, right of the name, as tall as the name
//   f  a thumbnail in the Location field, right of the address
//   g  a postmark (ring, outline, dot and cancellation lines) over the record card's top-right corner
//   h  beside the stamp, at the top of the verdict column
//   i  a third cell of the numbers card
//   j  a faint watermark behind the record card's fields
export const MAP_PLACEMENTS = Object.freeze(['e', 'f', 'g', 'h', 'i', 'j']);
// Each placement's dot scale: the smaller the map is drawn, the larger its dot is in the map's own units.
const DOT = { e: 3, f: 4, g: 4.5, h: 2.5, i: 3, j: 1.25 };

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

// The Location field's words, the state a link to the program page's map and table for that state (#state=XX, which
// the table filters on and the map marks), as Thirty Day Readmissions links a hospital's metro area.
const STATE_AT = '\u0001';
function locationText(view) {
  const values = { city: view.city, state: STATE_AT };
  const [before, after] = (view.zip ? fill('location', { ...values, zip: view.zip }) : fill('locationNoZip', values)).split(STATE_AT);
  const more = fill('locationState', { state: STATE_NAMES[view.state] ?? view.state });
  return html`${before}<a class="hosp__state" href="${SITE.sites.hacrp.path}#state=${encodeURIComponent(view.state)}">${view.state}<span class="vh"> ${more}</span></a>${after}`;
}

// The postmark's cancellation lines (placement g): wavy rules left of its ring, in its ink. Shape constants only.
const WAVES = { lines: 4, gap: 8, amp: 3, len: 10, half: 3 };
const wavesSvg = (() => {
  const { lines, gap, amp, len, half } = WAVES;
  const width = len * half * 2;
  const height = gap * (lines - 1) + 2 * amp + 2;
  const d = Array.from({ length: lines }, (_, i) => `M0 ${amp + 1 + i * gap}q${len / 2} ${-2 * amp} ${len} 0${` t${len} 0`.repeat(half * 2 - 1)}`).join('');
  return html`<svg class="postmark__waves" viewBox="0 0 ${String(width)} ${String(height)}" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
})();

// The state map in its placement's frame (the dot in the penalty ink's red; see styles.css .geo).
const geoFrame = (placement, svg) => html`<span class="geo geo--${placement}">${svg}</span>`;

// The record card, Thirty Day Readmissions' red-ruled form: a title bar, then numbered fields. map: the state map's
// markup when its placement is in the card (e, f, g or j), with that placement; else null.
function recordCard(view, { careSource, masterFy, map, placement }) {
  const here = (p) => (map && placement === p ? map : null);
  const fy = String(view.fy);
  const location = locationText(view);
  const type = typeText(view.profile);
  // Each field as (its number) => markup, numbered in order; a field with nothing to show is left out.
  const fields = [
    (no) => formField({ no, label: t('fieldHospital'), value: view.name, as: 'h1', cls: 'hosp__name', wide: true, aside: here('e') }),
    (no) => formField({ no, label: t('fieldLocation'), value: location, note: view.county, aside: here('f') }),
    type && ((no) => formField({ no, label: t('fieldType'), value: type, size: 'sm', note: masterFy ? fill('typeNote', { fy: String(masterFy) }) : null })),
    view.scored
      ? (no) => formField({ no, label: t('fieldScore'), value: heroNumber(view.score.text), size: 'big', cls: 'cms hosp__score', note: view.status === 'maryland' ? t('scoreNote') : html`${t('scoreNote')}<br>${heroLineText(view.boundaryText)}` })
      : (no) => formField({ no, label: t('fieldScore'), value: html`<span class="hosp__none"><span>${t('noScore')}</span></span>`, as: 'div' }),
    (no) => formField({ no, label: t('heroDecision'), value: decisionPill(view.status, view.decision.text), as: 'div', cls: 'hero__pill', note: !pillShowsCmsValue(view.status) && fill('decisionCms', { decision: view.decision.text }) }),
    (no) => starsField(view, no, careSource),
  ].filter(Boolean);
  let no = 0;
  const mark = here('g');
  return html`<div class="form hosp__id">
${here('j') && html`<div class="hosp__wm">${here('j')}</div>
`}${formTitle(fill('recordTitle', { fy }), fill('recordCcn', { ccn: view.ccn }))}
${mark && html`<div class="postmark">${wavesSvg}<span class="postmark__ring">${mark}<span class="postmark__code">${view.state}</span></span></div>
`}${fields.map((field) => {
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

// The numbers card beside the record: CMS's line (every scored hospital), this site's distance to it (a Yes or No
// decision) and, in placement i, the state map as the last cell; null when it has none of them.
const CELL_LETTERS = 'ABC';
function numbersCard(view, map) {
  const cells = [];
  if (view.scored) {
    const { highestNo, lowestYes } = view.boundaryText;
    const d = view.distance;
    cells.push((no) => formField({ no, label: t('lineHeading'), value: fillKeep('numLine', { highestNo, lowestYes }, [['highestNo', 'lowestYes']]), size: 'sm', note: view.status === 'maryland' ? t('lineMaryland') : t('numLineNote') }));
    if (d) cells.push((no) => formField({ no, label: t('fieldDistance'), value: d.text, note: d.to === 'highestNo' ? fill('numDistanceYes', { highestNo }) : fill('numDistanceNo', { lowestYes }) }));
  }
  if (map) cells.push((no) => formField({ no, label: t('fieldMap'), value: map, as: 'div', cls: 'hosp__map-cell' }));
  if (!cells.length) return null;
  return html`<div class="form hosp__nums${map ? ' hosp__nums--map' : ''}">
${cells.map((cell, i) => html`${cell(CELL_LETTERS[i])}
`)}</div>`;
}

// The state outline with the hospital's dot; null where geo.js draws no map (a territory, no point, or a point the
// outline doesn't hold). dot: the dot's scale (DOT, by placement). How the dot was placed is in Methods; the page's
// data list credits the geocoder for a geocoded address.
export function locatorMap(view, shapes, dot = 1) {
  if (!shapes || !view.point) return null;
  return stateMap({ shapes, code: view.state, point: view.point, label: fill('mapLabel', { state: STATE_NAMES[view.state] ?? view.state }), dot });
}

// The map in its placement's frame; null with no map.
const placedMap = (svg, placement) => svg && geoFrame(placement, svg);

// robots: null for an indexable page, else the meta robots value. ranges: each measure's national range
// (measureRanges(model) in figures.js), required for a scored hospital. whatif: { hospital, model, estimate, range }
// for the what-if (range from scoreRange() in generate.js); a hospital with no score never gets one.
// searchUrl: the hospitals asset the top bar's search reads (null: no search box). shapes: stateShapes(topology) for
// the state map (null: none). careSource: Care Compare's manifest facts ({ modified }) for the stars' note.
// masterFy: the hospital master's fiscal year, for the Type field's note.
// mapPlacement: where the state map goes (MAP_PLACEMENTS, e the default).
export function hospitalPage({ view, source, robots, assets, ranges = null, whatif = null, searchUrl = null, shapes = null, careSource = null, masterFy = null, mapPlacement = 'e' }) {
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
  const map = placedMap(locatorMap(view, shapes, DOT[mapPlacement]), mapPlacement);
  const at = (placement) => (mapPlacement === placement ? map : null);

  const body = html`<article class="wrap page page--article hosp">
<div class="hosp__top hosp__top--${mapPlacement}">
${recordCard(view, { careSource, masterFy, map, placement: mapPlacement })}
<section class="hosp__verdict" aria-label="${t('heroLabel')}">
${at('h') ? html`<div class="hosp__stamprow">${stampOf(view)}${map}</div>` : stampOf(view)}
${leadSentences(view).map((s, i) => html`<p class="${i ? 'hosp__why' : 'hosp__summary'}">${s}</p>`)}
${view.scored && html`<p class="hosp__note">${t('notAGrade')}</p>`}
${numbersCard(view, at('i'))}
<p class="small muted">${fillKeep('placeData', { date: isoDate(source.pdcReleased) }, ['date'])}</p>
</section>
</div>
<div class="prose">
${noteSentences(view).map((s) => html`<p>${s}</p>`)}
${small && html`<p class="note">${small}</p>`}
<p class="standing">${t('standing')}</p>
</div>
${split({ label: 'measures-h', text: html`<h2 id="measures-h">${t('measuresHeading')}</h2>
<p>${t('measuresIntro')}</p>
${largest && html`<p>${largest}</p>`}
${measureTable(view.measures)}`, figure: figs.length ? figs : null })}
${what?.body}
<p class="page__links">${printLink(home, t('backToProgram'))}</p>
${asofBar({ fy: view.fy, periods: view.periods, source, geocoded: Boolean(map) && view.geo === 'address' })}
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
