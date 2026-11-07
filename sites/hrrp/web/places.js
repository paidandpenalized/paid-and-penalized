// The places the Readmissions site has pages for: the four Census regions, their nine divisions, the states and the
// metro areas (CBSAs), each with the hospitals in the file it holds. A metro that crosses a state line belongs to the
// state holding most of its hospitals (its breadcrumb) and is listed under every state it reaches. Pure.
import { slug } from '../../../engine/js/hrrp/filters.js';
import { KINDS, placePath } from './links.js';

const byName = (a, b) => a.name.localeCompare(b.name);

// hospitals: the file's rows; meta: its meta (states: code -> name). Returns { list, byKey: Map('kind:key' -> place),
// of(h) -> [region, division, state, metro|null] }. Place: { kind, key, name, path, hospitals, parent, children, states }
// (parent and children are places; states: the codes its hospitals are in, sorted; a metro also has homeState).
export function buildPlaces(hospitals, meta) {
  const byKey = new Map();
  const get = (kind, key, name) => {
    const id = `${kind}:${key}`;
    if (!byKey.has(id)) byKey.set(id, { kind, key, name, path: placePath(kind, key), hospitals: [], parent: null, children: [], states: [] });
    return byKey.get(id);
  };
  const chains = new Map();
  for (const h of hospitals) {
    const region = get('region', slug(h.region), h.region);
    const division = get('division', slug(h.division), h.division);
    const state = get('state', h.st.toLowerCase(), meta.states[h.st] ?? h.st);
    const metro = h.cbsa && h.cbsaName ? get('metro', h.cbsa, h.cbsaName) : null;
    const chain = [region, division, state, metro];
    chains.set(h.id, chain);
    for (const p of chain) p?.hospitals.push(h);
  }
  for (const p of byKey.values()) p.states = [...new Set(p.hospitals.map((h) => h.st))].sort();
  const link = (child, parent) => { child.parent = parent; parent.children.push(child); };
  for (const p of byKey.values()) {
    if (p.kind === 'division') link(p, get('region', slug(p.hospitals[0].region)));
    else if (p.kind === 'state') link(p, get('division', slug(p.hospitals[0].division)));
    else if (p.kind === 'metro') {
      const n = new Map();
      for (const h of p.hospitals) n.set(h.st, (n.get(h.st) ?? 0) + 1);
      // The home state: the one with most of the metro's hospitals (ties: the first code).
      p.homeState = [...n].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      p.parent = byKey.get(`state:${p.homeState.toLowerCase()}`);
      for (const code of p.states) byKey.get(`state:${code.toLowerCase()}`).children.push(p);
    }
  }
  for (const p of byKey.values()) p.children.sort(byName);
  const list = [...byKey.values()].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
  return { list, byKey, of: (h) => chains.get(h.id) };
}
