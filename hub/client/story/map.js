// The story's states you can read (step 7, "By state"): pointing at a state, tapping it or tabbing to it (or to a small
// state's button) writes its line to the readout over the map; a click, a tap, Enter or Space pins it, so the line stays
// once the pointer leaves. Each state is a toggle button, pressed while pinned (aria-pressed), from the moment the map
// answers. The readout is for the eye; a quiet live region beside it ([data-said]) says a state's line when the state is
// picked, never as the pointer passes over the map or the focus moves (a focused state's own name is its line). The
// lines are the server's (hub/home/states.js stateLine): each state's title on the map and each button's name, so the
// readout says exactly what the map's tooltips and a screen reader say, Maryland's included ("not in these programs").
// An address's #state=<code> (the family search's state pick) names a state to pin.
import { US_STATES } from '../../../engine/js/states.js';

const CODES = new Set(US_STATES.map(([code]) => code));
const HASH = /^#state=([A-Za-z]{2})$/;

// The state an address's fragment names: a fifty-state or DC code after "#state=", in either case, as the data writes it
// (capitals); null for anything else.
export function stateFromHash(hash) {
  const m = HASH.exec(hash ?? '');
  const code = m ? m[1].toUpperCase() : null;
  return code && CODES.has(code) ? code : null;
}

// A state's line: its title's text on the map, or its button's name; null for neither.
export const lineOf = (el) => el.querySelector('title')?.textContent || el.getAttribute('aria-label') || null;

// Wires the map in the stage (stageEl): its states (paths with data-st), the small states' buttons, the readout. Shows the
// readout and the buttons (the story's CSS shows them on step 7 only). Returns { active(on), pin(code), fit(), stop() }:
// whether step 7 is being read (the states take the keyboard's focus only then); pin a state by its code; hold the
// readout to its longest line's height at its width now (the map under it then never moves when a longer line shows;
// again after a resize, before the stage measures the map); undo it all (the map as the server wrote it: no buttons, the
// readout's prompt hidden, nothing pinned or said).
export function mountMap(stageEl) {
  const readout = stageEl.querySelector('.readout');
  const said = stageEl.querySelector('[data-said]');
  const smalls = stageEl.querySelector('.smalls');
  const svg = stageEl.querySelector('.smap');
  const paths = [...svg.querySelectorAll('.st[data-st]')];
  const buttons = smalls ? [...smalls.querySelectorAll('[data-st]')] : [];
  const all = [...paths, ...buttons];
  const prompt = readout.textContent;
  let on = null;
  let pinned = null;

  // Each state's button is named by its title, by reference: WebKit computes an SVG title as not displayed, so a name
  // taken from the path's content alone counts as hidden there.
  for (const p of paths) {
    p.setAttribute('role', 'button');
    p.setAttribute('tabindex', '-1');
    const title = p.querySelector('title[id]');
    if (title) p.setAttribute('aria-labelledby', title.id);
  }
  for (const x of all) x.setAttribute('aria-pressed', 'false');
  readout.hidden = false;
  if (smalls) smalls.hidden = false;

  const byCode = (code) => all.find((x) => x.dataset.st === code) ?? null;
  // The readout: the state pointed at or focused, else the pinned one, else the prompt.
  function write() {
    const el = on ?? byCode(pinned);
    const line = el ? lineOf(el) : null;
    readout.textContent = line || prompt;
    readout.classList.toggle('is-line', Boolean(line));
    for (const x of all) {
      x.classList.toggle('is-on', x === on);
      x.classList.toggle('is-pin', x.dataset.st === pinned);
    }
  }
  // Pins the state code (null: none): each state's pressed state, the readout, and its line said to a screen reader (an
  // unpin says nothing more).
  const setPin = (code) => {
    pinned = code;
    for (const x of all) x.setAttribute('aria-pressed', String(x.dataset.st === pinned));
    write();
    const el = byCode(pinned);
    const line = el ? lineOf(el) : null;
    if (said && line) said.textContent = line;
  };
  const stateOf = (target) => {
    const el = target?.closest?.('[data-st]') ?? null;
    return el && all.includes(el) ? el : null;
  };
  const pin = (code) => setPin(pinned === code ? null : code);

  // The readout's height: its tallest line (each state's, as a line shows, and the prompt), measured at its width.
  function fit() {
    const shown = [readout.textContent, readout.classList.contains('is-line')];
    readout.style.minHeight = '';
    let tallest = 0;
    readout.classList.add('is-line');
    for (const line of new Set(all.map(lineOf).filter(Boolean))) {
      readout.textContent = line;
      tallest = Math.max(tallest, readout.getBoundingClientRect().height);
    }
    readout.classList.remove('is-line');
    readout.textContent = prompt;
    tallest = Math.max(tallest, readout.getBoundingClientRect().height);
    readout.textContent = shown[0];
    readout.classList.toggle('is-line', shown[1]);
    readout.style.minHeight = `${Math.ceil(tallest)}px`;
  }
  fit();

  // The listeners sit on the map's figure, an HTML element (an SVG element that listens for focus becomes a stop in the
  // tab order of its own). Every one comes off at once (stop).
  const box = svg.closest('.smapfig') ?? stageEl;
  const off = new AbortController();
  const { signal } = off;
  for (const type of ['pointerover', 'focusin']) {
    box.addEventListener(type, (e) => {
      on = stateOf(e.target);
      write();
    }, { signal });
  }
  // Leaving a state (the next one's pointerover, if any, follows at once).
  for (const type of ['pointerout', 'focusout']) {
    box.addEventListener(type, () => {
      on = null;
      write();
    }, { signal });
  }
  box.addEventListener('click', (e) => {
    const el = stateOf(e.target);
    if (el) pin(el.dataset.st);
  }, { signal });
  // A state's path is a button: Enter and Space press it (a <button> does this itself).
  box.addEventListener('keydown', (e) => {
    const el = stateOf(e.target);
    if (!el || !paths.includes(el) || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    pin(el.dataset.st);
  }, { signal });

  return {
    active(yes) {
      for (const p of paths) p.setAttribute('tabindex', yes ? '0' : '-1');
      if (!yes && on) {
        on = null;
        write();
      }
    },
    // Pin the state (from an address), whatever was pinned before.
    pin: setPin,
    fit,
    stop() {
      off.abort();
      readout.style.minHeight = '';
      on = null;
      pinned = null;
      for (const p of paths) {
        p.removeAttribute('role');
        p.removeAttribute('tabindex');
        p.removeAttribute('aria-labelledby');
      }
      for (const x of all) {
        x.removeAttribute('aria-pressed');
        x.classList.remove('is-on', 'is-pin');
      }
      readout.textContent = prompt;
      readout.classList.remove('is-line');
      readout.hidden = true;
      if (smalls) smalls.hidden = true;
      if (said) said.textContent = '';
    },
  };
}
