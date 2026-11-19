// The calculator's data: each TEAM participant in performance year 2 as one compact row, shared by the build and the
// browser. The build puts the default hospital's row in the page (so the calculator works before anything loads) and
// every active participant's in one hashed file the page fetches on the reader's first move toward another hospital;
// both pass through hospOf, so the server's drawing and the browser's first one read the same numbers. Pure: no DOM,
// file or clock; imports only the engine's category list.
import { CATEGORIES } from '../../../engine/js/team/params.js';

// A row: the CCN, the census division, the Track 2 flags (space-separated, '' for none), the participation start date,
// then per category (CATEGORIES order) the episodes, the average target price (to the cent), the hidden cells and the
// low-volume flag (1 or 0), then each public quality measure's percentile and value (null when it has none).
const PUBLIC_MEASURES = Object.freeze(['hybrid_hwr', 'iscmr']);
export const CALC_COLS = Object.freeze(['ccn', 'division', 'flags', 'start',
  ...CATEGORIES.flatMap((c) => [`n.${c}`, `price.${c}`, `hidden.${c}`, `lv.${c}`]),
  ...PUBLIC_MEASURES.flatMap((m) => [`pct.${m}`, `value.${m}`])]);
const PER_CAT = 4;
const HEAD = 4;

const cents = (x) => Math.round(x * 100) / 100;

// One participant of the emitted file (data.js loadTeam: participants[]) as a row.
export function calcRow(p) {
  return [p.ccn, p.division, p.track2Flags.join(' '), p.start,
    ...CATEGORIES.flatMap((c) => {
      const cat = p.cats[c];
      return [cat.n, cents(cat.price), cat.hidden, cat.lowVolume ? 1 : 0];
    }),
    ...PUBLIC_MEASURES.flatMap((m) => [p.quality[m]?.pct ?? null, p.quality[m]?.value ?? null])];
}

// What every hospital's numbers are read against: the year the episode counts come from (the newer of the two Medicare
// data years) and the categories whose regional average is this site's mean, not CMS's (team.categoryAvgDerived).
export const calcMeta = (team) => ({ dataYear: team.meta.mupYears[team.meta.mupYears.length - 1], derived: [...team.categoryAvgDerived] });

// The participants still in TEAM in performance year 2, as one string of their CCNs (six characters each, sorted), for
// the page itself: it knows which hospitals the file has before fetching it, so a ?h= or a link naming any other
// hospital fetches nothing. ccnSet reads it back.
export const activeCcns = (team) => team.participants.filter((p) => p.active).map((p) => p.ccn).sort().join('');
export const ccnSet = (text) => new Set(String(text ?? '').match(/[0-9A-Z]{6}/g) ?? []);

// The file the page fetches: the columns, meta and one row per participant still in TEAM in performance year 2
// (participants that left before it are not offered).
export const calcAsset = (team) => ({ cols: CALC_COLS, meta: calcMeta(team), rows: team.participants.filter((p) => p.active).map(calcRow) });

// A row as the calculator reads it: { ccn, division, flags, start, cats: { CAT: { n, price, hidden, lowVolume } },
// quality: { measure: { pct, value } | null } }, with who ({ name, city, state }, from the family search's file) spread
// in. Throws on a row of another shape, so a bad file is said, never drawn.
export function hospOf(row, who = {}) {
  if (!Array.isArray(row) || row.length !== CALC_COLS.length) throw new TypeError('calculator: a row of another shape');
  const [ccn, division, flags, start] = row;
  const cats = Object.fromEntries(CATEGORIES.map((c, i) => {
    const [n, price, hidden, lv] = row.slice(HEAD + i * PER_CAT, HEAD + (i + 1) * PER_CAT);
    if (!(Number.isInteger(n) && n >= 0 && Number.isFinite(price) && price >= 0 && Number.isInteger(hidden))) throw new TypeError('calculator: a category of another shape');
    return [c, { n, price, hidden, lowVolume: lv === 1 }];
  }));
  const q = row.slice(HEAD + CATEGORIES.length * PER_CAT);
  const quality = Object.fromEntries(PUBLIC_MEASURES.map((m, i) => {
    const [pct, value] = [q[2 * i], q[2 * i + 1]];
    if (pct === null) return [m, null];
    // A percentile from 0 to 100, as the engine takes it (quality.js compositeQuality throws on any other).
    if (!(Number.isFinite(pct) && pct >= 0 && pct <= 100)) throw new TypeError('calculator: a quality percentile of another shape');
    return [m, { pct, value }];
  }));
  return { ccn, division, flags: flags ? flags.split(' ') : [], start, cats, quality, name: who.name ?? null, city: who.city ?? null, state: who.state ?? null };
}

// The family search file's rows as { name, city, state } by CCN: what the build's default hospital, the calculator's
// picker and Part 1's lookup read of it. Throws on a file without those columns.
const WHO_COLS = ['ccn', 'name', 'city', 'state'];
export function whoByCcn(search) {
  const at = WHO_COLS.map((c) => (Array.isArray(search?.cols) ? search.cols.indexOf(c) : -1));
  if (at.includes(-1) || !Array.isArray(search.rows)) throw new TypeError('TEAM: not the family search\'s file');
  const [ccn, name, city, state] = at;
  return new Map(search.rows.map((r) => [r[ccn], { name: r[name], city: r[city], state: r[state] }]));
}

// The family search file's row for ccn as { name, city, state }, or {} when it has none.
export const whoOf = (search, ccn) => whoByCcn(search).get(ccn) ?? {};
