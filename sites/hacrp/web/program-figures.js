// The program page's figures and the place pages', drawn with the chart kit (web/charts/) in HACRP's words from
// programData() (program-data.js). Every takeaway is filled from the data the figure draws; copy.js holds the words.
import { html, raw } from '../../../web/render/html.js';
import { cmsText, count, decimal, ordinal, pct, shortDate, shownAbove } from '../../../web/render/format.js';
import { ruleCompare, scoreRule } from '../../../web/charts/scoreRule.js';
import { figure, imageOf, imagePair, keysHint, num } from '../../../web/charts/figure.js';
import { US_MAP_CODES, countiesOf, placeMap, usMap, usPoints } from '../../../web/charts/geo.js';
import { compareHist } from '../../../web/charts/compareHist.js';
import { fillAround, paraOf, printout, wsOp, wsTerm } from '../../../web/render/components.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { nameInText, placeCounts } from './places.js';
import { toUnit } from '../../../engine/js/stats.js';
import { WIDTH } from '../../../web/charts/svg.js';
import { punchCard } from '../../../web/charts/punchCard.js';
import { escapeStacks, shiftStrip } from '../../../web/charts/measureDots.js';
import { shareDots } from '../../../web/charts/shareDots.js';
import { sina } from '../../../web/charts/sina.js';
import { agreeGrid } from '../../../web/charts/agree.js';
import { miniCards } from '../../../web/charts/miniCards.js';
import { barRows } from '../../../web/charts/barRows.js';
import { histogramBins } from '../../../web/charts/histogram.js';
import { countBins, edgesAround } from './compare.js';
import { MEASURE_IDS, isSir } from '../../../engine/js/hacrp/measures.js';
import { SCORE_DECIMALS as DP } from '../../../engine/js/hacrp/score.js';
import { FEW_DECIDED, MAP_STEPS_PCT, REDUCTION_TEXT, SHORT_NAMES, SIR_BASE_YEAR, SIR_EXPECTED, SIR_EXPECTED_TEXT, SIR_NEXT_BASE_YEAR, SIR_NEXT_FY, WINSOR_HIGH, WINSOR_LOW, CUTOFF_PERCENTILE } from './constants.js';
import { fill, fillKeep, t } from './program/copy.js';
import { groupLabel, kindLabel } from './groups.js';
import { PAGE_WIDE, PER, STEP_WIDE, fmtOf, setName, SCATTER_W, SWARM_WIDE, agreeScatterOf, binCounts, both, pairPoints, pullPanel, pullTake, slidePanel, slideTake, stackOf, stackPanel, stackTake, swarmChart } from './explore-figures.js';
export { PAGE_WIDE };


// ---------- the score rule ----------

// The bold rule under the page's top: every decided hospital's score, sorted, the cut in red. highlight: a set of
// CCNs (a place's hospitals) drawn as ticks through it. The page script reads data-rule to find the hospital under
// the pointer (it loads the explore asset for names).
// The rule's order (lowest score first, ties by CCN), its scores and each hospital's rank, once per programData.
const RULE_ORDER = new WeakMap();
function ruleOrder(pd) {
  if (!RULE_ORDER.has(pd)) {
    const rows = [...pd.decidedRows].sort(ruleCompare);
    RULE_ORDER.set(pd, { scores: rows.map((r) => r.total), rank: new Map(rows.map((r, i) => [r.ccn, i])) });
  }
  return RULE_ORDER.get(pd);
}

export function ruleFigure(pd, { highlight = null, searchUrl = null, caption = null, here = null } = {}) {
  const { scores, rank } = ruleOrder(pd);
  const { yes, decided } = pd.counts;
  const ranks = highlight ? [...highlight].map((ccn) => rank.get(ccn)).filter((i) => i !== undefined).sort((a, b) => a - b) : null;
  const labels = { low: fill('ruleLow', { value: decimal(scores[0], DP) }), high: fill('ruleHigh', { value: decimal(scores[scores.length - 1], DP) }), average: t('ruleAverage'), line: fill('ruleLine'), cut: here === null ? fill('ruleCut', { yes: count(yes) }) : fill('ruleCutHere', { yes: count(yes), here: count(here) }) };
  const alt = fill('ruleAlt', { decided: count(decided), yes: count(yes) });
  // The phone's drawing has room for the short form of a place's cut count.
  const narrowLabels = here === null ? labels : { ...labels, cut: fill('ruleCutHereShort', { yes: count(yes), here: count(here) }) };
  const draw = (width) => imageOf(scoreRule({ scores, cut: yes, labels: width === WIDTH ? narrowLabels : labels, width, highlight: ranks }), alt, width === WIDTH ? 'narrow' : 'wide');
  return html`<figure class="rulefig"${searchUrl ? html` data-src="${searchUrl}"` : ''} data-cut="${t('nearbyCut')}" data-not-cut="${t('nearbyNotCut')}">
${draw(WIDTH)}
${draw(PAGE_WIDE)}
<figcaption class="rulefig__cap">${caption ?? fill('ruleCaption')}</figcaption>
</figure>`;
}

// ---------- Part 1's frame ----------

// A step of Part 1: its number, heading and words beside its figure (stacked on a phone).
export const step = ({ n, id, heading, text, figure: fig }) => html`<section class="step" id="${id}" aria-labelledby="${id}-h">
<div class="step__text">
<p class="step__n" aria-hidden="true">${String(n)}</p>
<p class="step__label vh">${fill('stepLabel', { n: String(n) })}</p>
<h3 class="step__title" id="${id}-h">${heading}</h3>
${text}
</div>
<div class="step__fig">
${fig}
</div>
</section>`;

// A figure that shows one measure at a time: a row of measure buttons (shown by the page script; without it, the
// first panel shows and the table holds every measure), then one panel per measure, each with its own one-line
// takeaway and its two drawings. The figure's own takeaway says what all the panels show.
export function measureFigure({ n, takeaway, panels, first, source, table, csvName, claimLevel = 'official', note = null, after = null, kind = null, data = null }) {
  const toggle = html`<div class="mtoggle" role="group" aria-label="${t('measureToggle')}" hidden>${panels.map((p) => html`<button type="button" class="mtoggle__b" data-measure="${p.id}" aria-pressed="${p.id === first ? 'true' : 'false'}">${p.short}</button>`)}</div>`;
  // A lazy panel (no drawings yet: p.svg absent) is drawn by the page script when first picked (data-kind names
  // its builder in client/explore.js; data-fig holds the builder's settings).
  const chart = html`<div class="mfig"${kind ? html` data-kind="${kind}"` : ''}${data ? html` data-fig="${JSON.stringify(data)}"` : ''}>${toggle}
${panels.map((p) => html`<div class="mpanel" data-measure="${p.id}"${p.data ? html` data-slide="${p.data}"` : ''}${p.svg ? '' : html` data-lazy`}${p.id === first ? '' : html` hidden`}>
<p class="mpanel__take">${p.take}</p>
${p.svg ? html`${imagePair(p, p.alt)}` : ''}
</div>`)}${after ?? ''}</div>`;
  return figure({ n, takeaway, chart, source, table, csvName, claimLevel, note });
}

// ---------- Part 1: the five steps ----------

// Figure: the punch card. The largest sets of measures each get a column (KEEP of them); the rest are pooled; hospitals
// with no score close the card.
const KEEP = 12;
function punchFigure(pd, { n, source }) {
  const kept = pd.coverage.filter((c) => c.ids.length).slice(0, KEEP);
  const rest = pd.coverage.filter((c) => c.ids.length && !kept.includes(c));
  const none = pd.coverage.find((c) => !c.ids.length);
  const sum = (list, k) => list.reduce((s, c) => s + c[k], 0);
  const nation = pd.counts.yes / pd.counts.decided;
  const shareOf = (yes, decided) => (decided ? { shareText: pct(yes / decided, 0), hot: shownAbove(yes / decided, nation, 0) } : {});
  const columns = [
    ...kept.map((c) => ({ holes: c.ids.map((id) => MEASURE_IDS.indexOf(id)), n: c.n, yes: c.yes, nText: count(c.n), ...shareOf(c.yes, c.decided), tip: fill('fig1Tip', { set: setName(c.ids), n: count(c.n), yes: count(c.yes) }) })),
    ...(rest.length ? [{ holes: null, n: sum(rest, 'n'), yes: sum(rest, 'yes'), nText: count(sum(rest, 'n')), ...shareOf(sum(rest, 'yes'), sum(rest, 'decided')), tip: fill('fig1TipOther', { k: count(rest.length), n: count(sum(rest, 'n')), yes: count(sum(rest, 'yes')) }) }] : []),
    ...(none ? [{ holes: null, empty: true, n: none.n, yes: 0, nText: count(none.n), tip: fill('fig1TipNone', { n: count(none.n) }) }] : []),
  ];
  const rows = MEASURE_IDS.map((id) => {
    const total = pd.measures[id].n + pd.measures[id].assigned;
    return { label: SHORT_NAMES[id], total, totalText: count(total) };
  });
  const labels = { other: t('fig1Other'), none: t('fig1None'), totals: t('fig1Totals'), share: t('fig1Share') };
  const one = pd.coverage.filter((c) => c.ids.length === 1).reduce((s, c) => s + c.n, 0);
  const all = pd.coverage.find((c) => c.ids.length === MEASURE_IDS.length)?.n ?? 0;
  const tableRows = pd.coverage.map((c) => [c.ids.length ? setName(c.ids) : t('fig1None'), num(count(c.n), c.n), num(count(c.decided), c.decided), num(count(c.yes), c.yes)]);
  const art = both((width) => punchCard({ rows, columns, labels, width }));
  return figure({
    n, source, alt: t('fig1Alt'), csvName: 'hacrp-measure-sets',
    takeaway: fill('fig1Takeaway', { all: count(all), file: count(pd.counts.file), measureCount: String(MEASURE_IDS.length), one: count(one), none: count(none?.n ?? 0) }),
    ...art, note: t('fig1Key'),
    table: { columns: [{ name: t('fig1ColSet') }, { name: t('fig1ColN'), numeric: true }, { name: t('fig1ColDecided'), numeric: true }, { name: t('fig1ColYes'), numeric: true }], rows: tableRows },
  });
}

// Figure: every hospital's value on each measure, stacked; only the first measure is drawn into the page.
const FIRST = 'CLABSI';
function stackFigure(pd, model, { n, source }) {
  const rows = Math.max(...MEASURE_IDS.map((id) => Math.ceil(Math.max(...binCounts(pd.measures[id].values, stackOf(id))) / PER)));
  const panels = MEASURE_IDS.map((id) => (id === FIRST ? stackPanel(id, pd.measures[id], { rows }) : { id, short: SHORT_NAMES[id], take: stackTake(id, pd.measures[id]) }));
  return measureFigure({
    n, takeaway: t('fig2Takeaway'), panels, first: FIRST, source, csvName: 'hacrp-measure-values', kind: 'stack', data: { rows },
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('fig2ColN'), numeric: true }, { name: t('fig2ColZero'), numeric: true }, { name: t('fig2ColMedian'), numeric: true }, { name: t('fig2ColAbove'), numeric: true }],
      rows: MEASURE_IDS.map((id) => {
        const m = pd.measures[id];
        const above = m.values.filter((v) => v > SIR_EXPECTED).length;
        return [SHORT_NAMES[id], num(count(m.n), m.n), num(count(m.zero), m.zero), num(fmtOf(id, model)(m.median), m.median), num(count(above), above)];
      }),
    },
  });
}

// Figure: each measure as reported and as scored; only the first measure is drawn into the page.
function pullFigure(pd, model, { n, source }) {
  const panels = MEASURE_IDS.map((id) => (id === FIRST ? pullPanel(id, pd.measures[id]) : { id, short: SHORT_NAMES[id], take: pullTake(id, pd.measures[id]) }));
  return measureFigure({
    n, takeaway: t('fig3Takeaway'), panels, first: FIRST, source, csvName: 'hacrp-floor-cap', claimLevel: 'recomputed', note: t('floorCapNote'), kind: 'pull',
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('fig3ColFloor'), numeric: true }, { name: t('fig3ColCap'), numeric: true }, { name: t('fig3ColAtFloor'), numeric: true }, { name: t('fig3ColAtCap'), numeric: true }],
      rows: MEASURE_IDS.map((id) => {
        const m = pd.measures[id];
        const p = model.params[id];
        const fmt = fmtOf(id, model);
        return [SHORT_NAMES[id], num(fmt(p.floor), p.floor), num(fmt(p.cap), p.cap), num(count(m.atFloor), m.atFloor), num(count(m.atCap), m.atCap)];
      }),
    },
  });
}

// The worksheet under the slide rule: the median hospital's z-scores summed and divided into its score.
function medianSum(median) {
  const terms = MEASURE_IDS.map((id) => ({ short: SHORT_NAMES[id], z: median.measures[id].z }));
  return html`<div class="ws ws--prog" role="group" aria-label="${t('fig4Sum')}">
<p class="ws__head">${t('fig4Sum')}</p>
<p class="ws__line"><span class="ws__paren" aria-hidden="true">(</span>${terms.map((term, i) => html`${i ? wsOp(term.z < 0 ? '−' : '+') : ''}${wsTerm(i ? decimal(Math.abs(term.z), DP) : cmsText(decimal(term.z, DP)), term.short)}`)}<span class="ws__paren" aria-hidden="true">)</span>${wsOp('÷')}${wsTerm(String(terms.length), t('wsN'))}${wsOp('=')}${wsTerm(cmsText(median.totalText), t('wsTotal'), 'ws__term--total')}</p>
</div>`;
}

// Figure: the slide rule, one measure at a time, with the median hospital's sum under it; only the first measure is
// drawn into the page.
function slideFigure(pd, model, median, { n, source }) {
  const panels = MEASURE_IDS.map((id) => (id === FIRST ? slidePanel(id, pd.measures[id]) : { id, short: SHORT_NAMES[id], take: slideTake(id, model.params[id]) }));
  return measureFigure({
    n, takeaway: t('fig4Takeaway'), panels, first: FIRST, source, csvName: 'hacrp-z-scores', claimLevel: 'recomputed', note: t('floorCapNote'), kind: 'slide',
    after: html`<p class="small muted slide__hint" hidden>${t('fig4Drag')}</p>
${medianSum(median)}`,
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('fig3ColFloor'), numeric: true }, { name: t('fig3ColCap'), numeric: true }, { name: t('fig4ColMean'), numeric: true }, { name: t('fig4ColSd'), numeric: true }],
      rows: MEASURE_IDS.map((id) => {
        const p = model.params[id];
        const fmt = fmtOf(id, model);
        return [SHORT_NAMES[id], num(fmt(p.floor), p.floor), num(fmt(p.cap), p.cap), num(fmt(p.mean), p.mean), num(fmt(p.sd), p.sd)];
      }),
    },
  });
}

// Figure: halve one measure for every hospital (CLABSI by default); the values move, the z-scores don't.
const HALVE_ID = 'CLABSI';
function halveFigure(pd, model, { n, source }) {
  const i = MEASURE_IDS.indexOf(HALVE_ID);
  const p = model.params[HALVE_ID];
  const fmt = fmtOf(HALVE_ID, model);
  const rows = pd.rows.filter((r) => r.values[i] !== null);
  const values = rows.map((r) => r.values[i]);
  const short = SHORT_NAMES[HALVE_ID];
  const labels = { top: fill('fig5Top', { short }), bottom: t('fig5Bottom') };
  const draw = (width) => shiftStrip({ values, z: rows.map((r) => r.z[i]), domain: [0, 3], zDomain: [Math.floor(p.zMin * 2) / 2, Math.ceil(p.zMax * 2) / 2], labels, format: (v) => decimal(v, 1), zFormat: (z) => cmsText(decimal(z, 1)), width });
  const art = both(draw);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const yes = count(pd.counts.yes);
  const chart = html`<p class="halve__row"><button type="button" class="fig__btn halve__btn" data-halve aria-pressed="false" data-on="${t('fig5Back')}" data-off="${t('fig5Halve')}" data-top-on="${fill('fig5TopHalf', { short })}" data-top-off="${fill('fig5Top', { short })}" hidden>${t('fig5Halve')}</button></p>
${imagePair(art, fill('fig5Alt', { short }))}
<p class="halve__same">${fill('fig5Same', { yes })}</p>`;
  return figure({
    n, takeaway: fill('fig5Takeaway', { short, yes }), chart, source, csvName: 'hacrp-halve', claimLevel: 'hypothetical',
    table: {
      columns: [{ name: t('fig5ColWhat') }, { name: t('fig5ColAsIs'), numeric: true }, { name: t('fig5ColHalf'), numeric: true }],
      rows: [
        [fill('fig5RowMedian', { short }), num(fmt(mid), mid), num(fmt(mid / 2), mid / 2)],
        [t('fig5RowCut'), num(yes, pd.counts.yes), num(yes, pd.counts.yes)],
      ],
    },
  });
}

// Part 1: the five steps, each beside its figure. median: medianHospital(model) (the sandbox's hospital); figure and
// step: the page's counters (web/charts/figure.js counter), so the sandbox after them takes the next step's number.
export function part1({ pd, model, periods, median, source, figure: fig, step: stepNo }) {
  const psi = SHORT_NAMES.PSI90;
  const haiCount = MEASURE_IDS.filter(isSir).length;
  const one = SIR_EXPECTED_TEXT;
  const each = (heading, text, draw) => {
    const n = stepNo();
    return step({ n, id: `step-${n}`, heading, text, figure: draw(fig()) });
  };
  return html`${each(fill('step1Heading', { measureCount: String(MEASURE_IDS.length) }),
    html`${para('step1a', { haiCount: String(haiCount), short: psi })}${para('step1Who')}${para('step1b', { short: psi })}<p>${fillKeep('step1c', { short: psi, psiStart: shortDate(periods.psi90.start), psiEnd: shortDate(periods.psi90.end), haiStart: shortDate(periods.hai.start), haiEnd: shortDate(periods.hai.end) }, ['psiStart', 'psiEnd', 'haiStart', 'haiEnd'])}</p>`,
    (n) => punchFigure(pd, { n, source }))}
${each(t('step2Heading'), html`${sirPara(one)}${para('step2b', { short: psi, one })}${para('step2c')}`, (n) => stackFigure(pd, model, { n, source }))}
${each(t('step3Heading'), html`${para('step3a', { low: ordinal(WINSOR_LOW), high: ordinal(WINSOR_HIGH) })}${para('step3b')}`, (n) => pullFigure(pd, model, { n, source }))}
${each(t('step4Heading'), html`${para('step4a')}${para('step4b')}${para('step4c')}`, (n) => slideFigure(pd, model, median, { n, source }))}
${each(t('step5Heading'), html`${para('step5a', { percentile: ordinal(CUTOFF_PERCENTILE), pct: REDUCTION_TEXT })}${para('step5b')}<p>${t('step5c')} ${t('step5d')}</p>`, (n) => halveFigure(pd, model, { n, source }))}`;
}

// A paragraph of the page's words: a key, filled with values when it has placeholders.
const para = paraOf(fill, t);

// Step 2's first paragraph, its term a box that opens on a click or tap (no script) with the SIR's arithmetic and
// baseline year. A <details> can't sit inside a <p>, so the paragraph is a div that reads as one.
function sirPara(one) {
  const base = String(SIR_BASE_YEAR);
  const box = html`<details class="def def--inline"><summary>${t('sirTerm')}<span class="def__mark" aria-hidden="true">?</span><span class="vh"> ${t('sirMore')}</span></summary><span class="def__box"><strong class="def__math">${t('sirBoxMath')}</strong> ${fill('sirBoxPredicted', { base })} ${fill('sirBoxBaseline', { base, next: String(SIR_NEXT_BASE_YEAR), nextFy: String(SIR_NEXT_FY) })}</span></details>`;
  return html`<div class="step__p">${fillAround((marks) => fill('step2a', { ...marks, one }), { sir: box })}</div>`;
}

// ---------- Part 2: the year's picture ----------

// A share-dots stem turns red only past the reference by more than this (two points): a hair over isn't news.
const SHARE_BAND = 0.02;
const bandText = decimal(SHARE_BAND * 100, 0);

// A section of Part 2: words left, figure right (5fr 7fr from 980px); wide: the words across the top, the figure
// under them at the page's width.
export const psec = ({ id, heading, text, figure: fig, wide = false, level = 3 }) => html`<section class="psec${wide ? ' psec--wide' : ''}" id="${id}" aria-labelledby="${id}-h">
<div class="psec__text">
${raw(`<h${level} class="psec__title" id="${id}-h">`)}${heading}${raw(`</h${level}>`)}
${text}
</div>
<div class="psec__fig">
${fig}
</div>
</section>`;

// The groups the swarm's buttons offer, by kind: [{ kind, key, label }].
function swarmGroups(pd) {
  const out = pd.types.map((k) => ({ kind: k.kind, groups: k.groups.map((g) => ({ key: g.key, label: groupLabel(k.kind, g.key) })) }));
  const regions = [...new Set(pd.decidedRows.map((r) => r.master.region).filter(Boolean))].sort();
  out.push({ kind: 'region', groups: regions.map((key) => ({ key, label: groupLabel('region', key) })) });
  return out;
}

function swarmFigure(pd, model, { n, source }) {
  const band = [model.boundary.highestNo, model.boundary.lowestYes];
  const items = pd.decidedRows.map((r) => ({ score: r.total, yes: r.yes, hl: false }));
  const alt = t('swarmAlt');
  const narrow = swarmChart({ items, band, width: WIDTH });
  const wide = swarmChart({ items, band, width: SWARM_WIDE });
  const nation = pct(pd.counts.yes / pd.counts.decided, 1);
  const picker = html`<div class="swarm__pick" hidden>
<p class="swarm__lead cap">${t('swarmPick')}</p>
<p class="swarm__kinds"><span class="swarm__kind"></span><span class="swarm__opts"><button type="button" class="swarm__chip" data-group="" aria-pressed="true">${t('swarmAll')}</button></span></p>
${swarmGroups(pd).map((k) => html`<p class="swarm__kinds"><span class="swarm__kind">${kindLabel(k.kind)}</span><span class="swarm__opts">${k.groups.map((g) => html`<button type="button" class="swarm__chip" data-group="${k.kind}:${g.key}" aria-pressed="false">${g.label}</button>`)}</span></p>`)}
<p class="swarm__readout" aria-live="polite" data-nation="${nation}"></p>
</div>`;
  const chart = html`<div class="swarm" data-band="${JSON.stringify(band)}" data-cut="${t('nearbyCut')}" data-not-cut="${t('nearbyNotCut')}">
${picker}
<div class="swarm__art">
${imageOf(narrow, alt, 'narrow')}
${imageOf(wide, alt, 'wide')}
</div>
</div>`;
  const bins = histogramBins(items.map((i) => i.score), 30, band[1]);
  return figure({
    n, chart, source, csvName: 'hacrp-scores',
    takeaway: fill('swarmTakeaway', { yes: count(pd.counts.yes), decided: count(pd.counts.decided), gap: decimal(band[1] - band[0], DP) }),
    table: {
      columns: [{ name: t('swarmColFrom'), numeric: true }, { name: t('swarmColTo'), numeric: true }, { name: t('figColHospitals'), numeric: true }, { name: t('figColDecision') }],
      rows: bins.map((b) => [num(cmsText(decimal(b.x0, DP)), b.x0), num(cmsText(decimal(b.x1, DP)), b.x1), num(count(b.count), b.count), b.count ? (b.above ? t('flagYes') : t('flagNo')) : '']),
    },
  });
}

// Figure: the share cut by kind of hospital, against the nation's.
function typesFigure(pd, { n, source }) {
  const nationShare = pd.counts.yes / pd.counts.decided;
  const nation = pct(nationShare, 1);
  const sections = pd.types.map((k) => ({
    head: kindLabel(k.kind),
    rows: k.groups.map((g) => {
      const label = groupLabel(k.kind, g.key);
      const share = pct(g.yes / g.decided, 0);
      return { label, sub: fill('typesSub', { yes: count(g.yes), decided: count(g.decided) }), value: g.yes / g.decided, n: g.decided, valueText: share, tip: fill('typesTip', { group: label, yes: count(g.yes), decided: count(g.decided), share }) };
    }),
  }));
  const all = sections.flatMap((s) => s.rows);
  const hi = all.reduce((a, b) => (b.value > a.value ? b : a));
  const lo = all.reduce((a, b) => (b.value < a.value ? b : a));
  const max = Math.ceil((hi.value + 0.05) * 10) / 10;
  const draw = (width) => shareDots({ sections, ref: nationShare, labels: { ref: fill('typesRef', { nation }) }, max, width, format: (v) => pct(v, 0), band: SHARE_BAND });
  const art = both(draw);
  return figure({
    n, source, alt: t('typesAlt'), ...art, csvName: 'hacrp-share-cut-by-type', note: fill('typesSize', { band: bandText }),
    takeaway: fill('typesTakeaway', { high: hi.label, highShare: hi.valueText, low: lo.label, lowShare: lo.valueText, nation }),
    table: {
      columns: [{ name: t('typesColGroup') }, { name: t('figColDecided'), numeric: true }, { name: t('figColCut'), numeric: true }, { name: t('figColShare'), numeric: true }],
      rows: pd.types.flatMap((k) => k.groups.map((g) => [`${kindLabel(k.kind)}: ${groupLabel(k.kind, g.key)}`, num(count(g.decided), g.decided), num(count(g.yes), g.yes), num(pct(g.yes / g.decided, 1), g.yes / g.decided)])),
    },
  });
}

// Figure: the sina columns by number of measures scored.
function funnelFigure(pd, { n, source, band }) {
  const cols = pd.funnel.filter((f) => f.decided > 0);
  const columns = cols.map((f) => {
    const rows = pd.decidedRows.filter((r) => r.ids.length === f.k);
    const share = pct(f.yes / f.decided, 0);
    const label = fill(f.k === 1 ? 'funnelOne' : 'funnelMany', { k: String(f.k) });
    const scores = rows.map((r) => r.total);
    return { label, short: String(f.k), sub: fill('funnelSub', { n: count(f.decided), share }), sub2: fill('funnelSd', { sd: decimal(f.sd, 2) }), scores, yes: rows.map((r) => r.yes), tip: fill('funnelTip', { label, n: count(f.decided), yes: count(f.yes), share, sd: decimal(f.sd, 2) }) };
  });
  const all = pd.decidedRows.map((r) => r.total);
  const domain = [Math.floor(Math.min(...all) * 2) / 2, Math.ceil(Math.max(...all) * 2) / 2];
  const draw = (width) => sina({ columns, line: band[1], domain, labels: { line: t('ruleLine') }, width, height: width > WIDTH ? 380 : 300, format: (v) => cmsText(decimal(v, 1)) });
  const art = both(draw);
  const one = pd.funnel[0];
  const six = pd.funnel.at(-1);
  return figure({
    n, source, alt: t('funnelAlt'), ...art, csvName: 'hacrp-scores-by-measure-count',
    takeaway: fill('funnelTakeaway', { ratio: decimal(one.sd / six.sd, 1), six: String(six.k), sdOne: decimal(one.sd, 2), sdAll: decimal(six.sd, 2) }),
    table: {
      columns: [{ name: t('funnelColK'), numeric: true }, { name: t('figColDecided'), numeric: true }, { name: t('figColCut'), numeric: true }, { name: t('funnelColMedian'), numeric: true }, { name: t('funnelColSd'), numeric: true }],
      rows: cols.map((f) => [num(String(f.k), f.k), num(count(f.decided), f.decided), num(count(f.yes), f.yes), num(cmsText(decimal(f.median, DP)), f.median), num(decimal(f.sd, 2), f.sd)]),
    },
  });
}

// Figure: how closely the measures agree, with the closest pair's scatter.
function agreeFigure(pd, { n, source }) {
  const sorted = [...pd.agree].sort((x, y) => y.rho - x.rho);
  const [top, second] = sorted;
  const pairs = pd.agree.map((p) => ({ ...p, text: decimal(p.rho, 2), tip: fill('agreeTip', { a: SHORT_NAMES[p.a], b: SHORT_NAMES[p.b], rho: decimal(p.rho, 2), n: count(p.n) }) }));
  const picked = `${top.a}|${top.b}`;
  const grid = (width) => agreeGrid({ ids: MEASURE_IDS, shorts: SHORT_NAMES, pairs, picked, width });
  const pts = pairPoints(pd.rows, top.a, top.b);
  const alt = t('agreeAlt');
  const chart = html`<div class="agree" data-picked="${picked}">
<div class="agree__grid">${imageOf(grid(WIDTH), alt, null)}</div>
<div class="agree__scatter">${imageOf(agreeScatterOf(pts, top.a, top.b, SCATTER_W), alt, null)}</div>
</div>`;
  return figure({
    n, chart, source, csvName: 'hacrp-measure-agreement', claimLevel: 'recomputed',
    takeaway: fill('agreeTakeaway', { a: SHORT_NAMES[top.a], b: SHORT_NAMES[top.b], rho: decimal(top.rho, 2), c: SHORT_NAMES[second.a], d: SHORT_NAMES[second.b], rhoNext: decimal(second.rho, 2) }),
    table: {
      columns: [{ name: t('agreeColPair') }, { name: t('agreeColRho'), numeric: true }, { name: t('agreeColN'), numeric: true }],
      rows: sorted.map((p) => [fill('setJoin', { a: SHORT_NAMES[p.a], b: SHORT_NAMES[p.b] }), num(decimal(p.rho, 3), p.rho), num(count(p.n), p.n)]),
    },
  });
}

// Figure: each cut hospital's score before and after its costliest measure goes to the national median.
function escapeFigure(pd, { n, source, band }) {
  const moved = pd.escapes.filter((e) => e.after !== null);
  const escaped = moved.filter((e) => e.escaped).length;
  const stuck = moved.length - escaped;
  const lo = Math.min(...moved.map((e) => e.after));
  const hi = Math.max(...moved.map((e) => e.total));
  const labels = { top: t('escapeTop'), bottom: t('escapeBottom'), out: fill('escapeOut', { n: count(escaped) }), stuck: fill('escapeStuck', { n: count(stuck) }) };
  const items = moved.map((e) => ({ from: e.total, to: e.after, out: e.escaped }));
  const draw = (width) => {
    const s = width > WIDTH ? { bin: 0.05, pitch: 4.4, cols: 3 } : { bin: 0.1, pitch: 2.8, cols: 3 };
    const edges = edgesAround(lo, hi, band[1], Math.round((hi - lo) / s.bin));
    return escapeStacks({ items, edges, line: band[1], labels, width, pitch: s.pitch, cols: s.cols, format: (v) => cmsText(decimal(v, 1)) });
  };
  const art = both(draw);
  const none = pd.escapes.length - moved.length;
  return figure({
    n, source, alt: t('escapeAlt'), ...art, csvName: 'hacrp-one-measure', claimLevel: 'hypothetical',
    takeaway: fill('escapeTakeaway', { escaped: count(escaped), yes: count(pd.counts.yes) }),
    note: none ? fill('escapeNone', { n: count(none) }) : null,
    table: {
      columns: [{ name: t('escapeColWhat') }, { name: t('escapeColN'), numeric: true }],
      rows: [[t('escapeRowOut'), num(count(escaped), escaped)], [t('escapeRowStuck'), num(count(stuck), stuck)]],
    },
  });
}

// Figure: the measure that added most to each cut hospital's score.
function driversFigure(pd, { n, source }) {
  const rows = MEASURE_IDS.map((id) => ({ id, n: pd.drivers[id] })).sort((a, b) => b.n - a.n);
  const max = rows[0].n;
  const art = { svg: barRows({ rows: rows.map((r, i) => ({ label: SHORT_NAMES[r.id], value: r.n, valueText: count(r.n), pen: i === 0, tip: fill('driversTip', { short: SHORT_NAMES[r.id], n: count(r.n) }) })), max, width: WIDTH }) };
  return figure({
    n, source, alt: t('driversAlt'), ...art, csvName: 'hacrp-largest-part',
    takeaway: fill('driversTakeaway', { top: SHORT_NAMES[rows[0].id], topN: count(rows[0].n), yes: count(pd.counts.yes), low: SHORT_NAMES[rows.at(-1).id], lowN: count(rows.at(-1).n) }),
    table: { columns: [{ name: t('colMeasure') }, { name: t('figColHospitals'), numeric: true }], rows: rows.map((r) => [SHORT_NAMES[r.id], num(count(r.n), r.n)]) },
  });
}

// Figure: the hospitals scored without data on a measure, a card each.
function assignedFigure(pd, { n, source }) {
  const list = [...pd.assigned].sort((a, b) => Number(b.yes) - Number(a.yes) || b.assigned.length - a.assigned.length || (a.ccn < b.ccn ? -1 : 1));
  const stateOf = new Map(pd.decidedRows.map((r) => [r.ccn, r.state]));
  const cards = list.map((a) => ({
    cells: MEASURE_IDS.map((id) => (a.assigned.includes(id) ? 'a' : a.ids.includes(id) ? 'm' : '')),
    yes: a.yes,
    tip: fill('assignedTip', { state: stateOf.get(a.ccn) ?? '', set: setName(a.assigned), decision: a.yes ? t('nearbyCut') : t('nearbyNotCut') }),
  }));
  const draw = (width) => miniCards({ id: width > WIDTH ? 'cards-wide' : 'cards', cards, width, cols: width > WIDTH ? 6 : 3 });
  const art = both(draw);
  const yes = list.filter((a) => a.yes).length;
  const none = list.filter((a) => a.measuredNone).length;
  return figure({
    n, source, alt: t('assignedAlt'), ...art, csvName: 'hacrp-assigned',
    takeaway: fill('assignedTakeaway', { n: count(list.length), yes: count(yes), none: count(none) }), note: fill('assignedSlots', { order: MEASURE_IDS.map((id) => SHORT_NAMES[id]).join(' · ') }),
    table: {
      columns: [{ name: t('assignedColWhat') }, { name: t('figColHospitals'), numeric: true }],
      rows: [[t('figColDecided'), num(count(list.length), list.length)], [t('figColCut'), num(count(yes), yes)]],
    },
  });
}

// Part 2, its figures numbered by the page's counter in the order the page shows them (the measure that added most
// sits in the words beside the escapes' figure, so it comes first).
export function part2({ pd, model, source, figure: fig }) {
  const band = [model.boundary.highestNo, model.boundary.lowestYes];
  const single = Object.fromEntries(pd.single.map((s) => [s.id, s]));
  const nation = pct(pd.counts.yes / pd.counts.decided, 1);
  const swarm = swarmFigure(pd, model, { n: fig(), source });
  const types = typesFigure(pd, { n: fig(), source });
  const funnel = funnelFigure(pd, { n: fig(), source, band });
  const agree = agreeFigure(pd, { n: fig(), source });
  const drivers = driversFigure(pd, { n: fig(), source });
  const escape = escapeFigure(pd, { n: fig(), source, band });
  const assigned = assignedFigure(pd, { n: fig(), source });
  return html`${psec({ id: 'swarm', wide: true, heading: t('swarmHeading'), text: html`${para('swarmText')}${para('swarmMaryland', { scored: count(pd.maryland.scored), above: count(pd.maryland.above) })}`, figure: swarm })}
${psec({ id: 'types', heading: t('typesHeading'), text: html`${para('typesText', { nation })}${para('typesText2', { band: bandText })}`, figure: types })}
${psec({
    id: 'funnel', heading: t('funnelHeading'),
    text: html`${para('funnelText', { six: String(MEASURE_IDS.length) })}${single.PSI90 && single.CDI ? para('funnelText2', { psiN: count(single.PSI90.decided), psi: SHORT_NAMES.PSI90, psiYes: count(single.PSI90.yes), cdiN: count(single.CDI.decided), cdi: SHORT_NAMES.CDI, cdiYes: count(single.CDI.yes) }) : ''}`,
    figure: funnel,
  })}
${psec({ id: 'agree', heading: t('agreeHeading'), text: html`${para('agreeText')}${para('agreeText2')}`, figure: agree })}
${psec({ id: 'escape', heading: t('escapeHeading'), text: html`${para('escapeText')}${para('escapeText2')}${drivers}`, figure: escape })}
${psec({ id: 'assigned', heading: t('assignedHeading'), text: html`${para('assignedText')}${para('assignedText2')}`, figure: assigned })}`;
}

// ---------- Part 3: the map and the way down ----------

// The key to a map's hospital dots: cut, not cut, and no decision. rings: the not-cut swatch as a ring (a place map
// drawn with one mark per hospital) rather than a gray dot.
const dotKey = ({ rings = false } = {}) => html`<ul class="usmap__key${rings ? ' usmap__key--rings' : ''}" role="list"><li><span class="usmap__sw usmap__sw--pen"></span>${t('mapDotsCut')}</li><li><span class="usmap__sw usmap__sw--ring"></span>${t('mapDotsNo')}</li><li><span class="usmap__sw usmap__sw--faint"></span>${t('mapDotsNA')}</li></ul>`;

const shareText = (yes, decided) => pct(decided ? yes / decided : 0, 1);

// Figure: the US map, two ways: each state shaded by the share CMS cut (a state is a mark that opens its page), or
// every hospital as a dot (wide screens). places: buildPlaces(); shapes: stateShapes(topology).
export function mapFigure({ pd, places, shapes, n, source }) {
  const states = new Map(places.list.filter((p) => p.kind === 'state').map((p) => [p.key.toUpperCase(), p]));
  const entry = (code) => {
    const p = states.get(code);
    if (!p) return { code, label: t('figStatesNone'), empty: true };
    const c = p.counts;
    if (c.decided === 0) return c.scored > 0 ? { code, p, label: t('figStatesNA'), hatched: true } : { code, p, label: t('figStatesNoDecision'), empty: true };
    const value = toUnit((100 * c.yes) / c.decided, 1);
    return { code, p, value, few: c.decided < FEW_DECIDED, label: fill('figStatesTile', { yes: count(c.yes), decided: count(c.decided), share: pct(value / 100, 1) }) };
  };
  const drawn = US_MAP_CODES.map(entry);
  const shares = drawn.filter((x) => x.value !== undefined).map((x) => x.value);
  const legend = { title: t('figColShare'), high: pct(Math.max(...shares) / 100, 1), zero: t('figStatesZero'), few: fill('figStatesFew', { n: count(FEW_DECIDED) }) };
  const entries = Object.fromEntries(drawn.map((x) => [x.code, x.value === undefined ? { hatched: x.hatched, empty: x.empty, label: x.label } : { value: x.value, label: x.label, few: x.few }]));
  const alt = t('figStatesAlt');
  const points = pd.rows.map((r) => ({ point: r.point, cls: r.yes === null ? 'chart-dots--faint' : r.yes ? 'chart-dots--pen' : 'chart-dots--ring' }));
  // The wide map carries every hospital as a dot over the states (shown in the dots mode, when the states turn plain).
  const overlay = usPoints({ shapes, points, sizes: { 'chart-dots--faint': 3.2, 'chart-dots--ring': 4.4, 'chart-dots--pen': 5.2 }, width: PAGE_WIDE });
  const choro = (width) => usMap({ id: width === WIDTH ? 'states' : 'states-wide', shapes, ramp: MAP_STEPS_PCT, format: (x) => pct(x / 100, 0), width, legend, states: entries, overlay: width === WIDTH ? '' : overlay });
  const chart = html`<div class="usmap" data-mode="share">
<div class="mtoggle usmap__modes" role="group" aria-label="${t('mapModes')}" hidden><button type="button" class="mtoggle__b" data-mode="share" aria-pressed="true">${t('mapModeShare')}</button><button type="button" class="mtoggle__b" data-mode="dots" aria-pressed="false">${t('mapModeDots')}</button></div>
${imageOf(choro(WIDTH), alt, 'narrow')}
${imageOf(choro(PAGE_WIDE), alt, 'wide')}
${dotKey()}
</div>`;
  const total = (k) => drawn.reduce((s, x) => s + (x.p ? x.p.counts[k] : 0), 0);
  const listed = [...states.values()].sort((a, b) => a.key.localeCompare(b.key));
  const fig = figure({
    n, chart, source, csvName: 'hacrp-states',
    takeaway: fill('figStatesTakeaway', { share: pct(total('yes') / total('decided'), 1), low: pct(Math.min(...shares) / 100, 1), high: pct(Math.max(...shares) / 100, 1) }),
    table: {
      columns: [{ name: t('figColState') }, { name: t('figColCut'), numeric: true }, { name: t('figColDecided'), numeric: true }, { name: t('figColShare'), numeric: true }],
      rows: listed.map((p) => {
        const c = p.counts;
        const v = c.decided ? toUnit((100 * c.yes) / c.decided, 1) : null;
        return [p.key.toUpperCase(), num(count(c.yes), c.yes), num(count(c.decided), c.decided), v === null ? num('—', null) : num(pct(v / 100, 1), v)];
      }),
    },
  });
  return html`${fig}
${keysHint(n, t('figStatesKeys'))}`;
}

// The way down by place: each region, its divisions and their states, each a link to its page with its count cut
// and a bar of its share (on the page's scale, the nation's share marked).
export function browseList(places, nation) {
  const { places: byId, regions } = places;
  const line = (p, cls) => {
    const c = p.counts;
    const share = c.decided ? c.yes / c.decided : 0;
    return html`<a class="browse__a ${cls}" href="${p.path}"><span class="browse__name">${p.name}</span><span class="browse__n">${fill('browseCount', { yes: count(c.yes), decided: count(c.decided) })}</span><span class="browse__bar" style="--share: ${share.toFixed(3)}; --nation: ${nation.toFixed(3)}" aria-hidden="true"></span><span class="browse__pct">${c.decided ? shareText(c.yes, c.decided) : t('browseNone')}</span></a>`;
  };
  return html`<nav class="block browse" aria-labelledby="browse-h">
<h2 id="browse-h">${t('browseHeading')}</h2>
<p class="small muted">${t('browseIntro')}</p>
<ol class="browse__regions" role="list">${regions.map((r) => html`<li>${line(r, 'browse__a--region')}
<ol class="browse__divs" role="list">${r.children.map((id) => byId.get(id)).map((d) => html`<li>${line(d, 'browse__a--div')}
<ol class="browse__states" role="list">${d.children.map((id) => byId.get(id)).map((s) => html`<li>${line(s, 'browse__a--state')}</li>`)}</ol></li>`)}</ol></li>`)}</ol>
</nav>`;
}

// ---------- place pages ----------

// A place's map: its hospitals as dots (red cut, ringed not cut, gray no decision), each opening its page.
// A place with more hospitals than this draws its map's dots as one path per kind, with no tooltips, and its
// figure's table lists its states rather than every hospital (the table under the page lists them all).
const DENSE = 160;
export function placeMapFigure({ place, places, pd, shapes, counties, hospitalRows, master, next, source }) {
  const byCcn = new Map(pd.rows.map((r) => [r.ccn, r]));
  const codes = place.kind === 'metro' ? place.stateCodes : [...new Set(place.ccns.map((c) => hospitalRows.get(c).state))];
  const dense = place.ccns.length > DENSE;
  const decision = (r) => (r?.yes === true ? t('nearbyCut') : r?.yes === false ? t('nearbyNotCut') : t('nearbyNA'));
  const kind = (r) => (r?.yes === true ? 'pen' : r?.yes === false ? 'ring' : 'faint');
  const points = place.ccns.map((ccn) => {
    const r = byCcn.get(ccn);
    const h = hospitalRows.get(ccn);
    return dense ? { point: h.point, cls: `chart-dots--${kind(r)}` } : {
      point: h.point, r: r?.yes ? 4.6 : 3.8, cls: `chart-place__dot--${kind(r)}`,
      tip: fill('placeMapTip', { name: h.name, city: h.city, score: cmsText(h.totalText), decision: decision(r) }), href: h.href,
    };
  });
  const label = fill('placeMapAlt', { name: nameInText(place) });
  const sizes = (width) => (dense ? { 'chart-dots--faint': width > WIDTH ? 4 : 2.6, 'chart-dots--ring': width > WIDTH ? 5.4 : 3.4, 'chart-dots--pen': width > WIDTH ? 6.2 : 4 } : null);
  const lines = place.kind === 'state' ? countiesOf(counties, codes[0]) : place.kind === 'metro' ? counties : [];
  const own = place.kind === 'metro' ? new Set(place.ccns.map((c) => master.get(c)?.fips).filter(Boolean)) : null;
  const draw = (width) => placeMap({ variant: width > WIDTH ? 'wide' : 'narrow', shapes, counties: lines, ownCounties: own, codes: place.kind === 'metro' ? [] : codes, fit: place.kind === 'metro' ? 'points' : 'states', points, label, width, aspect: place.kind === 'state' || place.kind === 'metro' ? 0.8 : 0.62, dense: sizes(width) });
  const narrow = draw(WIDTH);
  const wide = draw(STEP_WIDE);
  if (!narrow || !wide) return null;
  const chart = html`${narrow}
${wide}
${dotKey({ rings: !dense })}`;
  const c = place.counts;
  const states = dense ? codes.map((code) => places.places.get(`state:${code.toLowerCase()}`)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'en')) : null;
  return figure({
    n: next(), chart, source, csvName: `hacrp-${place.kind}-${place.key}-map`,
    takeaway: fill('placeMapTakeaway', { name: nameInText(place, { start: true }), yes: count(c.yes), decided: count(c.decided) }),
    table: dense ? {
      columns: [{ name: t('placeColPlace') }, { name: t('figColDecided'), numeric: true }, { name: t('figColCut'), numeric: true }],
      rows: states.map((p) => [p.name, num(count(p.counts.decided), p.counts.decided), num(count(p.counts.yes), p.counts.yes)]),
    } : {
      columns: [{ name: t('placeMapColHospital') }, { name: t('tableColCity') }, { name: t('tableColScore'), numeric: true }, { name: t('tableColDecision') }],
      rows: place.ccns.map((ccn) => hospitalRows.get(ccn)).sort((a, b) => a.name.localeCompare(b.name, 'en')).map((h) => [h.name, h.city, num(cmsText(h.totalText), h.totalText === 'N/A' ? null : h.totalText), h.decision]),
    },
  });
}

// A place's scores against the nation's, as shares of each one's hospitals.
const PLACE_BIN = 0.2;
export function placeHistFigure({ place, pd, model, next, source }) {
  const band = [model.boundary.highestNo, model.boundary.lowestYes];
  const all = pd.decidedRows.map((r) => r.total);
  const edges = edgesAround(Math.min(...all), Math.max(...all), band[1], Math.round((Math.max(...all) - Math.min(...all)) / PLACE_BIN));
  const mine = place.rows.filter((r) => r.decided).map((r) => r.total);
  if (!mine.length) return null;
  const bins = (xs) => countBins(xs, edges);
  const here = bins(mine);
  const nation = bins(all);
  const sh = (c, list) => pct(c / list.length, 0);
  const tip = (i) => fill('placeHistTip', { from: cmsText(decimal(edges[i], 1)), to: cmsText(decimal(edges[i + 1], 1)), here: sh(here[i], mine), nation: sh(nation[i], all) });
  const draw = (width) => compareHist({ edges, place: here, nation, line: band[1], labels: { line: t('ruleLine') }, tip, width, format: (v) => cmsText(decimal(v, 1)) });
  const art = both(draw);
  const c = place.counts;
  return figure({
    n: next(), source, alt: t('placeHistAlt'), ...art, csvName: `hacrp-${place.kind}-${place.key}-scores`,
    takeaway: fill('placeHistTakeaway', { share: pct(c.yes / c.decided, 1), nation: pct(pd.counts.yes / pd.counts.decided, 1), median: cmsText(decimal(c.median, DP)), nationMedian: cmsText(decimal(pd.medianScore, DP)) }),
    table: {
      columns: [{ name: t('swarmColFrom'), numeric: true }, { name: t('swarmColTo'), numeric: true }, { name: t('placeHistPlace'), numeric: true }, { name: t('placeHistNation'), numeric: true }],
      rows: here.map((h, i) => [num(cmsText(decimal(edges[i], 1)), edges[i]), num(cmsText(decimal(edges[i + 1], 1)), edges[i + 1]), num(count(h), h), num(count(nation[i]), nation[i])]),
    },
  });
}

// A place's hospitals worse than the national median, measure by measure, against one half.
export function placeMeasuresFigure({ place, model, next, source }) {
  const rows = MEASURE_IDS.map((id, i) => {
    const vals = place.rows.map((r) => r.values[i]).filter((v) => v !== null);
    const median = medianAt(model.params[id]);
    const worse = vals.filter((v) => v > median).length;
    return { id, n: vals.length, worse };
  }).filter((r) => r.n > 0);
  if (!rows.length) return null;
  const sections = [{
    head: '', rows: rows.map((r) => {
      const share = r.worse / r.n;
      return { label: SHORT_NAMES[r.id], sub: fill('placeMeasuresSub', { worse: count(r.worse), n: count(r.n) }), value: share, n: r.n, valueText: pct(share, 0), tip: fill('placeMeasuresTip', { short: SHORT_NAMES[r.id], worse: count(r.worse), n: count(r.n), share: pct(share, 0) }) };
    }),
  }];
  const all = sections[0].rows;
  const worst = all.reduce((a, b) => (b.value > a.value ? b : a));
  const best = all.reduce((a, b) => (b.value < a.value ? b : a));
  const draw = (width) => shareDots({ sections, ref: 0.5, labels: { ref: t('placeMeasuresRef') }, max: 1, width, format: (v) => pct(v, 0), band: SHARE_BAND });
  const art = both(draw);
  return figure({
    n: next(), source, alt: t('placeMeasuresAlt'), ...art, csvName: `hacrp-${place.kind}-${place.key}-measures`,
    takeaway: fill('placeMeasuresTakeaway', { worst: worst.label, worstShare: worst.valueText, best: best.label, bestShare: best.valueText }),
    table: {
      columns: [{ name: t('colMeasure') }, { name: t('fig2ColN'), numeric: true }, { name: t('placeMeasuresRef'), numeric: true }],
      rows: all.map((r) => [r.label, num(count(r.n), r.n), num(r.valueText, r.value)]),
    },
  });
}

// A place's children (a region's divisions, a division's states, a state's metro areas and the rest of the state), as
// a table: each a link with its counts, share bar and middle score.
// money: { head, cell(ccns) -> the cell's text or markup } adds a column of this site's estimated cut for each child
// (the place pages pass it); null for none.
export function childrenTable({ place, places, nation, money = null }) {
  const kids = place.children.map((id) => places.places.get(id));
  if (place.kind === 'state') {
    const inMetro = new Set(kids.flatMap((k) => k.ccns));
    const rest = place.rows.filter((r) => !inMetro.has(r.ccn));
    const restCcns = place.ccns.filter((c) => !inMetro.has(c));
    if (rest.length) kids.push({ name: t('placeOutside'), path: null, ccns: restCcns, counts: placeCounts(rest, restCcns.length) });
  }
  if (!kids.length) return null;
  const heading = t({ region: 'placeChildrenRegion', division: 'placeChildrenDivision', state: 'placeChildrenState' }[place.kind]);
  return html`<section class="block place__kids" aria-labelledby="kids-h">
<h2 id="kids-h" class="psec__title">${heading}</h2>
<p class="small muted">${t('placeChildrenIntro')}</p>
${printout(html`<table class="gb gb--kids" aria-labelledby="kids-h">
<thead><tr><th scope="col">${t('placeColPlace')}</th><th scope="col" class="num">${t('figColDecided')}</th><th scope="col" class="num">${t('figColCut')}</th><th scope="col">${t('figColShare')}</th><th scope="col" class="num">${t('placeColMedian')}</th>${money ? html`<th scope="col" class="num">${money.head}</th>` : ''}</tr></thead>
<tbody>${kids.map((k) => {
    const c = k.counts;
    const share = c.decided ? c.yes / c.decided : 0;
    return html`<tr><th scope="row">${k.path ? html`<a href="${k.path}">${k.name}</a>` : k.name}</th><td class="num">${count(c.decided)}</td><td class="num">${count(c.yes)}</td><td><span class="kids__share"><span class="browse__bar" style="--share: ${share.toFixed(3)}; --nation: ${nation.toFixed(3)}" aria-hidden="true"></span><span class="kids__pct">${c.decided ? pct(share, 1) : '—'}</span></span></td><td class="num">${c.median === null ? '—' : cmsText(decimal(c.median, DP))}</td>${money ? html`<td class="num kids__money">${money.cell(k.ccns)}</td>` : ''}</tr>`;
  })}</tbody>
</table>`)}
</section>`;
}
