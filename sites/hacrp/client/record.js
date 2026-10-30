// The record card's state outline (pages/hospital.js recordCard): the whole outline and the hospital's dot lie faint
// behind the card, under the fields. This script keeps the dot and its halo, the outline's busiest part, well clear of
// the fields' words: where they would fall on or near a line of words (or the dot on a rule), it moves the outline, by
// the least distance, to where they stand clear, preferring the empty lower part of a field to a place beside a line,
// and keeping the whole outline inside the card; where that finds no place it draws the outline smaller and tries again,
// and only then lets a little of it past the card's edge. It shows the outline once placed, and places it again whenever
// the card or the map's drawing changes size (a new width, the fonts arriving). Without scripts the outline shows unmoved, without its dot.

// The text the halo keeps clear of: the title bar and each field's label, value and note, line by line.
export const WORDS = ':is(.form__title, .field__label, .field__value, .field__note)';
// How far the dot keeps from a rule or the watermark's edge (px), the grid the moves are tried on (px), and how much of
// the outline's box stays inside the watermark by default.
const GAP = 3;
const STEP = 4;
const KEEP = 0.8;
// How far the halo keeps from a line of words (px): with room to spare, so the dot never reads as a bullet beside them;
// and, as a last resort on a card dense with words, less.
const ROOMY = 16;
const TIGHT = 12;
// The sizes the outline is tried at, about its middle: as drawn, then smaller, before any of it may leave the card (the
// smallest only on a narrow card dense with words). A place in the empty part of a field, below or above its lines, is
// worth drawing the outline a little smaller (down to BELOW_SIZE); past that, a place beside a line will do.
const SIZES = [1, 0.85, 0.7, 0.55, 0.45];
const BELOW_SIZE = 0.7;
// The tries, in order, until one finds a place: the size, the halo's room from words, how much of the outline stays
// inside (1: all of it), and whether the dot must stand below or above its field's lines rather than beside one.
export const TRIES = [
  ...SIZES.filter((s) => s >= BELOW_SIZE).map((s) => ({ s, gap: ROOMY, keep: 1, below: true })),
  ...SIZES.map((s) => ({ s, gap: ROOMY, keep: 1, below: false })),
  ...SIZES.map((s) => ({ s, gap: TIGHT, keep: 1, below: false })),
  { s: SIZES[SIZES.length - 1], gap: TIGHT, keep: KEEP, below: false },
];
// The farthest move tried, as a share of the watermark's longer side.
const REACH = 0.4;

const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

// Every move [dx, dy] on a grid of step px within n steps each way, nearest first; at one distance, the smaller rise or
// fall first, and down before up (a field's empty part is its lower part). The latest list is kept for the next
// placement (one card, one reach, until a resize changes it) and no other, so resizing never piles lists up.
let kept = { key: '', moves: [] };
export function movesWithin(n, step) {
  const key = `${n}:${step}`;
  if (kept.key !== key) {
    const moves = [];
    for (let i = -n; i <= n; i += 1) for (let j = -n; j <= n; j += 1) moves.push([i * step, j * step]);
    moves.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || Math.abs(a[1]) - Math.abs(b[1]) || b[1] - a[1]);
    kept = { key, moves };
  }
  return kept.moves;
}

// The smallest move { dx, dy } (movesWithin's order) that puts the dot (a circle { x, y, r }) clear of every obstacle
// (rects { left, top, right, bottom }, each kept room px from the dot's center: its own room, or the dot's radius and
// gap) and inside bounds by its radius and gap, while keeping at least keep of the shape's box (the outline's) inside
// bounds, and where prefer(x, y), if given, holds of the dot's new center. { dx: 0, dy: 0 } when the dot is clear where
// it is; null when no move within reach px clears it.
export function clearOffset({ dot, obstacles, bounds, shape, gap = GAP, step = STEP, reach = 240, keep = KEEP, prefer = null }) {
  const edge = dot.r + gap;
  const clearAt = (x, y) => {
    if (x - edge < bounds.left || x + edge > bounds.right || y - edge < bounds.top || y + edge > bounds.bottom) return false;
    return obstacles.every((o) => Math.hypot(x - Math.max(o.left, Math.min(x, o.right)), y - Math.max(o.top, Math.min(y, o.bottom))) >= (o.room ?? edge));
  };
  const area = (shape.right - shape.left) * (shape.bottom - shape.top);
  // Whole inside is whole: no rounding lets a sliver of the outline past the edge.
  const kept = (dx, dy) => area <= 0 || overlap({ left: shape.left + dx, right: shape.right + dx, top: shape.top + dy, bottom: shape.bottom + dy }, bounds) >= keep * area - 1e-6;
  for (const [dx, dy] of movesWithin(Math.floor(reach / step), step)) {
    const [x, y] = [dot.x + dx, dot.y + dy];
    if ((!prefer || prefer(x, y)) && kept(dx, dy) && clearAt(x, y)) return { dx: dx + 0, dy: dy + 0 };
  }
  return null;
}

const plain = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

// Each line of words in el, as the boxes the browser lays it out in (a pill or a badge whole), so the room right of a
// short line is room.
function lines(el) {
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(plain);
}

// Places the outline in card (the record card, .hosp__id) and marks its watermark placed (data-placed; data-dotless when
// no try finds the dot a place). Each try is measured from the outline as the stylesheet draws it (no move, full size)
// and written as the map's --dx, --dy and --s (the stylesheet's translate and scale about the map's middle).
// lineBoxes(el): the boxes of el's lines of words. A card without a map is left alone.
export function placeLocator(card, lineBoxes = lines) {
  const wm = card.querySelector('.hosp__wm');
  const map = wm?.querySelector('.geo--j');
  const dot = wm?.querySelector('.chart-geo-dot');
  const ring = wm?.querySelector('.chart-geo-halo');
  const state = wm?.querySelector('.chart-geo-state');
  if (!map || !dot || !ring || !state) return;
  const put = ({ dx, dy, s }) => {
    map.style.setProperty('--dx', `${dx}px`);
    map.style.setProperty('--dy', `${dy}px`);
    map.style.setProperty('--s', String(s));
  };
  put({ dx: 0, dy: 0, s: 1 });
  const g = map.getBoundingClientRect();
  const c = { x: (g.left + g.right) / 2, y: (g.top + g.bottom) / 2 };
  const d = dot.getBoundingClientRect();
  const r = (d.right - d.left) / 2;
  const halo = ring.getBoundingClientRect().width / 2;
  const o = plain(state.getBoundingClientRect());
  const bounds = plain(wm.getBoundingClientRect());
  const fields = [...card.querySelectorAll('.field')].map((field) => plain(field.getBoundingClientRect()));
  const words = [...card.querySelectorAll(WORDS)].flatMap(lineBoxes);
  const rules = fields.flatMap((f) => [{ left: f.right - 2, right: f.right, top: f.top, bottom: f.bottom }, { left: f.left, right: f.right, top: f.bottom - 2, bottom: f.bottom }]);
  // The lines of each field (by the middle of each line), to tell a place beside a line from one below them.
  const inside = (f, x, y) => x >= f.left && x <= f.right && y >= f.top && y <= f.bottom;
  const own = fields.map((f) => words.filter((w) => inside(f, (w.left + w.right) / 2, (w.top + w.bottom) / 2)));
  // About the map's middle, at size s.
  const at = (v, mid, s) => mid + (v - mid) * s;
  const scaled = (b, s) => ({ left: at(b.left, c.x, s), right: at(b.right, c.x, s), top: at(b.top, c.y, s), bottom: at(b.bottom, c.y, s) });
  const reach = REACH * Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (const { s, gap, keep, below } of TRIES) {
    const band = halo * s;
    const beside = (x, y) => {
      const i = fields.findIndex((f) => inside(f, x, y));
      return i >= 0 && own[i].some((w) => w.top < y + band && w.bottom > y - band);
    };
    const move = clearOffset({
      dot: { x: at((d.left + d.right) / 2, c.x, s), y: at((d.top + d.bottom) / 2, c.y, s), r: r * s },
      obstacles: [...words.map((box) => ({ ...box, room: band + gap })), ...rules],
      bounds,
      shape: scaled(o, s),
      reach,
      keep,
      prefer: below ? (x, y) => !beside(x, y) : null,
    });
    if (move) {
      delete wm.dataset.dotless;
      put({ ...move, s });
      wm.dataset.placed = '';
      return;
    }
  }
  // No place at all (none found on any page tried): the outline as drawn, and the dot and halo step out rather than sit
  // on words.
  wm.dataset.dotless = '';
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
  // The card, and the map's drawing within it: WebKit can lay the drawing out narrower at first and widen it later
  // without the card changing size.
  const resized = new ResizeObserver(later);
  resized.observe(card);
  const drawing = card.querySelector('.hosp__wm svg');
  if (drawing) resized.observe(drawing);
  if (document.fonts) document.fonts.ready.then(later, () => {});
}

if (typeof document !== 'undefined') start();
