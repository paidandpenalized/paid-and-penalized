// The places the HACRP site has pages for, from the hospital master: the four Census regions, their nine divisions,
// the states (with DC) and the metro areas (CBSAs), each with the hospitals in CMS's file it holds and their counts.
// A metro that crosses a state line belongs to the state holding most of its hospitals (its breadcrumb) and is
// listed under every state it reaches. Pure: data in, result out.
import { STATE_NAMES } from '../../../web/charts/geo.js';
import { median } from '../../../engine/js/stats.js';
import { KINDS, placePath } from './place-paths.js';

export { KINDS, placePath };

// A name as a path segment: lowercase words joined by hyphens ("East North Central" -> "east-north-central").
export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The counts every place page and every place row shows, over its rows (programData rows: each scored hospital)
// and the number of CMS rows it holds (file): scored, decided (scored, Yes or No), cut, the middle score, how many
// were scored on all six measures and how many got a CMS-assigned worst score.
export function placeCounts(rows, file) {
  const decided = rows.filter((r) => r.decided);
  const scores = rows.map((r) => r.total).sort((a, b) => a - b);
  return {
    file,
    scored: rows.length,
    decided: decided.length,
    yes: decided.filter((r) => r.yes).length,
    median: scores.length ? median(scores) : null,
    allSix: rows.filter((r) => r.ids.length === 6).length,
    assigned: rows.filter((r) => r.assigned.length).length,
  };
}

// hospitals: CMS's rows; master: Map ccn -> record; rows: programData().rows. Returns { places (by id
// "kind:key"), regions (in order), list (every place) }. Each place: { kind, key, id, name, path, parent (id or
// null), children (ids), ccns (CMS rows inside), rows (scored rows inside), counts, states (a metro's state codes) }.
export function buildPlaces({ hospitals, master, rows }) {
  const places = new Map();
  const rowOf = new Map(rows.map((r) => [r.ccn, r]));
  const get = (kind, key, name, parent) => {
    const id = `${kind}:${key}`;
    if (!places.has(id)) places.set(id, { kind, key, id, name, path: placePath(kind, key), parent, children: [], ccns: [], states: new Map() });
    return places.get(id);
  };
  for (const h of hospitals) {
    const r = master.get(h.ccn);
    if (!r?.region || !r.division || !STATE_NAMES[r.state]) continue;
    const region = get('region', slug(r.region), r.region, null);
    const division = get('division', slug(r.division), r.division, region.id);
    const state = get('state', r.state.toLowerCase(), STATE_NAMES[r.state], division.id);
    const chain = [region, division, state];
    if (r.cbsa && r.cbsaName) {
      const metro = get('metro', r.cbsa, r.cbsaName, null);
      metro.states.set(r.state, (metro.states.get(r.state) ?? 0) + 1);
      chain.push(metro);
    }
    for (const p of chain) p.ccns.push(h.ccn);
  }
  for (const p of places.values()) {
    if (p.kind === 'metro') {
      // The metro's home state: the one with most of its hospitals (ties: the first code).
      const [home] = [...p.states].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      p.parent = `state:${home.toLowerCase()}`;
    }
    p.stateCodes = [...p.states.keys()].sort();
    delete p.states;
    p.rows = p.ccns.map((c) => rowOf.get(c)).filter(Boolean);
    p.counts = placeCounts(p.rows, p.ccns.length);
  }
  // Children: a region's divisions, a division's states, a state's metros (every metro reaching it), by name.
  for (const p of places.values()) {
    if (p.kind === 'metro') {
      for (const code of p.stateCodes) places.get(`state:${code.toLowerCase()}`)?.children.push(p.id);
    } else if (p.parent) places.get(p.parent).children.push(p.id);
  }
  const byName = (a, b) => places.get(a).name.localeCompare(places.get(b).name, 'en');
  for (const p of places.values()) p.children.sort(byName);
  const regions = [...places.values()].filter((p) => p.kind === 'region').sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { places, regions, list: [...places.values()] };
}

// A place's name inside a sentence: Census regions and divisions take "the" ("the South", "the Middle Atlantic"), except
// New England, which stands alone; start: the name opens the sentence.
const NO_ARTICLE = new Set(['New England']);
export function nameInText(place, { start = false } = {}) {
  const article = (place.kind === 'region' || place.kind === 'division') && !NO_ARTICLE.has(place.name);
  if (!article) return place.name;
  return `${start ? 'The' : 'the'} ${place.name}`;
}

// The chain of places above a place, from its region down to its parent (a metro's: its home state's chain).
export function ancestors(places, place) {
  const out = [];
  for (let id = place.parent; id; id = places.get(id).parent) out.unshift(places.get(id));
  return out;
}
