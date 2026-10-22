// What a hospital page compares a hospital with, computed at build time from CMS's file and the hospital master:
// where its score and each measure's value sit among every hospital's (ranks and binned distributions), the groups it
// belongs to (its state, region and metro area, teaching status, size, ownership, urban or rural) with each group's
// scores and share cut, the measure that would lower its score most at the national median, and its nearest
// hospitals. Pure: data in, result out. nationalContext() is built once per build; every page reads it.
import { isAssigned, isDecided } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { whatIf } from '../../../engine/js/hacrp/whatif.js';
import { median } from '../../../engine/js/stats.js';
import { BED_BANDS, FEW_IN_GROUP, NEAREST, RIDGE_BINS } from './constants.js';

// Miles per radian of the Earth's mean radius (IUGG), for great-circle distances between hospitals.
const EARTH_MILES = 3958.8;
const RAD = Math.PI / 180;
export function miles([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

// How many of a sorted list are below x, and how many above it.
function below(sorted, x) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}
function above(sorted, x) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= x) lo = mid + 1; else hi = mid; }
  return sorted.length - lo;
}

// Equal-width bin edges over [lo, hi] with `at` as an edge (CMS's lowest Yes score, so no bin straddles the line).
export function edgesAround(lo, hi, at, bins) {
  const step = (hi - lo) / bins;
  const k0 = Math.floor((lo - at) / step);
  const k1 = Math.ceil((hi - at) / step);
  const edges = [];
  for (let k = k0; k <= k1; k++) edges.push(Number((at + k * step).toFixed(12)));
  return edges;
}

// Counts per bin for values on fixed edges; a value past either outer edge counts in the outer bin.
export function countBins(values, edges) {
  const counts = new Array(edges.length - 1).fill(0);
  for (const v of values) {
    let i = below(edges, v) - 1;
    if (edges[i + 1] === v) i += 1;
    counts[Math.min(Math.max(i, 0), counts.length - 1)] += 1;
  }
  return counts;
}

// A bed count's band: the index of the first BED_BANDS edge above it (0 under the first edge), or null.
export const bedBand = (beds) => (Number.isInteger(beds) ? BED_BANDS.filter((edge) => beds >= edge).length : null);

// Each group kind a hospital belongs to, in the order a page lists them: its key from the master (null: unknown, so
// the hospital is in no group of that kind).
const KINDS = [
  ['nation', () => 'all'],
  ['region', (r) => r.region ?? null],
  ['state', (r) => r.state ?? null],
  ['metro', (r) => r.cbsa ?? null],
  ['teach', (r) => r.teach ?? null],
  ['beds', (r) => bedBand(r.beds)],
  ['own', (r) => (['Nonprofit', 'Government', 'For-profit'].includes(r.own) ? r.own : null)],
  ['urban', (r) => (r.urban === null || r.urban === undefined ? null : String(r.urban))],
];
export const GROUP_KINDS = Object.freeze(KINDS.map(([kind]) => kind));

// A measure's flag for a compact glyph: 'assigned' (CMS gave the worst score), 'none' (no score on it), 'worse'
// (a value above the national median) or 'better' (at or below it).
function measureFlag(m, p) {
  if (m.z === null) return 'none';
  if (isAssigned(m)) return 'assigned';
  if (m.value === null) return 'none';
  return m.value > medianAt(p) ? 'worse' : 'better';
}

// hospitals: CMS's rows; master: Map ccn -> master record; model: { params, boundary }.
export function nationalContext({ hospitals, master, model }) {
  const { lowestYes } = model.boundary;
  const scored = hospitals.filter((h) => h.total !== null);
  const scores = scored.map((h) => h.total).sort((a, b) => a - b);
  const decided = hospitals.filter(isDecided);
  const domain = [scores[0], scores.at(-1)];
  const edges = edgesAround(domain[0], domain[1], lowestYes, RIDGE_BINS);

  // Each hospital with a score, as the comparisons read it.
  const rows = scored.map((h) => {
    const r = master.get(h.ccn);
    return {
      ccn: h.ccn,
      total: h.total,
      totalText: h.totalText,
      decision: h.paymentReduction,
      decided: isDecided(h),
      keys: Object.fromEntries(KINDS.map(([kind, of]) => [kind, of(r)])),
      point: Number.isFinite(r.lat) && Number.isFinite(r.lon) ? [r.lon, r.lat] : null,
      name: r.name,
      city: r.city,
      state: r.state,
      flags: MEASURE_IDS.map((id) => measureFlag(h.measures[id], model.params[id])),
    };
  });
  const byCcn = new Map(rows.map((row) => [row.ccn, row]));

  // Each measure's published values, sorted, and its distribution on the ruler's own axis (ruler.js domain).
  const measures = Object.fromEntries(MEASURE_IDS.map((id) => {
    const values = hospitals.map((h) => h.measures[id].value).filter((v) => v !== null).sort((a, b) => a - b);
    return [id, { values, n: values.length }];
  }));

  // A group's scores (all scored members) and its decided members' counts, remembered by kind and key.
  const groups = new Map();
  function group(kind, key) {
    const id = `${kind}:${key}`;
    if (!groups.has(id)) {
      const members = rows.filter((row) => row.keys[kind] === key);
      const sortedScores = members.map((row) => row.total).sort((a, b) => a - b);
      const dec = members.filter((row) => row.decided);
      groups.set(id, {
        kind, key,
        scored: members.length,
        decided: dec.length,
        yes: dec.filter((row) => row.decision === 'Yes').length,
        median: sortedScores.length ? median(sortedScores) : null,
        scores: sortedScores,
        // Columns over the shared edges: decided members only, as the program page's histogram counts.
        bins: countBins(dec.map((row) => row.total), edges),
      });
    }
    return groups.get(id);
  }

  return {
    scores,
    domain,
    edges,
    medianScore: median(scores),
    decidedCount: decided.length,
    measures,
    // Where x sits among every scored hospital's score: how many are below it and above it, of n.
    rankOf: (x) => ({ below: below(scores, x), above: above(scores, x), n: scores.length }),
    // Where a value sits among a measure's published values.
    measureRank: (id, x) => ({ below: below(measures[id].values, x), above: above(measures[id].values, x), n: measures[id].n }),
    // The groups a scored hospital belongs to that have at least FEW_IN_GROUP decided members, in KINDS order, with
    // its own rank among each group's scores.
    groupsOf(ccn) {
      const row = byCcn.get(ccn);
      if (!row) return [];
      return KINDS.map(([kind]) => row.keys[kind])
        .map((key, i) => (key === null ? null : group(KINDS[i][0], key)))
        .filter((g) => g && g.decided >= FEW_IN_GROUP)
        .map((g) => ({ ...g, below: below(g.scores, row.total), above: above(g.scores, row.total) }));
    },
    // The NEAREST other hospitals with a score and a place, nearest first: { ...row, miles }.
    nearest(ccn, point, k = NEAREST) {
      if (!point) return [];
      return rows.filter((row) => row.ccn !== ccn && row.point)
        .map((row) => ({ ...row, miles: miles(point, row.point) }))
        .sort((a, b) => a.miles - b.miles || (a.ccn < b.ccn ? -1 : 1))
        .slice(0, k);
    },
  };
}

// For a scored hospital: the measure (measured, above its national median) whose value at the national median
// would lower the Total HAC Score most, with the score it would then be: { id, median, after, drop }; null when no
// measure qualifies. Uses the what-if's own arithmetic (the engine's whatIf), so the page and the what-if agree.
export function biggestLever(hospital, model) {
  if (hospital.total === null) return null;
  let best = null;
  for (const id of MEASURE_IDS) {
    const m = hospital.measures[id];
    if (m.z === null || m.value === null || isAssigned(m)) continue;
    const at = medianAt(model.params[id]);
    if (!(m.value > at)) continue;
    const r = whatIf(hospital, model, { [id]: at });
    const drop = hospital.total - r.after.score;
    if (drop > 0 && (!best || drop > best.drop)) best = { id, median: at, after: r.after.score, drop, flag: r.after.flag };
  }
  return best;
}
