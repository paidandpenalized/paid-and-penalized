// The sentences a hospital's page (hub/hospital/page.js) states about its net against its peers, which the page's script
// restates for another peer group or a what-if. Pure and browser-safe. fill(key, values) fills hub/hospital/copy.js's
// words (the build's fillCopy, or the script's own).
import { HAC_CUT_PCT, rulePercent } from '../../web/programs.js';
import { count, factor, money, pct } from '../../web/render/format.js';

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
// A figure's ink: 'pen' for a cut, 'rew' for a bonus, null for zero.
export const inkOf = (x) => ({ cut: 'pen', bonus: 'rew', zero: null })[signOf(x)];
// Dollars with their sign, as the page's figures print them: "−$1.2M", "+$34K".
export const signedMoney = (dollars) => money(dollars, { sign: true });
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

// The hospital-acquired conditions cut as the page writes it ("1%").
export const HAC_CUT_TEXT = rulePercent(HAC_CUT_PCT);

// The word beside a row's dollars: a cut (hospital-acquired conditions': its flat rate), a bonus, or none. id: 'hrrp',
// 'hacrp', 'hvbp' or 'net'.
export function rowWord(fill, id, dollars) {
  const sign = signOf(dollars);
  if (sign === 'cut') return id === 'hacrp' ? fill('wordHacCut', { rate: HAC_CUT_TEXT }) : fill('wordCut');
  if (sign === 'bonus') return fill('wordBonus');
  return id === 'hrrp' || id === 'hacrp' ? fill('wordNoCut') : fill('wordNoChange');
}

// A program row's sentences: why the hospital has its dollars, what its peers have (each count with its words; the counts
// after the first two only when there are some) and, for a program that lists its hospitals, their median. id: 'hrrp',
// 'hacrp' or 'hvbp'; f: the row's figures (peers.js rowFigures); group: the peers' name.
export function whyText(fill, h, id, f, { fy, group }) {
  const est = h.est;
  const part = (key, n, values = {}) => ({ n, text: fill(key, { n: count(n), ...values }) });
  const parts = {
    hrrp: [part('partCut', f.cut), part('partNoCut', f.none), part('partOut', f.out)],
    hacrp: [part('partHacCut', f.cut, { rate: HAC_CUT_TEXT }), part('partNoCut', f.none)],
    hvbp: [part('partBonus', f.bonus), part('partCut', f.cut), part('partNoChange', f.none), part('partOut', f.out)],
  }[id].filter((p, i) => i < 2 || p.n > 0);
  const peers = fill('whyPeers', { n: count(f.n), group, parts: parts.map((p) => p.text).join(', ') });
  const median = id !== 'hacrp' && f.median !== null ? [fill('whyMedian', { median: signedShareText(f.median) })] : [];
  const own = {
    hrrp: () => (est.hrrpListed ? fill('whyFactor', { factor: factor(est.hrrpFactor) }) : fill('whyHrrpOut', { fy })),
    hacrp: () => (est.cut ? fill('whyHacCut', { fy, rate: HAC_CUT_TEXT }) : fill('whyHacNone', { fy })),
    hvbp: () => (est.vbpListed ? fill('whyFactor', { factor: factor(est.vbpFactor) }) : fill('whyVbpOut', { fy })),
  }[id]();
  return [own, peers, ...median];
}
