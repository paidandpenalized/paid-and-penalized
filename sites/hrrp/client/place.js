// A place page's browser script (figures/place.js): a dot on its map opens that hospital's page (click, or Enter on the dot the
// keyboard is on: web/client/figure.js marks it is-active). Without this script the dots show their tooltips and the table
// below lists every hospital with its link.
const open = (mark) => { if (mark?.dataset.href) window.location.assign(mark.dataset.href); };

for (const svg of document.querySelectorAll('svg.chart--place-map')) {
  svg.addEventListener('click', (e) => open(e.target.closest?.('[data-href]')));
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(svg.querySelector('.chart-mark.is-active[data-href]')); });
}
