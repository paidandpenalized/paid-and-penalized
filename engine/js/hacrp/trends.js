// What the years add up to: each hospital's record (cut, not cut, or no decision, year by year), how many have ever
// been cut, how often a cut repeats, and what chance alone would give. Pure: records in, results out.
//   A record is a string with one character per year, oldest first: 'Y' cut, 'N' not cut, '.' no decision that year
//   (not in CMS's file, no score, or not subject to the cut).

export const CUT = 'Y';
export const NOT_CUT = 'N';
export const NONE = '.';

// years: [{ fy, rows: [{ ccn, total, decision }] }] oldest first -> Map(ccn -> record string). A hospital has a
// decision in a year when CMS published a score and a Yes or No for it.
export function records(years) {
  const out = new Map();
  years.forEach(({ rows }, i) => {
    for (const r of rows) {
      const c = r.total !== null && r.decision === 'Yes' ? CUT : r.total !== null && r.decision === 'No' ? NOT_CUT : NONE;
      if (c === NONE && !out.has(r.ccn)) continue;
      if (!out.has(r.ccn)) out.set(r.ccn, NONE.repeat(years.length).split(''));
      out.get(r.ccn)[i] = c;
    }
  });
  return new Map([...out].map(([ccn, a]) => [ccn, a.join('')]));
}

const countOf = (rec, ch) => [...rec].filter((c) => c === ch).length;
export const timesCut = (rec) => countOf(rec, CUT);
export const yearsDecided = (rec) => rec.length - countOf(rec, NONE);

// Per year, over a Map(ccn -> record) of any set of hospitals: those with a decision and those cut, [{ decided, cut }].
export function tallyYears(recs, n) {
  const out = Array.from({ length: n }, () => ({ decided: 0, cut: 0 }));
  for (const rec of recs.values()) {
    for (let i = 0; i < n; i++) {
      if (rec[i] === NONE) continue;
      out[i].decided++;
      if (rec[i] === CUT) out[i].cut++;
    }
  }
  return out;
}

// Per year: tallyYears, and the first-time cut (never cut in an earlier year), with the running count of hospitals
// ever cut.
export function yearly(recs, n) {
  const ever = new Set();
  return tallyYears(recs, n).map((t, i) => {
    let first = 0;
    for (const [ccn, rec] of recs) {
      if (rec[i] === CUT && !ever.has(ccn)) {
        first++;
        ever.add(ccn);
      }
    }
    return { ...t, first, ever: ever.size };
  });
}

// The chance a sum of independent yes/no draws with probabilities ps comes to k, for k = 0..ps.length.
export function poissonBinomial(ps) {
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((q, k) => {
      next[k] += q * (1 - p);
      next[k + 1] += q * p;
    });
    dist = next;
  }
  return dist;
}

// Observed and chance counts of hospitals by times cut, among hospitals with a decision in at least `minYears`
// years. Chance: each year's cut falls at random on that year's hospitals with a decision, at that year's share.
export function timesCutVsChance(recs, shares, { minYears = 1 } = {}) {
  const max = shares.length;
  const observed = new Array(max + 1).fill(0);
  const chance = new Array(max + 1).fill(0);
  let hospitals = 0;
  for (const rec of recs.values()) {
    if (yearsDecided(rec) < minYears) continue;
    hospitals++;
    observed[timesCut(rec)]++;
    const ps = [...rec].map((c, i) => (c === NONE ? null : shares[i])).filter((p) => p !== null);
    poissonBinomial(ps).forEach((q, k) => { chance[k] += q; });
  }
  return { hospitals, observed, chance };
}

// The longest run of consecutive years cut in a record (a year with no decision breaks a run).
export function longestRun(rec) {
  let best = 0;
  let run = 0;
  for (const c of rec) {
    run = c === CUT ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// The pages' order of hospitals: records compared year by year with no decision read as not cut, so the hospitals
// cut first stand first and every hospital never cut stands at the end; ties by the record itself (a decision before
// none), then CCN. recs: Map(ccn -> record) -> [[ccn, record]].
export function rollOrder(recs) {
  const key = (rec) => rec.replaceAll(NONE, NOT_CUT);
  return [...recs].sort(([ca, a], [cb, b]) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka < kb ? 1 : -1; // 'Y' > 'N': cut first
    return a < b ? 1 : a > b ? -1 : ca < cb ? -1 : 1;
  });
}

// How long a cut follows a hospital: for each gap of k years (1 to n - 1), pooled over every pair of years k apart in
// which both have decisions, how many hospitals cut in the first year were cut in the second, and how many not cut
// in the first were. A year with no decisions at all (FY2023) never forms a pair.
export function repeatsByGap(recs, n) {
  const out = [];
  for (let k = 1; k < n; k++) {
    const row = { k, cutBefore: 0, cutAgain: 0, notBefore: 0, cutNew: 0 };
    for (const rec of recs.values()) {
      for (let i = 0; i + k < n; i++) {
        const a = rec[i];
        const b = rec[i + k];
        if (a === NONE || b === NONE) continue;
        if (a === CUT) {
          row.cutBefore++;
          if (b === CUT) row.cutAgain++;
        } else {
          row.notBefore++;
          if (b === CUT) row.cutNew++;
        }
      }
    }
    if (row.cutBefore && row.notBefore) out.push(row);
  }
  return out;
}

// The hospitals with a decision in every year CMS cut anyone (years: the indexes of those years): a fixed panel,
// so counts across years compare the same hospitals.
export function panel(recs, years) {
  return new Map([...recs].filter(([, rec]) => years.every((i) => rec[i] !== NONE)));
}
