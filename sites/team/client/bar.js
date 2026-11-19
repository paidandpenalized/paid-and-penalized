// Part 4 in the browser (web/program/bar.js drew it for constants.js BAR_DRG): the picker shows, and a new pick redraws
// Figure 4 (each region's step, label and tooltip, the legend's two ends), the figure's table, its caption and the price
// and sentence beside the words. The prices come from the page's own table of every episode type in every region (its
// cells' data-value), so the map and the table it sits over can never disagree, and the page fetches nothing for it. The
// shading is the build's (web/charts/evenSteps.js); the geometry never changes. Without this script the page shows
// BAR_DRG and the whole table, and the picker stays hidden.
import { evenSteps } from '../../../web/charts/evenSteps.js';
import { roundedDollars } from '../../../web/render/format.js';
import { DIVISION_NUMBERS, divisionName, extremes } from '../web/program/bar-data.js';

const STEP = /\bchart-div--s\d\b/;

// One episode type's prices, { div: price }, from its row of the big table: each cell under the column head of its
// division (data-div). null when the row or a price is missing.
function pricesOf(table, drg) {
  const row = [...table.tBodies].flatMap((body) => [...body.rows]).find((tr) => tr.dataset.drg === drg);
  if (!row) return null;
  const divs = [...table.tHead.rows[0].cells].slice(1).map((th) => Number(th.dataset.div));
  const values = Object.fromEntries([...row.cells].slice(1).map((td, i) => [divs[i], Number(td.dataset.value)]));
  return DIVISION_NUMBERS.every((div) => Number.isFinite(values[div])) ? values : null;
}

// A map drawing (the phone's or the wide one) shaded and labeled for these prices.
function paintMap(svg, values) {
  const { lo, hi, stepOf } = evenSteps(DIVISION_NUMBERS.map((div) => values[div]));
  for (const mark of svg.querySelectorAll('.chart-mark[data-div]')) {
    const div = Number(mark.dataset.div);
    mark.dataset.value = String(values[div]);
    // The tooltip's words: web/client/figure.js moves each mark's <title> into data-tip; a mark it hasn't reached keeps
    // its title.
    const tip = `${divisionName(div)}: ${roundedDollars(values[div])}`;
    mark.dataset.tip = tip;
    const title = mark.querySelector('title');
    if (title) title.textContent = tip;
    const shape = mark.querySelector('path.chart-div');
    shape.setAttribute('class', shape.getAttribute('class').replace(STEP, `chart-div--s${stepOf(values[div])}`));
  }
  for (const label of svg.querySelectorAll('.chart-div__price[data-div]')) label.textContent = roundedDollars(values[Number(label.dataset.div)]);
  svg.querySelector('[data-legend="low"]').textContent = roundedDollars(lo);
  svg.querySelector('[data-legend="high"]').textContent = roundedDollars(hi);
}

export function mountBar(root = document) {
  const part = root.querySelector('#bar');
  const pick = part?.querySelector('select[data-bar-pick]');
  const table = part?.querySelector('table[data-bar-table]');
  const figure = part?.querySelector('[data-bar-reader]');
  if (!pick || !table || !figure) return;
  const reader = Number(figure.dataset.barReader);
  const say = (key, text) => {
    for (const el of part.querySelectorAll(`[data-bar="${key}"]`)) el.textContent = text;
  };
  const show = () => {
    const values = pricesOf(table, pick.value);
    if (!values) return;
    const { lo, hi } = extremes(values);
    say('drg', pick.value);
    say('cat', pick.selectedOptions[0].parentElement.dataset.cat);
    say('price', roundedDollars(values[reader]));
    say('lo', roundedDollars(values[lo]));
    say('loName', divisionName(lo));
    say('hi', roundedDollars(values[hi]));
    say('hiName', divisionName(hi));
    for (const svg of figure.querySelectorAll('svg.chart--division-map')) paintMap(svg, values);
    for (const td of figure.querySelectorAll('td[data-div]')) {
      const v = values[Number(td.dataset.div)];
      td.dataset.value = String(v);
      td.textContent = roundedDollars(v);
    }
  };
  pick.addEventListener('change', show);
  part.querySelector('[data-bar-picker]').hidden = false;
  // A browser that kept the reader's last pick (back, or a reload) shows it at once.
  if (!pick.options[pick.selectedIndex].defaultSelected) show();
}
