// Display formatting. CMS's own text is shown as CMS published it; only the hyphen-minus becomes a true minus.
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

// The text with its first letter in upper case, for a label in sentence case; '' stays ''.
export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

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

// x is a fraction: 0.123 with dp 1 reads 12.3%. sign: + before a positive share (never before one that reads 0%).
export function pct(x, dp = 1, { sign = false } = {}) {
  const text = fixed(x, dp, 'percent').replace(/^-(?=\d)/, MINUS);
  return sign && x > 0 && /[1-9]/.test(text) ? `+${text}` : text;
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

// Whole dollars with thousands separators, for a statement whose lines add exactly: "$48,691,794", "−$58,430".
// sign: '+' before a positive amount (an adjustment's direction), else none.
export function dollars(x, { sign = false } = {}) {
  if (!Number.isInteger(x)) throw new RangeError(`dollars: not whole dollars: ${x}`);
  return `${x < 0 ? MINUS : sign && x > 0 ? '+' : ''}$${NUMBER.format(Math.abs(x))}`;
}

// dollars() of the nearest whole dollar, for an average or a share of a total ("$1,234").
export const roundedDollars = (x, options) => dollars(Math.round(x), options);

function longForm(year, month, day, source) {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new RangeError(`not a calendar date: "${source}"`);
  }
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// CMS's MM/DD/YYYY.
export function longDate(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) throw new RangeError(`expected MM/DD/YYYY, got "${text}"`);
  return longForm(Number(m[3]), Number(m[1]), Number(m[2]), text);
}

// YYYY-MM-DD.
export function isoDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError(`expected YYYY-MM-DD, got "${text}"`);
  return longForm(Number(m[1]), Number(m[2]), Number(m[3]), text);
}

// The same dates with the month cut to three letters ("Aug 13, 2026"; May stays May), for a narrow field or a stamp.
const short = (long) => long.replace(/^([A-Z][a-z]{2})[a-z]+/, '$1');
export const shortDate = (text) => short(longDate(text));
export const shortIsoDate = (text) => short(isoDate(text));
