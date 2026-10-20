// The commit blocklist: private names and strings that must never enter this public repo. The list itself lives
// outside the repo (see precommit-checks.js); this module only parses it and finds matches.

// One entry per line; blank lines and # comments are skipped. An empty list is refused: it is almost certainly
// a mistake, and an empty list would pass everything.
export function parseBlocklist(text) {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim().normalize('NFC'))
    .filter((line) => line !== '' && !line.startsWith('#'));
  if (entries.length === 0) throw new RangeError('blocklist: no entries');
  return entries;
}

const SPECIALS = /[.*+?^${}()|[\]\\/]/g;
const compiled = new Map();

// Literal text, any case, any run of whitespace, dots, dashes or underscores (as in file names and email
// addresses; line breaks included) where the entry has a space, and only
// where no letter or digit touches either end, so a surname inside a longer word doesn't count.
// Both sides are compared in Unicode NFC, so a composed accent matches a decomposed one.
function entryPattern(entry) {
  if (!compiled.has(entry)) {
    const body = entry
      .normalize('NFC')
      .split(/\s+/)
      .map((word) => word.replace(SPECIALS, '\\$&'))
      .join('[\\s._-]+');
    compiled.set(entry, new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu'));
  }
  return compiled.get(entry);
}

// Every match as { entry (1-based list index), line (1-based, where the match starts) }, ordered by line.
export function findHits(raw, entries) {
  const text = raw.normalize('NFC');
  const hits = [];
  entries.forEach((entry, i) => {
    // Matches arrive in text order, so count only the newlines since the previous one.
    let line = 1;
    let from = 0;
    for (const m of text.matchAll(entryPattern(entry))) {
      for (let k = text.indexOf('\n', from); k !== -1 && k < m.index; k = text.indexOf('\n', k + 1)) line++;
      from = m.index;
      hits.push({ entry: i + 1, line });
    }
  });
  return hits.sort((a, b) => a.line - b.line || a.entry - b.entry);
}
