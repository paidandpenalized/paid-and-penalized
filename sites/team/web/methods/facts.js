// The counts the Methods page states about the episode estimates, read from the TEAM file (data.js loadTeam: its
// participants). Pure.
//   active      the participants still in TEAM in performance year 2
//   noEpisodes  those of them with no public episodes in any category
export function methodsFacts(team) {
  const active = team.participants.filter((p) => p.active);
  const cats = (p) => Object.values(p.cats);
  return {
    active: active.length,
    noEpisodes: active.filter((p) => cats(p).every((c) => c.n === 0)).length,
  };
}

// How many hospitals carry each status reason (the TEAM file's status: { ccn: [code, arg] }), a CJR-X hospital counted
// by the reason its status wraps (or `ended`), so a count of hospitals in an area but not listed takes in those CJR-X
// covers too. Pure.
export function reasonCounts(status) {
  const out = {};
  for (const [code, arg] of Object.values(status)) {
    const reason = code === 'cjrx' ? arg[0] : code;
    out[reason] = (out[reason] ?? 0) + 1;
  }
  return out;
}
