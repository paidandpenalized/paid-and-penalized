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
