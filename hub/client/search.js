// The family search, on every hub page that has its box (hub/search/form.js; a form with data-hub): the shared combobox
// (web/client/omnibox.js) over the hub's hospitals and the fifty states and DC. A hospital is found by its name, city,
// state or CCN and opens its page; a state is found by its name or code and opens the front page at that state, where the
// story's map reads the address's #state=<code> (the code as the data holds it, capitals; the reader accepts either
// case). The index loads on first focus from the asset the form names (data-src), decoded once.
import { US_STATES } from '../../engine/js/states.js';
import { count } from '../../web/client/format.js';
import { loadHubAsset } from '../../web/client/hub-asset.js';
import { mountOmnibox } from '../../web/client/omnibox.js';
import { once } from '../../web/client/once.js';
import { buildIndex } from '../../web/client/search.js';
import { hospitalPathOf } from '../../web/site.js';
import { fill } from '../search/copy.js';

// The search entries (web/client/search.js buildIndex) for hospitals, as the asset decodes them (or hubHospitals gives
// them): each hospital by name, with "City, ST" under it, found also by its city and state and, as its key, its CCN; each
// state with the number of hospitals in it under it, found by its name and, as its key, its code.
export function hubEntries(hospitals) {
  const inState = new Map();
  const found = hospitals.map(({ ccn, name, city, state }) => {
    inState.set(state, (inState.get(state) ?? 0) + 1);
    return { type: 'hospital', key: ccn, label: name, sub: [city, state].filter(Boolean).join(', '), extra: `${city ?? ''} ${state ?? ''}`.trim(), href: hospitalPathOf('hub', ccn) };
  });
  const kind = fill('searchKindState');
  const states = US_STATES.map(([code, , name]) => {
    const n = inState.get(code) ?? 0;
    return { type: 'state', key: code, label: name, sub: n === 1 ? fill('searchPlaceSubOne', { kind }) : fill('searchPlaceSub', { kind, n: count(n) }), extra: '', href: `/#state=${code}` };
  });
  return [...states, ...found];
}

// What the combobox says: each option's kind, and the status and list for no match, a count and a failed load.
export const hubWords = {
  empty: fill('searchEmpty'),
  kind: { hospital: fill('searchKindHospital'), state: fill('searchKindState') },
  count: (n) => (n === 0 ? fill('searchEmpty') : n === 1 ? fill('searchCountOne') : fill('searchCount', { n: count(n) })),
  failed: fill('searchFailed'),
  more: null,
};

// Mounts the combobox on each form: the entries made once for all of them, from the asset the first form to need them
// names, and one index per kind of form (a form with data-only="<type>" lists only that type: the home story's search,
// hospitals). A pick is first announced on its form as a cancelable 'hub:pick' event ({ href }): a page's script that
// acts on it in place cancels it (the home story follows the hospital); otherwise open(href) opens it (the page by
// default). loadAsset(src) resolves to { hospitals }.
export function mountHubSearch(forms, { loadAsset = loadHubAsset, open = (href) => window.location.assign(href) } = {}) {
  const entries = once((src) => loadAsset(src).then(({ hospitals }) => hubEntries(hospitals)));
  const indexes = new Map();
  const indexFor = (form) => {
    const only = form.dataset.only ?? '';
    if (!indexes.has(only)) indexes.set(only, once(() => entries(form.dataset.src).then((all) => buildIndex(only ? all.filter((e) => e.type === only) : all))));
    return indexes.get(only)();
  };
  for (const form of forms) {
    const pick = (href) => {
      if (form.dispatchEvent(new CustomEvent('hub:pick', { detail: { href }, cancelable: true }))) open(href);
    };
    mountOmnibox(form, { load: () => indexFor(form), words: hubWords, open: pick });
  }
}

if (typeof document !== 'undefined') mountHubSearch([...document.querySelectorAll('form.omni[data-src][data-hub]')]);
