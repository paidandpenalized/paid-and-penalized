// Figures in the browser (web/charts/figure.js wrote them): column sort on the table, the CSV download built from
// the table, and a tooltip for the chart's marks on hover and from the keyboard (the chart takes focus; arrow keys,
// Home and End step through the marks; Escape hides the tooltip). A tap on a mark shows its tooltip until a tap
// elsewhere, Escape or a scroll. It also makes every table's scroll box on the page a keyboard-scrollable region while
// its table overflows (mountScroll). Program-neutral: it runs on any page with figure[data-figure]. Without
// JavaScript the table, the native SVG tooltips and the page still work. No animation.
import { toCsv } from '../../engine/js/csv.js';
import { compareNumbers, numberOrNaN } from '../../engine/js/stats.js';

const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
// Some browsers start a download after click() returns; revoking its blob URL at once can cancel it. A minute is
// ample, and one CSV's blob is small.
const REVOKE_MS = 60000;

// A cell's raw value (CMS's text, with its hyphen-minus) where the build kept one, else its text.
const valueOf = (cell) => cell.getAttribute('data-value') ?? cell.textContent.trim();

export function tableCsv(table) {
  const columns = [...table.tHead.rows[0].cells].map((th) => ({ name: th.textContent.trim(), numeric: th.hasAttribute('data-numeric') }));
  return toCsv(columns, [...table.tBodies[0].rows].map((row) => [...row.cells].map(valueOf)));
}

// Rows by column index, dir 1 (ascending) or -1. Numbers by value, with blanks and text such as "N/A" last in either
// direction; text by locale. Ties keep their order (Array sort is stable).
const collate = new Intl.Collator('en').compare;
export function compareRows(index, numeric, dir) {
  const key = (row) => valueOf(row.cells[index]);
  if (!numeric) return (a, b) => dir * collate(key(a), key(b));
  return (a, b) => compareNumbers(numberOrNaN(key(a)), numberOrNaN(key(b)), dir);
}

// A table's scroll box (components.js printout): while its table is wider than the box (on a phone), the box is a
// focusable region named by the table's own label, so a keyboard can scroll it, and its frame fades out at the right
// edge while more of the table lies that way (data-more). One observer for the page watches every box (a resize) and
// its table (its fonts or rows arriving); a scroll moves the edge, and an enclosing details' toggle re-reads it (a
// closed one's content is skipped, so the observer may not report it). The label is the table's aria-labelledby, else
// its caption's id.
export function scrollState(scroll) {
  const overflow = scroll.scrollWidth - scroll.clientWidth;
  return { region: overflow > 1, more: overflow - scroll.scrollLeft > 1 };
}

// Each mounted box, { scroll, frame, label, region }, by its scroll box and by its table: what the observer reports.
const BOXES = new Map();
let sizes = null;

// Every box's state is read before any box is written, so the page is laid out once, not once per box.
function edges(boxes) {
  const states = boxes.map((box) => scrollState(box.scroll));
  boxes.forEach((box, i) => {
    const { region, more } = states[i];
    box.frame.toggleAttribute('data-more', more);
    if (region === box.region) return;
    box.region = region;
    if (region) {
      box.scroll.setAttribute('tabindex', '0');
      box.scroll.setAttribute('role', 'region');
      box.scroll.setAttribute('aria-labelledby', box.label);
    } else {
      for (const name of ['tabindex', 'role', 'aria-labelledby']) box.scroll.removeAttribute(name);
    }
  });
}

export function mountScroll(scroll) {
  const table = scroll.querySelector('table');
  if (!table) return;
  const label = table.getAttribute('aria-labelledby') ?? table.caption?.id;
  if (!label || !('ResizeObserver' in window)) return;
  const box = { scroll, frame: scroll.parentElement, label, region: false };
  const edge = () => edges([box]);
  scroll.addEventListener('scroll', edge, { passive: true });
  scroll.closest('details')?.addEventListener('toggle', edge);
  // One report can name a box and its table: each box is read once.
  if (!sizes) sizes = new ResizeObserver((entries) => edges([...new Set(entries.map((e) => BOXES.get(e.target)))]));
  BOXES.set(scroll, box).set(table, box);
  sizes.observe(scroll);
  sizes.observe(table);
}

// live: the figure's polite live paragraph (a sort says its new order there, in the words the build wrote on the
// table: data-sorted-up and data-sorted-down, each with a {column} for the column head's text).
function mountTable(fig, live) {
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
      live.textContent = table.dataset[dir > 0 ? 'sortedUp' : 'sortedDown'].replace('{column}', () => button.textContent.trim());
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
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
  });
}

// One chart's tooltip layer; a figure with a narrow and a wide variant gets one per chart (only the shown one meets
// the pointer or the keyboard: the other is display: none). A focusable chart takes the figure's keyboard hint as its
// description, where the page has one (keysHint in web/charts/figure.js).
function mountMarks(fig, svg, live) {
  const marks = [...svg.querySelectorAll('[data-mark]')];
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
  fig.append(tip);
  svg.setAttribute('tabindex', '0');
  const hint = document.getElementById(`${fig.id}-keys`);
  if (hint) svg.setAttribute('aria-describedby', hint.id);

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

  // Onto a mark shows it; onto the chart's empty space (or a tap there) hides it.
  svg.addEventListener('pointerover', (e) => {
    const m = e.target.closest('[data-mark]');
    if (m) show(marks.indexOf(m), false);
    else hide();
  });
  // A mouse or pen leaving the chart hides the tooltip. A tap's pointerleave comes right after its pointerup, so a
  // touch keeps the tooltip; a tap outside the chart, Escape or a scroll hides it.
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide(); });
  svg.addEventListener('blur', hide);
  document.addEventListener('pointerdown', (e) => { if (current >= 0 && !svg.contains(e.target)) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current >= 0) hide(); });
  window.addEventListener('scroll', () => { if (current >= 0) hide(); }, { passive: true });
  svg.addEventListener('keydown', (e) => {
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

function mountFigure(fig) {
  const live = document.createElement('p');
  live.className = 'vh';
  live.setAttribute('aria-live', 'polite');
  fig.append(live);
  mountTable(fig, live);
  for (const svg of fig.querySelectorAll('svg.chart')) mountMarks(fig, svg, live);
}

if (typeof document !== 'undefined') {
  for (const fig of document.querySelectorAll('figure[data-figure]')) mountFigure(fig);
  for (const scroll of document.querySelectorAll('.printout__scroll')) mountScroll(scroll);
}
