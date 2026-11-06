// Ported from Thirty Day Readmissions (web/src/js/model.js at 33d1959).
// The Readmissions site's number formatting. Built on web/render/format.js where the output is identical; "—" for a
// missing or non-finite value, as the source printed it.
import { count, decimal, isoDate, money, shortIsoDate, signed } from '../../../web/render/format.js';

const DASH = '—';
const missing = (v) => v == null || !Number.isFinite(v);

// A percentage already in percent units (2.5 is "2.50%"). The source's toFixed is kept: format.js pct() takes a fraction.
export const fmtPct = (v, dp = 2) => (missing(v) ? DASH : `${v.toFixed(dp)}%`);

// A whole number with thousands separators: 2912 is "2,912".
export const fmtInt = (n) => (missing(n) ? DASH : count(Math.round(n)));

// Dollars shortened: $999, $12K, $1.2M, $120M, $1.2B. A negative takes format.js's true minus; the source printed "$-12K".
export const fmtMoney = (x) => (missing(x) ? DASH : money(x));

// YYYY-MM-DD as "Aug 13, 2026" (month 'short') or "August 13, 2026" ('long').
export const fmtDate = (iso, month = 'short') => (iso == null ? DASH : month === 'long' ? isoDate(iso) : shortIsoDate(iso));

// For export: v rounded to dp decimals, or null (not a dash: this is a value, not text).
export const roundTo = (v, dp) => (Number.isFinite(v) ? Number(v.toFixed(dp)) : null);

// Histogram bin for value v, bins of width w starting at lo; [lower, upper) and robust to float error.
export const binIndex = (v, lo, w) => Math.floor((v - lo) / w + 1e-9);

// How many of list fall under each value of key(item), as a Map.
export const countBy = (list, key) => {
  const n = new Map();
  for (const item of list) {
    const k = key(item);
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return n;
};

// A list in pages of `size`: [[...], [...]], none for an empty list.
export const pagesOf = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// The tie-break every sort here ends on: ids (CCNs, codes) in order, 0 only for equal ones.
export const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// A payment adjustment factor to four decimals, as CMS publishes it: 0.9988, 1.0000.
export const factor4 = (x) => (missing(x) ? DASH : decimal(x, 4));

// An excess readmission ratio (or a peer median) to dp decimals; four as CMS publishes it, three on a slider.
export const ratio = (x, dp = 4) => (missing(x) ? DASH : decimal(x, dp));

// A condition's share of the cut, a fraction, in percentage points to dp decimals and without the unit: 0.00342 is "0.342".
export const points = (x, dp = 3) => (missing(x) ? DASH : decimal(x * 100, dp));

// A ratio's gap from its peer median, as the worksheet's line 4 prints it but signed: "+0.0321", "−0.0173", "0.0000" for none, and
// "< 0.0001" (or "> −0.0001") for a sliver that would print as zero but is not.
export const gapText = (d, sliver = 0.0001) => {
  if (missing(d)) return DASH;
  if (d === 0) return ratio(0);
  if (Math.abs(d) < sliver) return d > 0 ? `< ${ratio(sliver)}` : `> −${ratio(sliver)}`;
  return signed(d, 4);
};
