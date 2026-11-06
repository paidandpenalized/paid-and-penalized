// The two tables at the foot of a place page (figures/place-table.js). The child table gets the shared pager (pager.js). The
// hospitals table carries its first page of rows in the page; here, when it comes near the screen, the script reads the rest from the
// rows asset, keeps this place's hospitals and draws a page at a time with the page's own row markup (figures/place-row.js), with the
// filters, a sort and Previous/Next. Both tables get a "Copy as CSV" button: the child table's file, and the hospitals table's file cut
// to the rows that pass the filters, in the current sort. Everything is hidden in the page until here, and without this script a reader
// has the first page and the CSV.
import { hospitalRow } from '../web/figures/place-row.js';
import { csvSubset, filterRows, placeRows, sortRows } from './place-rows.js';
import { mountPager } from './pager.js';

// Copies the text copyText() gives (a promise) and says how it went in the box's status line.
function mountCopy(box, copyText) {
  const button = box.querySelector('button[data-copy]');
  const status = box.querySelector('[data-copy-status]');
  if (!button || !status) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(await copyText());
      status.textContent = status.dataset.copied;
    } catch {
      status.textContent = status.dataset.failed;
    }
  });
}

// A same-site data file's text (only /data/hrrp/ and /assets/ paths).
async function fetchText(href, prefix) {
  if (!href?.startsWith(prefix)) throw new Error('not a site file');
  const res = await fetch(href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function mountKids(box) {
  mountPager({ table: box.querySelector('table.kids__table'), pager: box.querySelector('.kids__pager'), status: box.querySelector('.kids__status') });
  mountCopy(box, () => fetchText(box.dataset.csv, '/data/hrrp/'));
}

const fmt = (n) => n.toLocaleString('en-US');

function mountHospitals(box) {
  const body = box.querySelector('table.ph__table')?.tBodies[0];
  const controls = box.querySelector('.ph__controls');
  const status = box.querySelector('.ph__status');
  const [prev, next] = [box.querySelector('[data-prev]'), box.querySelector('[data-next]')];
  const size = Number(box.dataset.pageSize);
  if (!body || !controls || !status || !size || !box.dataset.src?.startsWith('/assets/')) return;
  const el = (id) => box.querySelector(`#${id}`);
  const f = { text: el('ph-text'), st: el('ph-state'), peer: el('ph-peer'), cond: el('ph-cond'), teach: el('ph-teach'), beds: el('ph-beds'), loc: el('ph-loc'), pen: el('ph-pen'), sort: el('ph-sort') };
  const scope = box.dataset.cbsa ? { cbsa: box.dataset.cbsa } : { states: (box.dataset.states ?? '').split(',') };
  let all = [];
  let conditions = [];
  let shown = [];
  let page = 1;

  const want = () => ({ text: f.text.value, st: f.st?.value, peer: f.peer.value, cond: f.cond.value, teach: f.teach.value, beds: f.beds.value, loc: f.loc.value, pen: f.pen.checked });
  function render() {
    shown = sortRows(filterRows(all, want()), f.sort.value);
    const pages = Math.max(1, Math.ceil(shown.length / size));
    page = Math.min(page, pages);
    const [from, to] = [(page - 1) * size, Math.min(page * size, shown.length)];
    body.innerHTML = shown.slice(from, to).map((r) => String(hospitalRow(r, conditions))).join('');
    box.querySelector('.ht-empty').hidden = shown.length > 0;
    body.closest('.printout').hidden = shown.length === 0;
    status.textContent = shown.length ? status.dataset.template.replace('{from}', fmt(from + 1)).replace('{to}', fmt(to)).replace('{n}', fmt(shown.length)) : '';
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
  }

  async function load() {
    try {
      const asset = JSON.parse(await fetchText(box.dataset.src, '/assets/'));
      all = placeRows(asset, scope);
      conditions = asset.conditions;
    } catch {
      return; // the first page and the CSV stay
    }
    box.querySelector('.ph__more')?.setAttribute('hidden', '');
    for (const e of [controls, status, prev, next]) e.hidden = false;
    controls.addEventListener('input', () => { page = 1; render(); });
    prev.addEventListener('click', () => { page -= 1; render(); });
    next.addEventListener('click', () => { page += 1; render(); });
    render();
    mountCopy(box, async () => csvSubset(await fetchText(box.dataset.csv, '/data/hrrp/'), shown.map((r) => r.h.id)));
  }

  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { watch.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    watch.observe(box);
  } else load();
}

export function mountPlaceTables() {
  for (const box of document.querySelectorAll('[data-kids]')) mountKids(box);
  for (const box of document.querySelectorAll('[data-ph]')) mountHospitals(box);
}
