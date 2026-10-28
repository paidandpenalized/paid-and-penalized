// The chart kit's text, measured at build time, where there is no browser to measure in: a string's width in viewBox
// units, never less than the browser draws it, so a layout built on it never overlaps; lines that fit a width; and a
// label placed under a mark so it stays inside the drawing.
//
// FACES: each character's advance in thousandths of the type size (em), measured once in Chrome (canvas, each glyph
// repeated, rounded up) at the chart labels' weight in the site's body face (Libre Franklin 600) and in its metric
// fallback (Arial Bold at the fallback's size-adjust, web/styles/base.css): the printable ASCII characters from the
// space on, then EXTRA's. A string counts in each face as the sum of its characters' advances, and its width is the
// larger sum, KERNING over: the most any group name drew wider than its advances' sum (1.22%, kerning and shaping),
// rounded up. Kerning mostly narrows a string, so the estimate runs about 1% to 7% over the drawn width. A character
// not in the table counts as the widest one. The type face's figures (IBM Plex Mono, and Courier New, its fallback)
// advance 0.6em a character.
const ASCII = {
  libre: '209 257 449 603 638 935 818 245 304 304 436 574 239 380 237 357 701 494 628 658 675 669 677 612 678 675 237 249 566 574 566 532 834 705 715 719 741 645 621 747 746 306 437 729 619 934 758 770 707 772 713 650 669 717 709 1052 706 706 664 306 357 306 475 535 299 558 606 545 606 584 395 622 592 256 256 590 257 914 592 599 605 606 411 524 417 588 555 802 560 545 506 345 255 345 595',
  fallback: '274 329 468 548 548 876 712 235 329 329 384 576 274 329 274 274 548 497 548 548 548 548 548 548 548 548 329 329 576 576 576 602 961 712 712 712 712 657 602 767 712 274 548 712 602 821 712 767 657 767 712 657 602 712 657 930 657 657 602 329 274 329 576 548 329 548 602 548 602 548 329 602 602 274 274 548 274 876 602 602 602 602 384 548 329 602 548 767 548 548 493 384 276 384 576',
};
// Other characters a label may hold, [libre, fallback] each.
const EXTRA = {
  '−': [574, 576], '–': [575, 548], '—': [899, 985], '’': [234, 239], '‘': [234, 239], '“': [442, 493], '”': [445, 493], '▲': [1000, 975],
  'é': [584, 548], 'á': [558, 548], 'í': [256, 274], 'ó': [599, 602], 'ú': [588, 602], 'ñ': [592, 602], 'ü': [588, 602], 'É': [645, 657], '·': [232, 329], '…': [840, 985],
};
const FACES = ['libre', 'fallback'].map((face, i) => {
  const table = new Map(ASCII[face].split(' ').map((em, j) => [String.fromCharCode(32 + j), Number(em) / 1000]));
  for (const [c, ems] of Object.entries(EXTRA)) table.set(c, ems[i] / 1000);
  return table;
});
const WIDEST = Math.max(...FACES.flatMap((table) => [...table.values()]));
const KERNING = 1.013;
const MONO = 0.6;

// text's width at size (px, a viewBox unit each), in the body face or (mono) the type face.
export function textWidth(text, size, { mono = false } = {}) {
  const chars = [...String(text)];
  if (mono) return size * chars.length * MONO;
  return size * KERNING * Math.max(...FACES.map((table) => chars.reduce((w, c) => w + (table.get(c) ?? WIDEST), 0)));
}

// text in lines no wider than max at size (body face), broken after a space or a run of hyphens ("Nashville-Davidson--"
// keeps both hyphens on its line); a piece wider than max keeps a line of its own. Each line but the last keeps the
// space it broke at, so the lines joined are the text (a line's width is measured without it). A last line of one
// word (a lone "area") takes the word before it too, where the line above has more and the two fit. Returns at least
// one line.
export function wrapText(text, max, size) {
  const fits = (pieces) => textWidth(pieces.join('').trimEnd(), size) <= max;
  const lines = [[]];
  for (const piece of String(text).split(/(?<=\s)|(?<=-)(?!-)/)) {
    const line = lines[lines.length - 1];
    if (line.length && !fits([...line, piece])) lines.push([piece]);
    else line.push(piece);
  }
  const [above, last] = lines.slice(-2);
  if (lines.length > 1 && last.length === 1 && above.length > 1 && fits([above[above.length - 1], ...last])) last.unshift(above.pop());
  return lines.map((line) => line.join(''));
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
