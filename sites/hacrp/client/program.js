// The program page's hospital search: a native datalist of hospital names; choosing one opens its page. The list
// comes from the hospitals asset named in the search box's data-src (see hospitalRows in web/generate.js), fetched
// the first time the box gets focus. Without JavaScript the search stays hidden.
import { CCN } from '../../../engine/js/ccn.js';

const box = document.querySelector('.search[data-src]');
const PATH = /^\/[a-z0-9/-]*\/$/;

if (box) {
  const input = box.querySelector('input');
  const list = box.querySelector('datalist');
  const paths = new Map();

  async function load() {
    const res = await fetch(box.dataset.src);
    if (!res.ok) throw new Error(`hospital list: HTTP ${res.status}`);
    const { hospitalPath, rows } = await res.json();
    if (!PATH.test(hospitalPath)) throw new Error('hospital list: bad hospitalPath');
    const valid = rows.filter(([ccn]) => CCN.test(ccn));
    // "Name, City, ST"; a label two hospitals share also carries the CCN.
    const labels = valid.map(([, name, city, state]) => `${name}, ${city}, ${state}`);
    const seen = new Map();
    for (const text of labels) seen.set(text, (seen.get(text) ?? 0) + 1);
    list.replaceChildren(...valid.map(([ccn], i) => {
      const text = seen.get(labels[i]) > 1 ? `${labels[i]} (CCN ${ccn})` : labels[i];
      paths.set(text, `${hospitalPath}${ccn.toLowerCase()}/`);
      const option = document.createElement('option');
      option.value = text;
      return option;
    }));
  }

  // One fetch; a failed one is tried again on the next focus.
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
