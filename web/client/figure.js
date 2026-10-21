// Figures in the browser (web/charts/figure.js wrote them): column sort on the table, the CSV download built from
// the table, and a tooltip for the chart's marks on hover and from the keyboard (the chart takes focus; arrow keys,
// Home and End step through the marks; Escape hides the tooltip). Program-neutral: it runs on any page with
// figure[data-figure]. Without JavaScript the table, the native SVG tooltips and the page still work. No animation.
import { toCsv } from '../../engine/js/csv.js';
import { compareNumbers } from '../../engine/js/stats.js';

const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// A cell's raw value (CMS's text, with its hyphen-minus) where the build kept one, else its text.
const valueOf = (cell) => cell.getAttribute('data-value') ?? cell.textContent.trim();

export function tableCsv(table) {
  const columns = [...table.tHead.rows[0].cells].map((th) => ({ name: th.textContent.trim(), numeric: th.hasAttribute('data-numeric') }));
  return toCsv(columns, [...table.tBodies[0].rows].map((row) => [...row.cells].map(valueOf)));
}

// Rows by column index, dir 1 (ascending) or -1. Numbers by value, with blanks and text such as "N/A" last in either
// direction; text by locale. Ties keep their order (Array sort is stable).
export function compareRows(index, numeric, dir) {
  const key = (row) => valueOf(row.cells[index]);
  if (!numeric) return (a, b) => dir * key(a).localeCompare(key(b), 'en');
  const num = (row) => (key(row) === '' ? NaN : Number(key(row)));
  return (a, b) => compareNumbers(num(a), num(b), dir);
}

function mountTable(fig) {
  const table = fig.querySelector('table');
  if (!table) return;
  const heads = [...table.tHead.rows[0].cells];
  heads.forEach((th, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fig__sort';
    button.append(...th.childNodes);
    th.append(button);
    button.addEventListener('click', () => {
      const dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
      for (const h of heads) h.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
      const body = table.tBodies[0];
      body.append(...[...body.rows].sort(compareRows(i, th.hasAttribute('data-numeric'), dir)));
    });
  });

  const download = fig.querySelector('[data-figure-csv]');
  if (!download) return;
  download.hidden = false;
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([tableCsv(table)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = download.dataset.figureCsv;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}

function mountMarks(fig) {
  const svg = fig.querySelector('svg.chart');
  const marks = svg ? [...svg.querySelectorAll('[data-mark]')] : [];
  if (!marks.length) return;
  // The custom tooltip replaces the native one, so the two never show together.
  for (const m of marks) {
    const title = m.querySelector('title');
    m.dataset.tip = title?.textContent ?? '';
    title?.remove();
  }
  const tip = document.createElement('div');
  tip.className = 'fig__tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  const live = document.createElement('p');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  fig.append(tip, live);
  svg.setAttribute('tabindex', '0');

  let current = -1;
  const hide = () => {
    marks[current]?.classList.remove('is-active');
    current = -1;
    tip.hidden = true;
  };
  const show = (i, announce) => {
    // The pointer moving between one mark's parts changes nothing; a key press still announces the mark again.
    if (i === current && !announce) return;
    marks[current]?.classList.remove('is-active');
    current = i;
    const m = marks[i];
    m.classList.add('is-active');
    tip.textContent = m.dataset.tip;
    tip.hidden = false;
    // Above the mark's hit area, kept inside the figure.
    const box = m.getBoundingClientRect();
    const frame = fig.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = Math.min(Math.max(box.left + box.width / 2 - frame.left, half), frame.width - half);
    tip.style.left = `${x}px`;
    tip.style.top = `${box.top - frame.top}px`;
    if (announce) live.textContent = m.dataset.tip;
  };

  svg.addEventListener('pointerover', (e) => {
    const m = e.target.closest('[data-mark]');
    if (m) show(marks.indexOf(m), false);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hide();
      return;
    }
    const step = STEPS[e.key];
    let i;
    if (step) i = current < 0 ? (step > 0 ? 0 : marks.length - 1) : (current + step + marks.length) % marks.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = marks.length - 1;
    else return;
    e.preventDefault();
    show(i, true);
  });
}

export function mountFigure(fig) {
  mountTable(fig);
  mountMarks(fig);
}

if (typeof document !== 'undefined') for (const fig of document.querySelectorAll('figure[data-figure]')) mountFigure(fig);
