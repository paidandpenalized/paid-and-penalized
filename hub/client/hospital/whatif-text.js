// The what-if's words on a hospital's page: the result sentence the live region says, the handles' aria-valuetext and
// the hypothetical banner. Pure and browser-safe; every dollar says estimated and its fiscal year. The words are
// hub/hospital/copy.js's: "would" and "hypothetical", never a verdict.
import { fillCopy } from '../../../web/render/components.js';
import { decimal, money } from '../../../web/render/format.js';
import { COPY } from '../../hospital/copy.js';
import { ROW_KEY, rowFigures } from '../../hospital/peers.js';
import { HAC_CUT_TEXT, comparison, rowWord, signedShareText } from '../../hospital/text.js';
import { changed, initial, outcome } from './whatif-state.js';

const fill = (key, values) => fillCopy(COPY, key, values);
const factor = (x) => decimal(x, 4);
const usd = (x) => money(x, { sign: true });

// The changes from h's actual state, each a clause of the sentence, in the page's order.
function clauses(state, h) {
  const a = initial(h);
  const out = [];
  if (state.hrrp !== a.hrrp) out.push(fill('wiIfHrrp', { to: factor(state.hrrp), from: factor(a.hrrp) }));
  if (state.hac !== a.hac) out.push(state.hac ? fill('wiIfHacOn', { rate: HAC_CUT_TEXT }) : fill('wiIfHacOff'));
  if (state.hvbp !== a.hvbp) out.push(fill('wiIfHvbp', { to: factor(state.hvbp), from: factor(a.hvbp) }));
  return out;
}
const join = (list) => (list.length < 2 ? list.join('') : fill('wiAnd', { list: list.slice(0, -1).join(', '), last: list[list.length - 1] }));

// The result sentence for state: once changed, what the estimated net would be and the group's median net share; else
// the page's own result sentence (hub/hospital/text.js comparison). peers: h's group; fy, group: the year and the
// group's name.
export function sentence(state, h, peers, { fy, group }) {
  const median = rowFigures(peers, 'net').median;
  if (!changed(state, h)) return comparison(fill, 'result', { share: h.est.share, median, n: peers.length, group });
  const { net } = outcome(state, h);
  return fill('wiIf', {
    changes: join(clauses(state, h)), fy, net: usd(net), share: signedShareText(net / h.est.total), actual: usd(h.est.net),
    median: signedShareText(median),
  });
}

// A row's handle as a screen reader says it: the factor (or the cut) and its estimated dollars, then "hypothetical" once
// the row differs from the actual. id: 'hrrp', 'hacrp' or 'hvbp'.
export function valueText(id, state, h, { fy }) {
  const key = ROW_KEY[id];
  const dollars = outcome(state, h)[key];
  const moved = state[key] !== initial(h)[key] || dollars !== h.est[key];
  const word = rowWord(fill, id, dollars);
  const text = id === 'hacrp'
    ? fill('wiValueHac', { word, fy, amount: usd(dollars) })
    : fill('wiValueFactor', { factor: factor(state[key]), fy, amount: usd(dollars), word });
  return moved ? fill('wiValueHyp', { text }) : text;
}

// The sticky banner's words: the hypothetical estimated net instead of the actual.
export const bannerText = (state, h, { fy }) => fill('wiBanner', { fy, net: usd(outcome(state, h).net), actual: usd(h.est.net) });
