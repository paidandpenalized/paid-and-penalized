// A search box as an accessible combobox, ported from Thirty Day Readmissions (web/src/js/ui/omnibox.js) onto markup
// the build writes (render/shell.js searchForm): the input is role="combobox" over a listbox of options. Typing lists
// the best matches; the arrow keys move through them (aria-activedescendant), Enter or a click opens one, Escape
// closes the list, and leaving the box closes it. The index loads on first focus (load() resolves to buildIndex's
// entries; a failure says so, and the next focus tries again); a list it was typed for while loading opens only if the
// reader is still in the box. A press anywhere on the list (an option, its scrollbar, its "No matches" row) keeps the
// focus in the box. A polite status says how many matched. Without JavaScript the form stays hidden.
// words: { empty, kind: { [type]: label }, count(n, query), failed, more(total) } — the site's own words (empty: text, or a
//        function of the query, so a site can say why a query finds nothing; more: the label of a last option that hands
//        every match on, or null; onMore(query) acts on it)
import { LIMIT, search } from './search.js';

export function mountOmnibox(form, { load, words, open = (href) => window.location.assign(href), onMore = null, types, moreTypes = null }) {
  const input = form.querySelector('[role="combobox"]');
  const list = form.querySelector('[role="listbox"]');
  const status = form.querySelector('[role="status"]');
  const listId = list.id;
  let index = null;
  let loading = null;
  let results = [];
  let total = 0;
  // The entries onMore hands on: with moreTypes, the list's matches of those kinds, counted by the same matcher.
  let handOn = [];
  let active = -1;
  // Whether the reader is in the box: a list typed for while the index loaded opens only then. A box that already has
  // the focus when this mounts is in it.
  let focused = document.activeElement === input;
  // Words typed while the index loaded, left unlisted because the reader had left the box or the load failed: listed once
  // the reader is back and the index is in.
  let pending = false;

  const ready = () => (loading ??= load().then((entries) => { index = entries; return true; }, () => {
    loading = null;
    if (input.value.trim()) pending = true; // the words typed wait for the next try
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
  const listedOf = () => (moreTypes ? results.filter((r) => moreTypes.includes(r.type)).length : results.length);
  const more = () => Boolean(onMore && words.more && (moreTypes ? handOn.length : total) > listedOf());
  const count = () => results.length + (more() ? 1 : 0);
  const pick = (i) => {
    const query = input.value;
    close();
    if (i < results.length) open(results[i].href);
    else if (more()) onMore(query.trim(), handOn);
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
    if (more()) items.push(option(`${listId}-${results.length}`, active === results.length, [['omni__t', words.more(moreTypes ? handOn.length : total)]]));
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'omni__empty';
      empty.textContent = typeof words.empty === 'function' ? words.empty(input.value) : words.empty;
      items.push(empty);
    }
    list.replaceChildren(...items);
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  async function update() {
    pending = false;
    const query = input.value;
    if (!query.trim()) {
      results = [];
      handOn = [];
      total = 0;
      status.textContent = '';
      close();
      return;
    }
    if (!index && !(await ready())) return;
    if (input.value !== query) return; // the reader typed on while the index loaded
    if (!focused) { // or left the box: the list would open with no one in it, so it waits for their return
      pending = true;
      return;
    }
    // One pass: when the option hands matches on, every match is ranked once and the list shows the first LIMIT.
    const handing = Boolean(onMore && moreTypes);
    const found = search(query, index, { limit: handing ? Infinity : LIMIT, types });
    ({ total } = found);
    results = found.results.slice(0, LIMIT);
    handOn = handing ? found.results.filter((r) => moreTypes.includes(r.type)) : [];
    active = results.length ? 0 : -1;
    status.textContent = words.count(total, query);
    paint();
  }

  // Back in the box with words a load left unlisted, the list follows them once the index is in (a failed load is tried
  // again here).
  input.addEventListener('focus', () => {
    focused = true;
    ready().then((ok) => { if (ok && pending && focused) update(); });
  });
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
  // A press anywhere on the list keeps the focus in the box (a mousedown's default would move it), so the list stays for
  // a press on its edge (where a scrollbar beside the options takes it) or on its "No matches" row; a press on an option
  // picks it.
  list.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // a right or middle press is the browser's (its menu), never a pick
    e.preventDefault();
    const li = e.target.closest?.('[role="option"]');
    if (li) pick([...list.children].indexOf(li));
  });
  // Leaving the box closes the list at once. A press on the list never leaves it (above), so nothing waits on a delay.
  input.addEventListener('blur', () => {
    focused = false;
    close();
  });
  // The form never submits: Enter picks, and a pick opens a page.
  form.addEventListener('submit', (e) => e.preventDefault());
  form.hidden = false;
}
