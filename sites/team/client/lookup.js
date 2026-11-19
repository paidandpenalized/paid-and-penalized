// Part 1's lookup, "Is a hospital in TEAM?" (the box sites/team/web/program/who.js writes): any hospital on Medicare's
// list, found by name, city or CCN with the family's matcher (web/client/search.js), and where it stands in TEAM. Nothing
// loads with the page: the box's first focus (or first keystroke) fetches its two files, the family search's names and
// places (data-src) and the lookup's codes and words (data-codes; lookup-copy.js lookupFile), so this script carries no
// copy. A query lists at most SHOWN hospitals, one line each (the tag, the name, the place, the reason, a link), under a
// sentence that counts every match. Only the sentence is live (polite): a screen reader hears the count, and the rows,
// plain content after it, are read as the reader moves on to them. A "yes" links the calculator (?h=<ccn>#calc, which
// works without this script); with it, the click stays on the page: the address carries ?h=, team:pick ({ ccn }) goes to
// the document for the calculator, which scrolls into view (smoothly unless the reader asks for reduced motion) and its
// heading takes the focus. A "no" links the hospital's page across the programs: the hub writes one for every hospital in
// the family search's file, and only those can be listed, since only they have a name here. Escape clears the box.
// Every name, place and reason goes into the page as text.
//
// A plain box over a list of links, not the family's combobox (web/client/omnibox.js): each row is an answer to read,
// with a reason, and a "no" may be one; a combobox's options are picks. Matching every hospital takes a few
// milliseconds, so the work is not split up.
import { CCN } from '../../../engine/js/ccn.js';
import { fetchAsset } from '../../../web/client/fetch-asset.js';
import { once } from '../../../web/client/once.js';
import { buildIndex, search } from '../../../web/client/search.js';
import { count, placeText } from '../../../web/render/format.js';
import { LOOKUP_COLS } from '../web/lookup.js';
import { loadSearch } from './files.js';

// The rows listed at most (the design's: a short answer under the box, not a directory).
export const SHOWN = 5;
// How long typing must pause before the list follows, in milliseconds: long enough that the live region is not read
// out at every letter.
const WAIT = 150;
const SEARCH_COLS = ['ccn', 'name', 'city', 'state'];

const fillIn = (text, values) => text.replace(/\{(\w+)\}/g, (all, k) => values[k] ?? all);

// The two files, joined: { index, standing } with index the matcher's entries (buildIndex) for each hospital the family
// search names and the codes place, and standing each one's [tag, text, link] by CCN. Throws on a file of another shape
// (the box then says the list didn't load).
export function lookupIndex(searchFile, codesFile) {
  const bad = () => new TypeError('lookup: a file is not the one the box reads');
  const cols = searchFile?.cols;
  const at = SEARCH_COLS.map((c) => (Array.isArray(cols) ? cols.indexOf(c) : -1));
  if (at.includes(-1) || !Array.isArray(searchFile.rows)) throw bad();
  const { rows, reasons, hub } = codesFile ?? {};
  if (String(codesFile?.cols) !== String(LOOKUP_COLS) || !Array.isArray(rows) || !reasons || typeof hub !== 'string') throw bad();
  const standing = new Map();
  for (const [ccn, code, arg] of rows) {
    const reason = reasons[JSON.stringify([code, arg])];
    if (!Array.isArray(reason) || reason.length !== 3) throw bad();
    standing.set(ccn, reason);
  }
  const entries = [];
  for (const row of searchFile.rows) {
    const [ccn, name, city, state] = at.map((i) => row[i]);
    const reason = standing.get(ccn);
    if (!reason || !CCN.test(ccn) || typeof name !== 'string') continue;
    const href = reason[2] === 'calc' ? `?h=${ccn}#calc` : `${hub}${ccn.toLowerCase()}/`;
    entries.push({ type: 'hospital', key: ccn, label: name, sub: placeText({ city, state }), extra: [city, state].filter(Boolean).join(' '), href });
  }
  return { index: buildIndex(entries), standing };
}

const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

// One row: the tag, then the name in bold, its place, the reason and the link, as text.
function rowOf(entry, [tag, text, link], words) {
  const yes = tag === 'YES';
  const li = node('li', `tm-res tm-res--${yes ? 'yes' : 'no'}`);
  const a = node('a', '', link === 'calc' ? words.toCalc : words.toHub);
  a.href = entry.href;
  if (link === 'calc') a.dataset.ccn = entry.key;
  const line = node('span');
  line.append(node('strong', '', entry.label), `${entry.sub ? `, ${entry.sub}` : ''}. ${text} `, a);
  li.append(node('b', 'tm-res__tag', yes ? words.yes : words.no), ' ', line);
  return li;
}

// The calculator takes the hospital: the address, the event, the scroll and the focus (the comment at the top).
function pick(ccn) {
  window.history.replaceState(window.history.state, '', `?h=${ccn}#calc`);
  document.dispatchEvent(new CustomEvent('team:pick', { detail: { ccn } }));
  const calc = document.getElementById('calc');
  if (!calc) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  calc.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const id = calc.closest('[aria-labelledby]')?.getAttribute('aria-labelledby');
  const heading = id ? document.getElementById(id) : null;
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

// Runs the box in mount (the [data-team-lookup] element), if there is one. wait: the pause before the list follows.
export function mountLookup(mount, { wait = WAIT } = {}) {
  const input = mount?.querySelector('input');
  const status = mount?.querySelector('[aria-live]');
  const list = mount?.querySelector('.tm-look__list');
  if (!input || !status || !list) return;
  const load = once(() => Promise.all([loadSearch(mount.dataset.src), fetchAsset(mount.dataset.codes, 'lookup')])
    .then(([searchFile, codesFile]) => ({ ...lookupIndex(searchFile, codesFile), words: codesFile.words })));
  let timer = 0;
  const say = (sentence, rows = []) => {
    status.textContent = sentence;
    list.replaceChildren(...rows);
  };

  async function show() {
    const query = input.value;
    if (!query.trim()) {
      say('');
      return;
    }
    let data;
    try {
      data = await load();
    } catch {
      say(mount.dataset.failed);
      return;
    }
    if (input.value !== query) return; // typed on while the files loaded: the next pause lists it
    const { results, total } = search(query, data.index, { limit: SHOWN });
    const w = data.words;
    const sentence = total === 0 ? w.empty : total === 1 ? w.countOne : fillIn(total > results.length ? w.countMore : w.count, { n: count(total), shown: count(results.length) });
    say(sentence, results.map((e) => rowOf(e, data.standing.get(e.key), w)));
  }

  input.addEventListener('focus', () => { load().catch(() => {}); });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(show, wait);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !input.value) return;
    e.preventDefault();
    clearTimeout(timer);
    input.value = '';
    say('');
  });
  list.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-ccn]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    pick(a.dataset.ccn);
  });
  mount.querySelector('.tm-look__nojs')?.remove();
  input.hidden = false;
}
