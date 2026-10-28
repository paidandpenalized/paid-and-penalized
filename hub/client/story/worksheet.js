// The home page's worksheet (below the story, in "Methods, in brief"): one hospital's estimate added up line by line,
// 1 its estimated Medicare inpatient pay, 2 the base the readmissions and value-based factors apply to, 3 to 5 each
// program's dollars, 6 the net = 3 + 4 + 5. The server writes it for the example hospital (hub/home/below.js), which is
// what the page shows without scripts; mountWorksheet refills it when the story's "Find yours" finds a hospital (the
// document's 'hub:select' event, find.js). worksheetModel is pure and serves both, so the two say the same thing the same
// way. The numbers are programDollars' (engine/js/dollars/whatif.js), which reproduces the emitted dollar row, so the
// lines add exactly.
import { programDollars } from '../../../engine/js/dollars/whatif.js';
import { fillCopy } from '../../../web/render/components.js';
import { decimal, dollars, placeText } from '../../../web/render/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { loadHubAsset } from '../../../web/client/hub-asset.js';
import { inProgram } from '../../hospital/peers.js';
import { signOf } from '../../hospital/text.js';
import { COPY } from './copy.js';

// A payment factor as the dollar file has it (to ten places), never shorter than the four places CMS publishes
// Readmissions' in: factorText(0.995) is "0.9950", factorText(1.0014638299) "1.0014638299". Line 2 times the factor less
// one then gives the program's line, to the dollar.
const MIN_PLACES = 4;
const MAX_PLACES = 10;
export function factorText(f) {
  let places = MIN_PLACES;
  while (places < MAX_PLACES && Math.abs(Number(f.toFixed(places)) - f) > 1e-12) places += 1;
  return decimal(f, places);
}

// What the worksheet says about a hospital with an estimate (hubHospitals' or the browser asset's row):
//   text  the words of each element the page marks data-ws="<key>": the CCN, name and place ("City, ST"), each line's
//         dollars (a program the hospital is not in reads "Not in this program", never $0) and the two factors
//   show  which notes show (data-ws-if): each factor's formula when the hospital is in that program, and the HAC line's
//         "in the cut" or "not in the cut"
//   sign  which stamp shows (data-sign): cut, bonus or zero
//   href  the hospital's page
export function worksheetModel(h) {
  const { est } = h;
  const d = programDollars(est);
  const signed = (v) => dollars(v, { sign: true });
  const line = (id, v) => (inProgram(est, id) ? signed(v) : fillCopy(COPY, 'notInProgram'));
  return {
    text: {
      ccn: h.ccn, name: h.name, place: placeText(h),
      total: dollars(est.total), base: dollars(est.base),
      hrrp: line('hrrp', d.hrrp), hrrpF: factorText(est.hrrpFactor),
      hac: signed(d.hac),
      hvbp: line('hvbp', d.hvbp), vbpF: factorText(est.vbpFactor),
      net: signed(d.net),
    },
    show: { hrrp: inProgram(est, 'hrrp'), vbp: inProgram(est, 'hvbp'), cut: est.cut, nocut: !est.cut },
    sign: signOf(d.net),
    href: hospitalPathOf('hub', h.ccn),
  };
}

// The lines whose amount may read "Not in this program", and the program each one's `show` flag names: such a cell is
// marked data-na (words, not a figure, so it may wrap).
export const OUTSIDE = Object.freeze({ hrrp: 'hrrp', hvbp: 'vbp' });

// Writes a hospital's model into the worksheet (root): text into the elements that hold it, the link's address, which
// notes and stamp show, and the example's lead hidden. No element is added.
export function paintWorksheet(root, m) {
  root.dataset.ccn = m.text.ccn;
  for (const el of root.querySelectorAll('[data-ws]')) {
    const key = el.dataset.ws;
    if (key === 'go') el.setAttribute('href', m.href);
    else el.textContent = m.text[key];
    if (key in OUTSIDE) el.toggleAttribute('data-na', !m.show[OUTSIDE[key]]);
  }
  for (const el of root.querySelectorAll('[data-ws-if]')) el.hidden = !m.show[el.dataset.wsIf];
  for (const el of root.querySelectorAll('[data-sign]')) el.hidden = el.dataset.sign !== m.sign;
  for (const el of root.querySelectorAll('[data-ws-ex]')) el.hidden = true;
}

// Follows the hospitals "Find yours" finds. The listener is on before the hub's data arrives: the story may announce a
// hospital (an address's ?h=) as soon as the data loads, so the last one announced waits for it here. Without the data
// the worksheet stays the example's.
export function mountWorksheet(root) {
  const src = root?.dataset.src;
  if (!src) return;
  let byCcn = null;
  let wanted = null;
  const show = () => {
    const h = byCcn?.get(wanted);
    if (h?.est) paintWorksheet(root, worksheetModel(h));
  };
  document.addEventListener('hub:select', (e) => {
    wanted = e.detail?.ccn ?? null;
    show();
  });
  loadHubAsset(src).then((asset) => {
    byCcn = asset.byCcn;
    show();
  }).catch(() => {});
}
