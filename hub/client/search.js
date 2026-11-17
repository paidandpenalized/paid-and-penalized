// The family search, on every hub page that has its box (hub/search/form.js; a form with data-hub): the shared combobox
// (web/client/omnibox.js) over every hospital on Medicare's list (the hospital master: the dollar file's hospitals and
// those outside the penalty programs) and the fifty states and DC. A hospital is found by its name, city, state or CCN
// and opens its page; a state is found by its name or code and opens the front page at that state, where the story's map
// reads the address's #state=<code> (the code as the data holds it, capitals; the reader accepts either case). The index
// loads on first focus from the search's own asset, which the form names (data-src; hub/search/asset.js writes it), decoded
// once. The hub's asset (the dollar file's hospitals, web/client/hub-asset.js) stays the story's and the shell's.
import { has } from '../../engine/js/has.js';
import { CCN } from '../../engine/js/ccn.js';
import { US_STATES } from '../../engine/js/states.js';
import { count } from '../../web/client/format.js';
import { placeText } from '../../web/render/format.js';
import { mountOmnibox } from '../../web/client/omnibox.js';
import { once } from '../../web/client/once.js';
import { buildIndex } from '../../web/client/search.js';
import { hospitalPathOf } from '../../web/site.js';
import { COPY, fill } from '../search/copy.js';

// The search asset's columns, in the order the build writes them (hub/search/asset.js reads the same list).
export const SEARCH_COLS = Object.freeze(['ccn', 'name', 'city', 'state', 'kind']);
// The master's kind that has no word (as on a hospital's page, which says nothing of it); every other kind the asset may
// hold has its word in the search's copy (hospitalKind.<kind>).
const UNKNOWN_KIND = 'unknown';
const KIND_KEY = 'hospitalKind.';
export const SEARCH_KINDS = Object.freeze([...Object.keys(COPY).filter((k) => k.startsWith(KIND_KEY)).map((k) => k.slice(KIND_KEY.length)), UNKNOWN_KIND]);
const KINDS = new Set(SEARCH_KINDS);
const STATE_CODES = new Set(US_STATES.map(([code]) => code));
const STATE_CODE = /^[A-Z]{2}$/;

// The asset as `{ rows, states }`: rows one `{ ccn, name, city, state, kind }` per hospital, in the asset's order (name the
// one its page shows; city text or null; state a two-letter code; kind one of SEARCH_KINDS), and states the number of
// hospitals the map counts in each of the fifty states and DC that has any. Throws on anything else rather than guess:
// columns other than SEARCH_COLS, a row of another length, a CCN that is no CCN or comes twice, a name that is no text,
// a kind the search has no word for, a count that is no count. Messages name a row by its place, never its values.
export function decodeSearchAsset(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset) || !Array.isArray(asset.cols) || !Array.isArray(asset.rows)) throw new TypeError('search asset: expected { cols, rows, states }');
  const { cols, rows, states } = asset;
  if (cols.length !== SEARCH_COLS.length || cols.some((c, i) => c !== SEARCH_COLS[i])) throw new RangeError('search asset: the columns are not the ones the search reads');
  if (!states || typeof states !== 'object' || Array.isArray(states)) throw new TypeError('search asset: expected the states\' counts');
  const seen = new Set();
  const decoded = rows.map((row, i) => {
    if (!Array.isArray(row) || row.length !== SEARCH_COLS.length) throw new RangeError(`search asset: row ${i} is not ${SEARCH_COLS.length} values`);
    const [ccn, name, city, state, kind] = row;
    if (typeof ccn !== 'string' || !CCN.test(ccn) || seen.has(ccn)) throw new RangeError(`search asset: row ${i} has no CCN of its own`);
    seen.add(ccn);
    if (typeof name !== 'string' || !name) throw new RangeError(`search asset: row ${i} has no name`);
    if (city !== null && typeof city !== 'string') throw new RangeError(`search asset: row ${i} has a city that is no text`);
    if (typeof state !== 'string' || !STATE_CODE.test(state)) throw new RangeError(`search asset: row ${i} has no state code`);
    if (typeof kind !== 'string' || !KINDS.has(kind)) throw new RangeError(`search asset: row ${i} has a kind the search has no word for`);
    return { ccn, name, city, state, kind };
  });
  const counts = {};
  for (const [code, n] of Object.entries(states)) {
    if (!STATE_CODES.has(code) || !Number.isInteger(n) || n < 0) throw new RangeError('search asset: a state\'s count is not a count of one of the fifty states and DC');
    counts[code] = n;
  }
  return { rows: decoded, states: counts };
}

// Fetches and decodes the search asset. Rejects with an Error naming the HTTP status; the combobox shows its one quiet
// "didn't load" line, and the next focus tries again (mountHubSearch fetches it once per page).
export function loadSearchAsset(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`search asset: ${url} answered ${res.status}`);
    return res.json();
  }).then(decodeSearchAsset);
}

// A hospital's second line: "City, ST · kind", or its place alone for a hospital of unknown kind.
function hospitalSub({ city, state, kind }) {
  const place = placeText({ city, state });
  const word = has(COPY, KIND_KEY + kind) ? fill(KIND_KEY + kind) : '';
  return place && word ? fill('searchHospitalSub', { place, kind: word }) : place || word;
}

// The search entries (web/client/search.js buildIndex), from the search asset as loadSearchAsset decodes it: each
// hospital by name, with its place and kind under it, found also by its city and state and, as its key, its CCN; each
// state with the number of hospitals the asset counts in it (the map's count: the state's line there says the same
// number), found by its name and, as its key, its code.
export function hubEntries({ rows, states }) {
  const found = rows.map((h) => {
    const { ccn, name, city, state } = h;
    return { type: 'hospital', key: ccn, label: name, sub: hospitalSub(h), extra: [city, state].filter(Boolean).join(' '), href: hospitalPathOf('hub', ccn) };
  });
  const kind = fill('searchKindState');
  const inStates = US_STATES.map(([code, , name]) => {
    const n = has(states, code) ? states[code] : 0;
    return { type: 'state', key: code, label: name, sub: n === 1 ? fill('searchPlaceSubOne', { kind }) : fill('searchPlaceSub', { kind, n: count(n) }), extra: '', href: `/#state=${code}` };
  });
  return [...inStates, ...found];
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
// default). loadAsset(src) resolves to { rows, states } (loadSearchAsset's).
export function mountHubSearch(forms, { loadAsset = loadSearchAsset, open = (href) => window.location.assign(href) } = {}) {
  const entries = once((src) => loadAsset(src).then(hubEntries));
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
