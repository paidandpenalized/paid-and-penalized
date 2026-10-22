// What the history pages draw, computed once per build from the emitted history (every program year's CMS file) and
// the hospital master: each year's self-check, each hospital's record and where it stood in line each year, how
// many hospitals have ever been cut, how often a cut repeats and what chance would give, and the share cut each year
// by kind of hospital and by state. Pure: data in, result out.
import { numberOf as cmsNumber, ruleFor, recomputeTotal } from '../../../engine/js/hacrp/eras.js';
import { yearCheck } from '../../../engine/js/hacrp/history.js';
import { panel, records, repeats, repeatsByGap, rollCallOrder, timesCutVsChance, yearly, longestRun, timesCut, yearsDecided, CUT } from '../../../engine/js/hacrp/trends.js';
import { TYPE_KINDS } from './program-data.js';

const numberOf = (text) => cmsNumber(text, 'history');

// One emitted year -> rows with numbers: { ccn, state, total, totalText, decision, z, d1, d2, recomputed, noted }. A
// year with no part published for any hospital is a year CMS scored no one (FY2023, when it published 0.0000 for
// every hospital): its totals are read as none.
export function yearRows(year) {
  const rule = ruleFor(year.fy);
  const noted = new Set(year.footnoted);
  const rows = year.hospitals.map((h) => {
    const [ccn, state, totalText, decision, ...parts] = h;
    const z = Object.fromEntries(year.measures.map((id, i) => [id, numberOf(parts[i])]));
    const d = year.domains ? parts.slice(year.measures.length) : [null, null];
    const rec = { ccn, state, total: numberOf(totalText), totalText, decision: decision || null, z, d1: numberOf(d[0]), d2: numberOf(d[1]), noted: noted.has(ccn) };
    return { ...rec, recomputed: recomputeTotal(rec, rule) };
  });
  const none = rows.every((r) => r.recomputed === null);
  return none ? rows.map((r) => ({ ...r, total: null, totalText: '' })) : rows;
}

// For each year, each hospital's place in line: the share of that year's other published scores below its own
// (0: the lowest score, 1: the highest).
function shares(rows) {
  const scored = rows.filter((r) => r.total !== null).map((r) => r.total).sort((a, b) => a - b);
  const below = (t) => {
    let lo = 0;
    let hi = scored.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (scored[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return new Map(rows.filter((r) => r.total !== null).map((r) => [r.ccn, scored.length > 1 ? below(r.total) / (scored.length - 1) : 0.5]));
}

// history: the emitted history file; master: Map ccn -> master record.
export function historyData({ history, master }) {
  const years = history.years.map((y) => ({ ...y, rows: yearRows(y) }));
  const n = years.length;
  const fys = years.map((y) => y.fy);
  const recs = records(years.map((y) => ({ fy: y.fy, rows: y.rows })));
  const counts = yearly(recs, n);
  const checks = years.map((y) => ({ fy: y.fy, rule: ruleFor(y.fy), check: yearCheck(y.rows) }));
  const shareCut = counts.map((c) => (c.decided ? c.cut / c.decided : null));
  const place = years.map((y) => shares(y.rows));
  const rowsBy = years.map((y) => new Map(y.rows.map((r) => [r.ccn, r])));
  // Each year's state, from that year's file (a hospital the master no longer lists keeps its state).
  const stateOf = new Map();
  years.forEach((y) => y.rows.forEach((r) => stateOf.set(r.ccn, r.state)));

  // The share cut each year by kind of hospital, by today's master facts (a hospital's kind can change; the
  // master's is its newest).
  const byType = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => {
      const members = [...recs.keys()].filter((ccn) => master.get(ccn) && test(master.get(ccn)));
      return { key, years: fys.map((_, i) => tally(members.map((c) => recs.get(c)[i]))) };
    }),
  }));
  const states = [...new Set(stateOf.values())].sort();
  const byState = new Map(states.map((st) => {
    const members = [...recs.keys()].filter((c) => stateOf.get(c) === st);
    return [st, { years: fys.map((_, i) => tally(members.map((c) => recs.get(c)[i]))), ever: members.filter((c) => recs.get(c).includes(CUT)).length, any: members.filter((c) => yearsDecided(recs.get(c)) > 0).length }];
  }));

  return {
    fys,
    years: years.map((y) => ({ fy: y.fy, rule: y.rule, scale: y.scale, measures: y.measures, periods: y.periods, decisions: y.decisions })),
    recs,
    counts,
    shareCut,
    checks,
    place,
    stateOf,
    order: rollCallOrder(recs),
    chance: timesCutVsChance(recs, shareCut.map((s) => s ?? 0), { minYears: 1 }),
    // The fixed panel: hospitals with a decision in every year CMS cut anyone; chance over it.
    panelChance: (() => {
      const cutYears = counts.map((c, i) => (c.cut ? i : -1)).filter((i) => i >= 0);
      const p = panel(recs, cutYears);
      return { years: cutYears.length, ...timesCutVsChance(p, shareCut.map((s) => s ?? 0), { minYears: cutYears.length }) };
    })(),
    repeats: repeats(recs, n),
    gaps: repeatsByGap(recs, n),
    coverage: coverageCut(years),
    byType,
    byState,
    infections: history.infections ?? [],
    // A hospital's record for its page: per year, its decision, score text and place in line.
    recordOf(ccn) {
      const rec = recs.get(ccn);
      if (!rec) return null;
      return {
        rec,
        cut: timesCut(rec),
        decided: yearsDecided(rec),
        run: longestRun(rec),
        years: years.map((y, i) => {
          const row = rowsBy[i].get(ccn) ?? null;
          return { fy: y.fy, c: rec[i], totalText: row?.totalText ?? null, share: place[i].get(ccn) ?? null };
        }),
      };
    },
  };
}

// Hospitals with a decision and those cut among a set of record characters.
function tally(chars) {
  const decided = chars.filter((c) => c !== '.').length;
  const cut = chars.filter((c) => c === CUT).length;
  return { decided, cut };
}

// The share cut by what CMS scored a hospital on, pooled over the years scored in z-scores (FY2018 on): only PSI 90,
// no PSI 90 (infections only), all of the year's measures, and every hospital. Counts hospital-years with a decision.
function coverageCut(years) {
  const groups = { psiOnly: { decided: 0, cut: 0 }, noPsi: { decided: 0, cut: 0 }, all: { decided: 0, cut: 0 }, every: { decided: 0, cut: 0 } };
  let first = null;
  let last = null;
  for (const y of years) {
    if (y.scale !== 'z') continue;
    for (const r of y.rows) {
      if (r.total === null || (r.decision !== 'Yes' && r.decision !== 'No')) continue;
      const have = y.measures.filter((id) => r.z[id] !== null);
      const psi = have.includes('PSI90');
      const keys = ['every', ...(psi && have.length === 1 ? ['psiOnly'] : []), ...(!psi && have.length ? ['noPsi'] : []), ...(have.length === y.measures.length ? ['all'] : [])];
      for (const k of keys) {
        groups[k].decided++;
        if (r.decision === 'Yes') groups[k].cut++;
      }
      first ??= y.fy;
      last = y.fy;
    }
  }
  return { groups, first, last };
}
