// What the history pages draw, computed once per build from the emitted history (every program year's CMS file) and
// the hospital master: each year's self-check, each hospital's record and where it stood in line each year, how
// many hospitals have ever been cut, how often a cut repeats and what chance would give, and the share cut each year
// by kind of hospital and by state. Pure: data in, result out.
import { bisectLeft } from 'd3-array';
import { numberOf as cmsNumber, ruleFor, recomputeTotal } from '../../../engine/js/hacrp/eras.js';
import { partRanges, withheldPart, yearCheck } from '../../../engine/js/hacrp/history.js';
import { CUT, NONE, NOT_CUT, panel, records, repeatsByGap, rollOrder, tallyYears, timesCutVsChance, yearly, longestRun, timesCut, yearsDecided } from '../../../engine/js/hacrp/trends.js';
import { TYPE_KINDS } from './program-data.js';

const numberOf = (text) => cmsNumber(text, 'history');

// One emitted year -> rows with numbers: { ccn, state, total, totalText, decision, z, d1, d2, notes, recomputed }. A
// year with no part published for any hospital is a year CMS scored no one (FY2023, when it published 0.0000 for
// every hospital): its totals are read as none. The emitted file keeps CMS's footnotes by row (`footnoted`), not by
// part, so every part of a footnoted row reads as footnoted (notes); a test holds the pinned files' own part footnotes
// to the same self-check (history-data.test.js).
export function yearRows(year) {
  const rule = ruleFor(year.fy);
  const footnoted = new Set(year.footnoted);
  const every = new Set([...year.measures, ...(year.domains ? ['D1', 'D2'] : [])]);
  const none = new Set();
  const rows = year.hospitals.map((h) => {
    const [ccn, state, totalText, decision, ...parts] = h;
    const z = Object.fromEntries(year.measures.map((id, i) => [id, numberOf(parts[i])]));
    const d = year.domains ? parts.slice(year.measures.length) : [null, null];
    const rec = { ccn, state, total: numberOf(totalText), totalText, decision: decision || null, z, d1: numberOf(d[0]), d2: numberOf(d[1]), notes: footnoted.has(ccn) ? every : none };
    return { ...rec, recomputed: recomputeTotal(rec, rule) };
  });
  const scoredNone = rows.every((r) => r.recomputed === null);
  return scoredNone ? rows.map((r) => ({ ...r, total: null, totalText: '' })) : rows;
}

// One year's self-check: a miss is let pass only for a part CMS withheld (engine/js/hacrp/history.js withheldPart),
// judged against the year's ranges of each part. ruleKey: the Methods page's words for the year's rule.
function checkOf(year, rows) {
  const rule = ruleFor(year.fy);
  const ranges = partRanges(rows);
  const ruleKey = rule.rule === 'equal' ? 'ruleEqual' : year.scale === 'tenths' ? 'ruleDomainsTenths' : 'ruleDomainsZ';
  return { fy: year.fy, rule, scale: year.scale, ruleKey, check: yearCheck(rows, (r) => withheldPart(r, rule, ranges, year.scale)) };
}

// For each year, each hospital's place in line: the share of that year's other published scores below its own
// (0: the lowest score, 1: the highest).
function shares(rows) {
  const scored = rows.filter((r) => r.total !== null).map((r) => r.total).sort((a, b) => a - b);
  return new Map(rows.filter((r) => r.total !== null).map((r) => [r.ccn, scored.length > 1 ? bisectLeft(scored, r.total) / (scored.length - 1) : 0.5]));
}

// history: the emitted history file; master: Map ccn -> master record.
export function historyData({ history, master }) {
  const years = history.years.map((y) => ({ ...y, rows: yearRows(y) }));
  const n = years.length;
  const fys = years.map((y) => y.fy);
  const recs = records(years.map((y) => ({ fy: y.fy, rows: y.rows })));
  // Each year's counts, with the share cut: null in a year CMS cut no one (FY2023).
  const counts = yearly(recs, n).map((c) => ({ ...c, share: c.cut ? c.cut / c.decided : null }));
  const cutAt = counts.map((c, i) => (c.share === null ? -1 : i)).filter((i) => i >= 0);
  const chanceShares = counts.map((c) => c.share ?? 0);
  const place = years.map((y) => shares(y.rows));
  const rowsBy = years.map((y) => new Map(y.rows.map((r) => [r.ccn, r])));
  // Each year's state, from that year's file (a hospital the master no longer lists keeps its state).
  const stateOf = new Map();
  years.forEach((y) => y.rows.forEach((r) => stateOf.set(r.ccn, r.state)));
  const tallyOf = (ccns) => tallyYears(new Map(ccns.map((c) => [c, recs.get(c)])), n);

  // The share cut each year by kind of hospital, by today's master facts (a hospital's kind can change; the
  // master's is its newest).
  const byType = TYPE_KINDS.map(([kind, groups]) => ({
    kind,
    groups: groups.map(([key, test]) => ({ key, years: tallyOf([...recs.keys()].filter((ccn) => master.get(ccn) && test(master.get(ccn)))) })),
  }));
  const states = [...new Set(stateOf.values())].sort();
  const byState = new Map(states.map((st) => [st, { years: tallyOf([...recs.keys()].filter((c) => stateOf.get(c) === st)) }]));

  return {
    fys,
    years: years.map((y) => ({ fy: y.fy, rule: y.rule, scale: y.scale, measures: y.measures, periods: y.periods, decisions: y.decisions })),
    recs,
    counts,
    // The years CMS cut anyone (every year but FY2023).
    cutYears: cutAt.length,
    checks: years.map((y) => checkOf(y, y.rows)),
    place,
    stateOf,
    // The pages' order of hospitals (trends.js rollOrder): the roll call, the history asset and the year map.
    order: rollOrder(recs),
    chance: timesCutVsChance(recs, chanceShares),
    // The fixed panel: hospitals with a decision in every year CMS cut anyone; chance over it.
    panelChance: { years: cutAt.length, ...timesCutVsChance(panel(recs, cutAt), chanceShares, { minYears: cutAt.length }) },
    gaps: repeatsByGap(recs, n),
    coverage: coverageCut(years),
    byType,
    byState,
    infections: history.infections ?? [],
    // A hospital's record for its page: per year, its decision, score text and place in line. The national counts
    // read a decision only with a score (records()); the hospital's own record also counts a Yes or No CMS gave in a
    // year it published no score for the hospital (noScore), so its page never calls a cut year "no decision".
    // null for a hospital with no decision in any year.
    recordOf(ccn) {
      const scored = recs.get(ccn) ?? NONE.repeat(n);
      const out = years.map((y, i) => {
        const row = rowsBy[i].get(ccn) ?? null;
        const noScore = scored[i] === NONE && row !== null && row.total === null && (row.decision === 'Yes' || row.decision === 'No');
        const c = noScore ? (row.decision === 'Yes' ? CUT : NOT_CUT) : scored[i];
        return { fy: y.fy, c, noScore, totalText: row?.totalText ?? null, share: place[i].get(ccn) ?? null };
      });
      const rec = out.map((y) => y.c).join('');
      if (!yearsDecided(rec)) return null;
      return { rec, cut: timesCut(rec), decided: yearsDecided(rec), run: longestRun(rec), years: out, noScore: out.filter((y) => y.noScore).map((y) => y.fy) };
    },
  };
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
