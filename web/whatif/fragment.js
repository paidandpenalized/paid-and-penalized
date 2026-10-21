// The what-if's shareable state: the reader's changed values in the URL fragment (#whatif&CLABSI=1.2&MRSA=0.9).
// The fragment never reaches a server. A link can be stale or tampered with, so decode keeps only what it can
// trust and never throws; the page then opens on CMS's values for everything else. Program-neutral: the site passes
// its measure ids and each measure's { decimals, cap }.
import { toUnit } from '../../engine/js/stats.js';

const TAG = 'whatif';
// A plain decimal: no sign, exponent, hex or blank (Number() would read all of those).
const DECIMAL = /^\d{1,6}(\.\d{1,8})?$/;
// A value may be up to this many times the measure's cap: past the cap the score no longer moves.
export const MAX_FACTOR = 10;
// The highest value a reader may set for a measure (params p): what the number field allows and a link may carry.
export const limitOf = (p) => toUnit(MAX_FACTOR * p.cap, p.decimals);

// A scenario link: #whatif&... A bare #whatif is the section's own anchor and carries no scenario.
export const isScenarioHash = (hash) => typeof hash === 'string' && hash.startsWith(`#${TAG}&`);
// Whether a URL fragment is the what-if's: #whatif or a scenario (a skip link's #main and the heading's #whatif-h
// are not).
export const isWhatIfHash = (hash) => hash === `#${TAG}` || isScenarioHash(hash);

// changes: { [id]: number }. Only ids in `ids` are written, in that order.
export function encode(changes, ids) {
  const parts = ids.filter((id) => Object.hasOwn(changes, id)).map((id) => `${id}=${changes[id]}`);
  return parts.length ? `#${[TAG, ...parts].join('&')}` : '';
}

// { changes, rejected }: an id is kept only if it is one of `ids`, appears once, and reads as a plain number in
// [0, MAX_FACTOR x cap], rounded to its display unit. rejected lists every other key, once.
export function decode(hash, { ids, params }) {
  const changes = {};
  const rejected = new Set();
  const text = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
  const [tag, ...parts] = text.split('&');
  if (tag !== TAG) return { changes, rejected: [] };

  const seen = new Map();
  for (const part of parts) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? null : part.slice(eq + 1);
    seen.set(key, seen.has(key) ? undefined : value);
  }

  for (const [key, value] of seen) {
    const p = ids.includes(key) ? params[key] : null;
    const x = p && typeof value === 'string' && DECIMAL.test(value) ? toUnit(Number(value), p.decimals) : NaN;
    if (Number.isFinite(x) && x <= limitOf(p)) changes[key] = x;
    else rejected.add(key);
  }
  return { changes, rejected: [...rejected] };
}
