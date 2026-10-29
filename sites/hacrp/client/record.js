// The record card's state outline (pages/hospital.js recordCard): the outline and the hospital's dot lie faint behind the
// whole card, under the fields. This script keeps the dot and its halo, the outline's busiest part, off the fields'
// words: where they would fall on a line of words (or the dot on a rule), it moves the whole outline, by the least
// distance, to where they stand clear (trying tighter fits on a card dense with words), and shows the outline once it is
// placed. It places it again whenever the card changes size (a new width, the fonts arriving). Without scripts the
// outline shows where the stylesheet puts it.

// The text the halo keeps clear of: the title bar and each field's label, value and note, line by line.
export const WORDS = ':is(.form__title, .field__label, .field__value, .field__note)';
// How far the dot keeps from a rule or the watermark's edge (px), the grid the moves are tried on (px), and how much of
// the outline's box must stay inside the watermark once moved, by default.
const GAP = 3;
const STEP = 4;
const KEEP = 0.8;
// The tries, in order, until one finds a place: how far the halo keeps from a line of words (px) and how much of the
// outline's box stays inside the watermark. First with room to spare, so the dot never looks wedged between lines; then
// just clear of them; then, on a narrow card dense with words, with more of the outline allowed past its edge.
const TRIES = [[8, KEEP], [GAP, KEEP], [GAP, 0.55]];
// The farthest move tried, as a share of the watermark's longer side.
const REACH = 0.4;

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// The smallest move { dx, dy } (whole steps of step px, nearest first) that puts the dot (a circle { x, y, r }) clear of
// every obstacle (rects { left, top, right, bottom }, each kept room px from the dot's center: its own room, or the dot's
// radius and gap) and inside bounds by its radius and gap, while keeping at least keep of the shape's box (the
// outline's) inside bounds. { dx: 0, dy: 0 } when the dot is clear where it is; null when no move within reach px
// clears it.
export function clearOffset({ dot, obstacles, bounds, shape, gap = GAP, step = STEP, reach = 240, keep = KEEP }) {
  const edge = dot.r + gap;
  const clearAt = (x, y) => {
    if (x - edge < bounds.left || x + edge > bounds.right || y - edge < bounds.top || y + edge > bounds.bottom) return false;
    return obstacles.every((o) => Math.hypot(x - Math.max(o.left, Math.min(x, o.right)), y - Math.max(o.top, Math.min(y, o.bottom))) >= (o.room ?? edge));
  };
  const area = (shape.right - shape.left) * (shape.bottom - shape.top);
  const kept = (dx, dy) => area <= 0 || overlap({ left: shape.left + dx, right: shape.right + dx, top: shape.top + dy, bottom: shape.bottom + dy }, bounds) >= keep * area;
  const n = Math.floor(reach / step);
  const moves = [];
  for (let i = -n; i <= n; i += 1) for (let j = -n; j <= n; j += 1) moves.push([i * step, j * step]);
  // Nearest first; at one distance, the smaller rise or fall first.
  moves.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || Math.abs(a[1]) - Math.abs(b[1]));
  for (const [dx, dy] of moves) if (clearAt(dot.x + dx, dot.y + dy) && kept(dx, dy)) return { dx: dx + 0, dy: dy + 0 };
  return null;
}

const px = (value) => parseFloat(value) || 0;
const plain = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
const shifted = (r, dx, dy) => ({ left: r.left - dx, top: r.top - dy, right: r.right - dx, bottom: r.bottom - dy });

// Each line of words in el, as the boxes the browser lays it out in (a pill or a badge whole), so the room right of a
// short line is room.
function lines(el) {
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(plain);
}

// Places the outline in card (the record card, .hosp__id) and marks its watermark placed (data-placed; data-dotless when
// no try finds the dot a place). The move is measured from the outline's own place, whatever move it carries now, and
// written as the map's --dx and --dy (the stylesheet's translate). lineBoxes(el): the boxes of el's lines of words. A
// card without a map is left alone.
export function placeLocator(card, lineBoxes = lines) {
  const wm = card.querySelector('.hosp__wm');
  const map = wm?.querySelector('.geo--j');
  const dot = wm?.querySelector('.chart-geo-dot');
  const ring = wm?.querySelector('.chart-geo-halo');
  const state = wm?.querySelector('.chart-geo-state');
  if (!map || !dot || !ring || !state) return;
  const now = [px(map.style.getPropertyValue('--dx')), px(map.style.getPropertyValue('--dy'))];
  const d = shifted(dot.getBoundingClientRect(), ...now);
  const r = (d.right - d.left) / 2;
  const halo = ring.getBoundingClientRect().width / 2;
  const bounds = plain(wm.getBoundingClientRect());
  const words = [...card.querySelectorAll(WORDS)].flatMap(lineBoxes);
  const rules = [...card.querySelectorAll('.field')].flatMap((field) => {
    const f = field.getBoundingClientRect();
    return [{ left: f.right - 2, right: f.right, top: f.top, bottom: f.bottom }, { left: f.left, right: f.right, top: f.bottom - 2, bottom: f.bottom }];
  });
  let move = null;
  for (const [gap, keep] of TRIES) {
    move = clearOffset({
      dot: { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2, r },
      obstacles: [...words.map((box) => ({ ...box, room: halo + gap })), ...rules],
      bounds,
      shape: shifted(state.getBoundingClientRect(), ...now),
      reach: REACH * Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top),
      keep,
    });
    if (move) break;
  }
  // No place at all (none found on any page tried): the outline stays put and the dot and halo step out, rather than
  // sit on words.
  if (move) delete wm.dataset.dotless;
  else wm.dataset.dotless = '';
  map.style.setProperty('--dx', `${move ? move.dx : 0}px`);
  map.style.setProperty('--dy', `${move ? move.dy : 0}px`);
  wm.dataset.placed = '';
}

function start() {
  const card = document.querySelector('.hosp__id');
  if (!card || !card.querySelector('.hosp__wm')) return;
  let queued = 0;
  const place = () => {
    queued = 0;
    placeLocator(card);
  };
  const later = () => {
    if (!queued) queued = requestAnimationFrame(place);
  };
  place();
  new ResizeObserver(later).observe(card);
  if (document.fonts) document.fonts.ready.then(later, () => {});
}

if (typeof document !== 'undefined') start();
