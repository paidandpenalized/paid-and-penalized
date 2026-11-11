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

// Each case's share as printed: at shareDecimals, and a share that still prints as zero as "under" the smallest share the
// decimals print (copy shareUnder), never "0.000%".
export function caseShareTexts(shares) {
  const dp = shareDecimals(shares);
  return shares.map((s) => {
    const text = pct(s, dp);
    return isZero(text) ? fill('shareUnder', { tiny: pct(unit(dp), dp) }) : text;
  });
}

// The headline's range: { low, high } (the printed low and high cases) when both print as numbers and differ; else
// { under }, the smallest share at three decimals above the high case, as "under" it (the range is too small to print as
// two numbers, so the headline gives its bound, never "X to X" or a zero).
export function shareRange(shares) {
  const texts = caseShareTexts(shares);
  const low = texts[0];
  const high = texts[texts.length - 1];
  const dp = DECIMALS[DECIMALS.length - 1];
  const numbers = !isZero(pct(shares[0], shareDecimals(shares))) && low !== high;
  if (numbers) return { low, high };
  const bound = (Math.floor(shares[shares.length - 1] / unit(dp)) + 1) * unit(dp);
  return { under: fill('shareUnder', { tiny: pct(bound, dp) }) };
}
