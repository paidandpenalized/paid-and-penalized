// A hospital page's what-if (figures/whatif.js): the sliders move the ratios, and the cut, the factor, the dollars and the
// waterfall under them are worked out again in the browser by the same functions the page was built with (whatif-data.js:
// whatIfPaf for the factor, Worksheet R's rows for the parts). "Reset" puts every ratio back; "Bring all to median" sets each
// ratio over its peer median to the median. Without this script the sliders stay disabled at the actual ratios.
import { mountCharts } from '../../../web/client/figure.js';
import { peerMedian } from '../../../engine/js/hrrp/formula.js';
import { WHATIF_DATA_ID, WI_STEP, clientHospital, liveWords, resultWords, whatIfState, whatIfWaterfall } from '../web/figures/whatif-data.js';
import { waterfallPair } from '../web/figures/waterfall.js';
import { t } from '../web/hospital/copy.js';
import { ratio } from '../web/numbers.js';

const hook = (root, name) => root.querySelector(`[data-wi="${name}"]`);

export function mountWhatIf() {
  const root = document.querySelector('[data-hosp-whatif]');
  const script = document.getElementById(WHATIF_DATA_ID);
  if (!root || !script) return;
  const data = JSON.parse(script.textContent);
  const { h, meta } = clientHospital(data);
  const fig = root.closest('figure[data-figure]');
  const parts = hook(root, 'parts');
  const rows = [...root.querySelectorAll('li[data-cond]')].map((li) => {
    const { cond } = li.dataset;
    return { cond, range: li.querySelector('input[data-wi="range"]'), val: li.querySelector('[data-wi="val"]'), err: h.c[cond].err, med: peerMedian(meta, h.peer, cond) };
  });
  // Only the ratios the reader has moved; the rest stay at the hospital's own, exactly.
  const over = {};
  let frame = 0;

  const draw = () => {
    frame = 0;
    const words = resultWords(whatIfState(h, meta, over));
    for (const key of ['cut', 'factor', 'dollars']) hook(root, key).textContent = words[key];
    // Markup from the chart code, which escapes every value it writes.
    parts.innerHTML = waterfallPair(whatIfWaterfall(h, meta, data.conditions, over), t('wiWfAlt')).text;
    // The tooltip layers of the drawings just replaced go with them.
    fig?.querySelectorAll(':scope > .fig__tip').forEach((tip) => tip.remove());
    if (fig) mountCharts(fig, parts);
  };
  const paint = () => { frame ||= requestAnimationFrame(draw); };
  const announce = () => { hook(root, 'live').textContent = liveWords(whatIfState(h, meta, over)); };

  // A condition's ratio set to value, or back to the actual one (null); one left at the actual ratio (to the step) is not "moved",
  // unless exact. move: also put the slider's thumb there (a button's doing; a drag has put it where it is).
  const set = (row, value, { exact = false, move = false } = {}) => {
    if (value === null || (!exact && Math.abs(value - row.err) < WI_STEP / 2)) delete over[row.cond]; else over[row.cond] = value;
    const shown = over[row.cond] ?? row.err;
    row.val.textContent = ratio(shown, 3);
    if (move) row.range.value = String(shown);
  };
  for (const row of rows) {
    row.range.addEventListener('input', () => { set(row, Number(row.range.value)); paint(); });
    row.range.addEventListener('change', announce);
  }
  hook(root, 'reset').addEventListener('click', () => {
    for (const row of rows) set(row, null, { move: true });
    paint();
    announce();
  });
  hook(root, 'median').addEventListener('click', () => {
    // The median itself, exactly: a ratio over it by less than half a step still comes down to it.
    for (const row of rows) set(row, row.err > row.med ? row.med : null, { exact: true, move: true });
    paint();
    announce();
  });

  hook(root, 'fields').disabled = false;
  hook(root, 'buttons').hidden = false;
  hook(root, 'help').hidden = false;
  hook(root, 'nojs').hidden = true;
}
