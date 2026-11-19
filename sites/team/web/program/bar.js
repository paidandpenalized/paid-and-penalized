// Part 4, the bar to beat: CMS's regional preliminary target prices. Beside the words, a picker of episode types (a real
// <select>, server-rendered on constants.js BAR_DRG) and that episode type's price in the region of the hospital the
// calculator starts with, in large type; Figure 4, the nine census regions shaded by the picked episode type's price
// (web/charts/divisionMap.js), that hospital's region outlined; and under them, in a disclosure, every episode type's price
// in every region, grouped by category with each category's All row. Regions are shaded, never hospitals. Without a script
// the page shows BAR_DRG and the whole table; client/bar.js redraws the map, the price, the sentence and the figure's
// table from the big table's own cells when the pick changes, so the two never disagree. Every price is the emitted file's.
import { CATEGORIES } from '../../../../engine/js/team/params.js';
import { DIVISIONS } from '../../../../engine/js/divisions.js';
import { divisionMap } from '../../../../web/charts/divisionMap.js';
import { drawn, figure, num } from '../../../../web/charts/figure.js';
import { printout, sentenceOf } from '../../../../web/render/components.js';
import { capitalize, count, isoDate, listText, roundedDollars, spelled } from '../../../../web/render/format.js';
import { html } from '../../../../web/render/html.js';
import { BAR_DRG, PY2_START } from '../constants.js';
import { fill, t } from '../copy.js';
import { partOf } from '../pages/parts.js';
import { DIVISION_NUMBERS, divisionName, extremes } from './bar-data.js';

const yearOf = (iso) => iso.slice(0, 4);
const sentence = sentenceOf(fill);
// A part of a sentence the page's script rewrites: its text in a span it finds by data-bar.
const live = (key, text) => html`<span data-bar="${key}">${text}</span>`;
const catWords = (cat) => t(`cat${cat}`);

// The price file's episode types by category, in the pages' category order, each category's DRGs in number order:
// [{ cat, drgs: ['469', '470', …] }].
export function drgsByCategory(team) {
  return CATEGORIES.map((cat) => ({
    cat,
    drgs: Object.keys(team.drgCategory).filter((drg) => team.drgCategory[drg] === cat).sort((a, b) => Number(a) - Number(b)),
  }));
}

// The region of the hospital the calculator starts with (the emitter's rule-picked default): its division number.
export function readerDivision(team) {
  const row = team.participants.find((p) => p.ccn === team.defaultCcn);
  if (!row) throw new RangeError('TEAM: the default hospital is not among the participants');
  return row.division;
}

// The picker: a label and a select of every episode type, grouped by category, BAR_DRG selected. Hidden until the page's
// script runs, since without it a pick would change nothing.
const picker = (team) => html`<p class="tm-pick" data-bar-picker hidden><label for="bar-drg">${t('barPick')}</label>
<select id="bar-drg" data-bar-pick>${drgsByCategory(team).map(({ cat, drgs }) => html`<optgroup label="${capitalize(catWords(cat))}" data-cat="${catWords(cat)}">${drgs.map((drg) => html`<option value="${drg}"${drg === BAR_DRG ? html` selected` : ''}>${fill('barPickOption', { drg, cat: catWords(cat) })}</option>`)}</optgroup>`)}</select></p>`;

// The picked episode type's price in the reader's region, large, and the sentence that says what it is: one paragraph,
// read out again, whole and once, when the pick changes (aria-atomic: the script rewrites it a span at a time).
function now(team, reader) {
  const cat = team.drgCategory[BAR_DRG];
  return html`<p class="tm-now" aria-live="polite" aria-atomic="true"><span class="tm-now__price">${live('price', roundedDollars(team.prices[BAR_DRG][reader]))}</span>
<span class="tm-now__says">${sentence('barSays', { drg: live('drg', BAR_DRG), cat: live('cat', catWords(cat)) }, { year: yearOf(PY2_START), division: divisionName(reader) })}</span></p>`;
}

function mapFigure({ team, atlas, reader, n }) {
  const values = team.prices[BAR_DRG];
  const { lo, hi } = extremes(values);
  const words = {
    price: roundedDollars,
    name: divisionName,
    tip: (div, v) => `${divisionName(div)}: ${roundedDollars(v)}`,
    legend: { title: t('barLegend'), low: t('barLow'), high: t('barHigh') },
  };
  const takeaway = sentence('barTakeaway', {
    drg: live('drg', BAR_DRG), cat: live('cat', catWords(team.drgCategory[BAR_DRG])),
    lo: live('lo', roundedDollars(values[lo])), loName: live('loName', divisionName(lo)),
    hi: live('hi', roundedDollars(values[hi])), hiName: live('hiName', divisionName(hi)),
  }, { year: yearOf(PY2_START), n: spelled(DIVISIONS.length) });
  return figure({
    n,
    takeaway,
    ...drawn((width) => divisionMap({ topo: atlas, values, reader, words, width })),
    note: fill('barNote', { division: divisionName(reader) }),
    source: fill('barSource', { year: yearOf(PY2_START), date: isoDate(team.meta.pricesDated) }),
    alt: t('barAlt'),
    csvName: 'team-regional-prices',
    table: {
      columns: [{ name: t('barColRegion') }, { name: t('barColStates') }, { name: t('barColPrice'), numeric: true }],
      rows: DIVISION_NUMBERS.map((div) => [divisionName(div), listText([...DIVISIONS[div - 1][1]]), { ...num(roundedDollars(values[div]), String(values[div])), data: { div: String(div) } }]),
    },
  });
}

// Every episode type's price in every region: a table in the family's printout (web/client/figure.js makes its scroll box a
// keyboard-scrollable region while it overflows), its first column and, where it scrolls, its head staying in view
// (styles.css), the reader's region shaded. One tbody per category: its name, its episode types, its
// All row (CMS's, or this site's mean where CMS's file has none: team.categoryAvgDerived). Each price cell keeps its
// raw value (data-value), which the page's script reads.
function allPrices({ team, reader }) {
  const groups = drgsByCategory(team);
  const derived = new Set(team.categoryAvgDerived);
  const mine = (div) => (div === reader ? html` class="num tm-all__mine"` : html` class="num"`);
  const cells = (prices) => DIVISION_NUMBERS.map((div) => html`<td${mine(div)} data-value="${String(prices[div])}">${roundedDollars(prices[div])}</td>`);
  const derivedCats = listText(CATEGORIES.filter((c) => derived.has(c)).map(catWords));
  return html`<details class="tm-all" id="all-prices">
<summary>${fill('allSummary', { n: count(Object.keys(team.prices).length), regions: count(DIVISIONS.length) })}</summary>
<p class="tm-all__cap" id="all-cap">${fill('allCaption', { year: yearOf(PY2_START) })}</p>
<div class="tm-all__box">${printout(html`<table class="gb tm-all__table" aria-labelledby="all-cap" data-bar-table>
<thead><tr><th scope="col">${t('allColType')}</th>${DIVISION_NUMBERS.map((div) => html`<th scope="col" data-div="${String(div)}"${div === reader ? html` class="tm-all__mine"` : ''}><span class="tm-all__no">${String(div)}</span> ${divisionName(div)}</th>`)}</tr></thead>
${groups.map(({ cat, drgs }) => html`<tbody>
<tr class="tm-all__cat"><th scope="rowgroup" colspan="${String(DIVISIONS.length + 1)}"><span>${capitalize(catWords(cat))}</span></th></tr>
${drgs.map((drg) => html`<tr data-drg="${drg}"><th scope="row">${fill('barOption', { drg })}</th>${cells(team.prices[drg])}</tr>
`)}<tr class="tm-all__avg"${derived.has(cat) ? html` data-derived` : ''}><th scope="row">${t(derived.has(cat) ? 'allAvgOurs' : 'allAvgCms')}${derived.has(cat) ? html`<span aria-hidden="true">*</span>` : ''}</th>${cells(team.categoryAvg[cat])}</tr>
</tbody>`)}
</table>`)}</div>
<p class="tm-all__note">${fill('allMine', { division: divisionName(reader) })}${derivedCats ? html` <span aria-hidden="true">*</span> ${fill('allDerived', { cats: derivedCats })}` : ''}</p>
</details>
`;
}

// Part 4. n: the Part's number; figureN: the page's figure counter; atlas: the pinned us-atlas topology.
export function barPart({ team, atlas, n, figureN }) {
  const reader = readerDivision(team);
  const words = html`<p>${t('barPrices')}</p>
${picker(team)}
${now(team, reader)}`;
  return partOf({
    id: 'bar', n, heading: fill('barHeading', { year: yearOf(PY2_START) }), words,
    fig: html`<div class="tm-bar" data-bar-reader="${String(reader)}">${mapFigure({ team, atlas, reader, n: figureN() })}</div>`,
    after: allPrices({ team, reader }),
  });
}
