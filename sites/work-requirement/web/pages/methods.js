// The work-requirement Methods page (/work-requirement/methods/): the head (kicker, heading, lede), then beside a
// contents column the sections: the four steps and the file's parameters, the three cases, what the method can't tell
// you, the lines 2 + 5 version, the other sensitivities drawn and tabled, who has no scenario, Maryland, the screens, our
// safety-net flag, the "exposed on both" rule, the sources with each pin's SHA-256, and changes and corrections; then the
// citation and the as-of line the program page closes on too. Every number comes from the scenario file (data), the
// manifest's pins it lists, or step 5's model (both); the words are methods/copy.js's.
import { citation, docSections, keepWhole, printout, sentenceOf } from '../../../../web/render/components.js';
import { count, decimal, isoDate, listText, money, ordinal, pct } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { externalLink, page } from '../../../../web/render/layout.js';
import { scenarioTag } from '../../../../web/render/shell.js';
import { SITE } from '../../../../web/site.js';
import { counter, drawn, figure, num } from '../../../../web/charts/figure.js';
import { BOTH_QUANTILE, BOTH_SHARE, S10_LINES, SCENARIOS } from '../constants.js';
import { cmsDate } from '../data.js';
import { METHODS_PATH, SOURCE_LINKS } from '../links.js';
import { methodsFacts } from '../methods/facts.js';
import { fill, t } from '../methods/copy.js';
import { sensChart } from '../methods/sens.js';
import { bothInput, bothModel } from '../program/both.js';
import { hospitalRows } from '../program/strips.js';
import { asOf, asOfPins, shellOf } from './parts.js';

const para = (text) => html`<p>${text}</p>`;
const sentence = sentenceOf(fill);
const lead = (head, body) => html`<p><strong>${t(head)}</strong> ${body}</p>`;
// A list of lead paragraphs: items [[head key, body]].
const leadList = (items) => html`<ul class="wr-meth__list">${items.map(([head, body]) => html`<li>${lead(head, body)}</li>`)}</ul>`;

// The file's alternatives (its `sensitivities`, schemas/medicaid.schema.json), in the order the table lists them after
// the decided method, each with its row's words (labelOf: the row's label, from the file's params where it names one;
// shortOf: the phone drawing's, where the label is too long for it). whatIf: the row is an end of the reader's use-rate
// what-if, not a choice of the method's, so it never counts as the choice that moves the totals most.
const next = (data) => ({ next: String(data.meta.fy + 1) });
export const SENSITIVITIES = Object.freeze([
  { key: 'line2_5', labelOf: () => fill('sens_line2_5', { a: String(S10_LINES.revenue), b: String(S10_LINES.supplemental) }) },
  { key: 'share_next_year', labelOf: (data) => fill('sens_share_next_year', next(data)), shortOf: (data) => fill('sensShort_share_next_year', next(data)) },
  { key: 'share_net_of_dsh', labelOf: () => t('sens_share_net_of_dsh') },
  { key: 'use_0.75', labelOf: (data) => fill('sens_use_low', { pct: pct(data.params.use_min, 0) }), whatIf: true },
  { key: 'use_1.25', labelOf: (data) => fill('sens_use_high', { pct: pct(data.params.use_max, 0) }), whatIf: true },
  { key: 'state_share_only', labelOf: () => t('sens_state_share_only'), shortOf: () => t('sensShort_state_share_only') },
]);

// The use rate's two sensitivities are the what-if's ends: the file's keys name them, so a change to either end would
// leave the label wrong. Throws on a mismatch.
function checkUseKeys(params) {
  for (const [key, v] of [['use_0.75', params.use_min], ['use_1.25', params.use_max]]) {
    if (Number(key.slice(4)) !== v) throw new RangeError(`work requirement Methods: sensitivity ${key} is not the use rate's end, ${v}`);
  }
}

// The method's own choices (not the what-if's ends) that move the middle case's revenue lost most from the decided
// method's: one label, or two when the top two moves print as the same amount (money(), as the table prints them), so
// rounding noise never names one. base: the decided method's middle; alts: [{ label, middle, whatIf }]. Pure.
export function mostMoved(base, alts) {
  const moves = alts.filter((r) => !r.whatIf).map((r) => ({ label: r.label, by: Math.abs(r.middle - base) }))
    .sort((a, b) => b.by - a.by);
  if (!moves.length) throw new RangeError('work requirement Methods: no method alternative to compare');
  const [first, second] = moves;
  return second && money(first.by) === money(second.by) ? [first.label, second.label] : [first.label];
}

// ---------- the sections ----------

function stepsSection(data, facts) {
  const p = data.params;
  const v = {
    fy: String(data.meta.fy), line: String(S10_LINES.revenue), cost: String(S10_LINES.cost), days: count(p.min_medicaid_days),
    useDefault: pct(p.use_default, 0), useMin: pct(p.use_min, 0), useMax: pct(p.use_max, 0), cap: count(p.max_cost_ratio),
    uninsured: pct(p.uninsured_share, 0), still: pct(p.care_still_used, 0), notUsed: pct(1 - p.care_still_used, 0),
  };
  const rows = [
    ['pBase', fill('pBaseV', { fy: v.fy }), 'pBaseFrom'],
    ['pUninsured', v.uninsured, 'pUninsuredFrom'],
    ['pStill', v.still, 'pStillFrom'],
    ['pUse', fill('pUseV', { min: v.useMin, max: v.useMax, def: v.useDefault }), 'pUseFrom'],
    ['pCap', fill('pCapV', { n: v.cap }), 'pCapFrom'],
    ['pDays', fill('pDaysV', { n: v.days }), 'pDaysFrom'],
    ['pPart', fill('pPartV', { n: count(p.part_year_days) }), 'pPartFrom'],
    ['pFence', fill('pFenceV', { n: count(p.margin_fence_iqr) }), 'pFenceFrom'],
    ['pMiur', fill('pMiurV', { n: count(p.miur_sds) }), 'pFlagFrom'],
    ['pRev', fill('pRevV', { share: pct(p.low_income_share, 0) }), 'pFlagFrom'],
  ];
  return {
    id: 'steps', heading: t('stepsHeading'), body: html`${para(fill('stepsText', { fy: v.fy, n: count(facts.scenario) }))}
<ol class="wr-meth__steps">
<li>${lead('step1Head', fill('step1', { line: v.line, fy: v.fy, days: v.days }))}</li>
<li>${lead('step2Head', fill('step2', { useDefault: v.useDefault, useMin: v.useMin, useMax: v.useMax }))}</li>
<li>${lead('step3Head', fill('step3', { cost: v.cost, line: v.line, cap: v.cap, uninsured: v.uninsured, still: v.still, notUsed: v.notUsed }))}</li>
<li>${lead('step4Head', fill('step4', { fy: v.fy }))}</li>
</ol>
<h3 class="wr-meth__sub">${t('sharesSub')}</h3>
${para(fill('sharesUninsured', { uninsured: v.uninsured }))}
${para(fill('sharesStill', { still: v.still, drop: v.notUsed }))}
${para(fill('sharesUse', { useDefault: v.useDefault }))}
${printout(html`<table class="gb wr-meth__params">
<caption class="vh" id="wr-params-cap">${t('paramsCaption')}</caption>
<thead><tr><th scope="col">${t('paramsColName')}</th><th scope="col">${t('paramsColValue')}</th><th scope="col">${t('paramsColFrom')}</th></tr></thead>
<tbody>${rows.map(([name, value, from]) => html`<tr><th scope="row">${t(name)}</th><td>${value}</td><td>${t(from)}</td></tr>`)}</tbody>
</table>`)}`,
  };
}

function casesSection(data) {
  const { table } = asOfPins(data);
  const m = Object.fromEntries(data.scenarios.map((s) => [s.id, decimal(s.decline_enrollment / 1000, 1)]));
  return {
    id: 'cases', heading: t('casesHeading'), body: html`${para(fill('casesText', { table, low: m.low, middle: m.middle, high: m.high }))}
${para(t('casesMap'))}
${para(t('casesSame'))}
${para(t('casesOfficial'))}`,
  };
}

function limitsSection(data) {
  const fy = String(data.meta.fy);
  const items = [
    ['limWhenHead', fill('limWhen', { fy })], ['limStatesHead', t('limStates')], ['limWhoHead', t('limWho')], ['limServiceHead', t('limService')],
    ['limMaternityHead', t('limMaternity')], ['limIncomeHead', t('limIncome')], ['limStayHead', t('limStay')], ['limEarlyHead', fill('limEarly', { settled: pct(data.meta.hcris.settled_share, 0), fy })],
  ];
  return { id: 'limits', heading: t('limitsHeading'), body: leadList(items) };
}

function linesSection(data) {
  const a = String(S10_LINES.revenue);
  const b = String(S10_LINES.supplemental);
  const alt = data.sensitivities.line2_5;
  const base = data.national;
  return {
    id: 'lines', heading: fill('linesHeading', { a, b }), body: html`${para(fill('linesText', { a, b }))}
${para(fill('linesNumbers', {
    a, b, low: money(alt.low.lost), high: money(alt.high.lost), middle: money(alt.middle.lost),
    baseLow: money(base.low.lost), baseHigh: money(base.high.lost), baseMiddle: money(base.middle.lost),
    added: money(alt.middle.added_uncompensated), baseAdded: money(base.middle.added_uncompensated),
    falls: count(alt.middle.falls_1pp), baseFalls: count(base.middle.falls_1pp),
  }))}
${para(fill('linesWhy', { a }))}`,
  };
}

// The sensitivities: the figure (the decided method, then each alternative, a band low to high) with its table.
function sensSection(data, fig) {
  checkUseKeys(data.params);
  const row = ({ label, short = label, roll, whatIf = false }) => {
    const [low, middle, high] = SCENARIOS.map((s) => roll[s].lost);
    return { label, short, roll, low, middle, high, whatIf, tip: fill('sensTip', { label, low: money(low), high: money(high), middle: money(middle) }) };
  };
  const rows = [
    row({ label: t('sens_decided'), roll: data.national }),
    ...SENSITIVITIES.map(({ key, labelOf, shortOf = labelOf, whatIf }) => row({ label: labelOf(data), short: shortOf(data), roll: data.sensitivities[key], whatIf })),
  ];
  const [base, ...alts] = rows;
  const most = mostMoved(base.middle, alts);
  const fy = data.meta.fy;
  const chart = drawn((width) => sensChart({ rows, labels: { axis: t('sensAxis') }, width }));
  const numCell = (v) => num(money(v), v);
  return {
    id: 'sensitivities', heading: t('sensHeading'), body: html`${para(t('sensText'))}
${figure({
    n: fig(),
    takeaway: most.length === 1 ? fill('sensTakeaway', { most: most[0] }) : fill('sensTakeawayTie', { a: most[0], b: most[1] }),
    capTag: scenarioTag(fy),
    ...chart,
    alt: fill('sensAlt', { low: money(base.low), high: money(base.high), middle: money(base.middle), rows: alts.map((r) => fill('sensAltRow', { label: r.label, low: money(r.low), high: money(r.high), middle: money(r.middle) })).join(' ') }),
    note: t('sensNote'),
    source: fill('sensSource', { fy: String(fy) }),
    claimLevel: 'hypothetical',
    csvName: 'work-requirement-sensitivities',
    table: {
      columns: [
        { name: t('sensColVersion'), numeric: false }, { name: t('sensColLow'), numeric: true }, { name: t('sensColMiddle'), numeric: true },
        { name: t('sensColHigh'), numeric: true }, { name: t('sensColAdded'), numeric: true }, { name: t('sensColFalls'), numeric: true },
      ],
      rows: rows.map(({ label, roll, low, middle, high }) => [label, numCell(low), numCell(middle), numCell(high),
        numCell(roll.middle.added_uncompensated), num(count(roll.middle.falls_1pp), roll.middle.falls_1pp)]),
    },
  })}
${para(t('sensDsh'))}`,
  };
}

function noneSection(data, facts) {
  const fy = String(data.meta.fy);
  const hospitalsOf = (cls) => count(facts.byClass[cls] ?? 0);
  const notExp = facts.states.not_expansion ?? [];
  const territories = facts.states.territory ?? [];
  return {
    id: 'none', heading: t('noneHeading'), body: html`${para(fill('noneText', { n: count(notExp.length), list: listText(notExp), h: hospitalsOf('not_expansion') }))}
${para(t('noneGeorgia'))}
${(facts.states.no_viii_group ?? []).map((state) => para(fill('noneWisconsin', { state, n: hospitalsOf('no_viii_group') })))}
${territories.length ? para(fill('noneTerritories', { list: listText(territories), n: hospitalsOf('territory') })) : ''}
${para(fill('noneNoReport', { n: hospitalsOf('no_cost_report'), fy }))}
${facts.latest4.length ? para(fill('noneQuarters', { states: listText(facts.latest4), fy })) : ''}
${para(t('noneMaryland'))}`,
  };
}

function marylandSection(facts) {
  return {
    id: 'maryland', heading: t('mdHeading'), body: html`${para(t('mdText'))}
${para(fill('mdUcc', { n: count(facts.byClass.all_payer ?? 0) }))}
${para(sentence('mdHscrc', { link: externalLink(SOURCE_LINKS.hscrcDeck, t('mdHscrcLink')) }))}`,
  };
}

function screensSection(data, facts) {
  const p = data.params;
  const n = (flag) => count(facts.flagged(flag));
  const items = [
    ['scrFilingHead', fill('scrFiling', { n: count(facts.filingErrors) })],
    ['scrOutliersHead', fill('scrOutliers', { iqr: count(p.margin_fence_iqr), n: n('margin_outlier') })],
    ['scrFloorHead', fill('scrFloor', { days: count(p.min_medicaid_days), n: n('few_medicaid_days') })],
    ['scrPartHead', fill('scrPart', { days: count(p.part_year_days), n: n('part_year') })],
    ['scrCapHead', fill('scrCap', { cap: count(p.max_cost_ratio), n: n('cost_ratio_capped') })],
    ['scrNoneHead', fill('scrNone', { a: String(S10_LINES.revenue), n: n('no_medicaid_revenue') })],
  ];
  return {
    id: 'screens', heading: t('scrHeading'), body: html`${para(fill('scrIntro', { total: count(facts.scenario) }))}
${leadList(items)}`,
  };
}

function safetySection(data, facts) {
  return {
    id: 'safety', heading: t('safetyHeading'), body: html`${para(fill('safetyText', {
      sds: count(data.params.miur_sds), a: String(S10_LINES.revenue), b: String(S10_LINES.supplemental), share: pct(data.params.low_income_share, 0),
    }))}
${para(fill('safetyCount', { n: count(facts.safetyNet.all), s: count(facts.safetyNet.scenario) }))}`,
  };
}

function bothSection(data, both) {
  const pfy = String(data.meta.penaltyFy);
  return {
    id: 'both', heading: t('bothHeading'), body: html`${para(fill('bothText', { share: pct(BOTH_SHARE, 0), pfy, pctile: ordinal(Math.round(BOTH_QUANTILE * 100)), cut: pct(both.cut, 3) }))}
${para(fill('bothPop', { n: count(both.pts.length), pfy }))}`,
  };
}

// The sources: the file's pins in three groups (data.js loadSourceGroups), each a table of file, the source's own date,
// the day it was retrieved and its full SHA-256, labeled by its heading (as the parameters table by its caption's id: the
// family's figure script makes a table's scroll box a keyboard stop only when the table is named); then the published
// sources the claims quote, and the code.
function sourcesSection(data, sources) {
  const byId = new Map(data.pins.map((p) => [p.id, p]));
  const fileCell = (p) => {
    const href = p.landingPage || p.downloadUrl;
    return href ? externalLink(href, p.title) : p.title;
  };
  const group = (key) => (sources[key].length ? html`<h3 class="wr-meth__sub" id="wr-src-${key}">${t(`srcGroup_${key}`)}</h3>
${printout(html`<table class="gb wr-meth__pins" aria-labelledby="wr-src-${key}">
<thead><tr><th scope="col">${t('srcColFile')}</th><th scope="col">${t('srcColDate')}</th><th scope="col">${t('srcColGot')}</th><th scope="col">${t('srcColHash')}</th></tr></thead>
<tbody>${sources[key].map((id) => {
    const p = byId.get(id);
    if (!p) throw new RangeError(`work requirement Methods: source ${id} is not among the file's pins`);
    const date = cmsDate(p);
    return html`<tr><th scope="row">${fileCell(p)}</th><td class="nw">${date ? isoDate(date) : t('srcNoDate')}</td><td class="nw">${isoDate(p.retrieved)}</td><td class="wr-meth__hash"><code>${p.sha256}</code></td></tr>`;
  })}</tbody>
</table>`)}` : '');
  const published = [['srcLaw', 'law'], ['srcRule', 'rule'], ['srcCbo', 'cbo'], ['srcUrban', 'urban'], ['srcCwf', 'cwf'], ['srcPathways', 'pathways'], ['srcHscrc', 'hscrc'], ['srcHscrcDeck', 'hscrcDeck']];
  return {
    id: 'sources', heading: t('srcHeading'), body: html`${para(t('srcText'))}
${group('scenario')}
${group('hospitals')}
${group('penalties')}
<h3 class="wr-meth__sub">${t('srcPublishedSub')}</h3>
<ul class="wr-meth__links">${published.map(([key, link]) => html`<li>${externalLink(SOURCE_LINKS[link], t(key))}</li>`)}</ul>
${para(sentence('srcCode', { repo: externalLink(SITE.repo, t('srcCodeLink')) }))}`,
  };
}

const changesSection = (data) => ({
  id: 'changes', heading: t('changesHeading'), body: para(sentence('changesText', { log: html`<a href="${SITE.pages.corrections}">${t('changesLog')}</a>` }, { v: String(data.meta.methodsVersion) })),
});

// The citation: the site, the page's title, its canonical URL, the methods version and the day the numbers changed. No
// access date: the page has no clock.
function citeBlock(data) {
  const date = isoDate(data.meta.changed);
  const text = fill('citeText', { site: SITE.name, title: t('methodsHeading'), url: SITE.origin + METHODS_PATH, v: String(data.meta.methodsVersion), date });
  return citation({ heading: t('citeHeading'), text: keepWhole(text, [date]), button: t('citeCopy'), copied: t('citeCopied'), failed: t('citeFailed') });
}

// robots: null for an indexable page, else the meta robots value; assets: the build's paths; data: loadMedicaid()'s
// result; sources: the file's sources grouped (data.js loadSourceGroups; tests may pass sourceGroups'); both: step 5's
// model (both.js bothModel; built here from data when not given).
export function methodsPage({ data, robots, assets, sources, both }) {
  if (!sources) throw new TypeError('work requirement Methods: sources (data.js loadSourceGroups) is required');
  const rows = both ? null : hospitalRows(data);
  const model = both ?? bothModel(rows, bothInput(data, rows));
  const facts = methodsFacts(data);
  const fig = counter();
  const sections = [
    stepsSection(data, facts), casesSection(data), limitsSection(data), linesSection(data), sensSection(data, fig), noneSection(data, facts),
    marylandSection(facts), screensSection(data, facts), safetySection(data, facts), bothSection(data, model), sourcesSection(data, sources), changesSection(data),
  ];
  const body = html`<article class="wrap page wr-meth">
<header class="page__head">
<p class="cap kicker">${t('methodsKicker')}</p>
<h1>${t('methodsHeading')}</h1>
<p class="wr-meth__lede">${fill('methodsLede', { fy: String(data.meta.fy) })}</p>
</header>
${docSections({ contents: t('contentsHeading'), sections })}
${citeBlock(data)}
${asOf(data)}
</article>`;
  return page({
    title: `${t('methodsHeading')} · ${SITE.name}`,
    description: t('methodsDescription'),
    path: METHODS_PATH,
    robots,
    body,
    scripts: [assets.js.figure, assets.js.cite],
    assets,
    ...shellOf({ current: 'methods' }),
  });
}
