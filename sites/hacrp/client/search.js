// The top bar's hospital search on every HACRP page (pages/parts.js searchBox): the shared combobox
// (web/client/omnibox.js) over the hospitals asset, each hospital found by its name, city, state, ZIP code or CCN,
// opening its page. On the program page a last option hands every match to the hospital table below (its text filter,
// through the 'hacrp:show-in-table' event client/program.js listens for).
import { count } from '../../../web/render/format.js';
import { buildIndex } from '../../../web/client/search.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { fill } from '../web/copy.js';
import { hospitalHref } from '../web/hospital-table.js';
import { hospitalLoader } from './hospitals.js';

const hospitals = hospitalLoader();

// A state's entry joins here when the site has state pages: { type: 'state', key, label, sub, href }.
export const STATE_ENTRIES = [];

// The asset's rows as search entries: [ccn, name, city, state, total, decision, zip].
export function hospitalEntries({ hospitalPath, rows }) {
  return rows.map(([ccn, name, city, state, , , zip = '']) => ({
    type: 'hospital', key: ccn, label: name, sub: [`${city}, ${state}`, zip].filter(Boolean).join(' '), extra: `${city} ${state} ${zip}`, href: hospitalHref(hospitalPath, ccn),
  }));
}

const form = typeof document === 'undefined' ? null : document.querySelector('form.omni[data-src]');
if (form) {
  const inTable = Boolean(document.querySelector('#ht-name'));
  mountOmnibox(form, {
    load: async () => buildIndex([...STATE_ENTRIES, ...hospitalEntries(await hospitals(form.dataset.src))]),
    words: {
      empty: fill('searchEmpty'),
      kind: { hospital: fill('searchKindHospital') },
      count: (n) => (n === 0 ? fill('searchEmpty') : n === 1 ? fill('searchCountOne') : fill('searchCount', { n: count(n) })),
      failed: fill('searchFailed'),
      more: inTable ? (n) => fill('searchMore', { n: count(n) }) : null,
    },
    onMore: inTable ? (query) => document.dispatchEvent(new CustomEvent('hacrp:show-in-table', { detail: query })) : null,
  });
}
