// The chart kit's text, measured at build time, where there is no browser to measure in: a string's width in viewBox
// units, never less than the browser draws it, so a layout built on it never overlaps; lines that fit a width; and a
// label placed under a mark so it stays inside the drawing.
//
// The widths are each glyph class's widest member in the site's body face at its chart weight (Libre Franklin 600,
// web/styles/fonts), as an em fraction, measured in Chrome at 12px: narrow marks and thin letters, most lowercase
// letters and figures like "1", capitals and other figures, and the widest glyphs. The 11px notes (400) are narrower
// still. The type face's figures (IBM Plex Mono) all advance 0.6em. A string's estimate runs a few percent over its
// drawn width; a wrong guess only wraps a line early.
const CLASSES = [
  [/[\s.,:;'’!|ijlI()[\]`]/, 0.31],
  [/[{}/\\\-frt*"J^]/, 0.48],
  [/[mwMW%@&▲]/, 1.06],
  [/[A-Z02-9$?#]/, 0.78],
];
const OTHER = 0.63;
const MONO = 0.6;

const emOf = (c) => CLASSES.find(([re]) => re.test(c))?.[1] ?? OTHER;

// text's width at size (px, a viewBox unit each), in the body face or (mono) the type face.
export function textWidth(text, size, { mono = false } = {}) {
  const chars = [...String(text)];
  return size * (mono ? chars.length * MONO : chars.reduce((w, c) => w + emOf(c), 0));
}

// text in lines no wider than max at size (body face), broken after a space or a run of hyphens ("Nashville-Davidson--"
// keeps both hyphens on its line); a piece wider than max keeps a line of its own. Returns at least one line.
export function wrapText(text, max, size) {
  const lines = [];
  let line = '';
  for (const piece of String(text).split(/(?<=\s)|(?<=-)(?!-)/)) {
    if (line && textWidth((line + piece).trimEnd(), size) > max) {
      lines.push(line.trimEnd());
      line = piece.trimStart();
    } else line += piece;
  }
  lines.push(line.trimEnd());
  return lines;
}

// A label under a mark at x, w units wide, placed as `place` asks ({ anchor, dx }: start, middle or end, nudged by dx)
// unless that would cross either end of [lo, hi]: then it is set against that end, or start-anchored just left of the
// mark (end-anchored just right of it) where that already clears the end. Returns { x, anchor, dx }.
export function fitLabel(x, w, place, [lo, hi]) {
  const at = x + place.dx;
  const [from, to] = { start: [at, at + w], middle: [at - w / 2, at + w / 2], end: [at - w, at] }[place.anchor];
  if (from >= lo && to <= hi) return { x, anchor: place.anchor, dx: place.dx };
  if (from < lo) return x - 6 >= lo ? { x, anchor: 'start', dx: -6 } : { x: lo, anchor: 'start', dx: 0 };
  return x + 6 <= hi ? { x, anchor: 'end', dx: 6 } : { x: hi, anchor: 'end', dx: 0 };
}
