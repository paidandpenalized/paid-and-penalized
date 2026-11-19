// Part 5 in the browser: the calculator the build drew (web/program/calc.js) comes alive. The default hospital's row is in
// the page; every other participant's is in one hashed file (the section's data-src), fetched with the family search's
// names (data-search) on the reader's first move toward another hospital: the picker's focus, "Show one at random", a
// team:pick from Part 1's lookup, or a ?h= or shared link naming another hospital. Those are the only fetches, and nothing
// the reader types leaves the browser: the state lives in the address's fragment (#team&…, client/share.js), written in
// place (history.replaceState) once the reader pauses, and a copied link carries the reader's own numbers only when they
// tick "include my numbers".
//
// Every change recomputes at once (calc-view.js calcView, the engine's arithmetic) and the page follows by text and
// attributes: the view's markup is built from the kit's escaped template, and each element marked data-v (or input
// marked data-in) takes its fresh twin's text and attributes; an input the reader is typing in keeps what they typed.
// The payoff figure is redrawn once per frame, and the polite sentence for a screen reader once the reader pauses
// (SETTLE_MS). A box that can't take what was typed goes back to its last good value and says so.
import { copyOrSelect } from '../../../web/client/clipboard.js';
import { fetchAsset } from '../../../web/client/fetch-asset.js';
import { followedCcn } from '../../../web/client/follow-ccn.js';
import { SETTLE_MS } from '../../../web/client/live-status.js';
import { mountOmnibox } from '../../../web/client/omnibox.js';
import { once } from '../../../web/client/once.js';
import { buildIndex } from '../../../web/client/search.js';
import { count } from '../../../web/render/format.js';
import { isScenarioHash } from '../../../web/whatif/fragment.js';
import { CALC_COLS, ccnSet, hospOf, whoByCcn } from '../../../web/team/calc-data.js';
import { fill, t } from '../web/calc-copy.js';
import { calcMarkup, calcView } from '../web/calc-view.js';
import { initialState } from '../../../web/team/opening.js';
import { BOXES, addressOf, applyLink, arrival, carryOver, commitBox, fragmentOf, isScenario, randomPick, readLink, setLowVolume, setSlider, setTrack, typeInto } from './calc-state.js';
import { hospitalEntry, loadSearch } from './files.js';

// How long "Link copied." stays before it clears (the copy-button guide's: long enough to read, then no stale words).
const COPIED_MS = 2000;

// The participants' file and the family search's, joined: { rows: Map ccn -> row, who: Map ccn -> { name, city, state },
// named (the participants the search names: the picker's and the random pick's), meta }. Throws on a file of another
// shape.
function joinFiles(calcFile, searchFile) {
  if (String(calcFile?.cols) !== String(CALC_COLS) || !Array.isArray(calcFile.rows) || !calcFile.meta) throw new TypeError('calculator: not the participants\' file');
  const rows = new Map(calcFile.rows.map((r) => [r[0], r]));
  const who = whoByCcn(searchFile);
  return { rows, who, named: [...rows.keys()].filter((ccn) => who.get(ccn)?.name), meta: calcFile.meta };
}

// Each element's key in the drawn markup: its data-v or data-in.
const keyOf = (el) => (el.dataset.v !== undefined ? `v:${el.dataset.v}` : `i:${el.dataset.in}`);
const KEYED = '[data-v], [data-in]';
const SKIP_ATTRS = new Set(['value', 'checked']);

// old takes fresh's attributes (all but an input's value and checked state, which are its live state).
function syncAttrs(old, fresh) {
  for (const { name } of [...old.attributes]) if (!SKIP_ATTRS.has(name) && !fresh.hasAttribute(name)) old.removeAttribute(name);
  for (const { name, value } of fresh.attributes) if (!SKIP_ATTRS.has(name) && old.getAttribute(name) !== value) old.setAttribute(name, value);
}

export function mountCalc(section) {
  const body = section?.querySelector('[data-calc-body]');
  const data = section?.querySelector('#tc-data');
  if (!body || !data) return;
  const first = JSON.parse(data.textContent);
  const tpl = document.createElement('template');
  const sayEl = section.querySelector('[data-calc-say]');
  const banner = section.querySelector('[data-calc-banner]');
  const msg = Object.assign(document.createElement('p'), { className: 'tc-msg' });
  msg.setAttribute('role', 'status');

  let meta = first.meta;
  let hosp = hospOf(first.row, first.who);
  let state = initialState(hosp);
  let view = null;
  let settle = 0;
  let frame = 0;
  let copiedTimer = 0;
  // The participants the file has (the page carries their CCNs), so a hospital outside them fetches nothing.
  const participants = ccnSet(first.ccns);
  // The state when a text box took the focus: where an edit the box can't take goes back to.
  let editStart = null;
  // A change waiting for the next frame (dirty), and whether it must reach the box being typed in (force).
  let dirty = false;
  let forced = false;
  let patches = 0;
  let draws = 0;

  const files = once(() => Promise.all([fetchAsset(section.dataset.src, 'calculator'), loadSearch(section.dataset.search)]).then(([c, s]) => joinFiles(c, s)));
  // The files for a move the reader made, or null after saying they didn't load.
  const filesOrSay = () => files().catch(() => {
    sayEl.textContent = t('calcFailed');
    return null;
  });

  // The parts only the script can work: shown once it runs (and again on each new hospital's markup).
  const showControls = () => {
    for (const el of body.querySelectorAll('[data-calc-copy], [data-calc-slide], .tc-incl, [data-calc-open]')) el.hidden = false;
  };

  // The view's markup as nodes (the kit's escaped template, parsed).
  const parsed = (markup) => {
    tpl.innerHTML = markup.text;
    return tpl.content;
  };

  // The figure: the costliest part to draw. Its draws are counted as the patches are (data-draws).
  const drawFigure = () => {
    const box = body.querySelector('[data-v="fig"]');
    if (!box) return;
    box.replaceChildren(...parsed(view.fig()).childNodes);
    section.dataset.draws = String(++draws);
  };

  // Every keyed element takes its fresh twin's text and attributes; force: inputs too, even the one being typed in.
  const patch = (force = false) => {
    const fresh = parsed(calcMarkup(view, { fig: false }));
    const old = new Map([...body.querySelectorAll(KEYED)].map((el) => [keyOf(el), el]));
    for (const el of fresh.querySelectorAll(KEYED)) {
      const key = keyOf(el);
      const now = old.get(key);
      if (!now || key === 'v:fig') continue;
      syncAttrs(now, el);
      if (el.dataset.in !== undefined) {
        if (now.type === 'checkbox' || now.type === 'radio') now.checked = el.hasAttribute('checked');
        else if (force || now !== document.activeElement) now.value = el.getAttribute('value');
      } else if (!el.firstElementChild) {
        if (now.textContent !== el.textContent) now.textContent = el.textContent;
      } else if (now.innerHTML !== el.innerHTML) {
        now.replaceChildren(...el.childNodes);
      }
    }
    // How many patches the page has made: a measure a test (and a CPU-throttled run) can read.
    section.dataset.patches = String(++patches);
  };

  const say = () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      sayEl.textContent = view.result.say;
      writeAddress();
    }, SETTLE_MS);
  };

  const writeAddress = () => {
    try {
      history.replaceState(history.state, '', addressOf(location, state));
    } catch {
      // A browser that rate-limits replaceState drops this write; the next change writes again.
    }
  };

  const nameIt = () => {
    section.querySelector('[data-v="name"]').textContent = view.hosp.name;
    section.querySelector('[data-v="where"]').textContent = view.hosp.where;
  };

  // A waiting change drawn now: the view recomputed and the page patched (the figure waits for the frame).
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    view = calcView({ hosp, state, team: meta });
    patch(forced);
    forced = false;
    say();
  };
  // The state changed. A reader's stream of moves (a slider drag, typing) is drawn once a frame: the view, the patch and
  // the figure together, so a burst of input events costs one patch. A move that ends something (a commit, a click: now)
  // is drawn at once; its figure follows next frame. The sentence and the address wait for the reader to pause.
  const update = (next, { force = false, now = false } = {}) => {
    state = next;
    dirty = true;
    forced ||= force;
    if (now) flush();
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      flush();
      drawFigure();
    });
  };

  // A new hospital: its whole calculator drawn afresh (the same markup the build draws for its default), the rest of the
  // page told (Part 4's region follows), the address written.
  const show = (h, next, { quiet = false } = {}) => {
    hosp = h;
    state = next;
    dirty = false;
    view = calcView({ hosp, state, team: meta });
    // Another hospital: a link's banner and the keys it couldn't use were about the last one (an arrival sets its own).
    banner.hidden = true;
    section.querySelector('[data-calc-rejected]').textContent = '';
    // The parts the same for every hospital are the build's: kept, moved into the new markup's empty boxes.
    const statics = new Map([...body.querySelectorAll('[data-static]')].map((el) => [el.dataset.static, [...el.childNodes]]));
    body.replaceChildren(...parsed(calcMarkup(view)).childNodes);
    for (const box of body.querySelectorAll('[data-static]')) box.append(...(statics.get(box.dataset.static) ?? []));
    showControls();
    nameIt();
    // One announcement for the move: this one (Part 4 follows quietly).
    if (!quiet) sayEl.textContent = fill('calcLoaded', { name: view.hosp.name });
    document.dispatchEvent(new CustomEvent('team:hospital', { detail: { ccn: hosp.ccn, division: hosp.division } }));
  };

  // Moves to the participant ccn from the file (a pick, a random draw, team:pick): its opening state, keeping the reader's
  // spending and band, as they were comparing. Says so, and writes the address.
  const load = async (ccn, { values = null, quiet = false } = {}) => {
    if (!participants.has(ccn)) return false;
    const f = await filesOrSay();
    const row = f?.rows.get(ccn);
    if (!row) return false;
    meta = f.meta;
    const h = hospOf(row, f.who.get(ccn));
    const next = values ? applyLink(initialState(h), values) : carryOver(state, h);
    show(h, next, { quiet });
    if (!values) writeAddress();
    return true;
  };

  // ---------- the reader's moves ----------

  // A box that can't take what was typed: it goes back to its value before the edit, and the line under it says so.
  const kept = (input) => {
    const box = BOXES[input.dataset.in.split('.')[0]];
    msg.textContent = fill('kept', { lo: count(box.lo), hi: count(box.hi), value: input.value });
    input.closest('td, p, th')?.append(msg);
  };

  body.addEventListener('focusin', (e) => {
    if (e.target.dataset?.in && e.target.type === 'text') editStart = state;
  });
  body.addEventListener('input', (e) => {
    const input = e.target;
    const key = input.dataset?.in;
    if (!key) return;
    msg.remove();
    if (input.type === 'range') update(setSlider(state, Number(input.value)));
    else if (input.type === 'text') {
      // While typing, a number the box takes applies at once; anything else waits for the reader to finish (change).
      const r = typeInto(state, hosp, key, input.value);
      if (r.ok && r.state !== state && input.value.trim() !== '') update(r.state);
    }
  });
  body.addEventListener('change', (e) => {
    const input = e.target;
    const key = input.dataset?.in;
    if (!key) return;
    if (input.type === 'range') flush(); // the drag or the key press ended: its last value drawn now
    else if (input.type === 'radio') update(setTrack(state, Number(input.value)), { now: true });
    else if (input.type === 'checkbox') update(setLowVolume(state, hosp, key.split('.')[1], input.checked), { now: true });
    else if (input.type === 'text') {
      // From where the edit began, never from the last prefix the keystrokes applied.
      const r = commitBox(editStart ?? state, hosp, key, input.value);
      update(r.state, { force: true, now: true });
      if (!r.ok) kept(input);
      editStart = state;
    }
  });
  body.addEventListener('click', (e) => {
    const open = e.target.closest?.('[data-calc-open]');
    if (open) {
      const details = body.querySelector('#tc-q');
      details.open = true;
      details.querySelector('summary').focus();
      return;
    }
    if (e.target.closest?.('[data-calc-copy]')) copyLink(e.target.closest('[data-calc-copy]'));
    else if (e.target.closest?.('[data-calc-slide]')) copySlide(e.target.closest('[data-calc-slide]'));
  });

  // "Copy a link": this page's address with the state's fragment, the reader's own numbers only when ticked. The clipboard
  // is written, never read; where the browser refuses, the link shows, selected, to copy by hand.
  function copyLink(button) {
    const includeMine = Boolean(body.querySelector('[data-calc-incl]')?.checked);
    copyText(button, `${location.origin}${location.pathname}${fragmentOf(state, { includeMine })}`, '[data-calc-link]', { copied: t('copied'), failed: t('copyFailed') });
  }

  // "Copy for a slide": the scenario as plain text (calc-view.js slideOf), as the view now has it, so a change not yet
  // drawn is in it too. Written to the clipboard, never read; the same fallback as the link's.
  function copySlide(button) {
    flush();
    copyText(button, view.slide(), '[data-calc-slide-text]', { copied: t('slideCopied'), failed: t('slideFailed') });
  }

  // The text to the clipboard, saying so beside the buttons; where the browser refuses, it shows in its own line
  // (selector), selected, to copy by hand. The line it didn't use stays hidden.
  async function copyText(button, text, selector, words) {
    const status = button.parentElement.querySelector('.tc-copied');
    const shown = body.querySelector(selector);
    clearTimeout(copiedTimer);
    for (const other of body.querySelectorAll('[data-calc-link], [data-calc-slide-text]')) if (other !== shown) other.hidden = true;
    const reveal = () => {
      shown.textContent = text;
      shown.hidden = false;
    };
    if (await copyOrSelect({ text, node: shown, status, ...words, reveal })) {
      copiedTimer = setTimeout(() => { status.textContent = ''; }, COPIED_MS);
    }
  }

  // ---------- another hospital: the picker, "Show one at random", Part 1's lookup ----------

  const form = section.querySelector('form.omni');
  if (form) {
    const entries = () => files().then((f) => buildIndex(f.named.map((ccn) => hospitalEntry({ ccn, ...f.who.get(ccn) }, ccn))));
    const input = form.querySelector('input');
    mountOmnibox(form, {
      load: entries,
      types: ['hospital'],
      words: {
        empty: t('calcPickEmpty'), kind: { hospital: t('calcPickKind') }, failed: t('calcFailed'), more: null,
        count: (n) => (n === 1 ? t('calcPickCountOne') : fill('calcPickCount', { n: count(n) })),
      },
      open: (ccn) => {
        input.value = '';
        load(ccn);
      },
    });
  }

  const random = section.querySelector('[data-calc-random]');
  random.hidden = false;
  random.addEventListener('click', async () => {
    const f = await filesOrSay();
    if (!f) return;
    const pool = f.named.map((ccn) => ({ ccn, state: f.who.get(ccn).state }));
    const ccn = randomPick(pool, Math.random, hosp.ccn);
    if (ccn) load(ccn);
  });

  // Part 1's lookup picked a hospital in TEAM (it scrolls here and focuses the Part's heading itself).
  document.addEventListener('team:pick', (e) => {
    const ccn = String(e.detail?.ccn ?? '');
    if (ccn !== hosp.ccn) load(ccn);
    else writeAddress();
  });

  // ---------- arrival: a ?h= or a shared link ----------

  // The state a link (#team&…) carries, applied only to the hospital it names (calc-state.js arrival: a link naming a
  // hospital the file doesn't have is dropped, said politely, and the page opens on the ?h= or the default). The file is
  // fetched only when a link or a ?h= names another hospital than the default. A scenario someone made shows the banner,
  // and the keys the link couldn't use are named in it (as text).
  async function arrive({ current = null } = {}) {
    const { hash, search } = location;
    const link = isScenarioHash(hash, 'team') ? readLink(hash) : null;
    const query = followedCcn(search);
    const base = first.row[0];
    let f = null;
    let failed = false;
    // The file only for a participant other than the default: any other hospital is one the file doesn't have.
    if ([link?.ccn, query].some((ccn) => ccn && ccn !== base && participants.has(ccn))) {
      try {
        f = await files();
      } catch {
        failed = true;
      }
    }
    const to = arrival({ link, query, defaultCcn: base, current, known: (ccn) => Boolean(f?.rows.has(ccn)) });
    if (to.ccn !== hosp.ccn || to.values) {
      const home = hospOf(first.row, first.who);
      if (to.ccn === base) show(home, to.values ? applyLink(initialState(home), to.values) : initialState(home), { quiet: true });
      else await load(to.ccn, { values: to.values, quiet: true });
    }
    // One sentence: a file that didn't load is what matters (it is also why a link was dropped).
    if (failed) sayEl.textContent = t('calcFailed');
    else if (to.dropped) sayEl.textContent = t('calcDropped');
    const rejected = section.querySelector('[data-calc-rejected]');
    rejected.textContent = link?.rejected.length ? fill('calcRejected', { keys: link.rejected.join(', ') }) : '';
    banner.hidden = !isScenario(state, hosp);
    if (link) section.scrollIntoView({ block: 'start' });
  }

  // "Start from the public numbers" (the banner's link): this hospital's opening state, the banner gone, the address
  // written; the page stays here.
  banner.querySelector('[data-calc-reset]')?.addEventListener('click', (e) => {
    e.preventDefault();
    update(initialState(hosp), { force: true, now: true });
    banner.hidden = true;
    section.querySelector('[data-calc-rejected]').textContent = '';
    writeAddress();
    section.scrollIntoView({ block: 'start' });
  });

  // The client's first drawing: the build's markup for the default hospital, taken through the same patch every change
  // makes (it changes nothing: the build drew the same view), then the parts only the script works.
  view = calcView({ hosp, state, team: meta });
  patch();
  section.querySelector('.tc__nojs')?.remove();
  showControls();
  // A link pasted into this tab, or Back to one: the page reads it again. (The page's own writes fire no hashchange.)
  window.addEventListener('hashchange', () => {
    if (isScenarioHash(location.hash, 'team') && location.hash !== fragmentOf(state)) arrive({ current: hosp.ccn });
  });
  if (isScenarioHash(location.hash, 'team') || followedCcn(location.search)) arrive();
}
