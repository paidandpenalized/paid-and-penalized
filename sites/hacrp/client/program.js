// The program page's scripts. Both the hospital search and the hospital table read the hospitals asset named in
// their data-src (see hospitalRows in web/generate.js), fetched once for both; without JavaScript both stay hidden
// and the table's section shows a sentence and the CSV link.
// The search: a native datalist of hospital names, fetched the first time the box gets focus; choosing one opens
// its page. Submitting (Enter or the button) matches the name, city or CCN: one match opens its page, several are
// handed to the table below (its text filter, scrolled into view), none says so; a list that didn't load says that, and
// the next submit fetches it again. The table: every hospital, sortable by any column, filtered by a state (kept in
// the URL as #state=XX) and by name, city or CCN; its rows are fetched when the section nears the screen, or at once
// when the URL names a state.
// The sandbox: the what-if on the median hospital, mounted from the page's own data (client/whatif.js), whose
// share is false: the URL is never read or written by it.
import { CCN } from '../../../engine/js/ccn.js';
import { TABLE_FIRST_ROWS } from '../web/constants.js';
import { fill } from '../web/copy.js';
import {
  compareByName, decodeState, filterRows, hospitalHref, hospitalLabel, searchKey, sortRows, stateCodes, tableRows, withState,
} from '../web/hospital-table.js';
import { cmsText, count } from '../../../web/render/format.js';
import { NARROW, SETTLE_MS } from '../../../web/whatif/dom.js';
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
  const status = box.querySelector('[role="status"]');
  // Each hospital: its label (the datalist's option), the text a query is matched against (key), and its page.
  const entries = [];
  const pathOf = (label) => entries.find((e) => e.label === label)?.path;

  async function load() {
    const { hospitalPath, rows } = await hospitals(box.dataset.src);
    const valid = [...rows].sort(compareByName);
    // "Name, City, ST"; a label two hospitals share also carries the CCN.
    const labels = valid.map(hospitalLabel);
    const seen = new Map();
    for (const text of labels) seen.set(text, (seen.get(text) ?? 0) + 1);
    list.replaceChildren(...valid.map((cells, i) => {
      const [ccn] = cells;
      const label = seen.get(labels[i]) > 1 ? `${labels[i]} (CCN ${ccn})` : labels[i];
      entries.push({ label, key: searchKey(cells), path: hospitalHref(hospitalPath, ccn) });
      const option = document.createElement('option');
      option.value = label;
      return option;
    }));
  }

  // true once the list is in; false when the fetch failed, and the next call tries again.
  let loading = null;
  const ready = () => (loading ??= load().then(() => true, () => {
    loading = null;
    return false;
  }));
  input.addEventListener('focus', ready);

  const go = (path) => { if (path) window.location.assign(path); };
  input.addEventListener('input', () => {
    status.textContent = '';
    go(pathOf(input.value));
  });
  // Several matches: the table below shows them, through its own text filter (mountTable reads it if the table
  // mounts later). A state filter could hide them, so the table goes back to all states, in the URL and the state
  // menu, as the menu itself writes it.
  function showInTable(query) {
    const filter = document.querySelector('#ht-name');
    if (!filter) return;
    const { pathname, search, hash } = window.location;
    const next = withState(hash, null);
    if (next !== hash) window.history.replaceState(null, '', pathname + search + next);
    const states = document.querySelector('#ht-state');
    if (states?.value) {
      states.value = '';
      states.dispatchEvent(new Event('change'));
    }
    filter.value = query;
    filter.dispatchEvent(new Event('input'));
    document.querySelector('#hospitals')?.scrollIntoView({ block: 'start' });
  }
  box.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    // A list that didn't load says so (the table's words), rather than "No hospital matches."
    if (!(await ready())) {
      status.textContent = fill('tableFailed');
      return;
    }
    const picked = pathOf(input.value);
    if (picked) return go(picked);
    const q = query.toLowerCase();
    const matches = entries.filter((e) => e.key.includes(q));
    if (matches.length === 1) return go(matches[0].path);
    status.textContent = matches.length ? '' : fill('tableCountNone');
    if (matches.length) showInTable(query);
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
  const menu = table.querySelector('#ht-sort');
  const heads = [...table.querySelectorAll('th[data-key]')];
  const codes = stateCodes(rows);
  // The search above may have filled the text filter before the table mounted.
  const view = { state: null, query: search.value, key: null, dir: 1, expanded: false };

  select.append(...codes.map((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    return option;
  }));

  // Each cell names its column (data-label), which a narrow screen, where the rows stack and the column heads are
  // hidden, gives to screen readers only, as generated text (styles.css): no extra node per cell.
  const label = Object.fromEntries(heads.map((th) => [th.dataset.key, th.textContent.trim()]));
  const cell = (text, key) => {
    const td = document.createElement('td');
    td.className = key === 'score' ? `ht-${key} num` : `ht-${key}`;
    td.dataset.label = label[key];
    td.append(text);
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
  // One sort, from a column head or the phone's menu; each shows the other's choice.
  function sortBy(key, dir) {
    view.key = key;
    view.dir = dir;
    for (const h of heads) {
      if (h.dataset.key === key) h.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
      else h.removeAttribute('aria-sort');
    }
    if (menu) menu.value = `${key}:${dir}`;
    ordered = sortRows(records, key, dir);
    render();
  }
  // On a phone the column heads are clipped out of view (styles.css), so their sort buttons leave the tab order
  // while that layout holds; they stay in the accessibility tree, and the Sort by menu stands in for them.
  const phone = window.matchMedia?.(NARROW);
  function sortTabs() {
    for (const th of heads) {
      const button = th.querySelector('button');
      if (phone.matches) button.setAttribute('tabindex', '-1');
      else button.removeAttribute('tabindex');
    }
  }
  if (phone) {
    sortTabs();
    phone.addEventListener?.('change', sortTabs);
  }
  for (const th of heads) {
    th.querySelector('button').addEventListener('click', () => {
      const key = th.dataset.key;
      sortBy(key, view.key === key || (view.key === null && key === 'state') ? -view.dir : 1);
    });
  }
  menu?.addEventListener('change', () => {
    const [key, dir] = menu.value.split(':');
    if (heads.some((h) => h.dataset.key === key)) sortBy(key, dir === '-1' ? -1 : 1);
  });
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
