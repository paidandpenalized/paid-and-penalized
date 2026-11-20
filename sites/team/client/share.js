// The calculator's share link: its state in the URL fragment (#team&h=010001&t=2&s=5&sk.LEJR=-3&b=5). The fragment
// never reaches a server, but a link can be stale or tampered with, so decodeTeam treats it as untrusted input: it keeps
// only keys it knows, numbers that match a strict grammar (clamped into range), and never throws. The reader's own
// numbers (episode counts, target prices, quality percentiles, low-volume flags) ride along only when the reader asks.
// The what-if's codec (web/whatif/fragment.js) cannot carry negative values, so TEAM has its own; the tag test is shared.
import { has } from '../../../engine/js/has.js';
import { clamp, toUnit } from '../../../engine/js/stats.js';
import { isScenarioHash, parseParts } from '../../../web/whatif/fragment.js';
import { BAND_MAX, BAND_MIN, CATEGORIES, MEASURES, SOLVE_SPAN, TRACKS } from '../../../engine/js/team/params.js';

const TAG = 'team';
// A link longer than this is ignored whole: the longest honest one is about 350 characters.
const MAX_LENGTH = 1000;
const TOO_LONG = '<too long>';
// An ASCII minus, digits, an optional fraction: no plus, exponent, hex, unicode minus, currency sign, comma or blank.
const NUMBER = /^-?\d{1,15}(\.\d{1,9})?$/;
const CCN = /^[0-9A-Z]{6}$/;
// Ceilings for a reader's own inputs, past any real hospital: no category has 100,000 episodes in a baseline period, and
// an average target price of $10,000,000 is far above any episode's. They keep a hand-edited link from carrying a number
// that overflows the page's arithmetic or layout; they are guards, not CMS rules.
export const MAX_EPISODES = 100000;
export const MAX_PRICE = 10000000;
const PCT_SPAN = SOLVE_SPAN * 100;
// Rejected key names are echoed back by the page (as text); keep a hostile one short. Each is shown as the reader would
// have typed it, percent-decoded, or as it came where it doesn't decode.
const KEY_SHOWN = 40;
// C0 and C1 controls and the bidi controls (embeddings, overrides, isolates, marks): nothing a reader should see echoed,
// as they can reorder or hide the text around them.
const UNSAFE_SHOWN = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
function shownKey(key) {
  let text = key;
  try {
    text = decodeURIComponent(key);
  } catch {
    // A malformed escape: the key as it came.
  }
  return text.replace(UNSAFE_SHOWN, '').slice(0, KEY_SHOWN);
}

// -0 prints as "0" but equals 0 only loosely; normalize so no state or link carries it.
const clean = (x) => (x === 0 ? 0 : x);
const tidy = (x, lo, hi, decimals) => clean(clamp(toUnit(x, decimals), lo, hi));

// Each whitelisted number key, in the order the encoder writes them: its range and decimals, the names it may carry
// (null for a bare key such as `s`), where it lands in the state (a path), and whether it is the reader's own number
// (written only when they ask). A named key (sk.LEJR) is the key, a dot and one of the names.
const MEASURE_KEYS = Object.keys(MEASURES);
const FIELDS = [
  { key: 's', lo: -PCT_SPAN, hi: PCT_SPAN, decimals: 1, names: null, slot: ['s'], mine: false },
  { key: 'sk', lo: -PCT_SPAN, hi: PCT_SPAN, decimals: 1, names: CATEGORIES, slot: ['sk'], mine: false },
  { key: 'b', lo: BAND_MIN * 100, hi: BAND_MAX * 100, decimals: 1, names: null, slot: ['band'], mine: false },
  { key: 'n', lo: 0, hi: MAX_EPISODES, decimals: 0, names: CATEGORIES, slot: ['ov', 'n'], mine: true },
  { key: 'p', lo: 0, hi: MAX_PRICE, decimals: 0, names: CATEGORIES, slot: ['ov', 'p'], mine: true },
  { key: 'q', lo: 0, hi: 100, decimals: 1, names: MEASURE_KEYS, slot: ['q'], mine: true },
];
const FLAG_GROUP = 'lv';
// Each number key's range and decimals, by key: the calculator's boxes take the same (client/calc-state.js BOXES).
export const RANGES = Object.freeze(Object.fromEntries(FIELDS.map(({ key, lo, hi, decimals }) => [key, { lo, hi, decimals }])));

// state[...slot][name] = value, or state[...slot] = value when name is null, making the objects on the way.
function put(state, slot, name, value) {
  const path = name === null ? slot : [...slot, name];
  let at = state;
  for (const k of path.slice(0, -1)) at = at[k] ??= {};
  at[path[path.length - 1]] = value;
}

// { state, rejected }: state holds only the keys that passed, as a partial state to merge over the page's defaults;
// rejected lists the other keys' names (never their values), once each. A repeated key is rejected whole, as in the
// what-if. A link over MAX_LENGTH is ignored whole.
export function decodeTeam(hash) {
  const state = {};
  if (!isScenarioHash(hash, TAG)) return { state, rejected: [] };
  if (hash.length > MAX_LENGTH) return { state, rejected: [TOO_LONG] };

  const seen = parseParts(hash.slice(TAG.length + 2));

  const rejected = new Set();
  for (const [key, value] of seen) {
    if (!accept(state, key, value)) rejected.add(shownKey(key));
  }
  return { state, rejected: [...rejected] };
}

// Writes one key's value into state when both the key and the value are valid; false otherwise.
function accept(state, key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'h') { if (!CCN.test(value)) return false; state.ccn = value; return true; }
  if (key === 't') { if (!has(TRACKS, value)) return false; state.track = Number(value); return true; }
  const dot = key.indexOf('.');
  const group = dot === -1 ? key : key.slice(0, dot);
  const name = dot === -1 ? null : key.slice(dot + 1);
  if (group === FLAG_GROUP && name !== null) {
    if (!CATEGORIES.includes(name) || (value !== '1' && value !== '0')) return false;
    put(state, [FLAG_GROUP], name, value === '1');
    return true;
  }
  const f = FIELDS.find((x) => x.key === group);
  if (!f || (f.names === null ? name !== null : !f.names.includes(name)) || !NUMBER.test(value)) return false;
  put(state, f.slot, name, tidy(Number(value), f.lo, f.hi, f.decimals));
  return true;
}

// The calculator's state as a fragment; '' when there is nothing to carry. Keys come in a fixed order. Percents are
// written to one decimal and dollars and counts as whole numbers. A value that is not a finite number, or a key the
// decoder would reject, is left out. Without includeMine the reader's own numbers (n, p, q, lv) are never written, even
// if the state holds them.
export function encodeTeam(state, { includeMine = false } = {}) {
  const st = state && typeof state === 'object' ? state : {};
  const parts = [];
  const add = (key, x, f) => { if (typeof x === 'number' && Number.isFinite(x)) parts.push(`${key}=${tidy(x, f.lo, f.hi, f.decimals)}`); };
  const read = (f, name) => f.slot.concat(name ?? []).reduce((at, k) => at?.[k], st);

  if (typeof st.ccn === 'string' && CCN.test(st.ccn)) parts.push(`h=${st.ccn}`);
  if (has(TRACKS, String(st.track))) parts.push(`t=${st.track}`);
  for (const f of FIELDS) {
    if (f.mine && !includeMine) continue;
    if (f.names === null) add(f.key, read(f), f);
    else for (const name of f.names) add(`${f.key}.${name}`, read(f, name), f);
  }
  if (includeMine) {
    for (const c of CATEGORIES) if (typeof st.lv?.[c] === 'boolean') parts.push(`${FLAG_GROUP}.${c}=${st.lv[c] ? 1 : 0}`);
  }
  return parts.length ? `#${[TAG, ...parts].join('&')}` : '';
}
