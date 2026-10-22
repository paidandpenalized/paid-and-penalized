// What the program page and the place pages draw, computed once per build from CMS's file, the hospital master and
// the fitted model: each hospital as the explorers read it, which measures each hospital was scored on, every
// measure's published values (with the hospitals at zero, at the floor and at the cap), the share cut by kind of
// hospital, how the spread of scores narrows as hospitals are scored on more measures, how closely the measures
// agree, which cut hospitals one measure stood between them and CMS's line, and the hospitals CMS gave its worst
// score on a measure. Pure: data in, result out. Every count here is a count of CMS's rows; the page's words say
// which population each figure counts.
import { decidedHospitals, isAssigned, scoredHospitals } from '../../../engine/js/hacrp/hospital.js';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { medianAt } from '../../../engine/js/hacrp/params.js';
import { median } from '../../../engine/js/stats.js';
import { biggestLever, bedBand } from './compare.js';

// The kinds of hospital the share-cut figure compares, in the order it lists them, each with its groups: [key,
// test on a master record]. A hospital the master knows nothing of for a kind is in none of its groups. Special
// statuses overlap (a hospital can be a rural referral center and a sole community hospital): each is its own group.
export const TYPE_KINDS = Object.freeze([
  ['teach', [['major', (r) => r.teach === 'major'], ['minor', (r) => r.teach === 'minor'], ['none', (r) => r.teach === 'none']]],
  ['beds', [0, 1, 2, 3].map((band) => [String(band), (r) => bedBand(r.beds) === band])],
  ['own', ['Nonprofit', 'For-profit', 'Government'].map((own) => [own, (r) => r.own === own])],
  ['urban', [['true', (r) => r.urban === true], ['false', (r) => r.urban === false]]],
  ['status', ['SCH', 'MDH', 'RRC'].map((code) => [code, (r) => (r.types ?? []).includes(code)])],
]);

// A measure set as a short key ("PSI90+CDI"), in MEASURE_IDS order.
export const patternKey = (ids) => ids.join('+');

// Spearman's rank correlation of two equal-length lists, ties given their average rank.
export function spearman(a, b) {
  if (a.length !== b.length || a.length < 3) throw new RangeError('spearman: two lists of the same length, at least 3');
  const ranks = (xs) => {
    const order = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(xs.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      const avg = (i + j) / 2;
      for (let k = i; k <= j; k++) r[order[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const [ma, mb] = [mean(ra), mean(rb)];
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  // A list with every value the same has no ranks to compare: no correlation (null), never NaN.
  return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
}

const sd = (xs) => {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};

// One measure's published values (sorted) as the figures read them: how many, how many at zero, at or under the
// floor and at or over the cap, how many hospitals CMS assigned its worst score (assigned), and the median as CMS's
// decimals print it. The build and the browser (from the explore asset) both call it.
export function measureSummary(id, values, params, assigned) {
  return {
    id,
    values,
    n: values.length,
    zero: values.filter((v) => v === 0).length,
    atFloor: values.filter((v) => v <= params.floor).length,
    atCap: values.filter((v) => v >= params.cap).length,
    assigned,
    median: medianAt(params),
    params,
  };
}

// hospitals: CMS's rows; master: Map ccn -> master record; model: { params, boundary }.
export function programData({ hospitals, master, model }) {
  const scored = scoredHospitals(hospitals);
  const decided = decidedHospitals(hospitals);
  const decidedSet = new Set(decided);
  const { lowestYes } = model.boundary;

  // Every hospital with a score, as the explorers read it: [ccn, total, yes (1, 0, or null when not subject), the
  // measures it was scored on (a bit each, MEASURE_IDS order), the ones CMS assigned, published values (null for
  // none)], plus its master facts for grouping and its place.
  const rows = scored.map((h) => {
    const r = master.get(h.ccn);
    const ids = MEASURE_IDS.filter((id) => h.measures[id].z !== null);
    return {
      ccn: h.ccn,
      name: r.name,
      city: r.city,
      state: r.state,
      total: h.total,
      totalText: h.totalText,
      decided: decidedSet.has(h),
      yes: decidedSet.has(h) ? h.paymentReduction === 'Yes' : null,
      ids,
      assigned: ids.filter((id) => isAssigned(h.measures[id])),
      values: MEASURE_IDS.map((id) => h.measures[id].value),
      z: MEASURE_IDS.map((id) => h.measures[id].z),
      master: r,
      point: Number.isFinite(r.lat) && Number.isFinite(r.lon) ? [r.lon, r.lat] : null,
    };
  });
  const decidedRows = rows.filter((row) => row.decided);
  const yesRows = decidedRows.filter((row) => row.yes);

  // Which measures each hospital in CMS's file was scored on: one pattern per distinct set, largest first (ties by
  // key), counted over every row, with the cut among the decided. Rows with no score are the empty pattern.
  const patterns = new Map();
  for (const h of hospitals) {
    const ids = MEASURE_IDS.filter((id) => h.measures[id].z !== null);
    const key = patternKey(ids);
    const p = patterns.get(key) ?? { key, ids, n: 0, decided: 0, yes: 0, assigned: 0 };
    p.n += 1;
    if (decidedSet.has(h)) {
      p.decided += 1;
      if (h.paymentReduction === 'Yes') p.yes += 1;
    }
    if (ids.some((id) => isAssigned(h.measures[id]))) p.assigned += 1;
    patterns.set(key, p);
  }
  const coverage = [...patterns.values()].sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));

  // Each measure's published values across CMS's file (CMS fits its floor, mean and cap over these), sorted, with
  // what the figures say of them (measureSummary).
  const measures = Object.fromEntries(MEASURE_IDS.map((id) => {
    const values = hospitals.map((h) => h.measures[id].value).filter((v) => v !== null).sort((a, b) => a - b);
    return [id, measureSummary(id, values, model.params[id], hospitals.filter((h) => isAssigned(h.measures[id])).length)];
  }));

  // The share cut by kind of hospital, over the decided: [{ kind, groups: [{ key, decided, yes }] }], groups with
  // no hospital left out.
  const types = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => {
      const members = decidedRows.filter((row) => test(row.master));
      return { key, decided: members.length, yes: members.filter((row) => row.yes).length };
    }).filter((g) => g.decided > 0),
  }));

  // How the spread of scores narrows with more measures: for 1 to 6 measures scored, the decided hospitals' count,
  // cut, middle score and spread (population SD), and the scores themselves.
  const funnel = MEASURE_IDS.map((_, i) => {
    const k = i + 1;
    const members = decidedRows.filter((row) => row.ids.length === k);
    const scores = members.map((row) => row.total).sort((a, b) => a - b);
    return { k, decided: members.length, yes: members.filter((row) => row.yes).length, median: scores.length ? median(scores) : null, sd: scores.length ? sd(scores) : null };
  });
  // The one-measure patterns, each with its count cut (the starkest contrast the funnel shows).
  const single = coverage.filter((p) => p.ids.length === 1 && p.decided > 0).map((p) => ({ id: p.ids[0], decided: p.decided, yes: p.yes, assigned: p.assigned }));

  // How closely each pair of measures agrees: Spearman's rank correlation over the hospitals with a published value
  // on both, and how many those are.
  const agree = [];
  for (let i = 0; i < MEASURE_IDS.length; i++) {
    for (let j = i + 1; j < MEASURE_IDS.length; j++) {
      const a = [];
      const b = [];
      for (const h of hospitals) {
        const x = h.measures[MEASURE_IDS[i]].value;
        const y = h.measures[MEASURE_IDS[j]].value;
        if (x !== null && y !== null) { a.push(x); b.push(y); }
      }
      // Too few hospitals with both values: no correlation to show (the figure leaves the pair out).
      const rho = a.length >= 3 ? spearman(a, b) : null;
      if (rho !== null) agree.push({ a: MEASURE_IDS[i], b: MEASURE_IDS[j], n: a.length, rho });
    }
  }

  // Each cut hospital's score, and its score had its one costliest measured result been at the national median
  // (compare.js biggestLever: the what-if's own arithmetic); escaped: that alone would have put it at or under CMS's
  // highest No score. A hospital with no measured result above the median has no lever.
  const byCcn = new Map(hospitals.map((h) => [h.ccn, h]));
  const escapes = yesRows.map((row) => {
    const lever = biggestLever(byCcn.get(row.ccn), model);
    return { ccn: row.ccn, total: row.total, after: lever ? lever.after : null, id: lever?.id ?? null, escaped: lever?.flag === 'No' };
  });

  // The hospitals CMS gave its worst score on at least one measure (no data submitted): which measures, and whether
  // CMS cut them; measuredNone: no measured result at all, so the score is CMS's assigned values alone.
  const assigned = decidedRows.filter((row) => row.assigned.length).map((row) => ({
    ccn: row.ccn, ids: row.ids, assigned: row.assigned, yes: row.yes, measuredNone: row.assigned.length === row.ids.length,
  }));

  // Maryland's scored hospitals (CMS's decision N/A): how many sit at or above the lowest score CMS cut elsewhere.
  const notSubject = rows.filter((row) => row.yes === null);
  const maryland = { scored: notSubject.length, above: notSubject.filter((row) => row.total >= lowestYes).length };

  // The measure that added most to each cut hospital's score (its largest z-score; an assigned one counts).
  const drivers = Object.fromEntries(MEASURE_IDS.map((id) => [id, 0]));
  for (const row of yesRows) {
    let best = -1;
    row.z.forEach((z, i) => { if (z !== null && (best < 0 || z > row.z[best])) best = i; });
    drivers[MEASURE_IDS[best]] += 1;
  }

  return {
    rows,
    decidedRows,
    counts: { file: hospitals.length, scored: rows.length, decided: decidedRows.length, yes: yesRows.length },
    coverage,
    measures,
    types,
    funnel,
    single,
    agree,
    escapes,
    assigned,
    maryland,
    drivers,
    medianScore: median(rows.map((row) => row.total).sort((a, b) => a - b)),
  };
}

// The explore asset the program page's and place pages' scripts read (hashed JSON, fetched when first needed): each
// measure's fitted values, CMS's line, how many hospitals CMS assigned its worst score on each measure, and one row
// per scored hospital: [ccn, total, yes (1, 0 or null), values (six, null for none), z-scores (six), teaching
// ("major", "minor", "none" or null), bed band (0 to 3 or null), ownership, urban (1, 0 or null), special statuses
// (SCH, MDH, RRC as bits 1, 2, 4), region, state, CBSA (or null), the measures CMS assigned (bits in MEASURE_IDS
// order), and for a cut hospital its score had its costliest measure been at the national median (or null)].
export const STATUS_BITS = Object.freeze({ SCH: 1, MDH: 2, RRC: 4 });
// The asset row's columns, by name.
export const COL = Object.freeze({ ccn: 0, total: 1, yes: 2, values: 3, z: 4, teach: 5, beds: 6, own: 7, urban: 8, status: 9, region: 10, state: 11, cbsa: 12, assigned: 13, after: 14 });
// Whether an asset row is in a group (kind, key as the share figure and the swarm's buttons name it).
const TESTS = {
  teach: (r, key) => r[COL.teach] === key,
  beds: (r, key) => r[COL.beds] === Number(key),
  own: (r, key) => r[COL.own] === key,
  urban: (r, key) => r[COL.urban] === (key === 'true' ? 1 : 0),
  status: (r, key) => (r[COL.status] & STATUS_BITS[key]) !== 0,
  region: (r, key) => r[COL.region] === key,
};
export const inGroup = (row, kind, key) => TESTS[kind](row, key);
export function exploreAsset(pd, model) {
  const after = new Map(pd.escapes.map((e) => [e.ccn, e.after]));
  return {
    ids: MEASURE_IDS,
    params: model.params,
    boundary: model.boundary,
    assigned: Object.fromEntries(MEASURE_IDS.map((id) => [id, pd.measures[id].assigned])),
    rows: pd.rows.map((r) => {
      const m = r.master;
      const bits = Object.entries(STATUS_BITS).reduce((b, [code, bit]) => b | ((m.types ?? []).includes(code) ? bit : 0), 0);
      return [r.ccn, r.total, r.yes === null ? null : r.yes ? 1 : 0, r.values, r.z, m.teach ?? null, bedBand(m.beds), m.own ?? null,
        m.urban === true ? 1 : m.urban === false ? 0 : null, bits, m.region ?? null, m.state ?? null, m.cbsa ?? null,
        r.assigned.reduce((b, id) => b | (1 << MEASURE_IDS.indexOf(id)), 0), after.get(r.ccn) ?? null];
    }),
  };
}
