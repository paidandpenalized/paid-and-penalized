// The one script every page loads first (render/layout.js), for the shell around it (render/shell.js): the dark-mode
// buttons, the hospital a reader follows from page to page, the phone's search button and the program tabs' scroll and
// fade. Each part is a function of the elements it works on, so the wiring is tested on a stand-in DOM; start() at the
// bottom finds those elements on a real page. Nothing is stored: the theme lasts for the visit, and the followed
// hospital lives in the address (?h=), so the next visit starts clean. Everything a hospital's name touches is
// textContent or an attribute, never markup. The pure parts of the follow are follow.js's, for any script to share.
import { CCN } from '../../engine/js/ccn.js';
import { CHIP } from '../chip-copy.js';
import { hospitalPathOf } from '../site.js';
import { money } from './format.js';
import { followedCcn, siteAddress, tabHref, tabProgram, withFollow, withoutFollow } from './follow.js';
import { loadHubAsset } from './hub-asset.js';

export { followedCcn, tabHref, tabProgram, withoutFollow };

// ---------- dark mode ----------

// The theme buttons (one in the bar, one in the footer; the CSS shows one at a time), hidden in the markup since they do
// nothing without this script. Either flips data-theme on <html> for this visit only and says so on the document
// ('pp-theme', detail { dark }), so a canvas reads its colors again; both buttons keep aria-pressed in step. The device
// changing its scheme says so too, while the visitor has made no choice.
export function wireTheme({ buttons, root, query, doc }) {
  if (!buttons.length) return;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : query.matches);
  const sync = () => { for (const button of buttons) button.setAttribute('aria-pressed', String(isDark())); };
  const announce = () => doc.dispatchEvent(new CustomEvent('pp-theme', { detail: { dark: isDark() } }));
  for (const button of buttons) {
    button.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      sync();
      announce();
    });
  }
  query.addEventListener('change', () => {
    sync();
    if (!root.dataset.theme) announce();
  });
  sync();
  for (const button of buttons) button.hidden = false;
}

// ---------- the followed hospital ----------

const make = (doc, tag, className, text) => {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
// The chip's words with their {placeholders} filled by a function, so a name holding "$&" is printed, not interpreted.
const fillWords = (words, name, value) => words.replace(`{${name}}`, () => value);

// Fills the empty chip as the build writes it for a hospital's own page: the key, the hospital's name linked to its page
// with its estimated net (none for a hospital with no estimate), and a link that stops following (stop: the same address
// without ?h=).
function fillChip({ chip, doc, row, fy, stop }) {
  const name = make(doc, 'a', 'chip__n');
  name.setAttribute('href', hospitalPathOf('hub', row.ccn));
  name.append(make(doc, 'span', 'chip__t', row.name));
  if (row.est) {
    const value = make(doc, 'span', 'chip__v');
    value.append(make(doc, 'span', 'vh', `${fillWords(CHIP.chipNet, 'fy', String(fy))} `), money(row.est.net, { sign: true }));
    name.append(' ', value);
  }
  const end = make(doc, 'a', 'chip__x', '×');
  end.setAttribute('href', stop);
  end.setAttribute('aria-label', fillWords(CHIP.chipStop, 'name', row.name));
  chip.replaceChildren(make(doc, 'span', 'chip__k', CHIP.chipKey), name, end);
  chip.hidden = false;
}

// Points the header's links at the followed hospital: each program's tab, and the wordmark (the front page keeps it).
// row: the hospital as the asset decodes it, when the page learned it from ?h=; then a tab goes to the program's page for
// it (tabHref). null on a hospital's own page, where the server already wrote every tab that has a page for it, and
// each tab still at a program's folder just carries ?h=. A link that is neither the front page nor a program's folder
// is left as it is.
export function rewriteLinks({ tabs, wordmark }, ccn, row = null) {
  for (const a of tabs) {
    const href = a.getAttribute('href');
    const program = tabProgram(href);
    if (program !== undefined) a.setAttribute('href', row ? tabHref(program, ccn, row) : withFollow(href, ccn));
  }
  if (wordmark?.getAttribute('href') === '/') wordmark.setAttribute('href', withFollow('/', ccn));
}

// What the header does about a followed hospital. On a hospital's page (hospital: the CCN its header names) nothing is
// fetched and a ?h= is ignored; its folder tabs carry it. Elsewhere a ?h= that is a well-formed CCN is looked up in the
// hub's asset (load(), fetched only then) and, when the asset has it, the chip is filled and the links rewritten. A value
// that is malformed, unknown or markup, or an asset that will not load, changes nothing and says nothing.
export async function follow({ hospital, chip, wordmark, tabs, search, here, load, doc }) {
  if (hospital) {
    if (CCN.test(hospital)) rewriteLinks({ tabs, wordmark }, hospital);
    return;
  }
  const ccn = followedCcn(search);
  if (ccn === null) return;
  let asset;
  try {
    asset = await load();
  } catch {
    return;
  }
  const row = asset.byCcn.get(ccn);
  if (!row) return;
  fillChip({ chip, doc, row, fy: asset.fy, stop: withoutFollow(here) });
  rewriteLinks({ tabs, wordmark }, ccn, row);
}

// ---------- the phone's search ----------

// The find button (shown here, since the bar's search is behind it only when a script can open it): it opens the
// search as a row of its own (.fam--searching on the header) and focuses the box; Escape closes the row and returns
// focus to the button, unless the box used that Escape to close its list.
export function wireFind({ header, button, input }) {
  const searching = () => header.classList.contains('fam--searching');
  const set = (open) => {
    header.classList.toggle('fam--searching', open);
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => {
    const open = !searching();
    set(open);
    if (open) input.focus();
  });
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && searching()) {
      set(false);
      button.focus();
    }
  });
  button.hidden = false;
}

// ---------- the program tabs ----------

// The room a tab keeps from the row's left edge, and from its right edge, where a fade (shell.css: 40px) marks more tabs.
const EDGE = 8;
const FADE = 48;

// How far to scroll the row so a tab is whole and clear of the left edge and the right fade: 0 when it already is.
// row, tab: { left, right } in the same coordinates.
export function tabScroll(row, tab) {
  if (tab.left < row.left + EDGE) return tab.left - row.left - EDGE;
  if (tab.right > row.right - FADE) return tab.right - row.right + FADE;
  return 0;
}

// Whether more tabs lie to the right of what the row shows (a pixel's fraction is not more).
export const moreTabs = ({ scrollLeft, clientWidth, scrollWidth }) => scrollLeft + clientWidth < scrollWidth - 1;

// Scrolls the current tab into view (a row that fits needs nothing) and keeps .tabs--more on the nav while more tabs lie
// to the right, as the row scrolls and the window resizes. fonts: a promise for the page's web fonts, which change the
// tabs' widths when they arrive, so the fit is made again then (a tab already clear is left where the reader put it).
export function wireTabs({ nav, row, win, fonts = null }) {
  const mark = () => nav.classList.toggle('tabs--more', moreTabs(row));
  const fit = () => {
    const current = row.querySelector('[aria-current="page"]');
    if (current && row.scrollWidth > row.clientWidth) {
      const by = tabScroll(row.getBoundingClientRect(), current.getBoundingClientRect());
      if (by) row.scrollLeft += by;
    }
    mark();
  };
  row.addEventListener('scroll', mark, { passive: true });
  win.addEventListener('resize', mark, { passive: true });
  fit();
  if (fonts) fonts.then(fit, () => {});
}

// ---------- a page ----------

function start() {
  wireTheme({ buttons: [...document.querySelectorAll('.theme-toggle')], root: document.documentElement, query: window.matchMedia('(prefers-color-scheme: dark)'), doc: document });
  const header = document.querySelector('header.fam');
  if (!header) return;
  // The find button is shown only when the bar holds a search form for it to open (a page without one keeps it hidden).
  const find = header.querySelector('.fam__find');
  const input = header.querySelector('form#omni [role="combobox"]');
  if (find && input) wireFind({ header, button: find, input });
  const nav = header.querySelector('nav.tabs');
  const row = nav?.querySelector('.tabs__scroll');
  if (nav && row) wireTabs({ nav, row, win: window, fonts: document.fonts?.ready ?? null });
  const chip = header.querySelector('[data-chip]');
  if (chip) {
    follow({
      hospital: header.dataset.hospital ?? null,
      chip,
      wordmark: header.querySelector('a.wordmark'),
      tabs: [...header.querySelectorAll('.tabs__scroll a.tab')],
      search: window.location.search,
      here: siteAddress(window.location),
      load: () => loadHubAsset(header.dataset.hubSrc),
      doc: document,
    });
  }
}

if (typeof document !== 'undefined') start();
