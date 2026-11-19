// Part 4 in the browser (web/program/bar.js drew it for constants.js BAR_DRG): the picker shows, and a new pick redraws
// Figure 4 (each region's step, label and tooltip, the legend's two ends), the figure's table, its caption and the price
// and sentence beside the words. The prices come from the page's own table of every episode type in every region (its
// cells' data-value), so the map and the table it sits over can never disagree, and the page fetches nothing for it. The
// shading is the build's (web/charts/evenSteps.js); the geometry never changes. Without this script the page shows
// BAR_DRG and the whole table, and the picker stays hidden.
//
// The reader's region follows the calculator's hospital (client/calc.js sends team:hospital with its division): the
// price beside the words, the region's name in the sentences, the table's shaded column and the map's outline move to
// it. The build's outline is drawn from the geometry it has and the page does not; the new one is the region's own
// shape stroked and clipped to its outside, so only its outer edge shows, as the build's does.
import { evenSteps } from '../../../web/charts/evenSteps.js';
import { roundedDollars } from '../../../web/render/format.js';
import { DIVISION_NUMBERS, divisionName, extremes } from '../web/program/bar-data.js';

const STEP = /\bchart-div--s\d\b/;
const SVG = 'http://www.w3.org/2000/svg';
const READER = 'chart-div--reader';
const MINE = 'tm-all__mine';

// An SVG element with these attributes.
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// One map drawing's outline moved to division div: the build's hidden; the region's shape, stroked in the outline's
// class and clipped to its outside (a frame far past the map with the shape cut out of it, even-odd), drawn over the
// shapes where the build's was.
const FRAME = 'M-10000 -10000h20000v20000h-20000z';
function outlineMap(svg, div, n) {
  const built = svg.querySelector('.chart-div__reader');
  const shape = svg.querySelector(`.chart-mark[data-div="${div}"] path.chart-div`);
  if (!built || !shape) return;
  for (const s of svg.querySelectorAll(`.${READER}`)) s.classList.remove(READER);
  shape.classList.add(READER);
  built.style.display = 'none';
  svg.querySelector('[data-moved-outline]')?.remove();
  const id = `tm-reader-clip-${n}`;
  const clip = svgEl('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
  clip.append(svgEl('path', { d: `${FRAME}${shape.getAttribute('d')}`, 'clip-rule': 'evenodd' }));
  const group = svgEl('g', { 'data-moved-outline': '' });
  group.append(clip, svgEl('path', { class: 'chart-div__reader chart-div__reader--moved', d: shape.getAttribute('d'), 'clip-path': `url(#${id})` }));
  built.after(group);
}

// The big table's shaded column moved to division div's.
function shadeColumn(table, div) {
  const head = [...table.tHead.rows[0].cells];
  const at = head.findIndex((th) => th.dataset.div === String(div));
  if (at < 0) return;
  for (const cell of table.querySelectorAll(`.${MINE}`)) cell.classList.remove(MINE);
  head[at].classList.add(MINE);
  for (const body of table.tBodies) for (const row of body.rows) if (row.cells.length === head.length) row.cells[at].classList.add(MINE);
}

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
  let reader = Number(figure.dataset.barReader);
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
  // The price and its sentence are a polite live region for a pick here. When the calculator's hospital moves them, the
  // calculator says so itself, so the region is quiet for that change and speaks again at the next pick.
  const now = part.querySelector('.tm-now');
  pick.addEventListener('change', () => {
    now?.setAttribute('aria-live', 'polite');
    show();
  });
  // The calculator's hospital moved to another region: the price, the region's name, the column and the outline follow.
  document.addEventListener('team:hospital', (e) => {
    const div = Number(e.detail?.division);
    if (!DIVISION_NUMBERS.includes(div) || div === reader) return;
    now?.setAttribute('aria-live', 'off');
    reader = div;
    figure.dataset.barReader = String(div);
    say('division', divisionName(div));
    [...figure.querySelectorAll('svg.chart--division-map')].forEach((svg, i) => outlineMap(svg, div, i));
    shadeColumn(table, div);
    show();
  });
  part.querySelector('[data-bar-picker]').hidden = false;
  // A browser that kept the reader's last pick (back, or a reload) shows it at once.
  if (!pick.options[pick.selectedIndex].defaultSelected) show();
}
