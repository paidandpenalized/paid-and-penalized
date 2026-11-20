// The calculator's state in the browser, as pure steps: where a page starts (a ?h= or a link's h), what a shared link
// applies over a hospital's numbers, what a typed box does, the link the page writes and shares, and the hospital "Show
// one at random" draws. No DOM: client/calc.js runs these against the page, and the tests run them alone. The state's
// shape is calc-view.js's.
import { clamp } from '../../../engine/js/stats.js';
import { BAND_DEFAULT, MISSING_QUALITY } from '../../../engine/js/team/params.js';
import { parseMoney, parsePct } from '../../../web/client/parse-input.js';
import { DEFAULT_SKIP_STATE } from '../../../web/skip-state.js';
import { initialState } from '../../../web/team/opening.js';
import { CALC, DEFAULT_TRACK } from '../web/constants.js';
import { MAX_EPISODES, MAX_PRICE, RANGES, decodeTeam, encodeTeam } from './share.js';


// Where a page opens, once it knows which participants the calculator has (known(ccn)): the hospital a link names
// (#team&h=…, readLink's), else the address's ?h= (query), else the default. A link's values apply only to the hospital
// it names: when that hospital is unknown (not a participant still in TEAM, a stale link, or a file that didn't load) its
// values are dropped (dropped: true, for the page to say so) and the page opens on the ?h= or the default. A link that
// names no hospital applies to whichever opens. Returns { ccn, values (or null), dropped }.
// current: the hospital already showing, when a link arrives on a page already open (a hashchange): a link that names
// no hospital then applies to it.
export function arrival({ link = null, query = null, defaultCcn, known, current = null }) {
  const named = link?.ccn;
  const knows = (ccn) => Boolean(ccn) && (ccn === defaultCcn || known(ccn));
  if (named && knows(named)) return { ccn: named, values: link.values, dropped: false };
  if (link && !named && current) return { ccn: current, values: link.values, dropped: false };
  const values = named ? null : link?.values ?? null;
  return { ccn: knows(query) ? query : defaultCcn, values, dropped: Boolean(named) && Object.keys(link.values).length > 0 };
}

// Each box the reader can type in: how its text is read, the range it takes and its decimals (the share link's own,
// share.js RANGES), and where the value goes (a path in the state; a category or measure box names its key after the
// dot: n.LEJR).
const MAX_AMOUNT = MAX_EPISODES * MAX_PRICE;
export const BOXES = Object.freeze({
  n: { parse: parseMoney, ...RANGES.n, path: ['ov', 'n'] },
  p: { parse: parseMoney, ...RANGES.p, path: ['ov', 'p'] },
  sk: { parse: parsePct, ...RANGES.sk, path: ['sk'] },
  q: { parse: parsePct, ...RANGES.q, path: ['q'] },
  band: { parse: parsePct, ...RANGES.b, path: null },
  earn: { parse: parseMoney, lo: 0, hi: MAX_AMOUNT, decimals: 0, path: null },
  owe: { parse: parseMoney, lo: 0, hi: MAX_AMOUNT, decimals: 0, path: null },
});
// The reader's own numbers: typed (or carried by a link), each shown as "your number" and named in state.mine. A row's
// spending (sk) is a scenario input, as the slider is: never one.
const OWN = new Set(['n', 'p', 'q']);

const round = (x, decimals) => Math.round(x * 10 ** decimals) / 10 ** decimals + 0;
// An "all five" spending held to the slider's reach (+ 0: never -0).
const toSlider = (s) => clamp(s, -CALC.slider, CALC.slider) + 0;
const copyState = (s) => ({ ...s, sk: { ...s.sk }, ov: { n: { ...s.ov.n }, p: { ...s.ov.p } }, lv: { ...s.lv }, q: { ...s.q }, mine: new Set(s.mine) });

// A box's value read from its text: { value } when the text is a number in the box's range (rounded to its decimals),
// else null.
function readBox(key, text) {
  const box = BOXES[key.split('.')[0]];
  const x = box?.parse(text);
  if (x === null || x === undefined || x < box.lo || x > box.hi) return null;
  return { value: round(x, box.decimals) };
}

// The value a box shows with nothing of the reader's in it: the hospital's public number (a measure with none shows
// CMS's missing-data score), or, for a row's spending, the slider's.
function publicValue(state, hosp, key) {
  const [group, name] = key.split('.');
  if (group === 'n') return hosp.cats[name].n;
  if (group === 'p') return hosp.cats[name].price;
  if (group === 'sk') return state.s;
  if (group === 'q') return hosp.quality[name]?.pct ?? MISSING_QUALITY;
  return null;
}

// The value a box shows now (its state's, else the hospital's), for comparing what was typed against it.
function current(state, hosp, key) {
  const [group, name] = key.split('.');
  if (group === 'n') return state.ov.n[name] ?? hosp.cats[name].n;
  if (group === 'p') return state.ov.p[name] ?? hosp.cats[name].price;
  if (group === 'sk') return state.sk[name] ?? state.s;
  if (group === 'q') return state.q[name] ?? hosp.quality[name]?.pct ?? MISSING_QUALITY;
  return state[group];
}

// The state after the reader types a number into a box (key: 'n.LEJR', 'q.falls', 'band', 'earn'…). A value that equals
// what the box already holds changes nothing; any other becomes the reader's own (state.mine) where it is a number of
// theirs. text '' clears the box: it goes back to the public number (or, for a row's spending, back to the slider).
// Returns { state, ok }: ok false when the text is not a number in the box's range (the state is then unchanged).
export function typeInto(state, hosp, key, text) {
  const [group, name] = key.split('.');
  const box = BOXES[group];
  if (!box) throw new RangeError(`calculator: no box ${key}`);
  const next = copyState(state);
  if (text.trim() === '') {
    if (box.path) {
      delete box.path.reduce((at, k) => at[k], next)[name];
      next.mine.delete(key);
    } else if (group === 'earn' || group === 'owe') next[group] = null;
    else return { state, ok: false };
    return { state: next, ok: true };
  }
  const read = readBox(key, text);
  if (!read) return { state, ok: false };
  if (read.value === round(current(state, hosp, key) ?? NaN, box.decimals)) return { state, ok: true };
  if (box.path) {
    const at = box.path.reduce((o, k) => o[k], next);
    // The public number typed back (or a displayed 50 retyped, or a row's spending equal to the slider) is not the
    // reader's: the box goes back to following it.
    if (read.value === round(publicValue(state, hosp, key), box.decimals)) {
      delete at[name];
      next.mine.delete(key);
      return { state: next, ok: true };
    }
    at[name] = read.value;
  } else next[group] = read.value;
  if (OWN.has(group)) next.mine.add(key);
  if (group === 'sk') next.moved = true;
  return { state: next, ok: true };
}

// A box's commit from where the reader's edit began (start: the state when the box took the focus): what typeInto makes
// of the final text, or, when the box can't take it, start itself, so an out-of-range number never leaves behind the
// last in-range prefix the keystrokes applied ("250000" in a box that takes up to 100,000 never leaves 25,000).
export function commitBox(start, hosp, key, text) {
  const r = typeInto(start, hosp, key, text);
  return r.ok ? r : { state: start, ok: false };
}

// The "all five" slider, the track, a low-volume box.
export const setSlider = (state, s) => ({ ...copyState(state), s: toSlider(s), moved: true });
export const setTrack = (state, track) => ({ ...copyState(state), track });
// A low-volume box set back to the hospital's own flag is not the reader's.
export function setLowVolume(state, hosp, cat, checked) {
  const next = copyState(state);
  if (checked === hosp.cats[cat].lowVolume) {
    delete next.lv[cat];
    next.mine.delete(`lv.${cat}`);
  } else {
    next.lv[cat] = checked;
    next.mine.add(`lv.${cat}`);
  }
  return next;
}

// The state another hospital opens with when the reader moves to it: its own opening state, keeping the reader's "all
// five" spending and band (they were comparing); its rows' spending is its own, so "set" is the slider's alone.
export const carryOver = (state, hosp) => ({ ...initialState(hosp), s: state.s, band: state.band, moved: state.s !== 0 });

// A shared link's values (decodeTeam's partial state) over a hospital's opening state: every own number it carries is the
// reader's ("your number"), its spending counts as set, and its "all five" spending is held to the slider's reach.
export function applyLink(state, link) {
  const next = copyState(state);
  if (link.track !== undefined) next.track = link.track;
  if (link.s !== undefined) next.s = toSlider(link.s);
  if (link.band !== undefined) next.band = link.band;
  for (const [cat, v] of Object.entries(link.sk ?? {})) next.sk[cat] = v;
  for (const g of ['n', 'p']) for (const [cat, v] of Object.entries(link.ov?.[g] ?? {})) { next.ov[g][cat] = v; next.mine.add(`${g}.${cat}`); }
  for (const [cat, v] of Object.entries(link.lv ?? {})) { next.lv[cat] = v; next.mine.add(`lv.${cat}`); }
  for (const [m, v] of Object.entries(link.q ?? {})) { next.q[m] = v; next.mine.add(`q.${m}`); }
  next.moved = next.s !== 0 || Object.keys(next.sk).length > 0;
  return next;
}

// Whether a state is a scenario someone set, not the hospital's opening one: any track, spending (the slider's or a
// row's), band or number of the reader's. (A link that only names a hospital is not.)
export function isScenario(state, hosp) {
  const base = initialState(hosp);
  return state.track !== base.track || state.s !== base.s || state.band !== base.band || Object.keys(state.sk).length > 0 || state.mine.size > 0;
}

// The link's state: the hospital, then only what differs from its opening state (the track, the slider and the band at
// their defaults are left out), so a plain pick is #team&h=<ccn>.
function shareState(state) {
  const out = { ccn: state.ccn, sk: state.sk, ov: state.ov, q: state.q, lv: state.lv };
  if (state.track !== DEFAULT_TRACK) out.track = state.track;
  if (state.s !== 0) out.s = state.s;
  if (state.band !== BAND_DEFAULT * 100) out.band = state.band;
  return out;
}

// The fragment for the page's address or a shared link: public inputs only, unless includeMine.
export const fragmentOf = (state, { includeMine = false } = {}) => encodeTeam(shareState(state), { includeMine });

// The address to write for the calculator's state: this page's path, its query exactly as it is (a ?h= is the family's
// followed hospital: the calculator reads it, never writes it; its own hospital is the fragment's h), and the state's
// fragment.
export const addressOf = ({ pathname, search }, state) => `${pathname}${search}${fragmentOf(state)}`;

// "Show one at random": a participant still in TEAM (pool: { ccn, state } from the calculator's file and the family
// search's), never one in DEFAULT_SKIP_STATE, never the one showing (not). rng: () => [0, 1). null for an empty pool.
export function randomPick(pool, rng, not = null) {
  const from = pool.filter((r) => r.state !== DEFAULT_SKIP_STATE && r.ccn !== not);
  return from.length ? from[Math.floor(rng() * from.length)].ccn : null;
}

// The keys a link carries, checked: the hospital it names (or undefined), its values and the keys it couldn't use.
export function readLink(hash) {
  const { state, rejected } = decodeTeam(hash);
  const { ccn, ...values } = state;
  return { ccn, values, rejected };
}

