// Display formatting. CMS's own text is shown as CMS published it; only the hyphen-minus becomes a true minus.
const MINUS = '−';
const NUMBER = new Intl.NumberFormat('en-US');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

// A leading hyphen-minus on a number becomes a true minus; every other character is left as CMS wrote it.
export const cmsText = (text) => String(text).replace(/^-(?=[\d.])/, MINUS);

export const count = (n) => NUMBER.format(n);

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

// x is a fraction: 0.123 with dp 1 reads 12.3%.
export function pct(x, dp = 1) {
  return fixed(x, dp, 'percent').replace(/^-(?=\d)/, MINUS);
}

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
