// The other hospitals in a hospital's area, as plain data: the metro area it is in, or, outside any metro area, the rest of its
// state. Built once for a build (areaGroups, in hospitalContext) because every hospital in an area shows the same table: the
// area's hospitals, largest cut first (then modeled dollars, then CCN), each with the state of its six conditions for the
// glyph. The CSV of the same rows is one file for the area, not one for each hospital in it. Pure.
import { CONDS, condState, contrib } from '../../../../engine/js/hrrp/formula.js';
import { NEIGHBORS_PAGE_SIZE } from '../constants.js';
import { byId } from '../numbers.js';

// A hospital is in a metro area when the row names both its code and its name; otherwise it is outside the metro areas.
export const inMetro = (h) => Boolean(h.cbsa && h.cbsaName);

// The area's key: "metro-<cbsa>" or "state-<xx>" (the state's hospitals outside any metro area).
export const areaKeyOf = (h) => (inMetro(h) ? `metro-${h.cbsa}` : `state-${h.st.toLowerCase()}`);

// The area's CSV name, without folder or extension.
export const areaCsvName = (fy, key) => `hrrp-fy${fy}-${key}-hospitals`;

const bySize = (a, b) => b.h.red - a.h.red || (b.h.pen ?? -1) - (a.h.pen ?? -1) || byId(a.h.id, b.h.id);

// A list of hospitals as table rows, largest cut first (then modeled dollars, then CCN): { h, states (condState for each
// condition, in CONDS order), rank (1-based) }. A hospital page's area table and a place page's hospitals table share it.
export function sizedRows(list, meta) {
  return list.map((h) => {
    const { byCond } = contrib(h, meta);
    return { h, states: CONDS.map((k) => condState(h, k, meta, byCond)) };
  }).sort(bySize).map((r, i) => ({ ...r, rank: i + 1 }));
}

// hospitals: the file's rows; meta: its meta. Returns a Map of area key -> { key, metro, name, state, rows, pages, nCut, csvName }
// for each area with more than one hospital. rows: [{ h, states (condState for each condition, in CONDS order), rank (1-based) }];
// pages: rows in chunks of NEIGHBORS_PAGE_SIZE.
export function areaGroups(hospitals, meta) {
  const groups = new Map();
  for (const h of hospitals) {
    const key = areaKeyOf(h);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  const out = new Map();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const metro = key.startsWith('metro-');
    const rows = sizedRows(list, meta);
    const pages = [];
    for (let i = 0; i < rows.length; i += NEIGHBORS_PAGE_SIZE) pages.push(rows.slice(i, i + NEIGHBORS_PAGE_SIZE));
    out.set(key, {
      key, metro, name: metro ? list[0].cbsaName : (meta.states[list[0].st] ?? list[0].st), rows, pages,
      nCut: rows.filter((r) => r.h.red > 0).length, csvName: areaCsvName(meta.fy, key),
    });
  }
  return out;
}
