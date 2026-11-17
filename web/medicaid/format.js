// A hospital's three case shares (the share of its patient revenue it could lose, low, middle and high), and its three
// cases' dollars, as both the work-requirement page's step 4 and the hub's Medicaid band print them, so one hospital reads
// the same on both. Pure.
import { money, pct } from '../render/format.js';
import { fill } from './copy.js';

// Two decimals, or three where two would print two cases alike or a case as zero; never more.
const DECIMALS = [2, 3];
// The smallest share the decimals print (one in the last place).
const unit = (dp) => 10 ** -(dp + 2);
const isZero = (text) => !/[1-9]/.test(text);

// The decimals the three shares print with: the fewest (DECIMALS) that print them all distinct and none as zero, else
// the most.
function shareDecimals(shares) {
  const ok = (dp) => {
    const texts = shares.map((s) => pct(s, dp));
    return new Set(texts).size === texts.length && !texts.some(isZero);
  };
  return DECIMALS.find(ok) ?? DECIMALS[DECIMALS.length - 1];
}

// One decision for the headline and the cases (ruling R33). Each case at shareDecimals, a share that still prints as zero
// as "under" the smallest share the decimals print (copy shareUnder), never "0.000%". When that leaves any case as
// "under" (the smallest share, read explicitly, not assumed to be the low case's) or the low and high cases printing alike,
// the range is too small to print as numbers: the headline is its bound, the smallest share at three decimals above the
// largest, as "under" it, and every case prints that same bound, so no case reads at or above the headline's.
// { texts: [low, middle, high], range: { low, high } or { under } }.
export function printedShares(shares) {
  const dp = shareDecimals(shares);
  const texts = shares.map((s) => {
    const text = pct(s, dp);
    return isZero(text) ? fill('shareUnder', { tiny: pct(unit(dp), dp) }) : text;
  });
  const low = texts[0];
  const high = texts[texts.length - 1];
  if (!isZero(pct(Math.min(...shares), dp)) && low !== high) return { texts, range: { low, high } };
  const most = DECIMALS[DECIMALS.length - 1];
  const bound = (Math.floor(Math.max(...shares) / unit(most)) + 1) * unit(most);
  const under = fill('shareUnder', { tiny: pct(bound, most) });
  return { texts: shares.map(() => under), range: { under } };
}

// Each case's share as printed (the band's cases, step 4's share row, table, label and factor).
export const caseShareTexts = (shares) => printedShares(shares).texts;

// The headline's range: { low, high } (the printed low and high cases), or { under }, the bound every case also prints.
export const shareRange = (shares) => printedShares(shares).range;

// A hospital's three case losses (its Medicaid revenue lost a year, low, middle and high, at the default use rate) as the
// hub's band prints them: money() of each, step 4's own strings without the minus its record card prints them with
// ("−$2.1M" there, "$2.1M" here beside the word "lose"). null when a case prints as "$0" or the low and high cases print
// alike (no hospital in today's file): the band then prints no dollars, never "$0" or "$X to $X".
export function printedLost(lost) {
  const texts = lost.map((x) => money(x));
  return texts.includes('$0') || texts[0] === texts[texts.length - 1] ? null : texts;
}
