// The commit blocklist: private names and strings that must never enter this public repo. The list itself lives
// outside the repo (see precommit-checks.js); this module only parses it and finds matches.

// One entry per line; blank lines and # comments are skipped. An empty list is refused: it is almost certainly
// a mistake, and an empty list would pass everything.
export function parseBlocklist(text) {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (entries.length === 0) throw new RangeError('blocklist: no entries');
  return entries;
}

const SPECIALS = /[.*+?^${}()|[\]\\/]/g;

// Literal text, any case, any run of whitespace (line breaks included) where the entry has a space, and only
// where no letter or digit touches either end, so a surname inside a longer word doesn't count.
function entryPattern(entry) {
  const body = entry
    .split(/\s+/)
    .map((word) => word.replace(SPECIALS, '\\$&'))
    .join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

// Every match as { entry (1-based list index), line (1-based, where the match starts) }, ordered by line.
export function findHits(text, entries) {
  const hits = [];
  entries.forEach((entry, i) => {
    for (const m of text.matchAll(entryPattern(entry))) {
      let line = 1;
      for (let k = text.indexOf('\n'); k !== -1 && k < m.index; k = text.indexOf('\n', k + 1)) line++;
      hits.push({ entry: i + 1, line });
    }
  });
  return hits.sort((a, b) => a.line - b.line || a.entry - b.entry);
}
