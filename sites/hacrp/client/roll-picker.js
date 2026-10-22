// The roll call's state picker (history-figures.js rollFigure), on the program page alone: client/program.js hands it
// to mountRoll (client/explore.js), and the place pages' grids have none, so their script never carries it. Picking a
// state redraws each drawing with that state's hospitals alone, as the build draws a grid (rollCall.js) at the
// drawing's own width and geometry, says in the readout how many were ever cut against the nation's share, and links
// to the state's page; "every state" puts the drawings back as they were built.
import { count, pct } from '../../../web/render/format.js';
import { rollParts } from '../../../web/charts/rollCall.js';
import { everCut } from '../../../engine/js/hacrp/trends.js';
import { fill, t } from '../web/explore/copy.js';
import { placePath } from '../web/place-paths.js';
import { rollBrackets } from '../web/roll-words.js';

// A state's hospitals out of the grid's order, in that order: { ccns, recs, states }. The order is the pages' (trends.js
// rollOrder, which ranks a hospital by its own record and CCN alone), so it is the order the state's page draws.
function stateGrid(hist, code) {
  const js = hist.states.flatMap((st, j) => (st === code ? [j] : []));
  return { ccns: js.map((j) => hist.ccns[j]), recs: js.map((j) => hist.recs[j]), states: js.map((j) => hist.states[j]) };
}

// The picker in a roll call's box, with what mountRoll shares: its drawings (svgs), a drawing's geometry (geomOf), the
// grid's order and names (ready), and pick, which tells it the grid now drawn.
export function mountStatePicker({ box, svgs, geomOf, ready, pick }) {
  const picker = box.querySelector('.roll__pick');
  const select = picker?.querySelector('select');
  if (!select) return;
  const link = picker.querySelector('.roll__open');
  const put = (svg, viewBox, label) => {
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-label', label);
  };
  // Each drawing as built (its nodes, its viewBox and its label), kept before the picker shows, for "every state".
  const built = new Map(svgs.map((svg) => [svg, { nodes: [...svg.childNodes], viewBox: svg.getAttribute('viewBox'), label: svg.getAttribute('aria-label') }]));
  const restore = () => {
    for (const [svg, { nodes, viewBox, label }] of built) {
      svg.replaceChildren(...nodes);
      put(svg, viewBox, label);
    }
  };
  // A state's grid g in each drawing. How many were ever cut and the brackets that say so, in the grid's own words, are
  // the same at every width: worked out once, and the count again in the readout's sentence.
  const draw = (g, fys, code) => {
    const name = select.selectedOptions[0]?.textContent ?? code;
    const n = g.recs.length;
    const ever = everCut(g.recs);
    const brackets = rollBrackets(n, ever);
    const years = fys.map(String);
    const label = fill('rollStateAlt', { state: name, hospitals: count(n) });
    for (const svg of svgs) {
      const width = svg.viewBox.baseVal.width;
      const [left, right, rowH] = geomOf(svg);
      const { height, body } = rollParts({ records: g.recs, years, brackets, blank: t('rollNone'), width, rowH, label: left, right });
      svg.innerHTML = body.text;
      put(svg, `0 0 ${width} ${height}`, label);
    }
    g.say = fill('rollStateSay', { state: name, ever: count(ever), hospitals: count(n), share: pct(ever / n, 0), nation: picker.dataset.nation });
    link.setAttribute('href', placePath('state', code));
    link.textContent = fill('rollStateLink', { state: name });
  };
  picker.hidden = false;
  select.addEventListener('change', () => {
    const show = (s) => {
      const code = select.value;
      const g = s && code ? stateGrid(s.hist, code) : null;
      const picked = g?.ccns.length ? g : null;
      // Either way each drawing's content is swapped, which takes the column outline with it.
      if (picked) draw(picked, s.hist.fys, code);
      else restore();
      link.hidden = !picked;
      pick(picked);
    };
    // A pick whose data won't load goes back to every state, so the select never names a state the grid doesn't show.
    ready().then(show, () => {
      select.value = '';
      show(null);
    });
  });
}
