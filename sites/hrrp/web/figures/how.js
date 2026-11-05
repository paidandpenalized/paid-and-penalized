// Ported from Thirty Day Readmissions (web/src/js/views/explainer.js at 33d1959), after HACRP's program page (sites/hacrp/web/program-figures.js).
// The program page's "How it works" Part: its line, the two callouts, then Steps 1 to 4. Step 1's punch card and Step 3's
// columns are drawn with the chart kit inside figure(), a phone drawing and a wide one; Step 2's swarm (figures/swarm.js) has the old
// site's condition switch (client/program.js); Step 4's medians are a table, open, as the old site had it; Step 5 is Worksheet R for the example
// hospital, drawn on the server, with a box that swaps the hospital in the browser (client/worksheet.js), and the waterfall under it
// (figures/waterfall.js), which the box redraws with the sheet.
import { CAP_PCT, CONDS, MIN_DISCHARGES } from '../../../../engine/js/hrrp/formula.js';
import { columns } from '../../../../web/charts/columns.js';
import { WIDE, drawn, figure, num } from '../../../../web/charts/figure.js';
import { punchCard } from '../../../../web/charts/punchCard.js';
import { searchForm } from '../../../../web/render/shell.js';
import { printout } from '../../../../web/render/components.js';
import { capitalize, count, listText, noun, pct, shownAbove, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { conditionShort } from '../derive.js';
import { fmtInt, fmtPct, ratio } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { hospitals, inSentence } from '../wording.js';
import { worksheetHtml } from '../worksheet.js';
import { swarmFigure } from './swarm.js';
import { waterfallFigure } from './waterfall.js';

// Punch card: the largest sets each get a column; the rest are pooled.
const KEEP = 12;
// The least width, in drawing units, between two labeled cutoffs on the dual-share axis; a closer one goes unlabeled.
const TICK_GAP = 26;
const COLUMNS_HEIGHT = 150;
// The claim a "New for" note names in the content file (its `claim` field), and the line that says where the note comes from.
export const NOTE_SOURCES = Object.freeze({ 'HRRP-14': 'newForSource', 'HRRP-19': 'newForSourceWindow', 'HRRP-20': 'newForSourceCovid' });
const BAR_CLASS = 'chart-col';
// A peer group's tone on the dual-share columns and in their key: the class's last part is the group's number (tokens.css --grp-N).
const GROUP_CLASS = 'chart-col--g';
const SWATCH_CLASS = 'swatch-g';

// A condition's label on the punch card's rows: CMS's abbreviation (the key, with the slash of hip and knee).
const abbr = (key) => key.replace('_', '/');

// A step of the Part: its number, heading and words beside its figure (stacked on a phone).
// wide: the figure runs the page's width under the words (a table or a worksheet, too wide for the right column).
const step = ({ n, id, heading, text, fig = null, wide = false }) => html`<section class="hstep${wide ? ' hstep--wide' : ''}" id="${id}" aria-labelledby="${id}-h">
<div class="hstep__text">
<p class="hstep__n" aria-hidden="true">${String(n)}</p>
<p class="hstep__label vh">${fill('stepLabel', { n: String(n) })}</p>
<h3 class="hstep__title" id="${id}-h">${heading}</h3>
${text}
</div>
${fig && html`<div class="hstep__fig">
${fig}
</div>
`}</section>`;

// ---------- Step 1 ----------

function punchFigure({ sets, conditions, edition, n }) {
  const kept = sets.sets.slice(0, KEEP);
  const rest = sets.sets.slice(KEEP);
  const sum = (list, k) => list.reduce((s, c) => s + c[k], 0);
  const nation = sets.yes / sets.measured;
  const name = (conds) => listText(conds.map((k) => conditionShort(conditions, k)));
  const shareOf = (yes, total) => ({ shareText: pct(yes / total, 0), hot: shownAbove(yes / total, nation, 0) });
  const cols = [
    ...kept.map((c) => ({ holes: c.conds.map((k) => CONDS.indexOf(k)), n: c.n, yes: c.yes, nText: count(c.n), ...shareOf(c.yes, c.n), tip: fill('fig1Tip', { set: name(c.conds), hospitals: hospitals(c.n), yes: count(c.yes) }) })),
    ...(rest.length ? [{ holes: null, n: sum(rest, 'n'), yes: sum(rest, 'yes'), nText: count(sum(rest, 'n')), ...shareOf(sum(rest, 'yes'), sum(rest, 'n')), tip: fill('fig1TipOther', { sets: noun(rest.length, 'rarer set'), hospitals: hospitals(sum(rest, 'n')), yes: count(sum(rest, 'yes')) }) }] : []),
    ...(sets.none ? [{ holes: null, empty: true, n: sets.none, yes: 0, nText: count(sets.none), tip: fill('fig1TipNone', { hospitals: hospitals(sets.none) }) }] : []),
  ];
  const rows = CONDS.map((k) => ({ label: abbr(k), total: sets.rows[k], totalText: count(sets.rows[k]) }));
  const labels = { other: t('fig1Other'), none: t('fig1None'), totals: t('fig1Totals'), share: t('fig1Share') };
  const byRows = Object.entries(sets.rows).sort((a, b) => b[1] - a[1]);
  const [top, bottom] = [byRows[0], byRows[byRows.length - 1]];
  const abbrs = listText(CONDS.filter((k) => abbr(k) !== conditionShort(conditions, k)).map((k) => `${abbr(k)} is ${inSentence(conditionShort(conditions, k))}`));
  const tableRows = [
    ...sets.sets.map((c) => [name(c.conds), num(count(c.n), c.n), num(count(c.yes), c.yes)]),
    ...(sets.none ? [[t('fig1None'), num(count(sets.none), sets.none), num('0', 0)]] : []),
  ];
  const fig = figure({
    n, source: fill('fig1Source', { edition }), alt: t('fig1Alt'), csvName: 'hrrp-measure-sets',
    takeaway: fill('fig1Takeaway', {
      top: conditionShort(conditions, top[0]), nTop: count(top[1]), bottom: inSentence(conditionShort(conditions, bottom[0])), nBottom: count(bottom[1]),
      measured: count(sets.measured), n: count(sets.measured + sets.none), none: count(sets.none),
    }),
    ...drawn((width) => punchCard({ rows, columns: cols, labels, width }), WIDE),
    table: { columns: [{ name: t('fig1ColSet') }, { name: t('fig1ColN'), numeric: true }, { name: t('fig1ColYes'), numeric: true }], rows: tableRows },
  });
  // The note on reading the holes goes with the step's words, not under the chart: it would stretch the figure's column.
  return { fig, note: fill('fig1Key', { abbrs }) };
}

// ---------- Step 3 ----------

// The cutoffs to label at this drawing width: left to right, each one at least TICK_GAP units from the last one labeled.
function labeled(ticks, top, width) {
  const pitch = (width - 12) / top;
  const out = [];
  for (const v of ticks) if (!out.length || (v - out[out.length - 1]) * pitch >= TICK_GAP) out.push(v);
  return out;
}

// The peer group (1 to 5) a one-point bin falls in, by its middle.
const groupOf = (bands, bin) => bands.find((b) => bin.x0 + 0.5 < b.x1)?.peer ?? bands.length;

// The figure and the line about its axis marks, which goes with the step's words (it would stretch the figure's column).
function dualFigure({ dual, edition, n }) {
  const bins = dual.bins.map((b) => ({ ...b, cls: `${BAR_CLASS} ${GROUP_CLASS}${groupOf(dual.bands, b)}`, tip: fill('fig2Tip', { from: `${b.x0}%`, to: `${b.x1}%`, n: count(b.n) }) }));
  const draw = (width) => columns({
    bins, domain: [0, dual.top], ticks: labeled(dual.ticks, dual.top, width), format: (v) => `${Math.round(v)}%`, width, height: COLUMNS_HEIGHT, stagger: true,
    bands: dual.bands.map((b) => ({ x0: b.x0, x1: b.x1, label: fill('fig2Band', { n: String(b.peer) }) })),
  });
  const sizes = dual.groups.map((g) => g.n);
  const key = dual.groups.map((g) => ({ cls: `${SWATCH_CLASS}${g.peer}`, label: fill('fig2Key', { n: String(g.peer), from: fmtPct(g.lo * 100, 0), to: fmtPct(g.hi * 100, 0) }) }));
  const fig = figure({
    n, source: fill('fig2Source', { edition }), alt: t('fig2Alt'), csvName: 'hrrp-dual-share', key,
    takeaway: fill('fig2Takeaway', { min: fmtInt(Math.min(...sizes)), max: fmtInt(Math.max(...sizes)), n: fmtInt(dual.n) }),
    ...drawn(draw, WIDE),
    table: {
      columns: [{ name: t('fig2ColShare') }, { name: t('fig2ColN'), numeric: true }],
      rows: dual.bins.map((b) => [fill('dualRange', { from: `${b.x0}%`, to: `${b.x1}%` }), num(count(b.n), b.n)]),
    },
  });
  return { fig, note: fill('fig2Note', { cutoffs: listText(dual.ticks.map((v) => `${Math.round(v)}%`)) }) };
}

// ---------- Step 4 ----------

// The peer-group medians: a row for each group, labeled with its dual-share range, a column for each condition at four
// decimals, as CMS publishes them; a median above one is shaded. On the program page the table is open under its title
// and the note; with collapsed (Methods) it sits in a disclosure. rows: how-data.js mediansRows().
export function mediansTable({ rows, conditions, edition, collapsed = false }) {
  const table = printout(html`<table class="gb meds__table">
<thead><tr><th scope="col">${t('medsGroup')}</th>${CONDS.map((k) => html`<th scope="col" class="num">${conditionShort(conditions, k)}</th>`)}</tr></thead>
<tbody>${rows.map((r) => html`<tr><th scope="row">${fill('medsRow', { n: String(r.peer), from: fmtPct(r.lo * 100, 0), to: fmtPct(r.hi * 100, 0) })}</th>${r.cells.map(({ value }) => html`<td class="num${value > 1 ? ' hi' : ''}">${value === null ? t('medsMissing') : ratio(value)}</td>`)}</tr>`)}</tbody>
</table>`);
  return collapsed
    ? html`<details class="meds">
<summary>${fill('medsSummary', { edition })}</summary>
${table}
</details>`
    : html`<div class="meds">
<p class="meds__title">${fill('medsTitle', { edition })}</p>
<p class="meds__note">${fill('medsNote', { one: ratio(1, 1) })}</p>
${table}
</div>`;
}

// ---------- the callouts ----------

// "New for <FY>": the notes for this fiscal year; '' when the notes are for another year (items null).
export const calloutNewFor = ({ items, edition }) => (items
  ? html`<aside class="callout" aria-labelledby="callout-new-h">
<p class="callout__title cap" id="callout-new-h">${fill('newForTitle', { edition })}</p>
<ul>${items.map((i) => html`<li><b>${i.title}</b> ${i.body}</li>`)}</ul>
</aside>`
  : '');

// The one "Sources" disclosure under the two callouts: a line for each note that names a claim (the lines carry the claim
// ids, so the copy gate still ties them to CLAIMS.md). '' when there are none.
export function calloutSources({ items, edition }) {
  const lines = [...new Set((items ?? []).map((i) => i.claim).filter((c) => Object.hasOwn(NOTE_SOURCES, c)))];
  return lines.length
    ? html`<details class="srcs">
<summary>${t('sourcesTitle')}</summary>
${lines.map((c) => html`<p class="small muted">${fill(NOTE_SOURCES[c], { edition })}</p>
`)}</details>`
    : '';
}

// "Who is in the program": the hospital count rounded to the hundred, and who is out.
export const calloutWho = ({ rounded }) => html`<aside class="callout callout--ink" aria-labelledby="callout-who-h">
<p class="callout__title cap" id="callout-who-h">${t('whoTitle')}</p>
<p>${fill('whoText', { n: fmtInt(rounded) })}</p>
</aside>`;

// ---------- the Part ----------

// The hospital box above Worksheet R (client/worksheet.js mounts it), the sheet it swaps and the waterfall under the sheet, which it
// redraws too. src: the hospitals asset the box searches; sheetSrc: the worksheet asset the swapped sheet is computed from (data-src
// on the holder: fetched when a hospital is picked). null: no box, only the example. figureN: the waterfall's figure number, kept on
// its holder for the redraw.
function worksheetStep({ how, edition, estimateTag, hospitalsUrl, sheetSrc, figureN }) {
  const sheet = worksheetHtml(how.worksheet, { edition, conditions: how.conditions, dollars: { payShort: how.payShort, tag: estimateTag } });
  const fig = waterfallFigure({ rows: how.worksheet, conditions: how.conditions, n: figureN, edition });
  return html`${hospitalsUrl && sheetSrc && searchForm({ id: 'ws-pick', src: hospitalsUrl, label: t('wsPickLabel'), find: t('searchFind'), findRest: t('wsPickLabel'), placeholder: t('wsPickPlaceholder') })}
<div class="wsr-holder" id="worksheet"${sheetSrc ? html` data-src="${sheetSrc}" data-context="${JSON.stringify({ edition, conditions: how.conditions, payShort: how.payShort })}"` : ''}>
${sheet}
</div>
<div class="wf-holder" data-figure-n="${String(figureN)}">
${fig}
</div>`;
}

// how: view.how (how-data.js howData); figure: the page's figure counter; edition: the edition's label; estimateTag: the
// estimate tag beside a modeled dollar figure; hospitalsUrl and worksheetUrl: the assets Worksheet R's box reads.
export function howPart(how, { figure: nextFigure, edition, estimateTag = '', hospitalsUrl = null, worksheetUrl = null }) {
  const { conditions } = how;
  const words = capitalize(spelled(CONDS.length));
  const punch = punchFigure({ sets: how.sets, conditions, edition, n: nextFigure() });
  const swarm = swarmFigure({ how, edition, n: nextFigure() });
  const dual = dualFigure({ dual: how.dual, edition, n: nextFigure() });
  const waterfallN = nextFigure();
  return html`<p class="part__intro">${fill('howIntro', { edition })}</p>
<div class="hgrid">
${calloutNewFor({ items: how.newFor, edition })}
${calloutWho({ rounded: how.rounded })}
</div>
${calloutSources({ items: how.newFor, edition })}
${step({
    n: 1, id: 'step-1', heading: fill('step1Title', { words }),
    text: html`<p>${fill('step1Text', { words: spelled(CONDS.length), minCases: String(MIN_DISCHARGES) })}</p>
<p class="small muted">${punch.note}</p>`,
    fig: punch.fig,
  })}
${step({
    n: 2, id: 'step-2', heading: t('step2Title'),
    text: html`<p>${fill('step2Text', { one: ratio(1, 1) })}</p>
<p>${fill('step2Medians', { lo: ratio(how.span.lo), hi: ratio(how.span.hi) })}</p>
<p>${t('step2Line')}</p>`,
    fig: swarm,
  })}
${step({
    n: 3, id: 'step-3', heading: t('step3Title'),
    text: html`<p>${t('step3Text')}</p>
<p class="small muted">${dual.note}</p>`,
    fig: dual.fig,
  })}
${step({
    n: 4, id: 'step-4', heading: t('step4Title'), wide: true,
    text: html`<p>${t('step4Text')}</p>`,
    fig: mediansTable({ rows: how.medians, conditions, edition }),
  })}
${step({
    n: 5, id: 'step-5', heading: t('step5Title'), wide: true,
    text: html`<p>${fill('step5Text', { cap: String(CAP_PCT) })}</p>
<p>${t('step5Which')}</p>`,
    fig: worksheetStep({ how, edition, estimateTag, hospitalsUrl, sheetSrc: worksheetUrl, figureN: waterfallN }),
  })}`;
}
