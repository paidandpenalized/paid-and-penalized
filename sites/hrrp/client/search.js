// The program page's hospital search, the hero's box (web/client/omnibox.js): each hospital found by name, city, state, ZIP code or
// CCN, and each place the site has a page for, opening its page. Worksheet R's box (client/worksheet.js) shares the
// asset (client/hospitals.js) and the index, and searches hospitals only.
import { count } from '../../../web/render/format.js';
import { buildIndex } from '../../../web/client/search.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { once } from '../../../web/client/once.js';
import { KINDS } from '../web/links.js';
import { fill } from '../web/program/copy.js';
import { loadHospitals } from './hospitals.js';

const kindWord = (kind) => fill(`searchKind${kind[0].toUpperCase()}${kind.slice(1)}`);

// The asset's places as search entries; a state also matches its code.
const placeEntries = ({ places }) => places.map(([kind, key, name, path, n]) => ({
  type: kind, key: kind === 'state' ? key.toUpperCase() : `${kind}-${key}`, label: name, extra: '', href: path,
  sub: n === 1 ? fill('searchPlaceSubOne', { kind: kindWord(kind) }) : fill('searchPlaceSub', { kind: kindWord(kind), n: count(n) }),
}));

// The asset's hospitals as search entries; href: where a pick goes (the hospital's page).
const hospitalEntries = ({ hospitalPath, hospitals }) => hospitals.map((h) => ({
  type: 'hospital', key: h.id, label: h.name, sub: [`${h.city}, ${h.st}`, h.zip].filter(Boolean).join(' '), extra: `${h.city} ${h.st} ${h.zip}`, href: `${hospitalPath}${h.id.toLowerCase()}/`,
}));

// The words an omnibox shows (what the site's boxes say for kinds, counts and failure).
export const searchWords = () => ({
  empty: fill('searchEmpty'),
  kind: Object.fromEntries(['hospital', ...KINDS].map((kind) => [kind, kindWord(kind)])),
  count: (n) => (n === 0 ? fill('searchEmpty') : n === 1 ? fill('searchCountOne') : fill('searchCount', { n: count(n) })),
  failed: fill('searchFailed'),
  more: null,
});

// The one index of every place and hospital, built on the first call; Worksheet R's box searches it for hospitals only.
export const loadIndex = once((src) => loadHospitals(src).then((data) => buildIndex([...placeEntries(data), ...hospitalEntries(data)])));

// The hero's box (and any other full search box on the page): one index, loaded on the first focus.
export function mountSearch() {
  for (const form of document.querySelectorAll('form.omni[data-src]:not(#ws-pick)')) {
    mountOmnibox(form, { load: () => loadIndex(form.dataset.src), words: searchWords() });
  }
}
