// A hospital's three case shares (the share of its patient revenue it could lose, low, middle and high) as both the
// work-requirement page's step 4 and the hub's Medicaid band print them, so one hospital reads the same on both. Pure.
import { pct } from '../render/format.js';
import { fill } from './copy.js';

// Two decimals, or three where two would print two cases alike or a case as zero; never more.
const DECIMALS = [2, 3];
// The smallest share the decimals print (one in the last place).
const unit = (dp) => 10 ** -(dp + 2);
const isZero = (text) => !/[1-9]/.test(text);

// The decimals the three shares print with: the fewest (DECIMALS) that print them all distinct and none as zero, else
// the most.
export function shareDecimals(shares) {
  const ok = (dp) => {
    const texts = shares.map((s) => pct(s, dp));
    return new Set(texts).size === texts.length && !texts.some(isZero);
  };
  return DECIMALS.find(ok) ?? DECIMALS[DECIMALS.length - 1];
}

// One decision for the headline and the cases (ruling R33). Each case at shareDecimals, a share that still prints as zero
// as "under" the smallest share the decimals print (copy shareUnder), never "0.000%". When that leaves the low case as
// "under" or the low and high cases printing alike, the range is too small to print as numbers: the headline is its bound,
// the smallest share at three decimals above the high case, as "under" it, and every case prints that same bound, so no
// case reads at or above the headline's. { texts: [low, middle, high], range: { low, high } or { under } }.
function printed(shares) {
  const dp = shareDecimals(shares);
  const texts = shares.map((s) => {
    const text = pct(s, dp);
    return isZero(text) ? fill('shareUnder', { tiny: pct(unit(dp), dp) }) : text;
  });
  const low = texts[0];
  const high = texts[texts.length - 1];
  if (!isZero(pct(shares[0], dp)) && low !== high) return { texts, range: { low, high } };
  const most = DECIMALS[DECIMALS.length - 1];
  const bound = (Math.floor(shares[shares.length - 1] / unit(most)) + 1) * unit(most);
  const under = fill('shareUnder', { tiny: pct(bound, most) });
  return { texts: shares.map(() => under), range: { under } };
}

// Each case's share as printed (the band's cases, step 4's share row, table, label and factor).
export const caseShareTexts = (shares) => printed(shares).texts;

// The headline's range: { low, high } (the printed low and high cases), or { under }, the bound every case also prints.
export const shareRange = (shares) => printed(shares).range;
