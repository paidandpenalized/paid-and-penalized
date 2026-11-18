// Where the area map's (geo.js areaMap) words and pins go, so none covers another: its pins spread apart, its states
// labeled by postal code and its towns set beside their pins, each clear of the marks placed before it. Plain geometry
// in viewBox units; the map projects and draws.
import { geoPath } from 'd3-geo';

// A pin's radius, in viewBox units, and the room kept between two pins once spread apart: enough that two pins at one
// place each move past their radius, so the hairline back to the place shows between them.
export const PIN_R = 9;
export const PIN_GAP = 8;
// The ▲'s reach from the center: the room a pin spread apart keeps from the place's mark unless told another.
export const THIS_R = 12;
// The golden angle, in radians: the direction two pins at the very same place are pushed apart, a different one for each
// pair, the same on every build.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
// At most this many rounds of pushing apart (a page has a handful of pins; they settle in a few).
const SPREAD_ROUNDS = 60;

// Pushes b away from a until they are min apart, when they are closer: b moves by share k of the overlap, a by the rest
// (k = 1 leaves a where it is). Two points at the very same place part along the golden angle times turn. Moves the
// points in place; returns whether they moved.
function nudge(a, b, min, k, turn) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d >= min - 1e-6) return false;
  const [ux, uy] = d < 1e-6 ? [Math.cos(GOLDEN * turn), Math.sin(GOLDEN * turn)] : [dx / d, dy / d];
  const push = (min - d) * k;
  b[0] += ux * push; b[1] += uy * push;
  if (k < 1) {
    const back = (min - d) * (1 - k);
    a[0] -= ux * back; a[1] -= uy * back;
  }
  return true;
}

// Pins spread apart so none covers another or the place's mark: each pair closer than two radii (and a gap) is pushed
// apart along the line between them, half each, and a pin over the mark is pushed off it; then each is kept inside the
// frame. Rounds repeat until nothing moves. Deterministic: the same pins give the same places on every build. xy: [[x, y]],
// in pin order; center: [x, y]; gap: the room kept between two pins (default PIN_GAP); selfR: the place's mark's reach
// (default THIS_R, the ▲'s). Returns new [[x, y]].
export function spreadPins(xy, center, { width, height, r = PIN_R, gap = PIN_GAP, selfR = THIS_R }) {
  const at = xy.map(([x, y]) => [x, y]);
  const min = 2 * r + gap;
  const clamp = (v, hi) => Math.min(hi - r - 1, Math.max(r + 1, v));
  for (let round = 0; round < SPREAD_ROUNDS; round++) {
    let moved = false;
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) moved = nudge(at[i], at[j], min, 1 / 2, i + j) || moved;
      moved = nudge(center, at[i], r + selfR, 1, i + 1) || moved;
    }
    for (const p of at) {
      const [x, y] = [clamp(p[0], width), clamp(p[1], height)];
      if (x !== p[0] || y !== p[1]) [p[0], p[1]] = [x, y];
    }
    if (!moved) break;
  }
  return at;
}

// State labels: a state's postal code, in a box this many units each way from its point (two letters of the 10-unit mono
// label, with a little air), placed where the box is clear of the state's edges, the frame, the pins and the place's mark.
const LABEL_HALF_W = 10;
const LABEL_HALF_H = 7;
const LABEL_CLEAR = Math.hypot(LABEL_HALF_W, LABEL_HALF_H);
// A state needs this much of the frame (in square units: ten labels' boxes) to be labeled at all, so a corner of a state at
// the frame's edge goes unlabeled.
const LABEL_MIN_AREA = 40 * LABEL_HALF_W * LABEL_HALF_H;
// The grid a label's point is looked for on, where the outline's center is not clear.
const LABEL_STEP = 10;

// Whether [x, y] is inside the rings (even-odd, so a hole is outside).
export function inside([x, y], rings) {
  let odd = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
}
// The distance from [x, y] to the rings' nearest edge.
export function edgeDistance([x, y], rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const [vx, vy] = [bx - ax, by - ay];
      const len2 = vx * vx + vy * vy;
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
      best = Math.min(best, Math.hypot(x - ax - t * vx, y - ay - t * vy));
    }
  }
  return best;
}

// Up to max states labeled by postal code, the largest in the frame first, each at a point inside it: its outline's center
// where that is clear, else the clearest point on a grid over it; a state with no clear point goes unlabeled. states:
// [[code, feature]] (those the frame meets); ringsOf(feature): its rings projected, clipped to the frame and thinned
// ([[[x, y]]]); obstacles: [{ x, y, r }] (the pins and the place's mark), which a label keeps clear of, as of the labels
// placed before it. Returns [{ code, x, y }].
export function stateLabels({ projection, states, ringsOf, width, height, max, obstacles }) {
  const path = geoPath(projection);
  const edgeRoom = (x, y) => Math.min(x, width - x, y, height - y);
  const candidates = states.map(([code, f]) => ({ code, f, area: path.area(f) })).filter((c) => c.area >= LABEL_MIN_AREA)
    .sort((a, b) => b.area - a.area || (a.code < b.code ? -1 : 1));
  const placed = [];
  for (const { code, f } of candidates) {
    if (placed.length >= max) break;
    const rings = ringsOf(f);
    const avoid = [...obstacles, ...placed.map((l) => ({ x: l.x, y: l.y, r: LABEL_CLEAR }))];
    const clearance = (pt) => {
      if (!inside(pt, rings)) return -Infinity;
      return Math.min(edgeDistance(pt, rings), edgeRoom(...pt), ...avoid.map((o) => Math.hypot(pt[0] - o.x, pt[1] - o.y) - o.r));
    };
    let best = path.centroid(f);
    let score = best.every(Number.isFinite) ? clearance(best) : -Infinity;
    if (score < LABEL_CLEAR) {
      const [[x0, y0], [x1, y1]] = path.bounds(f);
      for (let y = Math.max(y0, 0) + LABEL_STEP / 2; y < Math.min(y1, height); y += LABEL_STEP) {
        for (let x = Math.max(x0, 0) + LABEL_STEP / 2; x < Math.min(x1, width); x += LABEL_STEP) {
          const s = clearance([x, y]);
          if (s > score) [best, score] = [[x, y], s];
        }
      }
    }
    if (score >= LABEL_CLEAR) placed.push({ code, x: best[0], y: best[1] });
  }
  return placed;
}

// A pin's town: its words in the type face, 10 units, about 6 units a character, set beside the pin (right, then left,
// above, below: SPOTS, each a direction along an axis and the text's anchor there), at the first place where the words
// stay inside the frame and clear of the obstacles (the pins and the place's mark), the state labels and the towns set
// before; none clear, no words.
const TOWN_SIZE = 10;
const TOWN_CHAR = 6.1;
const TOWN_GAP = 4;
const SPOTS = [{ axis: 'x', d: 1, anchor: 'start' }, { axis: 'x', d: -1, anchor: 'end' }, { axis: 'y', d: -1, anchor: 'middle' }, { axis: 'y', d: 1, anchor: 'middle' }];
// The words' box and their point at a spot: the box's edge nearer the pin is off away from it along the axis.
function spotAt({ axis, d, anchor }, x, y, w, h, off) {
  if (axis === 'x') {
    const near = x + d * off;
    const far = near + d * w;
    return { x: near, y, anchor, box: { x0: Math.min(near, far), x1: Math.max(near, far), y0: y - h / 2, y1: y + h / 2 } };
  }
  const near = y + d * off;
  const far = near + d * h;
  return { x, y: near + d * h / 2, anchor, box: { x0: x - w / 2, x1: x + w / 2, y0: Math.min(near, far), y1: Math.max(near, far) } };
}
// A town is named once, beside the first of its pins where its words fit: a pin's townKey (its text by default) says
// which pins share a town, so a later pin in it takes the name when the first had no room.
// points: the pins ({ town, townKey }: text, or none); at: where each is drawn ([[x, y]], in pin order); labels:
// stateLabels'. Returns [{ text, x, y, anchor }].
export function townLabels(points, at, { width, height, obstacles, labels }) {
  const boxes = labels.map((l) => ({ x0: l.x - LABEL_HALF_W, x1: l.x + LABEL_HALF_W, y0: l.y - LABEL_HALF_H, y1: l.y + LABEL_HALF_H }));
  const out = [];
  const named = new Set();
  const hitsBox = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  const hitsCircle = (b) => obstacles.some((c) => {
    const nx = Math.max(b.x0, Math.min(c.x, b.x1));
    const ny = Math.max(b.y0, Math.min(c.y, b.y1));
    return Math.hypot(c.x - nx, c.y - ny) < c.r;
  });
  points.forEach(({ town, townKey = town }, i) => {
    if (!town || named.has(townKey)) return;
    const [x, y] = at[i];
    const w = town.length * TOWN_CHAR;
    const spot = SPOTS.map((s) => spotAt(s, x, y, w, TOWN_SIZE, PIN_R + TOWN_GAP))
      .find(({ box: b }) => b.x0 >= 2 && b.x1 <= width - 2 && b.y0 >= 2 && b.y1 <= height - 2 && !hitsBox(b) && !hitsCircle(b));
    if (!spot) return;
    named.add(townKey);
    boxes.push(spot.box);
    out.push({ text: town, x: spot.x, y: spot.y, anchor: spot.anchor });
  });
  return out;
}
