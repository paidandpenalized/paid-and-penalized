// Which fiscal year a page shows. A program page shows the newest fiscal year its data has results for. The hub shows,
// for every hub page, the fiscal year for which the most of the programs in its dollar estimate have results, the later
// on a tie, so two hospitals' totals always compare. Pure.

// The newest year in program.years, or null when it has none.
export function shownYear({ years }) {
  return years.length ? Math.max(...years) : null;
}

// The year the most programs have results for (a year repeated in one program counts once); the later on a tie; null
// when no program has a year.
export function hubYear(programs) {
  const counts = new Map();
  for (const { years } of programs) {
    for (const year of new Set(years)) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  let best = null;
  for (const [year, count] of counts) {
    if (best === null || count > counts.get(best) || (count === counts.get(best) && year > best)) best = year;
  }
  return best;
}
