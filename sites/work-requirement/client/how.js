// Step 2's chain and worksheets (web/program/how.js draws them at the middle case and the default use rate): redrawn
// from the page's state when the case or the use rate moves, with the same code the server drew them with
// (web/program/chain.js): each link's drawings and value, the axis, the status lines, each worksheet's lines, the cases'
// marks and Figure 2's table.
import { money } from '../../../web/render/format.js';
import { LINKS, TABLE_ROWS, axisFigure, linkFigure, linkValue, statusText, worksheetBody } from '../web/program/chain.js';

// section: the step's section; store: the page's state; how: the strips asset's (how.js howModel).
export function mountHow(section, { store, how }) {
  const links = LINKS.map(({ n }) => [n, section.querySelector(`.wr-link[data-link="${n}"]`), section.querySelector(`[data-fig="${n}"]`), section.querySelector(`[data-ws-body="${n}"]`)]);
  const axis = section.querySelector('[data-how-axis]');
  const statuses = [...section.querySelectorAll('[data-how-status]')];
  const cases = [...section.querySelectorAll('.wr-case[data-scen], .wr-mitcase[data-scen]')];
  const sign = Object.fromEntries(TABLE_ROWS.map(([, key, s]) => [key, s]));
  const cells = [...section.querySelectorAll('td[data-how]')].map((td) => [td, ...td.dataset.how.split(' ')]);

  // A worksheet's buttons show it open (the page's popovers; the browser keeps their expanded state for assistive tech).
  for (const pop of section.querySelectorAll('.wr-ws[popover]')) {
    const openers = [...section.querySelectorAll(`.wr-lines[popovertarget="${pop.id}"]`)];
    pop.addEventListener('toggle', (e) => openers.forEach((b) => b.toggleAttribute('data-open', e.newState === 'open')));
  }

  store.subscribe((state, changed) => {
    if (!changed.has('scenario') && !changed.has('totals')) return;
    const view = { totals: state.totals, scenario: state.scenario, use: state.use, how };
    for (const [n, li, fig, body] of links) {
      li.dataset.v = String(linkValue(n, view));
      fig.innerHTML = linkFigure(n, view).text;
      body.innerHTML = worksheetBody(n, view).text;
    }
    axis.innerHTML = axisFigure(view).text;
    for (const el of statuses) el.textContent = statusText(view);
    for (const el of cases) {
      if (el.dataset.scen === state.scenario) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    }
    if (changed.has('totals')) {
      for (const [td, key, s] of cells) {
        const v = sign[key] * state.totals[s][key];
        td.textContent = money(v);
        td.dataset.value = String(v);
      }
    }
  });
}
