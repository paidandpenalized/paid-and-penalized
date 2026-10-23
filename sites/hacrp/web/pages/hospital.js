// One hospital's page, after Thirty Day Readmissions' hospital record and beyond it. The top: the record card (name,
// place, type, CMS's score and decision, Care Compare's stars; the state's outline a watermark behind it) beside the
// verdict (a stamp, the summary, CMS's line in plain words and the line bar), the two the same height over a bold
// rule. Then numbered figures, each beside its words: where the score came from (each measure's value among every
// hospital's), how the parts add up (the worksheet and a waterfall to CMS's line), the what-if, the groups the
// hospital belongs to, and its nearest hospitals. The foot: the data facts and downloads beside the citation. Odd rows
// show CMS's values and add no inference.
import { STATE_NAMES, stateMap } from '../../../../web/charts/geo.js';
import { COPY as SHARED } from '../../../../web/copy.js';
import { footnoteLegend, footnoteNote, formField, formTitle, stamp } from '../../../../web/render/components.js';
import { cmsText, count, decimal, isoDate, ordinal } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { CARE_COMPARE_STARS, CUTOFF_PERCENTILE, REDUCTION_TEXT } from '../constants.js';
import { biggestLever } from '../compare.js';
import { distanceSentence, leadSentence, measureNote, noteSentences, smallNumber, whySentences } from '../sentences.js';
import { fill, fillKeep, sourceText, t } from '../copy.js';
import { partsFigure } from '../figures.js';
import { ledgerFigure, lineBarBlock, nearbyBlock, peersFigure, sumFigure, worksheet } from '../hospital-figures.js';
import { careCompareHref } from '../links.js';
import { asofBar, citation, dataLinks, decisionPill, pillShowsCmsValue, printLink, siteHeader } from './parts.js';
import { whatIfSection } from './whatif.js';
import { SCORE_DECIMALS as DP } from '../../../../engine/js/hacrp/score.js';
import { MEASURE_IDS } from '../../../../engine/js/hacrp/measures.js';
import { encode } from '../../../../web/whatif/fragment.js';
import { historySource, hospitalInfectionsFigure, recordStrip, yearsFigure } from '../history-figures.js';
import { fill as hfill, t as ht } from '../history/copy.js';
import { cliffFigure, moneyField, moneySourceText, moneyVerdict, moneyWorksheet, shareBlock, statementFigure } from '../money-figures.js';
import { fill as mfill, t as mt } from '../money/copy.js';
import { maKey } from '../money.js';

// The fonts a hospital page preloads: the default set with the mono's 700 (the hero number) in place of its 400.
const HERO_FONTS = ['alfa-slab-one-400', 'libre-franklin-400', 'ibm-plex-mono-700'];

// The hero's number, its decimal point in a span the CSS pulls in: a monospace point takes a full cell, which opens
// a gap at hero size. The digits stay tabular, and the text is CMS's, unchanged.
function heroNumber(text) {
  const at = text.indexOf('.');
  return at < 0 ? text : html`${text.slice(0, at)}<span class="dp">.</span>${text.slice(at + 1)}`;
}

const footnote = (f) => footnoteNote({ lead: fill('footnoteLead', { code: f.code }), text: f.text });

// A measure's notes in the ledger: this site's note on an assigned measure, CMS's footnotes and the estimate tag.
// The tag marks a recompute from a measured value, so a measure with no value (unscored or assigned) has none.
function measureNotes(m) {
  const tag = m.tagged && m.hasValue && html`<details class="est"><summary>${t('estimateTag')}</summary>
<p class="est__body small">${fill('estimateNote', { maxError: m.maxErrorText })} <a href="/methods/#estimate">${t('estimateMore')}</a></p></details>`;
  const note = measureNote(m);
  if (!note && !m.footnotes.length && !tag) return '';
  return html`<div class="ledger__notes">${note && html`<p>${note}</p>`}${m.footnotes.map(footnote)}${tag}</div>`;
}

// Every CMS footnote the page quotes, once, in the order it first appears.
const legend = (view) => footnoteLegend({
  heading: t('footnotesHeading'),
  lists: [view.score.footnotes, view.decision.footnotes, ...view.measures.map((m) => m.footnotes)],
});

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
// or CMS's own words where it published no rating, with CMS's footnotes, as formField options. null when Care
// Compare doesn't list the hospital.
function starsSpec(view, careSource) {
  const cc = view.careCompare;
  if (!cc || !careSource) return null;
  const n = /^[1-9]$/.test(cc.rating) ? Number(cc.rating) : null;
  const value = n !== null && n <= CARE_COMPARE_STARS
    ? html`<span class="stars" aria-hidden="true">${'★'.repeat(n)}<span class="stars__off">${'☆'.repeat(CARE_COMPARE_STARS - n)}</span></span><span class="vh">${fill('stars', { n: String(n), max: String(CARE_COMPARE_STARS) })}</span>`
    : cc.rating;
  const note = html`${fillKeep('starsNote', { date: isoDate(careSource.modified) }, ['date'])}${cc.footnotes.map((f) => html`<br>${fill('footnoteLead', { code: f.code })} ${f.text}`)}<br><a href="${careCompareHref(view.ccn)}" target="_blank" rel="noopener">${t('starsLink')}<span class="vh">${SHARED.newTab}</span></a>`;
  return { label: t('fieldStars'), value, note, size: n === null ? 'sm' : null, fieldCls: 'f-stars' };
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

// The state outline with the hospital's dot, drawn faint behind the record's fields (its dot in the penalty red);
// null where geo.js draws no map (a territory, no point, or a point the outline doesn't hold). How the dot was placed
// is in Methods; the page's data list credits the geocoder for a geocoded address.
const WATERMARK_DOT = 1.25;
function locatorMap(view, shapes) {
  if (!shapes || !view.point) return null;
  return stateMap({ shapes, code: view.state, point: view.point, label: fill('mapLabel', { state: STATE_NAMES[view.state] ?? view.state }), dot: WATERMARK_DOT });
}

// The record card, Thirty Day Readmissions' red-ruled form: a title bar, then numbered fields over the state's
// outline (map: its markup, or null): the hospital, then where and what it is, then CMS's score and decision beside
// this site's estimate of the money (money: hospitalMoney()), a row that reads score, decision, dollars.
function recordCard(view, { careSource, map, money }) {
  const fy = String(view.fy);
  const type = typeText(view.profile);
  // Each field's formField options, numbered in order once the fields with nothing to show are left out.
  const specs = [
    { label: t('fieldHospital'), value: view.name, as: 'h1', cls: 'hosp__name', wide: true },
    { label: t('fieldLocation'), value: locationText(view), note: view.county, fieldCls: 'f-loc' },
    type && { label: t('fieldType'), value: type, size: 'sm', fieldCls: 'f-type' },
    starsSpec(view, careSource),
    view.scored
      ? { label: t('fieldScore'), value: heroNumber(view.score.text), size: 'big', cls: 'cms hosp__score', note: t('scoreNote'), fieldCls: 'f-score' }
      : { label: t('fieldScore'), value: html`<span class="hosp__none"><span>${t('noScore')}</span></span>`, as: 'div', fieldCls: 'f-score' },
    { label: t('heroDecision'), value: decisionPill(view.status, view.decision.text), as: 'div', cls: 'hero__pill', note: !pillShowsCmsValue(view.status) && fill('decisionCms', { decision: view.decision.text }), fieldCls: 'f-pay' },
    moneyField(money),
  ].filter(Boolean);
  const [name, ...rest] = specs.map((spec, i) => formField({ no: i + 1, ...spec }));
  return html`<div class="form hosp__id">
${map && html`<div class="hosp__wm" aria-hidden="true"><span class="geo geo--j">${map}</span></div>
`}${formTitle(fill('recordTitle', { fy }), fill('recordCcn', { ccn: view.ccn }))}
${name}
<div class="hosp__fields">
${rest.map((markup) => html`${markup}
`)}</div>
</div>`;
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

// The verdict beside the record: the stamp, what CMS reports (its decision set apart, in the penalty ink for a cut),
// why, with what the score is in one sentence, then CMS's line in plain words and how CMS sets it, the line bar and
// the hospital's rank.
const DECISION_AT = '\u0001';
function leadMarkup(view) {
  const [before, after] = leadSentence(view, DECISION_AT).split(DECISION_AT);
  const pen = view.status === 'yes' || view.status === 'yes-no-score';
  return html`${before}<strong class="hosp__decision${pen ? ' hosp__decision--pen' : ''}">${view.decision.text}</strong>${after}`;
}

function verdict(view, nat, history, money) {
  const words = [...whySentences(view), ...(view.status === 'maryland' ? [t('lineMaryland')] : []), ...(view.scored ? [t('scoreCompares')] : [])].join(' ');
  const { beside, below } = moneyVerdict(view, money);
  return html`<section class="hosp__verdict" aria-label="${t('heroLabel')}">
<div class="hosp__stampline">
${stampOf(view)}
${beside}
</div>
<p class="hosp__summary">${leadMarkup(view)}</p>
${below}
${words && html`<p class="hosp__why">${words}</p>`}
${view.scored && html`<div class="hosp__lineblock">
<p class="hosp__line">${fillKeep('lineCut', { lowestYes: view.boundaryText.lowestYes }, ['lowestYes'])}</p>
<p class="hosp__how">${fill('lineHow', { percentile: ordinal(CUTOFF_PERCENTILE) })}</p>
${lineBarBlock(view, nat)}
</div>`}
${history?.rec ? recordStrip(history.rec, history.hd.fys) : ''}
${shareBlock(view, money)}
</section>`;
}

// A numbered section, named by its heading (id-h): its words (heading first) beside its figure from 980px, stacked under that. wide: the words
// run across the top in two columns and the figure takes the page's width under them.
const section = ({ id, text, figure, wide = false }) => html`<section class="block hsec${wide ? ' hsec--full' : ''}" id="${id}" aria-labelledby="${id}-h">
<div class="hsec__text">
${text}
</div>
<div class="hsec__fig">
${figure}
</div>
</section>`;

// The lever sentence: the measure that would lower the score most at the national median, and whether that alone
// would cross CMS's line.
function leverText(view, hospital, model) {
  const lever = biggestLever(hospital, model);
  if (!lever) return view.measures.some((m) => m.hasValue && m.hasZ && !m.assigned) ? t('leverNone') : null;
  const m = view.measures.find((x) => x.id === lever.id);
  const fmt = (v) => decimal(v, model.params[lever.id].decimals);
  const sentence = fill('leverOne', { short: m.short, median: fmt(lever.median), drop: cmsText(decimal(lever.drop, DP)), after: cmsText(decimal(lever.after, DP)) });
  const words = view.status === 'yes' && lever.flag === 'No' ? `${sentence} ${t('leverFlip')}` : sentence;
  // The same change, opened in the what-if (its scenario link).
  return html`${words} <a class="hsec__try" href="${encode({ [lever.id]: lever.median }, MEASURE_IDS)}">${t('leverTry')}</a>`;
}

// The what-if for a scored hospital, CMS's values to start, shared by link (pages/whatif.js has its page data). Its
// bars are the page's figure n: each measure's part of the score, live as the reader changes a value.
function whatIfBlock(view, whatif, source, assets, n) {
  const script = assets.js['hacrp-hospital'];
  if (!script) throw new TypeError('hospitalPage: assets.js must hold the hacrp-hospital module for the what-if');
  const pageData = { name: view.name, fy: view.fy, path: view.path, source, boundaryText: view.boundaryText, baseline: 'cms', share: true };
  const wrapBars = (chart) => partsFigure(view, n, sourceText({ fy: view.fy, source }), chart);
  return { body: whatIfSection(whatif, pageData, 'hacrp-hospital', wrapBars), script };
}

// robots: null for an indexable page, else the meta robots value. nat: nationalContext() (compare.js). hospital:
// CMS's row; model: the fitted model. whatif: { hospital, model, estimate, range } for the what-if (range from
// scoreRange() in generate.js); a hospital with no score never gets one. searchUrl: the hospitals asset the top
// bar's search reads (null: no search box). shapes: stateShapes(topology) for the maps (null: none). careSource:
// Care Compare's manifest facts ({ modified }) for the stars' note. masterFy: the hospital master's fiscal year, for
// the data list's source of the Type field's facts. master: the hospital's master record (its metro's name). money:
// this site's dollars for the hospital (money.js hospitalMoney: a hospital with no estimate has a row that says why).
// backtest: what a likely range means (data.js dollarsData's), which the statement's note says.
export function hospitalPage({ view, hospital = null, model, nat, master, source, robots, assets, whatif = null, searchUrl = null, shapes = null, counties = [], careSource = null, masterFy = null, history = null, money, backtest }) {
  if (!nat || !model) throw new TypeError('hospitalPage: nat (nationalContext) and model are required');
  const fy = String(view.fy);
  const where = { name: view.name, city: view.city, state: view.state, fy };
  const heading = fill('hospitalTitle', where);
  const title = `${heading} · ${SITE.name}`;
  const small = smallNumber(view);
  const home = SITE.sites.hacrp.path;
  const line = sourceText({ fy: view.fy, source });
  const map = locatorMap(view, shapes);
  // Figures are numbered in page order, each taking the next number only if it is drawn.
  let n = 0;
  const numbered = (fig) => { if (fig) n++; return fig; };
  const moneySource = moneySourceText({ fy: view.fy, source });
  const cliffFig = money.estimated && view.scored ? numbered(cliffFigure(view, money, nat, { n: n + 1, source: moneySource })) : null;
  const statement = money.estimated ? numbered(statementFigure(view, money, { n: n + 1, source: moneySource, backtest })) : null;
  const ledger = numbered(ledgerFigure({ view, nat, model, n: n + 1, source: line, notes: measureNotes }));
  const row = hospital ?? whatif?.hospital;
  const lever = view.scored && row ? leverText(view, row, model) : null;
  const sum = view.scored ? numbered(sumFigure({ view, n: n + 1, source: line })) : null;
  const what = view.scored && whatif ? numbered(whatIfBlock(view, whatif, source, assets, n + 1)) : null;
  // Its years: where its score fell each year CMS published one, when the build holds the history and CMS published
  // its score in more than one year.
  const years = history?.rec?.hasScoreYears ? numbered(yearsFigure(history.rec, history.hd, { n: n + 1, source: historySource(history.hd) })) : null;
  const infections = history ? numbered(hospitalInfectionsFigure(history.sir, history.hd, { n: n + 1, source: hfill('hinfSource', { first: String(history.hd.infections[0]?.cy ?? ''), last: String(history.hd.infections.at(-1)?.cy ?? '') }) })) : null;
  const peers = numbered(peersFigure({ view, nat, master, n: n + 1, source: line }));
  const nearby = view.scored ? nearbyBlock({ view, nat, shapes, counties, n: n + 1, source: line }) : null;
  numbered(nearby?.fig);
  const nearRank = peers?.rows.filter((r) => r.g.kind === 'state' || r.g.kind === 'metro') ?? [];
  const notes = noteSentences(view);

  const body = html`<article class="wrap page page--hosp hosp">
<div class="hosp__top">
${recordCard(view, { careSource, map, money })}
${verdict(view, nat, history, money)}
</div>
${notes.length || small ? html`<div class="hosp__notes">
${notes.map((s) => html`<p>${s}</p>`)}
${small && html`<p class="note">${small}</p>`}
</div>` : ''}
${cliffFig && section({
    id: 'cliff', wide: true,
    text: html`<h2 id="cliff-h">${mt('cliffHeading')}</h2>
<p>${mfill(maKey(money, 'cliffIntro'), { pct: REDUCTION_TEXT })}</p>
<p>${mt('cliffHow')}</p>`,
    figure: cliffFig,
  })}
${statement && section({
    id: 'money',
    text: html`<h2 id="money-h">${mt('stmtHeading')}</h2>
<p>${mfill(maKey(money, 'stmtIntro'), { fy })}</p>
<p>${mfill('stmtOrder', { pct: REDUCTION_TEXT })}</p>
${moneyWorksheet(money)}`,
    figure: statement,
  })}
${section({
    id: 'measures', wide: true,
    text: html`<h2 id="measures-h">${t('ledgerHeading')}</h2>
<p>${fill('ledgerIntro', { n: String(view.n), all: String(view.measures.length) })}</p>
${lever && html`<p class="hsec__lever${view.status === 'yes' ? '' : ' hsec__lever--ink'}">${lever}</p>`}`,
    figure: ledger,
  })}
${sum && section({
    id: 'sum',
    text: html`<h2 id="sum-h">${t('sumHeading')}</h2>
<p>${fill('sumIntro', { n: String(view.n) })}</p>
${worksheet(view)}
${view.distance && html`<p class="hsec__stat">${distanceSentence(view)}</p>`}`,
    figure: sum,
  })}
${what?.body}
${years && section({
    id: 'years',
    text: html`<h2 id="years-h">${ht('yearsHeading')}</h2>
<p>${ht('yearsIntro')}</p>
${history.rec.run > 1 ? html`<p class="hsec__stat">${hfill('yearsRun', { run: String(history.rec.run) })}</p>` : ''}`,
    figure: years,
  })}
${infections && section({
    id: 'infections',
    text: html`<h2 id="infections-h">${ht('hinfHeading')}</h2>
<p>${ht('hinfIntro')}</p>`,
    figure: infections,
  })}
${peers && section({
    id: 'peers',
    text: html`<h2 id="peers-h">${t('peersHeading')}</h2>
<p>${t('peersIntro')}</p>
${nearRank.map((r) => html`<p class="hsec__stat">${fill('peersRank', { group: r.label, share: r.higher, n: count(r.g.scored - 1) })}</p>`)}`,
    figure: peers.fig,
  })}
${nearby && section({
    id: 'nearby',
    text: html`<h2 id="nearby-h">${t('nearbyHeading')}</h2>
<p>${fill('nearbyIntro', { k: String(nearby.count) })}</p>
${nearby.fig}${nearby.keys}`,
    figure: nearby.table,
  })}
<div class="hosp__foot">
<div class="hosp__facts">
${asofBar({ fy: view.fy, periods: view.periods, source, typeFy: masterFy && typeText(view.profile) ? masterFy : null, geocoded: Boolean(map) && view.geo === 'address' })}
${dataLinks(view.fy, source)}
${legend(view)}
<p class="page__links">${printLink(home, t('backToProgram'))}</p>
</div>
<div class="hosp__cite">
<p class="standing">${t('standing')}</p>
${citation({ fy: view.fy, title: heading, path: view.path, source })}
</div>
</div>
</article>`;

  return page({
    title,
    // A neutral sentence: no payment decision and no dollar figure, so a link's preview (Open Graph, ARCH-23) names neither.
    // The Share control's sentence (shareSentence) is what a reader chooses to copy.
    description: fill(money.estimated ? 'hospitalDescription' : 'hospitalDescriptionNone', where),
    path: view.path,
    robots,
    body,
    scripts: [assets.js.figure, assets.js.cite, assets.js.share, assets.js.topbar, ...(searchUrl ? [assets.js['hacrp-search']] : []), ...(what ? [what.script] : [])],
    assets,
    topbar: siteHeader({ fy: view.fy, current: 'map', searchUrl }),
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: SITE.origin + view.path, isBasedOn: source.landingPage },
    // The hero's number is IBM Plex Mono 700, the most important glyphs on the page, which would otherwise swap in late.
    preloadFonts: HERO_FONTS,
  });
}
