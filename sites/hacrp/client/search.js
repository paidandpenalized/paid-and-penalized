// The bar's hospital search on every HACRP page (pages/parts.js searchBox): the shared combobox
// (web/client/omnibox.js) over the hospitals asset, each hospital found by its name, city, state, ZIP code or CCN,
// opening its page. On the program page a last option hands every match to the hospital table below (its text filter,
// through the 'hacrp:show-in-table' event client/program.js listens for).
import { count } from '../../../web/render/format.js';
import { buildIndex } from '../../../web/client/search.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { fill } from '../web/search/copy.js';
import { hospitalHref } from '../web/hospital-table.js';
import { hospitalLoader } from './hospitals.js';
import { once } from '../../../web/client/once.js';

const hospitals = hospitalLoader();

// The asset's places as search entries: [kind, key, name, path, hospitals]; a state also matches its code.
const kindWord = (kind) => fill(`searchKind${kind[0].toUpperCase()}${kind.slice(1)}`);
export function placeEntries({ places = [] }) {
  return places.map(([kind, key, name, path, n]) => ({
    type: kind, key: kind === 'state' ? key.toUpperCase() : `${kind}-${key}`, label: name, sub: n === 1 ? fill('searchPlaceSubOne', { kind: kindWord(kind) }) : fill('searchPlaceSub', { kind: kindWord(kind), n: count(n) }), extra: '', href: path,
  }));
}

// The asset's rows as search entries: [ccn, name, city, state, total, decision, zip].
export function hospitalEntries({ hospitalPath, rows }) {
  return rows.map(([ccn, name, city, state, , , zip = '']) => ({
    type: 'hospital', key: ccn, label: name, sub: [`${city}, ${state}`, zip].filter(Boolean).join(' '), extra: `${city} ${state} ${zip}`, href: hospitalHref(hospitalPath, ccn),
  }));
}

// Every search box on the page (the top bar's, and the program page's larger one in its hero): one index, loaded once.
const forms = typeof document === 'undefined' ? [] : [...document.querySelectorAll('form.omni[data-src]')];
const load = once((src) => hospitals(src).then((data) => buildIndex([...placeEntries(data), ...hospitalEntries(data)])));
for (const form of forms) {
  // A place page's table lists only its hospitals, so the option to see every match there is the program page's.
  const inTable = Boolean(document.querySelector('.ht:not([data-area]) #ht-name'));
  mountOmnibox(form, {
    load: () => load(form.dataset.src),
    words: {
      empty: fill('searchEmpty'),
      kind: { hospital: fill('searchKindHospital'), state: fill('searchKindState'), metro: fill('searchKindMetro'), region: fill('searchKindRegion'), division: fill('searchKindDivision') },
      count: (n) => (n === 0 ? fill('searchEmpty') : n === 1 ? fill('searchCountOne') : fill('searchCount', { n: count(n) })),
      failed: fill('searchFailed'),
      more: inTable ? (n) => fill('searchMore', { n: count(n) }) : null,
    },
    onMore: inTable ? (query) => document.dispatchEvent(new CustomEvent('hacrp:show-in-table', { detail: query })) : null,
  });
}
