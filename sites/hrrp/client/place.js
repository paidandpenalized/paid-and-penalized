// A place page's browser script: a dot on its map opens that hospital's page (click, or Enter on the dot the keyboard is on:
// web/client/figure.js marks it is-active), and the two tables at its foot get their pager, filters and copy buttons
// (place-tables.js). Without this script the dots show their tooltips and the tables list every row with its link.
import { HOSPITALS_PATH } from '../web/links.js';
import { mountPlaceTables } from './place-tables.js';

// The dot's address is built with the page; only a hospital's own page is followed.
const open = (mark) => {
  const href = mark?.dataset.href;
  if (href?.startsWith(HOSPITALS_PATH)) window.location.assign(href);
};

for (const svg of document.querySelectorAll('svg.chart--place-map')) {
  svg.addEventListener('click', (e) => open(e.target.closest?.('[data-href]')));
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(svg.querySelector('.chart-mark.is-active[data-href]')); });
}
mountPlaceTables();
