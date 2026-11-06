// A hospital page's area table (figures/neighbors.js): the pager shows one page of 25 at a time, opening on the page this
// hospital is on. Without this script every row shows.
import { mountPager } from './pager.js';

export function mountNeighbors() {
  const box = document.querySelector('[data-nb]');
  if (!box) return;
  const table = box.querySelector('table.nb__table');
  const here = table?.querySelector('tr.is-current')?.closest('tbody[data-page]');
  mountPager({ table, pager: box.querySelector('.nb__pager'), status: box.querySelector('.nb__status'), first: here ? Number(here.dataset.page) : 1 });
}
