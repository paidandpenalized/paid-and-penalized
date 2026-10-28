// The sentences a hospital's page (hub/hospital/page.js) states about its net against its peers, which the page's script
// restates for another peer group or a what-if. Pure and browser-safe. fill(key, values) fills hub/hospital/copy.js's
// words (the build's fillCopy, or the script's own).
import { count, pct } from '../../web/render/format.js';

// The most decimals a share is printed with.
const MAX_DP = 6;

// A share of pay (a fraction) as the sentences print it, without its sign: two decimals, or more for a share that two
// would print as zero, so a small cut never reads "0.00%" beside dollars that are not zero.
export function shareText(x) {
  for (let dp = 2; dp < MAX_DP; dp++) {
    const text = pct(Math.abs(x), dp);
    if (/[1-9]/.test(text)) return text;
  }
  return pct(Math.abs(x), MAX_DP);
}

// A share as shareText prints it, with its sign: a true minus, + before a positive share, none on zero.
export const signedShareText = (x) => (x === 0 ? pct(0, 2) : `${x < 0 ? '−' : '+'}${shareText(x)}`);

// Which way a figure goes: 'cut' (below zero), 'bonus' (above) or 'zero'.
export const signOf = (x) => (x < 0 ? 'cut' : x > 0 ? 'bonus' : 'zero');
const KEY = { cut: 'Cut', bonus: 'Bonus', zero: 'Zero' };

// The median's phrase: "a 0.57% cut", "a 0.10% bonus" or "no change".
export function medianPhrase(fill, median) {
  const sign = signOf(median);
  return sign === 'zero' ? fill('medianZero') : fill(`median${KEY[sign]}`, { share: shareText(median) });
}

// A sentence comparing the hospital's net with its peers' median: the headline ('head') or the what-if's result ('result').
// share: the hospital's net as a share of its pay; median: its peers' median share; n and group: the peers, counted and
// named ("Alabama hospitals").
export function comparison(fill, kind, { share, median, n, group }) {
  const sign = signOf(share);
  const values = { median: medianPhrase(fill, median), n: count(n), group };
  return fill(`${kind}${KEY[sign]}`, sign === 'zero' ? values : { share: shareText(share), ...values });
}
