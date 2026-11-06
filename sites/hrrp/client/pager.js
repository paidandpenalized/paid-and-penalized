// A paged table's browser behavior, shared by the program page's "Every state" table (client/map.js) and a hospital page's
// area table (client/hospital.js): the table holds one tbody for each page (data-page), the pager's buttons (hidden until now)
// show one and mark it pressed, and the status line (optional; hidden until now) says which rows show, from the template in
// its data-template with {from}, {to} and {n} (written with the page's thousands separators). Without this script every page shows, so the table reads whole.
//   table: the table; pager: the nav of buttons[data-to-page]; status: the status element or null; first: the page to open on.
import { count } from '../../../web/client/format.js';

export function mountPager({ table, pager, status = null, first = 1 }) {
  if (!pager || !table) return;
  const pages = [...table.querySelectorAll('tbody[data-page]')];
  const size = Number(table.dataset.pageSize);
  const total = pages.reduce((n, body) => n + body.rows.length, 0);
  const show = (n) => {
    for (const body of pages) body.hidden = body.dataset.page !== String(n);
    for (const b of pager.querySelectorAll('button[data-to-page]')) b.setAttribute('aria-pressed', String(b.dataset.toPage === String(n)));
    if (status && size) {
      const from = (n - 1) * size + 1;
      status.textContent = status.dataset.template.replace('{from}', count(from)).replace('{to}', count(Math.min(n * size, total))).replace('{n}', count(total));
    }
  };
  pager.hidden = false;
  if (status) status.hidden = false;
  pager.addEventListener('click', (e) => { const b = e.target.closest('button[data-to-page]'); if (b) show(b.dataset.toPage); });
  show(first);
}
