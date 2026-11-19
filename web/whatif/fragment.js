// The what-if's shareable state: the reader's changed values in the URL fragment (#whatif&CLABSI=1.2&MRSA=0.9).
// The fragment never reaches a server. A link can be stale or tampered with, so decode keeps only what it can
// trust and never throws; the page then opens on CMS's values for everything else. Program-neutral: the site passes
// its measure ids and each measure's { decimals, cap }.
import { has } from '../../engine/js/has.js';
import { toUnit } from '../../engine/js/stats.js';

const TAG = 'whatif';
// A plain decimal: no sign, exponent, hex or blank (Number() would read all of those).
const DECIMAL = /^\d{1,6}(\.\d{1,8})?$/;
// A value may be up to this many times the measure's cap: past the cap the score no longer moves.
export const MAX_FACTOR = 10;
// The highest value a reader may set for a measure (params p): what the number field allows and a link may carry.
export const limitOf = (p) => toUnit(MAX_FACTOR * p.cap, p.decimals);

// A scenario link: #whatif&... A bare #whatif is the section's own anchor and carries no scenario.
// TEAM's signed-number codec (sites/team/client/share.js) shares this helper's parseParts and isScenarioHash.
// Other calculators keep the same shape under their own tag (TEAM's #team&...), so the tag is a parameter.
export const isScenarioHash = (hash, tag = TAG) => typeof hash === 'string' && hash.startsWith(`#${tag}&`);
// Whether a URL fragment is the what-if's: #whatif or a scenario (a skip link's #main and the heading's #whatif-h
// are not).
export const isWhatIfHash = (hash) => hash === `#${TAG}` || isScenarioHash(hash);

// The `key=value&key=value` body as a Map in order of first appearance: a blank part is skipped, a bare key maps to null,
// and a repeated key is poisoned (undefined) so a caller rejects it whole. Shared with TEAM's codec (sites/team/client/share.js).
export function parseParts(body) {
  const seen = new Map();
  for (const part of body.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? null : part.slice(eq + 1);
    seen.set(key, seen.has(key) ? undefined : value);
  }
  return seen;
}

// changes: { [id]: number }. Only ids in `ids` are written, in that order.
export function encode(changes, ids) {
  const parts = ids.filter((id) => has(changes, id)).map((id) => `${id}=${changes[id]}`);
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

  const seen = parseParts(parts.join('&'));

  for (const [key, value] of seen) {
    const p = ids.includes(key) ? params[key] : null;
    const x = p && typeof value === 'string' && DECIMAL.test(value) ? toUnit(Number(value), p.decimals) : NaN;
    if (Number.isFinite(x) && x <= limitOf(p)) changes[key] = x;
    else rejected.add(key);
  }
  return { changes, rejected: [...rejected] };
}
