// The home page's words make claims about the data ("most hospitals take a small cut", "two of every three"); these check
// them on every build, so the build stops rather than print a sentence the data no longer bear out. Shared by the story
// (page.js) and what sits below it (below.js).

// How near a simple fraction (a half to four fifths) must be to a share for the words to say it as one ("Two of every
// three", "one hospital in five"); further off, they give the share.
const FRACTION_NEAR = 0.02;

// A claim the words make: ok, or the build stops, naming the words.
export function holds(ok, words) {
  if (!ok) throw new RangeError(`hub home: the data no longer bear out "${words}"`);
}

// The simple fraction nearest x, as { part, whole }, within FRACTION_NEAR; null when none is that near.
export function simpleFraction(x) {
  let best = null;
  for (let whole = 2; whole <= 5; whole++) {
    for (let part = 1; part < whole; part++) {
      const away = Math.abs(x - part / whole);
      if (!best || away < best.away - 1e-12) best = { part, whole, away };
    }
  }
  return best.away <= FRACTION_NEAR ? { part: best.part, whole: best.whole } : null;
}
