// The calculator's share link: its state in the URL fragment (#team&h=010001&t=2&s=5&sk.LEJR=-3&b=5). The fragment
// never reaches a server, but a link can be stale or tampered with, so decodeTeam treats it as untrusted input: it keeps
// only keys it knows, numbers that match a strict grammar (clamped into range), and never throws. The reader's own
// numbers (episode counts, target prices, quality percentiles, low-volume flags) ride along only when the reader asks.
// The what-if's codec (web/whatif/fragment.js) cannot carry negative values, so TEAM has its own; the tag test is shared.
import { has } from '../../../engine/js/has.js';
import { isScenarioHash } from '../../../web/whatif/fragment.js';
import { BAND_MAX, BAND_MIN, CATEGORIES, MEASURES, SOLVE_SPAN, TRACKS } from '../../../engine/js/team/params.js';

const TAG = 'team';
// A link longer than this is ignored whole: the longest honest one is about 350 characters.
export const MAX_LENGTH = 1000;
export const TOO_LONG = '<too long>';
// An ASCII minus, digits, an optional fraction: no plus, exponent, hex, unicode minus, currency sign, comma or blank.
const NUMBER = /^-?\d{1,15}(\.\d{1,9})?$/;
const CCN = /^[0-9A-Z]{6}$/;
// Ceilings for a reader's own inputs, past any real hospital: no category has 100,000 episodes in a baseline period, and
// an average target price of $10,000,000 is far above any episode's. They keep a hand-edited link from carrying a number
// that overflows the page's arithmetic or layout; they are guards, not CMS rules.
export const MAX_EPISODES = 100000;
export const MAX_PRICE = 10000000;
const PCT_SPAN = SOLVE_SPAN * 100;
// Rejected key names are echoed back by the page; keep a hostile one short.
const KEY_SHOWN = 40;

const round = (x, decimals) => { const f = 10 ** decimals; return Math.round(x * f) / f; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// -0 prints as "0" but equals 0 only loosely; normalize so no state or link carries it.
const clean = (x) => (x === 0 ? 0 : x);
const tidy = (x, lo, hi, decimals) => clean(clamp(round(x, decimals), lo, hi));

// Each whitelisted key's range, decimals and where it lands in the state. A prefix key (sk.LEJR) names a group.
const SCALAR = { s: [-PCT_SPAN, PCT_SPAN, 1], b: [BAND_MIN * 100, BAND_MAX * 100, 1] };
const GROUPS = {
  sk: [-PCT_SPAN, PCT_SPAN, 1, CATEGORIES],
  n: [0, MAX_EPISODES, 0, CATEGORIES],
  p: [0, MAX_PRICE, 0, CATEGORIES],
  q: [0, 100, 1, Object.keys(MEASURES)],
};
const FLAG_GROUP = 'lv';

// Where a decoded group value goes: state.sk, state.ov.n, state.ov.p, state.lv, state.q.
function put(state, group, name, value) {
  if (group === 'n' || group === 'p') ((state.ov ??= {})[group] ??= {})[name] = value;
  else (state[group] ??= {})[name] = value;
}

// { state, rejected }: state holds only the keys that passed, as a partial state to merge over the page's defaults;
// rejected lists the other keys' names (never their values), once each. A repeated key is rejected whole, as in the
// what-if. A link over MAX_LENGTH is ignored whole.
export function decodeTeam(hash) {
  const state = {};
  if (!isScenarioHash(hash, TAG)) return { state, rejected: [] };
  if (hash.length > MAX_LENGTH) return { state, rejected: [TOO_LONG] };

  const seen = new Map();
  for (const part of hash.slice(TAG.length + 2).split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? null : part.slice(eq + 1);
    seen.set(key, seen.has(key) ? undefined : value);
  }

  const rejected = new Set();
  for (const [key, value] of seen) {
    if (!accept(state, key, value)) rejected.add(key.slice(0, KEY_SHOWN));
  }
  return { state, rejected: [...rejected] };
}

// Writes one key's value into state when both the key and the value are valid; false otherwise.
function accept(state, key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'h') { if (!CCN.test(value)) return false; state.ccn = value; return true; }
  if (key === 't') { if (!/^[123]$/.test(value) || !has(TRACKS, value)) return false; state.track = Number(value); return true; }
  if (has(SCALAR, key)) {
    if (!NUMBER.test(value)) return false;
    const [lo, hi, d] = SCALAR[key];
    state[key === 'b' ? 'band' : key] = tidy(Number(value), lo, hi, d);
    return true;
  }
  const dot = key.indexOf('.');
  if (dot === -1) return false;
  const group = key.slice(0, dot);
  const name = key.slice(dot + 1);
  if (group === FLAG_GROUP) {
    if (!CATEGORIES.includes(name) || (value !== '1' && value !== '0')) return false;
    put(state, group, name, value === '1');
    return true;
  }
  if (!has(GROUPS, group) || !GROUPS[group][3].includes(name) || !NUMBER.test(value)) return false;
  const [lo, hi, d] = GROUPS[group];
  put(state, group, name, tidy(Number(value), lo, hi, d));
  return true;
}

// The calculator's state as a fragment; '' when there is nothing to carry. Keys come in a fixed order. Percents are
// written to one decimal and dollars and counts as whole numbers. A value that is not a finite number, or a key the
// decoder would reject, is left out. Without includeMine the reader's own numbers (n, p, q, lv) are never written, even
// if the state holds them.
export function encodeTeam(state, { includeMine = false } = {}) {
  const st = state && typeof state === 'object' ? state : {};
  const parts = [];
  const add = (key, x, [lo, hi, d]) => { if (typeof x === 'number' && Number.isFinite(x)) parts.push(`${key}=${tidy(x, lo, hi, d)}`); };

  if (typeof st.ccn === 'string' && CCN.test(st.ccn)) parts.push(`h=${st.ccn}`);
  if (has(TRACKS, String(st.track))) parts.push(`t=${st.track}`);
  add('s', st.s, SCALAR.s);
  for (const c of CATEGORIES) add(`sk.${c}`, st.sk?.[c], GROUPS.sk);
  add('b', st.band, SCALAR.b);
  if (includeMine) {
    for (const c of CATEGORIES) add(`n.${c}`, st.ov?.n?.[c], GROUPS.n);
    for (const c of CATEGORIES) add(`p.${c}`, st.ov?.p?.[c], GROUPS.p);
    for (const k of Object.keys(MEASURES)) add(`q.${k}`, st.q?.[k], GROUPS.q);
    for (const c of CATEGORIES) if (typeof st.lv?.[c] === 'boolean') parts.push(`${FLAG_GROUP}.${c}=${st.lv[c] ? 1 : 0}`);
  }
  return parts.length ? `#${[TAG, ...parts].join('&')}` : '';
}
