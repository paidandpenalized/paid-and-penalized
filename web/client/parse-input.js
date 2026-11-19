// Numbers a reader types into a box, as people write them: "$1.2M", "1,200,000", "$41,468", "−5%", "-5", "+2.5 %". Pure:
// text in, a number or null out (null for anything else, never NaN or Infinity, so a caller keeps its last good value).
// The minus may be a hyphen, a true minus or a dash; commas must group thousands; a money amount may end in K, M or B.

// Every kind of minus a keyboard, a phone or a paste gives: hyphen-minus, true minus, en dash, em dash, small and full-width
// hyphen-minus.
const MINUSES = /[\u2212\u2013\u2014\uFE63\uFF0D]/g;
// Spaces of every kind a paste or a locale can bring (\s covers no-break, thin and narrow no-break).
const SPACES = /\s/g;
// A sign, then digits (commas between groups of three, or none), an optional fraction; or a bare fraction.
const NUMBER = /^([+-]?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/;
const UNITS = { k: 1e3, m: 1e6, b: 1e9 };

function parse(text, { prefix = '', suffix = null }) {
  if (typeof text !== 'string') return null;
  let s = text.replace(SPACES, '').replace(MINUSES, '-');
  // A sign may sit before or after the currency sign ("-$5", "$-5").
  if (prefix) s = s.replace(/^([+-]?)\$/, '$1');
  let unit = 1;
  if (suffix === 'money') {
    const m = /[kmb]$/i.exec(s);
    if (m) {
      unit = UNITS[m[0].toLowerCase()];
      s = s.slice(0, -1);
    }
  } else if (suffix === 'pct') {
    s = s.replace(/%$/, '');
  }
  const m = NUMBER.exec(s);
  if (!m) return null;
  const x = Number(m[2].replace(/,/g, '')) * unit * (m[1] === '-' ? -1 : 1);
  return Number.isFinite(x) ? x + 0 : null; // + 0: never -0
}

// Dollars: "$1.2M" is 1200000, "41,468" is 41468, "−$5K" is −5000.
export const parseMoney = (text) => parse(text, { prefix: '$', suffix: 'money' });

// A percent as the reader writes it, in percent units: "−5%" and "-5" are −5, "+2.5 %" is 2.5.
export const parsePct = (text) => parse(text, { suffix: 'pct' });
