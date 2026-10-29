// The scale bar's drawing frame and its dots' places, shared by the build (hub/home/bar.js draws the bar as an SVG) and
// the story's script (which lays the same dots on its canvas, exactly over the SVG's, before pouring them out). Pure.

// The drawing's frame, in viewBox units: its width, the bar's top and height, the dots' inset from its ends and edges,
// and their diameter.
export const BAR = Object.freeze({ W: 600, Y: 6, H: 60, INSET_X: 3, INSET_Y: 4, DOT: 2.1 });

// A stable spread in [0, 1) for a hospital's row in the hub asset (its index in the dollar file's order): the height of
// its dot in the bar. An integer hash (multiply, xor-shift), the same in the build and the browser.
export function barHash(i) {
  let x = ((i + 1) * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

// Each hospital with an estimate as { i, mid }: i its index in `hospitals` (the hub asset's row), mid the middle of its
// slice of the total pay, from 0 to 1, in order of pay (smallest first, the dollar file's order on a tie).
export function barOrder(hospitals) {
  const rows = hospitals.map((h, i) => ({ i, pay: h.est?.total })).filter((r) => r.pay !== undefined)
    .sort((a, b) => a.pay - b.pay || a.i - b.i);
  const total = rows.reduce((sum, r) => sum + r.pay, 0);
  let before = 0;
  return rows.map(({ i, pay }) => {
    const mid = (before + pay / 2) / total;
    before += pay;
    return { i, mid };
  });
}

// A dot's center in viewBox units, from its mid and hash: the bar's frame inset on every side. The build rounds the SVG's
// to a tenth; so does this, so the canvas lands on the same spot.
export const barDot = (mid, hash) => [
  Math.round((BAR.INSET_X + mid * (BAR.W - 2 * BAR.INSET_X)) * 10) / 10,
  Math.round((BAR.Y + BAR.INSET_Y + hash * (BAR.H - 2 * BAR.INSET_Y)) * 10) / 10,
];
