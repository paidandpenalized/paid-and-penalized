// The Map Part's browser behavior (figures/map.js): the measure buttons show one drawing at a time, the "hospital dots"
// checkbox turns the dot layer on, a state picked on the map opens its page, and the "Every state" pager (pager.js) shows one page of
// the table at a time. Without this script the average cut shows, the dots are off and the whole table reads.
import { placePath } from '../web/links.js';
import { mountPager } from './pager.js';
import { mountSwitch } from './switch.js';

// The measures and the dots. The controls are hidden in the page; unhiding them is what offers them.
function mountSwitches(box) {
  const controls = box.querySelector('.usmap__controls');
  if (!controls) return;
  mountSwitch({ box, controls, attr: 'measure', panels: box.querySelectorAll('.usmap__m'), group: controls.querySelector('.usmap__modes') });
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

export function mountMap() {
  for (const box of document.querySelectorAll('.usmap')) { mountSwitches(box); mountStateLinks(box); }
  mountPager({ table: document.querySelector('table.states__table'), pager: document.querySelector('.states__pager') });
}
