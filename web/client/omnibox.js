// The top bar's search as an accessible combobox, ported from Thirty Day Readmissions (web/src/js/ui/omnibox.js) onto
// markup the build writes (a site's searchBox): the input is role="combobox" over a listbox of options. Typing lists
// the best matches; the arrow keys move through them (aria-activedescendant), Enter or a click opens one, Escape
// closes the list. The index loads on first focus (load() resolves to buildIndex's entries; a failure says so, and the
// next focus tries again). A polite status says how many matched. Without JavaScript the form stays hidden.
// words: { empty, kind: { [type]: label }, count(n), failed, more(total) } — the site's own words (more: the label
//        of a last option that hands every match on, or null; onMore(query) acts on it)
import { LIMIT, search } from './search.js';

export function mountOmnibox(form, { load, words, open = (href) => window.location.assign(href), onMore = null }) {
  const input = form.querySelector('[role="combobox"]');
  const list = form.querySelector('[role="listbox"]');
  const status = form.querySelector('[role="status"]');
  const listId = list.id;
  let index = null;
  let loading = null;
  let results = [];
  let total = 0;
  let active = -1;

  const ready = () => (loading ??= load().then((entries) => { index = entries; return true; }, () => {
    loading = null;
    status.textContent = words.failed;
    return false;
  }));

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  // The options: the matches, then (where the site hands matches on) one for all of them when the list is cut short.
  const more = () => Boolean(onMore && words.more && total > results.length);
  const count = () => results.length + (more() ? 1 : 0);
  const pick = (i) => {
    const query = input.value;
    close();
    if (i < results.length) open(results[i].href);
    else if (more()) onMore(query.trim());
  };

  const option = (id, selected, parts) => {
    const li = document.createElement('li');
    li.id = id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(selected));
    for (const [cls, text] of parts) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    return li;
  };
  const paint = () => {
    const items = results.map((r, i) => option(`${listId}-${i}`, i === active, [['omni__t', r.label], ['omni__s', r.sub], ['omni__k', words.kind[r.type] ?? '']]));
    if (more()) items.push(option(`${listId}-${results.length}`, active === results.length, [['omni__t', words.more(total)]]));
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'omni__empty';
      empty.textContent = words.empty;
      items.push(empty);
    }
    list.replaceChildren(...items);
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  async function update() {
    const query = input.value;
    if (!query.trim()) {
      results = [];
      total = 0;
      status.textContent = '';
      close();
      return;
    }
    if (!index && !(await ready())) return;
    if (input.value !== query) return; // the reader typed on while the index loaded
    ({ results, total } = search(query, index, { limit: LIMIT }));
    active = results.length ? 0 : -1;
    status.textContent = words.count(total);
    paint();
  }

  input.addEventListener('focus', () => { ready(); });
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    const n = count();
    if (e.key === 'ArrowDown' && n) {
      active = list.hidden ? 0 : (active + 1) % n;
      paint();
      e.preventDefault();
    } else if (e.key === 'ArrowUp' && n) {
      active = list.hidden ? n - 1 : (active - 1 + n) % n;
      paint();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!list.hidden && active >= 0) pick(active);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault();
      close();
    }
  });
  // A press on an option picks it before the input's blur closes the list.
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest?.('[role="option"]');
    if (!li) return;
    e.preventDefault();
    pick([...list.children].indexOf(li));
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  // The form never submits: Enter picks, and a pick opens a page.
  form.addEventListener('submit', (e) => e.preventDefault());
  form.hidden = false;
}
