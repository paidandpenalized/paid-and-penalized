// The record card's state outline (client/record.js): the whole outline lies behind the fields, and the move (and, where
// it must, the smaller size) that keeps its dot and halo well clear of every field's words and the dot of its rules.
// The pure part runs on rectangles; the wiring on a stand-in page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { HACRP } from '../web/generate.js';
import { TRIES, WORDS, clearOffset, movesWithin, placeLocator } from '../client/record.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
// A card's inner box, 600 by 400, and an outline that fills its right half.
const BOUNDS = rect(0, 0, 600, 400);
const SHAPE = rect(300, 0, 600, 400);
const at = (x, y, r = 8) => ({ x, y, r });

test('clearOffset: a dot already clear stays where it is', () => {
  assert.deepEqual(clearOffset({ dot: at(450, 300), obstacles: [rect(10, 10, 590, 100)], bounds: BOUNDS, shape: SHAPE }), { dx: 0, dy: 0 });
});

test('clearOffset: a dot on a word moves the least distance that clears it by the gap, in whole steps', () => {
  // A line of words from y 100 to 120 across the card; the dot at y 112, nearer the line's bottom.
  const words = [rect(20, 100, 580, 120)];
  const move = clearOffset({ dot: at(450, 112), obstacles: words, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4 });
  assert.deepEqual(move, { dx: 0, dy: 20 }, 'down: 112 + 20 = 132 = 120 + r 8 + gap 4');
  // Nearer the top: it goes up.
  assert.deepEqual(clearOffset({ dot: at(450, 104), obstacles: words, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4 }), { dx: 0, dy: -16 });
  // A short word: sideways is nearer.
  assert.deepEqual(clearOffset({ dot: at(450, 110), obstacles: [rect(400, 100, 452, 120)], bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4 }), { dx: 16, dy: 0 });
});

test('clearOffset: the moved dot keeps clear of every obstacle at once, and of a corner by the circle, not the box', () => {
  const words = [rect(20, 100, 580, 120), rect(20, 132, 580, 152)];
  const move = clearOffset({ dot: at(450, 126), obstacles: words, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4 });
  // Between the two lines there is no room (12 px for a 24 px circle); the nearest clear place is past one of them.
  const y = 126 + move.dy;
  assert.equal(move.dx, 0);
  assert.ok(y >= 152 + 12 || y <= 100 - 12, `${y}`);
  // Diagonally off a box's corner, a circle is clear sooner than its square box would be (3 px across or down).
  const corner = clearOffset({ dot: at(345, 345), obstacles: [rect(300, 300, 340, 340)], bounds: BOUNDS, shape: SHAPE, gap: 0, step: 1, reach: 60 });
  assert.deepEqual(corner, { dx: 1, dy: 1 });
});

test('clearOffset: the dot stays inside the bounds, by the gap, and the outline mostly inside them', () => {
  // A word under the dot near the card's bottom edge: down would leave the card, so it goes up.
  const move = clearOffset({ dot: at(450, 384), obstacles: [rect(20, 370, 580, 392)], bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4 });
  assert.ok(move.dy < 0 && 384 + move.dy <= 370 - 12, JSON.stringify(move));
  // The outline may not leave the bounds by more than keep allows: a far move that would push most of it out is refused.
  const wall = [rect(0, 0, 600, 360)];
  assert.equal(clearOffset({ dot: at(450, 200), obstacles: wall, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4, keep: 0.9 }), null, 'the only room is past the outline\'s keep');
  // With less kept, the move to the strip under the wall (172 px down leaves 57% of the outline inside).
  assert.deepEqual(clearOffset({ dot: at(450, 200), obstacles: wall, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4, keep: 0.4 }), { dx: 0, dy: 172 });
});

test('clearOffset: no clear place within reach is null', () => {
  assert.equal(clearOffset({ dot: at(300, 200), obstacles: [rect(0, 0, 600, 400)], bounds: BOUNDS, shape: SHAPE }), null);
});

test('clearOffset: where prefer is given, only a place it holds of; keep 1 keeps the whole outline inside', () => {
  const words = [rect(20, 100, 580, 120)];
  // Nearest is up (y 104 near the line's top), but a place below the line is asked for.
  const below = clearOffset({ dot: at(450, 104), obstacles: words, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4, prefer: (x, y) => y > 120 });
  assert.deepEqual(below, { dx: 0, dy: 28 });
  // An outline that fills the bounds top to bottom may not move up or down at all with keep 1.
  assert.equal(clearOffset({ dot: at(450, 104), obstacles: words, bounds: BOUNDS, shape: SHAPE, gap: 4, step: 4, keep: 1 }), null);
});

test('movesWithin: nearest first; at one distance sideways before up or down, and down before up; made once for each reach and step', () => {
  const moves = movesWithin(3, 4);
  assert.equal(moves.length, 49);
  assert.deepEqual(moves.slice(0, 5), [[0, 0], [-4, 0], [4, 0], [0, 4], [0, -4]]);
  assert.equal(movesWithin(3, 4), moves, 'the same list, not made again');
});

// A stand-in page: a card whose watermark (wm) holds the map (its box mapBox, scaled about its middle), its words and
// fields at fixed boxes, the dot (with its halo, half again its radius) and the outline's box. placeLocator measures the
// outline unmoved and at full size; placed() reads where its values put the dot and the outline.
const LINE = (el) => [el.getBoundingClientRect()];
function stub({ dot, words = [], fields = [], wm = rect(0, 0, 600, 400), mapBox = rect(100, 0, 500, 400), shape = rect(150, 40, 450, 360) }) {
  const values = {};
  const style = { values, setProperty: (k, v) => { values[k] = v; }, getPropertyValue: (k) => values[k] ?? '' };
  const box = (r) => ({ getBoundingClientRect: () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }) });
  const circle = (r) => box(rect(dot.x - r, dot.y - r, dot.x + r, dot.y + r));
  const parts = { '.geo--j': { style, ...box(mapBox) }, '.chart-geo-dot': circle(dot.r), '.chart-geo-halo': circle(dot.r * 1.5), '.chart-geo-state': box(shape) };
  const wmEl = { ...box(wm), dataset: {}, querySelector: (sel) => parts[sel] ?? null };
  const card = {
    querySelector: (sel) => (sel === '.hosp__wm' ? wmEl : null),
    querySelectorAll: (sel) => (sel === WORDS ? words.map(box) : sel === '.field' ? fields.map(box) : []),
  };
  const placed = () => {
    const [dx, dy, k] = ['--dx', '--dy', '--s'].map((p) => parseFloat(values[p]));
    const [cx, cy] = [(mapBox.left + mapBox.right) / 2, (mapBox.top + mapBox.bottom) / 2];
    const X = (x) => cx + (x - cx) * k + dx;
    const Y = (y) => cy + (y - cy) * k + dy;
    return { s: k, dot: { x: X(dot.x), y: Y(dot.y), r: dot.r * k, halo: dot.r * 1.5 * k }, shape: rect(X(shape.left), Y(shape.top), X(shape.right), Y(shape.bottom)) };
  };
  return { card, wm: wmEl, style, placed };
}
const gapOf = (p, r) => Math.hypot(p.x - Math.max(r.left, Math.min(p.x, r.right)), p.y - Math.max(r.top, Math.min(p.y, r.bottom)));
const within = (inner, outer) => inner.left >= outer.left - 1e-9 && inner.right <= outer.right + 1e-9 && inner.top >= outer.top - 1e-9 && inner.bottom <= outer.bottom + 1e-9;

test('the tries: the whole outline at full size, then smaller, before any of it may leave the card; roomy before tight', () => {
  const firstPartial = TRIES.findIndex((t) => t.keep < 1);
  assert.equal(firstPartial, TRIES.length - 1, 'a partial outline only as the last try');
  assert.deepEqual([...new Set(TRIES.slice(0, firstPartial).map((t) => t.s))], [1, 0.85, 0.7, 0.55, 0.45], 'each size in turn');
  assert.ok(TRIES.slice(0, 8).every((t) => t.gap === 16), 'with room to spare (16 px from the halo to the words) first');
  assert.deepEqual(TRIES.slice(0, 4).map((t) => [t.s, t.below]), [[1, true], [0.85, true], [0.7, true], [1, false]], 'below a field\'s lines, a little smaller if need be, before beside them');
});

test('placeLocator: the least move that takes the dot and halo well clear of the words at full size, below its field\'s lines rather than beside them, the whole outline inside', () => {
  // A field with a label across the top and a short value line under it; the dot on the value line.
  const words = [rect(10, 10, 580, 30), rect(10, 40, 285, 60)];
  const s = stub({ dot: at(280, 50), words, fields: [rect(0, 0, 600, 200)] });
  placeLocator(s.card, LINE);
  const p = s.placed();
  assert.equal(p.s, 1, 'full size');
  for (const w of words) assert.ok(gapOf(p.dot, w) >= p.dot.halo + 16, `the halo 16 px clear of the line at ${w.top}`);
  assert.ok(p.dot.y - p.dot.halo >= 60, 'below the value line, not beside it (a place right of it is nearer)');
  assert.ok(within(p.shape, rect(0, 0, 600, 400)), 'the whole outline inside');
  assert.equal(s.wm.dataset.placed, '');
  assert.equal(s.style.values['--s'], '1');
  // Placed again (a resize): measured from the outline as drawn, so the same place.
  const before = { ...s.style.values };
  placeLocator(s.card, LINE);
  assert.deepEqual(s.style.values, before);
});

test('placeLocator: smaller before any of the outline leaves the card', () => {
  // The outline fills the card top to bottom; the dot on a line across the card: only a move up or down clears it, and
  // only a smaller outline has room for one.
  const words = [rect(0, 180, 600, 200)];
  const s = stub({ dot: at(300, 190), words, mapBox: rect(0, 0, 600, 400), shape: rect(100, 0, 500, 400) });
  placeLocator(s.card, LINE);
  const p = s.placed();
  assert.equal(p.s, 0.7, '0.85 leaves too little room above and below; 0.7 enough');
  assert.ok(gapOf(p.dot, words[0]) >= p.dot.halo + 16, 'the halo well clear of the line');
  assert.ok(within(p.shape, rect(0, 0, 600, 400)), 'the whole outline inside');
  assert.equal(s.wm.dataset.dotless, undefined);
});

test('placeLocator: a rule keeps the dot, not its halo, at its distance', () => {
  // A field whose right rule runs from x 456: the dot (r 8) keeps r + 3 from it.
  const s = stub({ dot: at(440, 300), fields: [rect(200, 200, 458, 380)] });
  placeLocator(s.card, LINE);
  const p = s.placed();
  assert.ok(gapOf(p.dot, rect(456, 200, 458, 380)) >= p.dot.r + 3 && gapOf(p.dot, rect(200, 378, 458, 380)) >= p.dot.r + 3, JSON.stringify(p.dot));
  assert.equal(p.s, 1);
});

test('placeLocator: a dot already clear stays; with no clear place at all, the dot and halo step out; a card without a map is left alone', () => {
  const clear = stub({ dot: at(300, 300), words: [rect(20, 100, 580, 120)] });
  placeLocator(clear.card, LINE);
  assert.deepEqual(clear.style.values, { '--dx': '0px', '--dy': '0px', '--s': '1' });
  assert.equal(clear.wm.dataset.dotless, undefined);
  const boxed = stub({ dot: at(300, 200), words: [rect(0, 0, 600, 400)] });
  placeLocator(boxed.card, LINE);
  assert.deepEqual(boxed.style.values, { '--dx': '0px', '--dy': '0px', '--s': '1' }, 'the outline as drawn');
  assert.deepEqual([boxed.wm.dataset.placed, boxed.wm.dataset.dotless], ['', ''], 'placed, and the dot steps out rather than sit on words');
  assert.doesNotThrow(() => placeLocator({ querySelector: () => null, querySelectorAll: () => [] }));
});

test('the record script is an entry of its own, never storage, markup or the network', () => {
  assert.equal(HACRP.entries['hacrp-record'], 'sites/hacrp/client/record.js');
  const src = readFileSync(REPO_ROOT + 'sites/hacrp/client/record.js', 'utf8').replace(/\/\/.*$/gm, '');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'Storage', 'cookie', 'fetch', 'XMLHttpRequest', 'setAttribute(\'style\'', '.style.transform']) assert.ok(!src.includes(word), word);
});
