// The program page's scripts. Both the hospital search and the hospital table read the hospitals asset named in
// their data-src (see hospitalRows in web/generate.js), fetched once for both; without JavaScript both stay hidden
// and the table's section shows a sentence and the CSV link.
// The search: a native datalist of hospital names, fetched the first time the box gets focus; choosing one opens
// its page. The table: every hospital, sortable by any column, filtered by a state (kept in the URL as #state=XX)
// and by name; its rows are fetched when the section nears the screen, or at once when the URL names a state.
// The sandbox: the what-if on the median hospital, mounted from the page's own data (client/whatif.js), whose
// share is false: the URL is never read or written by it.
import { CCN } from '../../../engine/js/ccn.js';
import { TABLE_FIRST_ROWS } from '../web/constants.js';
import { fill } from '../web/copy.js';
import { compareByName, decodeState, filterRows, hospitalHref, sortRows, stateCodes, tableRows, withState } from '../web/hospital-table.js';
import { cmsText, count } from '../../../web/render/format.js';
import { SETTLE_MS } from '../../../web/whatif/dom.js';
import { mountFromPage } from './whatif.js';

const PATH = /^\/[a-z0-9/-]*\/$/;

// One fetch for the search and the table; a failed one is tried again on the next call.
let pending = null;
function hospitals(src) {
  pending ??= (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`hospital list: HTTP ${res.status}`);
    const { hospitalPath, rows } = await res.json();
    if (!PATH.test(hospitalPath)) throw new Error('hospital list: bad hospitalPath');
    return { hospitalPath, rows: rows.filter(([ccn]) => CCN.test(ccn)) };
  })().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

const box = document.querySelector('.search[data-src]');

if (box) {
  const input = box.querySelector('input');
  const list = box.querySelector('datalist');
  const paths = new Map();

  async function load() {
    const { hospitalPath, rows } = await hospitals(box.dataset.src);
    const valid = [...rows].sort(compareByName);
    // "Name, City, ST"; a label two hospitals share also carries the CCN.
    const labels = valid.map(([, name, city, state]) => `${name}, ${city}, ${state}`);
    const seen = new Map();
    for (const text of labels) seen.set(text, (seen.get(text) ?? 0) + 1);
    list.replaceChildren(...valid.map(([ccn], i) => {
      const text = seen.get(labels[i]) > 1 ? `${labels[i]} (CCN ${ccn})` : labels[i];
      paths.set(text, hospitalHref(hospitalPath, ccn));
      const option = document.createElement('option');
      option.value = text;
      return option;
    }));
  }

  let loading = null;
  input.addEventListener('focus', () => {
    loading ??= load().catch(() => { loading = null; });
  });

  const go = (path) => { if (path) window.location.assign(path); };
  input.addEventListener('input', () => go(paths.get(input.value)));
  // Enter opens the one hospital whose label contains what was typed, if only one does.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const matches = [...paths.keys()].filter((text) => text.toLowerCase().includes(query));
    if (matches.length === 1) go(paths.get(matches[0]));
  });
  box.hidden = false;
}

const table = document.querySelector('.ht[data-src]');

// linked: the page was opened from a link naming a state (#state=XX), so a valid one brings the table into view.
function mountTable({ hospitalPath, rows }, { linked }) {
  const section = table.closest('section');
  const select = table.querySelector('#ht-state');
  const search = table.querySelector('#ht-name');
  const status = table.querySelector('#ht-count');
  const body = table.querySelector('tbody');
  const all = table.querySelector('#ht-all');
  const heads = [...table.querySelectorAll('th[data-key]')];
  const codes = stateCodes(rows);
  const view = { state: null, query: '', key: null, dir: 1, expanded: false };

  select.append(...codes.map((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    return option;
  }));

  // Each cell names its column (data-label), for the stacked rows of a narrow screen.
  const label = Object.fromEntries(heads.map((th) => [th.dataset.key, th.textContent.trim()]));
  const cell = (text, key) => {
    const td = document.createElement('td');
    if (key === 'score') td.className = 'num';
    td.dataset.label = label[key];
    td.textContent = text;
    return td;
  };
  function row([ccn, name, city, state, total, decision]) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    const a = document.createElement('a');
    a.href = hospitalHref(hospitalPath, ccn);
    a.textContent = name;
    th.append(a);
    tr.append(th, cell(city, 'city'), cell(state, 'state'), cell(cmsText(total), 'score'), cell(decision, 'decision'));
    return tr;
  }
  // Each row's <tr> is built once; a filter or sort only puts the built rows in a new order.
  const built = new WeakMap();
  const rowOf = (r) => {
    if (!built.has(r)) built.set(r, row(r.cells));
    return built.get(r);
  };

  // The row count, in a polite live region; while the reader types a name, it follows SETTLE_MS after they stop.
  let settle = null;
  function announce(text, wait) {
    clearTimeout(settle);
    if (wait) settle = setTimeout(() => { status.textContent = text; }, SETTLE_MS);
    else status.textContent = text;
  }

  // The rows in the reader's sort, built once per sort change: the asset's own order is the default (hospitalRows),
  // and a filter keeps the order it is given, so a keystroke only filters. Each row's lowercase name and numeric
  // score are read once, here.
  const records = tableRows(rows);
  let ordered = records;

  function render({ typing = false } = {}) {
    const matches = filterRows(ordered, view);
    const limited = !view.state && !view.expanded && matches.length > TABLE_FIRST_ROWS;
    const shown = limited ? matches.slice(0, TABLE_FIRST_ROWS) : matches;
    body.replaceChildren(...shown.map(rowOf));
    all.hidden = !limited;
    if (limited) all.textContent = fill('tableShowAll', { n: count(matches.length) });
    const text = matches.length === 0 ? fill('tableCountNone')
      : matches.length === 1 ? fill('tableCountOne')
        : limited ? fill('tableCountFirst', { shown: count(shown.length), n: count(matches.length) })
          : fill('tableCount', { n: count(matches.length) });
    announce(text, typing);
  }

  // The state from the URL: a code in the data, or none; anything else in the fragment is left alone.
  function fromHash() {
    const state = decodeState(window.location.hash, codes);
    if (state === view.state) return false;
    view.state = state;
    select.value = state ?? '';
    return true;
  }

  select.addEventListener('change', () => {
    view.state = codes.includes(select.value) ? select.value : null;
    const { pathname, search: query, hash } = window.location;
    window.history.replaceState(null, '', pathname + query + withState(hash, view.state));
    render();
  });
  search.addEventListener('input', () => {
    view.query = search.value;
    render({ typing: true });
  });
  all.addEventListener('click', () => {
    view.expanded = true;
    render();
  });
  for (const th of heads) {
    th.querySelector('button').addEventListener('click', () => {
      const key = th.dataset.key;
      view.dir = view.key === key || (view.key === null && key === 'state') ? -view.dir : 1;
      view.key = key;
      for (const h of heads) h.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', view.dir > 0 ? 'ascending' : 'descending');
      ordered = sortRows(records, view.key, view.dir);
      render();
    });
  }
  window.addEventListener('hashchange', () => { if (fromHash()) render(); });

  fromHash();
  render();
  section.querySelector('.ht-nojs').hidden = true;
  table.hidden = false;
  // Never animated (a smooth scroll started on load does not run in a background tab); focus stays where it is.
  if (linked && view.state) section.scrollIntoView({ block: 'start', behavior: 'auto' });
}

if (table) {
  // Fetch when the table nears the screen, or at once for a link that names a state (or a browser with no
  // observer). hospitals() keeps one fetch in flight, so a second call waits for the same one, and the table is
  // mounted once. A failed fetch is logged and offers a Try again button (and is tried again the next time the
  // section comes near); a fault while building the table is not caught here, so it reaches the console as itself.
  let observer = null;
  let mounted = false;
  const linked = /(^#|&)state=/.test(window.location.hash);
  const retry = table.closest('section').querySelector('.ht-retry');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fig__btn';
  button.textContent = fill('tableRetry');
  const load = () => hospitals(table.dataset.src).then(
    (data) => {
      if (mounted) return;
      mounted = true;
      observer?.disconnect();
      const focused = document.activeElement === button;
      retry.replaceChildren();
      mountTable(data, { linked });
      if (focused) table.querySelector('#ht-state').focus();
    },
    (error) => {
      console.error(error);
      retry.replaceChildren(fill('tableFailed'), ' ', button);
    },
  );
  button.addEventListener('click', load);
  if (!linked && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) load(); }, { rootMargin: '600px 0px' });
    observer.observe(table.closest('section'));
  } else {
    load();
  }
}

// After the search and the table, so a fault in the sandbox never takes them with it.
mountFromPage('hacrp-program');
