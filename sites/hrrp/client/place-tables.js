// The two tables at the foot of a place page (figures/place-table.js). The child table gets the shared pager (pager.js); the
// hospitals table gets its filters, sort and a pager over the rows that pass, and both get a "Copy as CSV" button that copies the
// file the page links. Everything is hidden in the page until here, and without this script every row shows.
import { bedBand } from '../../../engine/js/hrrp/filters.js';
import { mountPager } from './pager.js';

// The CSV the section links (data-csv), copied as text. The status line says how it went.
function mountCopy(box) {
  const button = box.querySelector('button[data-copy]');
  const status = box.querySelector('[data-copy-status]');
  const href = box.dataset.csv;
  if (!button || !href?.startsWith('/data/hrrp/')) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      status.textContent = status.dataset.copied;
    } catch {
      status.textContent = status.dataset.failed;
    }
  });
}

function mountKids(box) {
  mountPager({ table: box.querySelector('table.kids__table'), pager: box.querySelector('.kids__pager'), status: box.querySelector('.kids__status') });
  mountCopy(box);
}

const num = (v) => (v === undefined || v === '' ? null : Number(v));
// Highest first, a blank last, ties in the page's own order (cut, then dollars, then CCN).
const SORTS = {
  cut: (a, b) => a.i - b.i,
  dollars: (a, b) => (b.pen ?? -1) - (a.pen ?? -1) || a.i - b.i,
  name: (a, b) => a.name.localeCompare(b.name, 'en') || a.i - b.i,
  beds: (a, b) => (b.beds ?? -1) - (a.beds ?? -1) || a.i - b.i,
};

function mountHospitals(box) {
  const table = box.querySelector('table.ph__table');
  const body = table?.tBodies[0];
  const controls = box.querySelector('.ph__controls');
  const status = box.querySelector('.ph__status');
  const empty = box.querySelector('.ht-empty');
  const [prev, next] = [box.querySelector('[data-prev]'), box.querySelector('[data-next]')];
  const size = Number(box.dataset.pageSize);
  if (!body || !controls || !status || !size) return;
  const rows = [...body.rows].map((tr, i) => ({
    tr, i,
    // What the text box searches: the name and place as shown, the CCN from the link, and the former name when there is one.
    text: `${tr.cells[0].textContent} ${tr.dataset.alias ?? ''} ${tr.querySelector('a')?.getAttribute('href').split('/').filter(Boolean).pop() ?? ''}`.toLowerCase(),
    name: tr.querySelector('a')?.textContent ?? '', pen: num(tr.dataset.pen), beds: num(tr.dataset.beds),
  }));
  const el = (id) => box.querySelector(`#${id}`);
  const f = { text: el('ph-text'), st: el('ph-state'), peer: el('ph-peer'), cond: el('ph-cond'), teach: el('ph-teach'), beds: el('ph-beds'), loc: el('ph-loc'), pen: el('ph-pen'), sort: el('ph-sort') };
  let page = 1;
  let order = '';
  let sorted = rows;

  function render() {
    const text = f.text.value.trim().toLowerCase();
    const pick = (control) => (control ? control.value : '');
    const want = { st: pick(f.st), peer: pick(f.peer), cond: pick(f.cond), teach: pick(f.teach), beds: pick(f.beds), loc: pick(f.loc) };
    if (f.sort.value !== order) {
      order = f.sort.value;
      sorted = [...rows].sort(SORTS[order]);
      body.append(...sorted.map((r) => r.tr));
    }
    const ordered = sorted.filter((r) => {
      const d = r.tr.dataset;
      return (!f.pen.checked || Number(d.paf) < 1) && (!want.st || d.st === want.st) && (!want.peer || d.peer === want.peer)
        && (!want.teach || d.teach === want.teach) && (!want.beds || bedBand(r.beds) === want.beds) && (!want.loc || d.urban === want.loc)
        && (!want.cond || d.conds[Number(want.cond)] === 'c') && (!text || r.text.includes(text));
    });
    const pages = Math.max(1, Math.ceil(ordered.length / size));
    page = Math.min(page, pages);
    const [from, to] = [(page - 1) * size, page * size];
    const shown = new Set(ordered.slice(from, to));
    for (const r of rows) r.tr.hidden = !shown.has(r);
    empty.hidden = ordered.length > 0;
    table.closest('.printout').hidden = ordered.length === 0;
    status.textContent = ordered.length ? status.dataset.template.replace('{from}', (from + 1).toLocaleString('en-US')).replace('{to}', Math.min(to, ordered.length).toLocaleString('en-US')).replace('{n}', ordered.length.toLocaleString('en-US')) : '';
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
  }

  controls.hidden = false;
  status.hidden = false;
  prev.hidden = false;
  next.hidden = false;
  controls.addEventListener('input', () => { page = 1; render(); });
  prev.addEventListener('click', () => { page -= 1; render(); });
  next.addEventListener('click', () => { page += 1; render(); });
  render();
  mountCopy(box);
}

export function mountPlaceTables() {
  for (const box of document.querySelectorAll('[data-kids]')) mountKids(box);
  for (const box of document.querySelectorAll('[data-ph]')) mountHospitals(box);
}
