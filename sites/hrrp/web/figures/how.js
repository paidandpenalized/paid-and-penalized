// Ported from Thirty Day Readmissions (web/src/js/views/explainer.js at 33d1959), after HACRP's program page (sites/hacrp/web/program-figures.js).
// The program page's "How it works" Part: its line, the two callouts, then Steps 1 to 4. Step 1's punch card and Step 3's
// columns are drawn with the chart kit inside figure(), a phone drawing and a wide one; Step 2's swarm is not drawn yet
// (figures/how-data.js swarmData holds its numbers); Step 4's medians are a table, collapsed.
import { CONDS, MIN_DISCHARGES } from '../../../../engine/js/hrrp/formula.js';
import { columns } from '../../../../web/charts/columns.js';
import { WIDE, drawn, figure, num } from '../../../../web/charts/figure.js';
import { punchCard } from '../../../../web/charts/punchCard.js';
import { printout } from '../../../../web/render/components.js';
import { capitalize, count, listText, pct, shownAbove, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { fmtInt, fmtPct, ratio } from '../numbers.js';
import { fill, t } from '../program/copy.js';
import { inSentence } from '../wording.js';

// Punch card: the largest sets each get a column; the rest are pooled.
const KEEP = 12;
// The least width, in drawing units, between two labeled cutoffs on the dual-share axis; a closer one goes unlabeled.
const TICK_GAP = 26;
const COLUMNS_HEIGHT = 150;
const BAR_CLASS = 'chart-col';

const shortOf = (conditions, key) => conditions.find((c) => c.key === key).short;
// A condition's label on the punch card's rows: CMS's abbreviation (the key, with the slash of hip and knee).
const abbr = (key) => key.replace('_', '/');

// A step of the Part: its number, heading and words beside its figure (stacked on a phone).
const step = ({ n, id, heading, text, fig = null }) => html`<section class="hstep" id="${id}" aria-labelledby="${id}-h">
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
  const name = (conds) => listText(conds.map((k) => shortOf(conditions, k)));
  const shareOf = (yes, total) => ({ shareText: pct(yes / total, 0), hot: shownAbove(yes / total, nation, 0) });
  const cols = [
    ...kept.map((c) => ({ holes: c.conds.map((k) => CONDS.indexOf(k)), n: c.n, yes: c.yes, nText: count(c.n), ...shareOf(c.yes, c.n), tip: fill('fig1Tip', { set: name(c.conds), n: count(c.n), yes: count(c.yes) }) })),
    ...(rest.length ? [{ holes: null, n: sum(rest, 'n'), yes: sum(rest, 'yes'), nText: count(sum(rest, 'n')), ...shareOf(sum(rest, 'yes'), sum(rest, 'n')), tip: fill('fig1TipOther', { k: count(rest.length), n: count(sum(rest, 'n')), yes: count(sum(rest, 'yes')) }) }] : []),
    ...(sets.none ? [{ holes: null, empty: true, n: sets.none, yes: 0, nText: count(sets.none), tip: fill('fig1TipNone', { n: count(sets.none) }) }] : []),
  ];
  const rows = CONDS.map((k) => ({ label: abbr(k), total: sets.rows[k], totalText: count(sets.rows[k]) }));
  const labels = { other: t('fig1Other'), none: t('fig1None'), totals: t('fig1Totals'), share: t('fig1Share') };
  const byRows = Object.entries(sets.rows).sort((a, b) => b[1] - a[1]);
  const [top, bottom] = [byRows[0], byRows[byRows.length - 1]];
  const abbrs = listText(CONDS.filter((k) => abbr(k) !== shortOf(conditions, k)).map((k) => `${abbr(k)} is ${inSentence(shortOf(conditions, k))}`));
  const tableRows = [
    ...sets.sets.map((c) => [name(c.conds), num(count(c.n), c.n), num(count(c.yes), c.yes)]),
    ...(sets.none ? [[t('fig1None'), num(count(sets.none), sets.none), num('0', 0)]] : []),
  ];
  return figure({
    n, source: fill('fig1Source', { edition }), alt: t('fig1Alt'), csvName: 'hrrp-measure-sets',
    takeaway: fill('fig1Takeaway', {
      top: shortOf(conditions, top[0]), nTop: count(top[1]), bottom: inSentence(shortOf(conditions, bottom[0])), nBottom: count(bottom[1]),
      measured: count(sets.measured), n: count(sets.measured + sets.none), none: count(sets.none),
    }),
    ...drawn((width) => punchCard({ rows, columns: cols, labels, width }), WIDE),
    note: fill('fig1Key', { abbrs }),
    table: { columns: [{ name: t('fig1ColSet') }, { name: t('fig1ColN'), numeric: true }, { name: t('fig1ColYes'), numeric: true }], rows: tableRows },
  });
}

// ---------- Step 3 ----------

// The cutoffs to label at this drawing width: left to right, each one at least TICK_GAP units from the last one labeled.
function labeled(ticks, top, width) {
  const pitch = (width - 12) / top;
  const out = [];
  for (const v of ticks) if (!out.length || (v - out[out.length - 1]) * pitch >= TICK_GAP) out.push(v);
  return out;
}

function dualFigure({ dual, edition, n }) {
  const bins = dual.bins.map((b) => ({ ...b, cls: BAR_CLASS, tip: fill('fig2Tip', { from: `${b.x0}%`, to: `${b.x1}%`, n: count(b.n) }) }));
  const draw = (width) => columns({ bins, domain: [0, dual.top], ticks: labeled(dual.ticks, dual.top, width), format: (v) => `${Math.round(v)}%`, width, height: COLUMNS_HEIGHT });
  const sizes = dual.groups.map((g) => g.n);
  return figure({
    n, source: fill('fig2Source', { edition }), alt: t('fig2Alt'), csvName: 'hrrp-dual-share',
    takeaway: fill('fig2Takeaway', { min: fmtInt(Math.min(...sizes)), max: fmtInt(Math.max(...sizes)), n: fmtInt(dual.n) }),
    ...drawn(draw, WIDE),
    note: fill('fig2Note', { cutoffs: listText(dual.ticks.map((v) => `${Math.round(v)}%`)) }),
    table: {
      columns: [{ name: t('fig2ColShare') }, { name: t('fig2ColN'), numeric: true }],
      rows: dual.bins.map((b) => [fill('dualRange', { from: `${b.x0}%`, to: `${b.x1}%` }), num(count(b.n), b.n)]),
    },
  });
}

// ---------- Step 4 ----------

// The peer-group medians in a collapsed table: a row for each group, labeled with its dual-share range, a column for each
// condition at four decimals, as CMS publishes them. Methods shows the same table.
export function mediansTable({ meta, conditions, edition = fill('editionLabel', { fy: String(meta.fy) }) }) {
  const rows = meta.peerCutoffs.map(([lo, hi], i) => ({ peer: i + 1, lo, hi, cells: CONDS.map((k) => meta.peerMedians[i + 1]?.[k] ?? null) }));
  return html`<details class="meds">
<summary>${fill('medsSummary', { edition })}</summary>
${printout(html`<table class="gb">
<thead><tr><th scope="col">${t('medsGroup')}</th>${CONDS.map((k) => html`<th scope="col" class="num">${shortOf(conditions, k)}</th>`)}</tr></thead>
<tbody>${rows.map((r) => html`<tr><th scope="row">${fill('medsRow', { n: String(r.peer), from: fmtPct(r.lo * 100, 0), to: fmtPct(r.hi * 100, 0) })}</th>${r.cells.map((v) => html`<td class="num">${v === null ? t('medsMissing') : ratio(v)}</td>`)}</tr>`)}</tbody>
</table>`)}
</details>`;
}

// ---------- the callouts ----------

// "New for <FY>": the notes for this fiscal year; '' when the notes are for another year (items null).
export const calloutNewFor = ({ items, edition }) => (items
  ? html`<aside class="callout" aria-labelledby="callout-new-h">
<p class="callout__title cap" id="callout-new-h">${fill('newForTitle', { edition })}</p>
<ul>${items.map((i) => html`<li><b>${i.title}</b> ${i.body}</li>`)}</ul>
${items.some((i) => i.title.includes('Medicare Advantage')) ? html`<p class="small muted">${fill('newForSource', { edition })}</p>` : ''}
</aside>`
  : '');

// "Who is in the program": the hospital count rounded to the hundred, and who is out.
export const calloutWho = ({ rounded }) => html`<aside class="callout callout--ink" aria-labelledby="callout-who-h">
<p class="callout__title cap" id="callout-who-h">${t('whoTitle')}</p>
<p>${fill('whoText', { n: fmtInt(rounded) })}</p>
</aside>`;

// ---------- the Part ----------

// how: view.how (how-data.js howData); figure: the page's figure counter; edition: the edition's label.
export function howPart(how, { figure: nextFigure, edition }) {
  const { conditions } = how;
  const words = capitalize(spelled(CONDS.length));
  return html`<p class="part__intro">${fill('howIntro', { edition })}</p>
<div class="hgrid">
${calloutNewFor({ items: how.newFor, edition })}
${calloutWho({ rounded: how.rounded })}
</div>
${step({
    n: 1, id: 'step-1', heading: fill('step1Title', { words }),
    text: html`<p>${fill('step1Text', { words: spelled(CONDS.length), minCases: String(MIN_DISCHARGES) })}</p>`,
    fig: punchFigure({ sets: how.sets, conditions, edition, n: nextFigure() }),
  })}
${step({
    n: 2, id: 'step-2', heading: t('step2Title'),
    text: html`<p>${fill('step2Text', { one: ratio(1, 1) })}</p>
<p>${fill('step2Medians', { lo: ratio(how.span.lo), hi: ratio(how.span.hi) })}</p>`,
  })}
${step({
    n: 3, id: 'step-3', heading: t('step3Title'),
    text: html`<p>${t('step3Text')}</p>`,
    fig: dualFigure({ dual: how.dual, edition, n: nextFigure() }),
  })}
${step({
    n: 4, id: 'step-4', heading: t('step4Title'),
    text: html`<p>${t('step4Text')}</p>`,
    fig: mediansTable({ meta: how.meta, conditions, edition }),
  })}`;
}
