// Display formatting. CMS's own text is shown as CMS published it; only the hyphen-minus becomes a true minus.
const MINUS = '−';
const NUMBER = new Intl.NumberFormat('en-US');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

// A leading hyphen-minus on a number becomes a true minus; every other character is left as CMS wrote it.
export const cmsText = (text) => String(text).replace(/^-(?=[\d.])/, MINUS);

export const count = (n) => NUMBER.format(n);

function fixed(x, dp, style) {
  return new Intl.NumberFormat('en-US', { style, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(x);
}

// x is a fraction: 0.123 with dp 1 reads 12.3%.
export function pct(x, dp = 1) {
  return fixed(x, dp, 'percent').replace(/^-(?=\d)/, MINUS);
}

// A true minus for negatives, + for positives, no sign for a value that rounds to zero.
export function signed(x, dp = 1) {
  const body = fixed(Math.abs(x), dp, 'decimal');
  if (Number(body.replaceAll(',', '')) === 0) return body;
  return (x < 0 ? MINUS : '+') + body;
}

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
