// Display formatting. CMS's own text is shown as CMS published it; only the hyphen-minus becomes a true minus.
import { isoParts, onCalendar } from '../../engine/js/dates.js';

const MINUS = '−';
const NUMBER = new Intl.NumberFormat('en-US');
const LIST = new Intl.ListFormat('en-US', { type: 'conjunction' });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

// A leading hyphen-minus on a number becomes a true minus; every other character is left as CMS wrote it.
export const cmsText = (text) => String(text).replace(/^-(?=[\d.])/, MINUS);

export const count = (n) => NUMBER.format(n);

// A count with its noun, the noun singular for exactly one: noun(1, 'hospital') is "1 hospital", noun(12, 'cut hospital')
// "12 cut hospitals". plural: for a noun that doesn't take an s.
export const noun = (n, singular, plural = `${singular}s`) => `${count(n)} ${n === 1 ? singular : plural}`;

// Words joined as a list: "A", "A and B", "A, B, and C".
export const listText = (xs) => LIST.format(xs);

// A small count in words ("five"), for a sentence that reads better without the digit; the digits from eleven up.
const NUMBER_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n) => NUMBER_WORDS[n] ?? count(n);

// A whole number from 0 to 99 in words ("thirty", "forty-five"), for a rule's number in a sentence (web/programs.js);
// anything else throws. Unlike numberWord, it never leaves digits.
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function spelled(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError(`spelled: ${String(n)} is not a whole number from 0 to 99`);
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
}

// A share as the words a sentence uses for it: 0.25 is "a quarter" (determiner 'the': "the quarter"), 0.75 is
// "three-quarters", which takes no determiner. Any other share throws; add its word here when a sentence needs it.
const FRACTION_WORDS = new Map([[0.25, 'quarter'], [0.75, 'three-quarters']]);
export function fractionWord(share, determiner = 'a') {
  const word = FRACTION_WORDS.get(share);
  if (word === undefined) throw new RangeError(`fractionWord: no words for the share ${String(share)}`);
  return word.includes('-') ? word : `${determiner} ${word}`;
}

// The text with its first letter in upper case, for a label in sentence case; '' stays ''.
export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// A place as the pages print it: "City, ST", or as much of it as there is ('' for neither).
export const placeText = ({ city, state }) => [city, state].filter(Boolean).join(', ');

// An English ordinal: 1st, 2nd, 3rd, 11th, 22nd, 75th.
export function ordinal(n) {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th');
}

// One formatter per style and decimal count: building an Intl.NumberFormat is the slow part.
const FIXED = new Map();
function fixed(x, dp, style) {
  const key = `${style}:${dp}`;
  if (!FIXED.has(key)) FIXED.set(key, new Intl.NumberFormat('en-US', { style, minimumFractionDigits: dp, maximumFractionDigits: dp }));
  return FIXED.get(key).format(x);
}

// x is a fraction: 0.123 with dp 1 reads 12.3%. A share that reads zero has no sign, however it got there (-0.00004 at
// two decimals is "0.00%", not "−0.00%"); sign: + before a positive share that does not.
export function pct(x, dp = 1, { sign = false } = {}) {
  const raw = fixed(x, dp, 'percent');
  if (!/[1-9]/.test(raw)) return raw.replace(/^-/, '');
  const text = raw.replace(/^-(?=\d)/, MINUS);
  return sign && x > 0 ? `+${text}` : text;
}

// A share as "higher than" or "worse than" may print it: rounded down, never up, so the sentence stays true (74.97%
// reads 74%, never 75%). A float a hair under a whole step (0.75 computed as 0.7499…) still reads the step.
export function pctFloor(x, dp = 0) {
  const unit = 10 ** (dp + 2);
  return pct(Math.floor(x * unit + 1e-9) / unit, dp);
}

// Whether share a is above share b as the page prints them at dp decimals: two shares that print the same are neither
// above nor below each other. Null (no share) is never above.
export const shownAbove = (a, b, dp = 1) => a !== null && b !== null && pct(a, dp) !== pct(b, dp) && a > b;

function withSign(x, dp, plus) {
  const body = fixed(Math.abs(x), dp, 'decimal');
  if (Number(body.replace(/,/g, '')) === 0) return body;
  return (x < 0 ? MINUS : plus) + body;
}

// A fixed number of decimals: a true minus for negatives, no plus sign, no sign on a value that rounds to zero.
export const decimal = (x, dp) => withSign(x, dp, '');

// A payment factor to four decimals, as CMS publishes it: factor(0.9988) is "0.9988", factor(1) "1.0000".
export const factor = (x) => decimal(x, 4);

// As decimal, with + for positives.
export const signed = (x, dp = 1) => withSign(x, dp, '+');

// The number decimal(x, dp) and signed(x, dp) show, so a chart can plot exactly what its text says (Intl's rounding,
// not toFixed's: the two split some ties).
export const shown = (x, dp) => Number(fixed(x, dp, 'decimal').replace(/,/g, '')) + 0; // + 0: never -0

// Dollars, shortened as Thirty Day Readmissions writes them: "$640", "$48K", "$1.2M", "$342M", "$1.0B", a true minus
// for a negative. Each threshold sits at its rounding point, so a value never prints as "$1000K" or "$1000M", and a
// value that rounds to zero has no sign.
const MONEY_STEPS = [
  [999.5e6, (a) => `${(a / 1e9).toFixed(1)}B`],
  [99.95e6, (a) => `${Math.round(a / 1e6)}M`],
  [999.5e3, (a) => `${(a / 1e6).toFixed(1)}M`],
  [999.5, (a) => `${Math.round(a / 1e3)}K`],
  [0, (a) => String(Math.round(a))],
];
const moneyBody = (a) => MONEY_STEPS.find(([from]) => a >= from)[1](a);
// sign: + before a positive amount (never before one that reads $0), as dollars() does.
export function money(x, { sign = false } = {}) {
  if (!Number.isFinite(x)) throw new RangeError(`money: not a number: ${x}`);
  const body = moneyBody(Math.abs(x));
  return `${body === '0' ? '' : x < 0 ? MINUS : sign && x > 0 ? '+' : ''}$${body}`;
}

// A range of dollars, low to high, as money() writes each end: "$850K–$1.2M"; the unit said once when both ends share
// it ("$1.0–1.4M"); " to " when an end is negative, where a dash would read as a minus ("−$12K to $40K").
export function moneyRange(lo, hi) {
  if (!(lo <= hi)) throw new RangeError(`moneyRange: low ${lo} is above high ${hi}`);
  const [a, b] = [money(lo), money(hi)];
  if (lo < 0 || hi < 0) return `${a} to ${b}`;
  const unit = (s) => /[KMB]$/.exec(s)?.[0] ?? '';
  return unit(a) && unit(a) === unit(b) ? `${a.slice(0, -1)}–${b.slice(1)}` : `${a}–${b}`;
}

// Whole dollars with thousands separators, for a statement whose lines add exactly: "$48,691,794", "−$58,430".
// sign: '+' before a positive amount (an adjustment's direction), else none.
export function dollars(x, { sign = false } = {}) {
  if (!Number.isInteger(x)) throw new RangeError(`dollars: not whole dollars: ${x}`);
  return `${x < 0 ? MINUS : sign && x > 0 ? '+' : ''}$${NUMBER.format(Math.abs(x))}`;
}

// dollars() of the nearest whole dollar, for an average or a share of a total ("$1,234").
export const roundedDollars = (x, options) => dollars(Math.round(x), options);

function longForm(year, month, day, source) {
  if (!onCalendar(year, month, day)) throw new RangeError(`not a calendar date: "${source}"`);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// CMS's MM/DD/YYYY.
export function longDate(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) throw new RangeError(`expected MM/DD/YYYY, got "${text}"`);
  return longForm(Number(m[3]), Number(m[1]), Number(m[2]), text);
}

// YYYY-MM-DD.
export const isoDate = (text) => longForm(...isoParts(text), text);

// The month and year of a YYYY-MM-DD date, each for a sentence's own placeholder: { month: 'December', year: '2026' }.
// The day is checked, not said.
export function isoMonth(text) {
  const [year, month, day] = isoParts(text);
  longForm(year, month, day, text);
  return { month: MONTHS[month - 1], year: String(year) };
}

// The same dates with the month cut to three letters ("Aug 13, 2026"; May stays May), for a narrow field or a stamp.
const short = (long) => long.replace(/^([A-Z][a-z]{2})[a-z]+/, '$1');
export const shortDate = (text) => short(longDate(text));
export const shortIsoDate = (text) => short(isoDate(text));
