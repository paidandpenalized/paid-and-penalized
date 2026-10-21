// Search over a site's places, ported from Thirty Day Readmissions (web/src/js/ui/search.js): pure functions, shared by
// the browser's combobox (omnibox.js) and the tests. Every word of a query must start a word of the entry (its label
// and its extra text: a city, a ZIP, a CCN), with saint/st, mount/mt and fort/ft taken as one; an exact key or label
// ranks first, then a label that starts with the query, then words found in the label, shorter labels first. No DOM.

const SYNONYMS = { saint: ['st'], st: ['saint'], mount: ['mt'], mt: ['mount'], fort: ['ft'], ft: ['fort'] };
// Kinds of entry outrank one another at equal match: a state over a hospital (states join the index when a site has
// state pages; buildIndex takes them as entries like any other).
const TYPE_WEIGHT = { state: 30, metro: 20, hospital: 0 };
export const LIMIT = 10;

// Lowercase, accents and apostrophes dropped, everything else not a letter or digit a single space.
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// entries: [{ type, key, label, sub, extra, href }]: key is matched exactly (a CCN), label is what the list shows,
// sub its second line, extra more words to match (a city, a state, a ZIP), href the page it opens.
export function buildIndex(entries) {
  return entries.map(({ type, key, label, sub = '', extra = '', href }) => {
    const labelNorm = normalize(label);
    return { type, key: String(key), label, sub, href, labelNorm, labelWords: labelNorm.split(' '), words: normalize(`${label} ${extra} ${key}`).split(' ') };
  });
}

const matchesWord = (alts, words) => words.some((w) => alts.some((a) => w.startsWith(a)));

// The best matches for query, best first, at most limit, and how many matched in all: { results, total }.
export function search(query, index, { limit = LIMIT, types } = {}) {
  const q = normalize(query);
  if (!q) return { results: [], total: 0 };
  const tokens = q.split(' ').map((t) => [t, ...(SYNONYMS[t] || [])]);
  const scored = [];
  for (const e of index) {
    if (types && !types.includes(e.type)) continue;
    if (!tokens.every((alts) => matchesWord(alts, e.words))) continue;
    let score = TYPE_WEIGHT[e.type] ?? 0;
    if (e.key.toLowerCase() === q) score += 1000;
    if (e.labelNorm === q) score += 500;
    else if (e.labelNorm.startsWith(q)) score += 200;
    for (const alts of tokens) if (matchesWord(alts, e.labelWords)) score += 20;
    score -= e.label.length * 0.1;
    scored.push({ e, score });
  }
  // Ties keep the index's order (Array sort is stable).
  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, limit).map((x) => x.e), total: scored.length };
}
