// The record card's state outline (client/record.js): the outline lies behind the fields, and the move that keeps its
// dot clear of every field's words and rules. The pure part runs on rectangles; the wiring on a stand-in page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../../../pipeline/files.js';
import { HACRP } from '../web/generate.js';
import { WORDS, clearOffset, placeLocator } from '../client/record.js';

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

// A stand-in page: a card whose watermark (wm) holds the map, its words and fields at fixed boxes; the dot, its halo
// (half again its radius) and the outline's box move with the map's --dx and --dy, as a CSS translate moves them. Each
// word's element is one line (LINE).
const LINE = (el) => [el.getBoundingClientRect()];
function stub({ dot, words = [], fields = [], wm = rect(10, 40, 590, 390), shape = rect(300, 40, 590, 390) }) {
  const values = {};
  const style = { values, setProperty: (k, v) => { values[k] = v; }, getPropertyValue: (k) => values[k] ?? '' };
  const shift = () => [parseFloat(values['--dx'] ?? '0'), parseFloat(values['--dy'] ?? '0')];
  const box = (r) => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
  const fixed = (r) => ({ getBoundingClientRect: () => box(r) });
  const moving = (r) => ({ getBoundingClientRect: () => { const [x, y] = shift(); return box(rect(r.left + x, r.top + y, r.right + x, r.bottom + y)); } });
  const circle = (r) => moving(rect(dot.x - r, dot.y - r, dot.x + r, dot.y + r));
  const parts = { '.geo--j': { style }, '.chart-geo-dot': circle(dot.r), '.chart-geo-halo': circle(dot.r * 1.5), '.chart-geo-state': moving(shape) };
  const wmEl = { ...fixed(wm), dataset: {}, querySelector: (sel) => parts[sel] ?? null };
  const card = {
    querySelector: (sel) => (sel === '.hosp__wm' ? wmEl : null),
    querySelectorAll: (sel) => (sel === WORDS ? words.map(fixed) : sel === '.field' ? fields.map(fixed) : []),
  };
  return { card, wm: wmEl, style };
}

test('placeLocator moves the outline by the offset (a custom property pair, set through the CSSOM) and marks it placed; the halo keeps off words, the dot off rules', () => {
  const s = stub({ dot: at(450, 112), words: [rect(20, 100, 580, 120)] });
  placeLocator(s.card, LINE);
  assert.deepEqual(s.style.values, { '--dx': '0px', '--dy': '28px' }, 'down: 112 + 28 = 140, the halo (12) and its gap (8) past the line\'s 120');
  assert.equal(s.wm.dataset.placed, '');
  // Placed again (a resize) from where it stands now: the move is measured from the outline's own place, not the moved one.
  placeLocator(s.card, LINE);
  assert.deepEqual(s.style.values, { '--dx': '0px', '--dy': '28px' });
});

test('placeLocator: on a card dense with words, a tighter fit beside them before none', () => {
  // Lines 34 px apart across the card: the halo (12) with its roomy gap (8) fits nowhere between them; just clear of
  // them (3) it does.
  const words = [60, 114, 168, 222, 276, 330].map((top) => rect(20, top, 580, top + 20)).concat([rect(20, 384, 580, 389)]);
  const s = stub({ dot: at(450, 70), words });
  placeLocator(s.card, LINE);
  assert.deepEqual(s.style.values, { '--dx': '0px', '--dy': '28px' }, 'y 98: 18 and 16 from the lines either side, past 15');
  assert.equal(s.wm.dataset.dotless, undefined);
});

test('placeLocator: a rule keeps the dot, not its halo, at its distance', () => {
  // A field whose right rule runs from x 456: the dot (r 8) keeps r + 3 from it; its halo (12) may cross it.
  const s = stub({ dot: at(450, 300), fields: [rect(200, 200, 458, 380)] });
  placeLocator(s.card, LINE);
  assert.deepEqual(s.style.values, { '--dx': '-8px', '--dy': '0px' }, '442 is 14 from the rule, past r 8 and gap 3; 446 would be 10');
});

test('placeLocator: a dot already clear stays; with no clear place at all, the dot and halo step out; a card without a map is left alone', () => {
  const clear = stub({ dot: at(450, 300), words: [rect(20, 100, 580, 120)] });
  placeLocator(clear.card, LINE);
  assert.deepEqual(clear.style.values, { '--dx': '0px', '--dy': '0px' });
  assert.equal(clear.wm.dataset.dotless, undefined);
  const boxed = stub({ dot: at(450, 200), words: [rect(0, 0, 600, 400)] });
  placeLocator(boxed.card, LINE);
  assert.deepEqual(boxed.style.values, { '--dx': '0px', '--dy': '0px' }, 'the outline stays put');
  assert.deepEqual([boxed.wm.dataset.placed, boxed.wm.dataset.dotless], ['', ''], 'placed, and the dot steps out rather than sit on words');
  assert.doesNotThrow(() => placeLocator({ querySelector: () => null, querySelectorAll: () => [] }));
});

test('the record script is an entry of its own, never storage, markup or the network', () => {
  assert.equal(HACRP.entries['hacrp-record'], 'sites/hacrp/client/record.js');
  const src = readFileSync(REPO_ROOT + 'sites/hacrp/client/record.js', 'utf8').replace(/\/\/.*$/gm, '');
  for (const word of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'Storage', 'cookie', 'fetch', 'XMLHttpRequest', 'setAttribute(\'style\'', '.style.transform']) assert.ok(!src.includes(word), word);
});
