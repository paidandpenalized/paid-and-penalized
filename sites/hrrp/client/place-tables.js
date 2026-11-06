// The two tables at the foot of a place page (figures/place-table.js), and, with the same code, the program page's "Every hospital"
// table (figures/explore.js: its box says data-all, a data-prefix for its control ids and a download button that writes the filtered
// rows as a file; it holds no row until the rows load, so it stays hidden until then). The child table gets the shared pager (pager.js). The
// hospitals table carries its first page of rows in the page; here, when it comes near the screen, the script reads the rest from the
// rows asset, keeps this place's hospitals and draws a page at a time with the page's own row markup (figures/place-row.js), with the
// filters, a sort and Previous/Next. Both tables get a "Copy as CSV" button: the child table's file, and the hospitals table's file cut
// to the rows that pass the filters, in the current sort. Everything is hidden in the page until here, and without this script a reader
// has the first page and the CSV.
import { copyOrSelect } from '../../../web/client/clipboard.js';
import { once } from '../../../web/client/once.js';
import { hospitalRow } from '../web/figures/place-row.js';
import { csvSubset, filterRows, placeRows, sortRows, statusLine } from './place-rows.js';
import { mountPager } from './pager.js';

// Copies the text copyText() gives (a promise) and says how it went in the box's status line; where the browser refuses, the box's
// table is selected for the reader to copy by hand.
function mountCopy(box, copyText) {
  const button = box.querySelector('button[data-copy]');
  const status = box.querySelector('[data-copy-status]');
  const table = box.querySelector('table');
  if (!button || !status || !table) return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    let text;
    try {
      text = await copyText();
    } catch {
      // Cleared first, so a repeat is announced again.
      status.textContent = '';
      status.textContent = status.dataset.failed;
      return;
    }
    await copyOrSelect({ text, node: table, status, copied: status.dataset.copied, failed: status.dataset.failed });
  });
}

const RETRY = ['pointerdown', 'focusin'];

// A same-site data file's text (only /data/hrrp/ and /assets/ paths).
async function fetchText(href, prefix) {
  if (!href?.startsWith(prefix)) throw new Error('not a site file');
  const res = await fetch(href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// A box's CSV file: fetched once, and again on the next click after a failure.
const csvOf = (box) => once(() => fetchText(box.dataset.csv, '/data/hrrp/'));

function mountKids(box) {
  mountPager({ table: box.querySelector('table.kids__table'), pager: box.querySelector('.kids__pager'), status: box.querySelector('.kids__status') });
  mountCopy(box, csvOf(box));
}

// Saves text as a CSV file the reader downloads (a link made for the click, then dropped).
function saveCsv(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountHospitals(box) {
  const body = box.querySelector('table.ph__table')?.tBodies[0];
  const controls = box.querySelector('.ph__controls');
  const status = box.querySelector('.ph__status');
  const [prev, next] = [box.querySelector('[data-prev]'), box.querySelector('[data-next]')];
  const size = Number(box.dataset.pageSize);
  if (!body || !controls || !status || !size) return;
  // Copy works from the CSV alone, so it is there whether or not the rows load: the whole file until the table's rows are drawn, then
  // the rows that pass the filters.
  const csv = csvOf(box);
  let shown = null;
  const subset = async () => (shown ? csvSubset(await csv(), shown.map((r) => r.h.id)) : csv());
  mountCopy(box, subset);
  const download = box.querySelector('button[data-download]');
  if (download) {
    download.hidden = false;
    download.addEventListener('click', async () => {
      try {
        saveCsv(await subset(), box.dataset.csv.split('/').pop());
      } catch {
        // The full file stays a link in the page's note.
      }
    });
  }
  // A table that fits on one page has every row and names no asset.
  if (!box.dataset.src) return;
  if (!box.dataset.src.startsWith('/assets/')) return;
  const prefix = box.dataset.prefix ?? 'ph';
  const el = (id) => box.querySelector(`#${prefix}-${id}`);
  const f = { text: el('text'), st: el('state'), peer: el('peer'), cond: el('cond'), teach: el('teach'), beds: el('beds'), loc: el('loc'), pen: el('pen'), sort: el('sort') };
  const scope = 'all' in box.dataset ? { all: true } : box.dataset.cbsa ? { cbsa: box.dataset.cbsa } : { states: (box.dataset.states ?? '').split(',') };
  let all = [];
  let conditions = [];
  let page = 1;

  const want = () => ({ text: f.text.value, st: f.st?.value, peer: f.peer.value, cond: f.cond.value, teach: f.teach.value, beds: f.beds.value, loc: f.loc.value, pen: f.pen.checked });
  function render() {
    shown = sortRows(filterRows(all, want()), f.sort.value);
    const pages = Math.max(1, Math.ceil(shown.length / size));
    page = Math.min(page, pages);
    const [from, to] = [(page - 1) * size, Math.min(page * size, shown.length)];
    body.innerHTML = shown.slice(from, to).map((r) => String(hospitalRow(r, conditions, { prefix }))).join('');
    box.querySelector('.ht-empty').hidden = shown.length > 0;
    body.closest('.printout').hidden = shown.length === 0;
    status.textContent = statusLine(status.dataset.template, { page, size, n: shown.length });
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
  }

  // The rows asset, fetched once; a failure is tried again on the reader's next touch of the table.
  const loadRows = once(async () => {
    const asset = JSON.parse(await fetchText(box.dataset.src, '/assets/'));
    all = placeRows(asset, scope);
    conditions = asset.conditions;
  });

  async function load() {
    try {
      await loadRows();
    } catch {
      // The first page and the CSV stay. A box with no page of rows (hidden) says so instead and is not touched again.
      if (box.hidden) {
        const note = box.parentElement.querySelector('.ht-retry');
        if (note) note.textContent = note.dataset.text;
        return;
      }
      const retry = () => { for (const type of RETRY) box.removeEventListener(type, retry); load(); };
      for (const type of RETRY) box.addEventListener(type, retry);
      return;
    }
    box.querySelector('.ph__more')?.setAttribute('hidden', '');
    box.hidden = false;
    box.parentElement.querySelector('.ht-nojs')?.setAttribute('hidden', '');
    for (const e of [controls, status, prev, next]) e.hidden = false;
    controls.addEventListener('input', () => { page = 1; render(); });
    prev.addEventListener('click', () => { page -= 1; render(); });
    next.addEventListener('click', () => { page += 1; render(); });
    render();
  }

  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { watch.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    // A box with no rows yet is hidden (it has no place on the screen), so its note stands in for it.
    watch.observe(box.hidden ? box.parentElement.querySelector('.ht-nojs') ?? box : box);
  } else load();
}

export function mountHospitalTables() {
  for (const box of document.querySelectorAll('[data-ph]')) mountHospitals(box);
}

export function mountPlaceTables() {
  for (const box of document.querySelectorAll('[data-kids]')) mountKids(box);
  mountHospitalTables();
}
