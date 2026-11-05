// The Map Part's browser behavior (figures/map.js): the measure buttons show one drawing at a time, the "hospital dots"
// checkbox turns the dot layer on, a state picked on the map opens its page, and the "Every state" pager shows one page of
// the table at a time. Without this script the average cut shows, the dots are off and the whole table reads.
import { placePath } from '../web/links.js';

// The measures and the dots. The controls are hidden in the page; unhiding them is what offers them.
function mountSwitches(box) {
  const controls = box.querySelector('.usmap__controls');
  if (!controls) return;
  controls.hidden = false;
  const buttons = [...controls.querySelectorAll('button[data-measure]')];
  controls.querySelector('.usmap__modes')?.addEventListener('click', (e) => {
    const picked = e.target.closest('button[data-measure]');
    if (!picked) return;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === picked));
    for (const m of box.querySelectorAll('.usmap__m')) m.hidden = m.dataset.measure !== picked.dataset.measure;
    box.dataset.measure = picked.dataset.measure;
  });
  const dots = controls.querySelector('input[data-dots]');
  if (dots) {
    dots.checked = false;
    dots.addEventListener('change', () => { box.dataset.dots = dots.checked ? 'on' : 'off'; });
  }
}

// A state's click (or Enter on the state the keyboard is on: web/client/figure.js marks it is-active) opens its page.
function mountStateLinks(box) {
  const open = (mark) => { if (mark?.dataset.state) window.location.assign(placePath('state', mark.dataset.state)); };
  for (const svg of box.querySelectorAll('svg.chart--us-map')) {
    svg.addEventListener('click', (e) => open(e.target.closest?.('[data-state]')));
    svg.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(svg.querySelector('.chart-mark.is-active[data-state]')); });
  }
}

// "Every state": one tbody for each page; the pager (hidden until now) shows one.
function mountPager(table) {
  const pager = document.querySelector('.states__pager');
  if (!pager || !table) return;
  const pages = [...table.querySelectorAll('tbody[data-page]')];
  const show = (n) => {
    for (const body of pages) body.hidden = body.dataset.page !== String(n);
    for (const b of pager.querySelectorAll('button[data-to-page]')) b.setAttribute('aria-pressed', String(b.dataset.toPage === String(n)));
  };
  pager.hidden = false;
  pager.addEventListener('click', (e) => { const b = e.target.closest('button[data-to-page]'); if (b) show(b.dataset.toPage); });
  show(1);
}

export function mountMap() {
  for (const box of document.querySelectorAll('.usmap')) { mountSwitches(box); mountStateLinks(box); }
  mountPager(document.querySelector('table.states__table'));
}
