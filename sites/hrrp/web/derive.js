// Ported from Thirty Day Readmissions (web/src/js/data.js and views/explainer.js at 33d1959).
// Values derived from the data file: the edition's phrases, each hospital's derived fields, the cap's steps, the
// program's mean cut by year and the example hospital. Pure.
import { CONDS, contrib, cutPct } from '../../../engine/js/hrrp/formula.js';
import { mean } from '../../../engine/js/stats.js';
import { capitalize, placeText, spelled } from '../../../web/render/format.js';
import { EXAMPLE_MIN_BEDS, EXAMPLE_MIN_FLAGS } from './constants.js';
import { fill } from './copy.js';
import { fmtDate } from './numbers.js';

// A count of years is written in words up to this many ("Fifteen"), in digits after.
const WORDS_UP_TO = 20;

// Every edition-specific phrase, derived from the data so a new fiscal year is a data refresh. The payment year runs
// from October 1 to September 30 (HRRP-06).
export function edition(meta, history) {
  const { fy } = meta;
  const firstFy = history.years[0];
  const nYears = fy - firstFy + 1;
  const payStart = `${fy - 1}-10-01`;
  const payEnd = `${fy}-09-30`;
  const range = (start, end) => fill('editionRange', { start: fmtDate(start, 'long'), end: fmtDate(end, 'long') });
  return {
    fy,
    label: fill('editionLabel', { fy: String(fy) }),
    firstFy,
    nYears,
    yearsWord: nYears <= WORDS_UP_TO ? capitalize(spelled(nYears)) : String(nYears),
    perfLong: range(...meta.perf),
    payShort: fill('editionPayShort', { start: fmtDate(payStart), end: fmtDate(payEnd) }),
    payLong: range(payStart, payEnd),
    payStart: fmtDate(payStart, 'long'),
    span: fill('editionSpan', { first: String(firstFy), last: String(fy) }),
  };
}

// The row with each condition's part of the cut (cx), the conditions CMS flagged and its place line. The row itself is not changed.
export function withDerived(h, meta) {
  return {
    ...h,
    cx: contrib(h, meta).byCond,
    flags: CONDS.filter((k) => h.c[k]?.flag === 1),
    place: placeText({ city: h.city, state: h.st }),
  };
}

// A mark at each year the payment cap changed, read from the data; narrow charts drop "cap" from all but the last.
export function capMarks(national) {
  const steps = national.filter((r, i) => r.cap != null && r.cap !== national[i - 1]?.cap);
  return steps.map((r, i) => {
    const values = { cap: String(r.cap) };
    return { fy: r.fy, label: fill('capMark', values), short: fill(i === steps.length - 1 ? 'capMark' : 'capMarkShort', values) };
  });
}

// The factor of hospital h in year number i of the years (the history's, then the file's own), for meanCutByYear: the
// file's own factor in its year, the history's before it (undefined or null where the hospital was not in that file).
export const pafByYear = ({ history, meta }) => (h, i) => (i === history.years.length ? h.paf : history.paf[h.id]?.[i]);

// Mean cut (%) per year across list, each year over those of them in that year's file; null for a year none of them
// is in. paf(h, i): the hospital's factor in years[i]. Over every hospital this is the national line for area and
// hospital charts: the same hospitals as the area line, unlike CMS's yearly totals.
export function meanCutByYear(list, years, paf) {
  return years.map((_, i) => {
    const vals = list.map((h) => paf(h, i)).filter((v) => v != null);
    return vals.length ? mean(vals.map(cutPct)) : null;
  });
}

// A typical, readable example hospital: penalized, mid-size, several conditions flagged, and of those the median cut.
// list: hospitals with withDerived()'s flags. The first hospital when none fits.
export function exampleHospital(list) {
  const fits = list.filter((h) => h.flags.length >= EXAMPLE_MIN_FLAGS && h.beds >= EXAMPLE_MIN_BEDS && h.paf < 1).sort((a, b) => a.red - b.red);
  return fits[Math.floor(fits.length / 2)] ?? list[0];
}

