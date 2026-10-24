// The HACRP program page (/hacrp/), after Thirty Day Readmissions' front page and past it. The top: the name, the
// lede, a large search and the summary form under its stamp, over the score rule (every hospital's score, sorted).
// Part 1 walks the formula in five steps, each beside a live figure, and ends in the sandbox. Part 2 is the year's
// picture: every hospital's score, who was cut by kind of hospital, how the number of measures widens the spread,
// how little the measures agree, what one measure would have changed and the hospitals CMS scored without data.
// Part 3: the US map, the table of every hospital beside the way down by region, division and state. The foot: the
// sources beside the data facts, downloads and citation. Every number comes from the emitted data or a method
// constant.
import { fillAround, formField, formTitle, stamp } from '../../../../web/render/components.js';
import { html } from '../../../../web/render/html.js';
import { count, isoDate, pct, shortDate, shortIsoDate } from '../../../../web/render/format.js';
import { page } from '../../../../web/render/layout.js';
import { SITE } from '../../../../web/site.js';
import { REDUCTION_TEXT, SHORT_NAMES } from '../constants.js';
import { sourceText } from '../copy.js';
import { fill, fillKeep, t } from '../program/copy.js';
import { moneySourceText } from '../money-figures.js';
import { LINKS, PROGRAM_PATH } from '../links.js';
import { counter } from '../../../../web/charts/figure.js';
import { browseList, mapFigure, part1, part2, psec, ruleFigure } from '../program-figures.js';
import { part4 } from '../history-figures.js';
import { fill as hfill } from '../history/copy.js';
import { asofBar, citation, dataLinks, hospitalTable, partHead, searchBox, siteHeader } from './parts.js';
import { moneyPart, moneyPartIntro, summaryMoneyField } from '../money-part.js';
import { t as mt } from '../money/copy.js';
import { whatIfSection } from './whatif.js';

const link = (href, text, note) => html`<li><a href="${href}">${text}</a>${note && html` <span class="muted">${note}</span>`}</li>`;

// The sandbox: the what-if on the synthetic median hospital, from its own values, with no link to share (its page
// data, pages/whatif.js, take the same shape as a hospital page's). Its label is the section's, under the heading.
function sandbox(whatif, { fy, boundaryText, source }) {
  const data = { name: null, fy, path: PROGRAM_PATH, source, boundaryText, baseline: 'sandbox', share: false };
  return whatIfSection(whatif, data, 'hacrp-program');
}

// The page's top: the kicker, the program's name in the display face (its last word in the penalty ink), the lede
// with this year's count, the hero search and a line of places to try; beside it the summary form under its stamp.
function programTop({ title, subtitle, fy, counts, boundaryText, periods, source, searchUrl, tryPlaces, md }) {
  const at = title.lastIndexOf(' ');
  const { lowestYes } = boundaryText;
  const fyText = String(fy);
  const range = (key, { start, end }, more = {}) => fillKeep(key, { ...more, start: shortDate(start), end: shortDate(end) }, ['start', 'end']);
  const payYear = { start: `10/01/${fy - 1}`, end: `09/30/${fy}` };
  const tryMarkup = tryPlaces && fillAround((marks) => fill('heroTry', marks), {
    state: html`<a href="${tryPlaces.state.path}">${tryPlaces.state.name}</a>`,
    metro: html`<a href="${tryPlaces.metro.path}">${tryPlaces.metro.name}</a>`,
    every: html`<a href="#hospitals">${t('heroEvery')}</a>`,
    how: html`<a href="#how">${t('heroHow')}</a>`,
  });
  return html`<header class="page__head prog__top">
<div class="prog__intro stack">
<p class="cap kicker prog__kicker">${fill('kicker', { subtitle, fy: fyText })}</p>
<h1 class="prog__title">${at < 0 ? title : html`${title.slice(0, at)} <span class="prog__title-pen">${title.slice(at + 1)}</span>`}</h1>
<p class="prog__lede">${t('progLedeScore')} ${fill('progLedeCut', { pct: REDUCTION_TEXT })} <strong>${fill('progLedeCount', { fy: fyText, yes: count(counts.yes), decided: count(counts.decided) })}</strong> ${t('progLedeEnd')}</p>
${searchUrl && html`<div class="prog__find stack">
${searchBox(searchUrl, { id: 'hero', hero: true })}
${tryMarkup && html`<p class="prog__try">${tryMarkup}</p>`}
</div>`}
</div>
<div class="prog__card stack">
<div class="form prog__summary">
${formTitle(fill('summaryTitle', { fy: fyText }), fillKeep('summaryReleased', { date: isoDate(source.pdcReleased) }, ['date']))}
${[
    { label: t('summaryCut'), value: count(counts.yes), size: 'big', note: fill('summaryCutNote', { decided: count(counts.decided) }) },
    { label: t('summaryPct'), value: REDUCTION_TEXT, size: 'big', note: t('summaryPctNote') },
    md && { ...summaryMoneyField(md), wide: true },
    { label: t('summaryScored'), value: count(counts.scored), note: t('summaryScoredNote') },
    { label: t('lineHeading'), value: fill('summaryLineValue', { lowestYes }), note: t('summaryLineNote') },
    { label: t('summaryData'), value: html`${range('summaryDataPsi', periods.psi90, { short: SHORT_NAMES.PSI90 })}<br>${range('summaryDataHai', periods.hai)}`, size: 'sm' },
    { label: t('summaryPayYear'), value: range('summaryPayYearValue', payYear), size: 'sm', note: fill('summaryPayYearNote', { fy: fyText }) },
  ].filter(Boolean).map((field, i) => html`${formField({ no: i + 1, ...field })}
`)}</div>
${stamp({ label: fill('stampReleased', { date: shortIsoDate(source.pdcReleased) }) })}
</div>
</header>`;
}

// counts: { decided, yes, scored }. boundaryText: CMS's text for the line's two scores. searchUrl: the hospitals
// asset the searches read (generate.js, hospitalRows). robots: null for an indexable page. whatif: { hospital, model,
// estimate, range } for Part 1 and the sandbox (hospital: medianHospital(model)). pd: programData() (program-data.js),
// for the score rule and the parts; places: buildPlaces() (places.js) and shapes: stateShapes(topology), for the map,
// the browse list and the hero's suggestions (tryPlaces); exploreUrl: the explore asset the page's scripts read. Each
// part is left out without its data. Figures and Part 1's steps are numbered in page order.
// md: moneyData() (money-data.js), for the summary form's estimate and the Part on the money; null for none, and left out
// when no cut hospital has an estimate (a test's slice of the file).
export function programPage({ fy, counts, boundaryText, periods, searchUrl, source, robots, assets, whatif = null, pd = null, exploreUrl = null, tryPlaces = null, places = null, shapes = null, hd = null, rollUrl = null, master = null, md: estimates = null }) {
  const { title, subtitle } = SITE.sites.hacrp;
  const fyText = String(fy);
  const heading = fill('programTitle', { fy: fyText });
  const what = whatif && sandbox(whatif, { fy, boundaryText, source });
  // The page's figures and Part 1's steps, numbered in page order.
  const figureNo = counter();
  const stepNo = counter();
  const line = sourceText({ fy, source });
  const parts = pd && whatif ? { one: part1({ pd, model: whatif.model, periods, median: whatif.hospital, source: line, figure: figureNo, step: stepNo }), two: part2({ pd, model: whatif.model, source: line, figure: figureNo }) } : null;
  const md = estimates?.cutRows.length ? estimates : null;
  const money = md ? moneyPart({ md, source: moneySourceText({ fy, source }), shapes, figure: figureNo }) : null;
  const map = pd && places && shapes ? mapFigure({ pd, places, shapes, n: figureNo(), source: line }) : '';
  const sandboxNo = what ? stepNo() : null;
  const partNo = counter();

  const body = html`<article class="wrap page page--prog prog"${exploreUrl ? html` data-explore="${exploreUrl}"` : ''}>
${programTop({ title, subtitle, fy, counts, boundaryText, periods, source, searchUrl, tryPlaces, md })}
${pd && ruleFigure(pd, { searchUrl })}
<section class="part" id="how" aria-labelledby="how-h">
${partHead({ n: partNo(), id: 'how', heading: t('part1Heading'), intro: fill('part1Intro', { fy: fyText }) })}
${parts?.one ?? ''}
${what && html`<p class="step__n step__n--sandbox" id="step-${sandboxNo}" aria-hidden="true">${String(sandboxNo)}</p>
${what}`}
</section>
<section class="part" id="fy" aria-labelledby="fy-h">
${partHead({ n: partNo(), id: 'fy', heading: fill('part2Heading', { fy: fyText }), intro: t('part2Intro') })}
${parts?.two ?? ''}
</section>
${money ? html`<section class="part" id="money" aria-labelledby="money-h">
${partHead({ n: partNo(), id: 'money', heading: mt('moneyPartHeading'), intro: moneyPartIntro(md, fy) })}
${money}
</section>` : ''}
<section class="part" id="map" aria-labelledby="map-h">
${partHead({ n: partNo(), id: 'map', heading: t('part3Heading'), intro: t('part3Intro') })}
${map}
<div class="prog__browse">
${hospitalTable({ fy, searchUrl, source })}
${places && pd ? browseList(places, pd.counts.yes / pd.counts.decided) : ''}
</div>
</section>
${hd ? html`<section class="part" id="history" aria-labelledby="history-h">
${partHead({ n: partNo(), id: 'history', heading: hfill('part4Heading', { n: String(hd.fys.length), k: String(hd.cutYears) }), intro: hfill('part4Intro', { first: String(hd.fys[0]), share: pct(hd.counts[hd.counts.length - 1].ever / hd.recs.size, 0) }) })}
${part4({ hd, figure: figureNo, rollUrl, src: searchUrl, shapes, master })}
</section>` : ''}
<div class="prog__foot">
<section class="block" aria-labelledby="links-h">
<h2 id="links-h" class="h-sm">${t('linksHeading')}</h2>
<ul class="links" role="list">
${link(LINKS.cmsProgram, t('linkCmsProgram'))}
${link(source.landingPage, t('linkPdc'))}
${link(LINKS.careCompare, t('linkCareCompare'), t('linkCareCompareNote'))}
${link(LINKS.leapfrog, t('linkLeapfrog'), t('linkLeapfrogNote'))}
</ul>
</section>
<div class="prog__facts">
${asofBar({ fy, periods, source })}
${dataLinks(fy, source)}
${citation({ fy, title: heading, path: PROGRAM_PATH, source })}
</div>
</div>
</article>`;

  return page({
    title: `${heading} · ${SITE.name}`,
    description: fill('programDescription', { fy: fyText }),
    path: PROGRAM_PATH,
    robots,
    body,
    scripts: [assets.js.figure, assets.js.cite, assets.js.topbar, assets.js['hacrp-search'], assets.js['hacrp-program']],
    assets,
    topbar: siteHeader({ fy, current: 'how', searchUrl }),
  });
}
