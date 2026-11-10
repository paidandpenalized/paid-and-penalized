// Step 3 in the browser (web/program/states.js drew it for the most exposed state, the middle case and the default use
// rate): Figure 3, the headline and the card redrawn from the page's state with the same code when the case, the use rate
// or the selected state moves (and the figure's text alternative with the case and use rate), and the table's dollars and
// shares when the use rate does. A click on a state's dot or its
// gutter circle, or a pick in the card's list (the keyboard's way), selects it; the page's live line then says the new
// headline. Only the drawing on show is redrawn, the other when the width brings it on.
import { money, pct } from '../../../web/render/format.js';
import { SCENARIOS } from '../web/constants.js';
import { cardBody, headlineHtml, headlineOf, numbersOf, statesAlt, statesBody, statesLayout } from '../web/program/states.js';

// section: the step; store: the page's state; model: the strips asset's states (decodeStates); wide: the media query
// list under which the wide drawing shows; say(text): the page's live line.
export function mountStates(section, { store, model, wide, say = () => {} }) {
  const svgs = new Map(['narrow', 'wide'].map((d) => [d, section.querySelector(`svg[data-fit="${d}"]`)]).filter(([, svg]) => svg));
  const head = section.querySelector('[data-st-head]');
  const card = section.querySelector('[data-st-card]');
  const name = section.querySelector('[data-st-name]');
  const pick = section.querySelector('.wr-stcard__pick');
  if (!head || !card || !name || !pick) return;
  const byCode = new Map(model.states.map((s) => [s.code, s]));
  // The table's number cells: data-st is "<code> <lost|share> <case index>".
  const cells = [...section.querySelectorAll('td[data-st]')].map((td) => [td, ...td.dataset.st.split(' ')]);
  const viewOf = (state) => ({ k: SCENARIOS.indexOf(state.scenario), use: state.use });

  const stale = new Set();
  const shown = () => (wide.matches && svgs.has('wide') ? 'wide' : 'narrow');
  const drawOne = (drawing) => {
    const svg = svgs.get(drawing);
    if (!svg) return;
    const state = store.get();
    svg.innerHTML = statesBody(statesLayout({ model, drawing, ...viewOf(state), selected: state.stateCode })).text;
    stale.delete(drawing);
  };
  wide.addEventListener('change', () => stale.has(shown()) && drawOne(shown()));

  const select = (code) => byCode.has(code) && store.set({ stateCode: code });
  for (const svg of svgs.values()) svg.addEventListener('click', (e) => { const g = e.target.closest('[data-st]'); if (g) select(g.dataset.st); });
  pick.addEventListener('change', () => select(pick.value));

  store.subscribe((state, changed) => {
    const moved = changed.has('scenario') || changed.has('use') || changed.has('totals');
    if (!moved && !changed.has('stateCode')) return;
    for (const drawing of svgs.keys()) stale.add(drawing);
    drawOne(shown());
    const view = viewOf(state);
    if (moved) for (const svg of svgs.values()) svg.setAttribute('aria-label', statesAlt(model, view.k, view.use));
    const headline = headlineOf(model, state.stateCode, view);
    head.innerHTML = headlineHtml(headline).text;
    card.innerHTML = cardBody(model, state.stateCode, view).text;
    if (changed.has('stateCode')) {
      pick.value = state.stateCode;
      name.textContent = byCode.get(state.stateCode).name;
      say(`${headline.big}. ${headline.why}`);
    }
    if (changed.has('use')) {
      for (const [td, code, kind, k] of cells) {
        const n = numbersOf(byCode.get(code), Number(k), state.use);
        const v = kind === 'lost' ? n.lost : n.share;
        td.textContent = kind === 'lost' ? money(v) : pct(v, 2);
        td.dataset.value = String(v);
      }
    }
  });
  // The list takes the name's place.
  name.hidden = true;
  pick.hidden = false;
}
