// The money's charts' narrow and wide drawings (web/charts: treemap, acrossLine, geo usBubbles), on synthetic numbers:
// each chart owns its phone rule (isNarrow) so a figure draws the same data twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPinned } from '../../pipeline/files.js';
import { acrossLine, dodge } from '../charts/acrossLine.js';
import { pairBars } from '../charts/pairBars.js';
import { PAGE } from '../charts/figure.js';
import { stateShapes, usBubbles } from '../charts/geo.js';
import { WIDTH } from '../charts/svg.js';
import { textWidth } from '../charts/text.js';
import { treemap } from '../charts/treemap.js';

const height = (svg) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);

test('the treemap: a phone\'s drawing is plain and shorter; a page-wide one gives each tile its tooltip on the tile itself', () => {
  const groups = [
    { label: 'A', sub: 'a', value: 30, tiles: [{ value: 20, tip: 'Tile one' }, { value: 10, tip: 'Tile two' }] },
    { label: 'B', sub: 'b', value: 10, tiles: [{ value: 10, tip: 'Tile three' }] },
  ];
  const phone = String(treemap({ groups, width: WIDTH }));
  const wide = String(treemap({ groups, width: PAGE }));
  assert.ok(!phone.includes('Tile one') && !phone.includes('<rect data-mark'), 'no tile tooltips on a phone');
  assert.match(phone, /<path class="chart-tree__tile" d="M[\d.]+ [\d.]+h/);
  assert.ok(height(phone) < height(wide), 'taller across a page');
  const tiles = [...wide.matchAll(/<rect data-mark x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"><title>([^<]*)<\/title><\/rect>/g)];
  assert.deepEqual(tiles.map((m) => m[5]), ['Tile one', 'Tile two', 'Tile three']);
  assert.doesNotMatch(wide, /<g class="chart-mark" data-mark><title>Tile/, 'no wrapper around a tile');
  // Coordinates to a tenth of a unit, in both drawings.
  assert.doesNotMatch(phone + wide, /d="[^"]*\.\d\d\d?[hvz]/);
  assert.ok(tiles.every((m) => m.slice(1, 5).every((v) => !/\.\d\d/.test(v))));
});

test('the treemap: tiles are written in their own order (not by size) without moving; a sliver of a group has no header and its tiles fill its box', () => {
  const tiles = [{ value: 50, tip: 'Big', order: 'b' }, { value: 30, tip: 'Mid', order: 'a' }, { value: 20, tip: 'Small', order: 'c' }];
  const place = (svg) => new Map([...svg.matchAll(/<rect data-mark x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"><title>([^<]*)<\/title>/g)].map((m) => [m[5], m.slice(1, 5).join(' ')]));
  const sized = String(treemap({ groups: [{ label: 'A', sub: 'a', value: 100, tiles: tiles.map(({ order, ...t }) => t) }], width: PAGE }));
  const ordered = String(treemap({ groups: [{ label: 'A', sub: 'a', value: 100, tiles }], width: PAGE }));
  assert.deepEqual([...place(sized).keys()], ['Big', 'Mid', 'Small'], 'without an order, in the order given');
  assert.deepEqual([...place(ordered).keys()], ['Mid', 'Big', 'Small'], 'by order');
  assert.deepEqual([...place(ordered)].sort(), [...place(sized)].sort(), 'every tile in the same place either way');
  // A group too small to carry a header: here about 0.2% of the area, a box a few units tall under the third column.
  // It is drawn without a label, its tiles fill its box, and they are told apart by their tooltips.
  const groups = [
    { label: 'First', sub: 'f', value: 1470, tiles: [{ value: 1470, tip: 'First tile' }] },
    { label: 'Second', sub: 's', value: 913, tiles: [{ value: 913, tip: 'Second tile' }] },
    { label: 'Third', sub: 't', value: 676, tiles: [{ value: 676, tip: 'Third tile' }] },
    { label: 'Sliver', sub: 'z', value: 5, tiles: [{ value: 3, tip: 'Sliver one' }, { value: 2, tip: 'Sliver two' }] },
  ];
  const svg = String(treemap({ groups, width: PAGE }));
  const boxes = [...svg.matchAll(/<rect class="chart-tree__group" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1, 5).map(Number));
  assert.equal(boxes.length, 4);
  const box = boxes[3];
  assert.ok(box[3] > 0 && box[3] < 30 && box[2] > 30, `a box wide and shorter than a header: ${box}`);
  assert.ok(!svg.includes('>Sliver<'), 'no label for it');
  const drawn = place(svg);
  assert.deepEqual([...drawn.keys()].sort(), ['First tile', 'Second tile', 'Sliver one', 'Sliver two', 'Third tile']);
  for (const key of ['Sliver one', 'Sliver two']) {
    const [x, y, w, h] = drawn.get(key).split(' ').map(Number);
    assert.ok(w > 0 && h > 0, `${key} has a size`);
    assert.ok(x >= box[0] - 0.1 && x + w <= box[0] + box[2] + 0.1 && y >= box[1] - 0.1 && y + h <= box[1] + box[3] + 0.1, `${key} inside its box`);
  }
});

test('the treemap: a box has a header only where its label is printed (one threshold), never a blank band; a box in the old gap between the two thresholds has none', () => {
  const group = { label: 'Only', sub: 'o', value: 10, tiles: [{ value: 6, tip: 'One' }, { value: 4, tip: 'Two' }] };
  // The top of the highest tile: a wide drawing writes each as a rect, a phone's (and any narrower than a page) as one path.
  const tileTop = (svg) => Math.min(...[...svg.matchAll(/<rect data-mark x="[\d.]+" y="([\d.]+)"|M[\d.]+ ([\d.]+)h/g)].map((m) => Number(m[1] ?? m[2])));
  // One group fills the whole drawing, so its box is the drawing: every height and width from a sliver to a full header.
  const sizes = [];
  for (const height of [20, 33, 34, 35, 36, 37, 38, 39, 40, 60, 200]) sizes.push([PAGE, height]);
  for (const width of [40, 69, 70, 71, 120]) sizes.push([width, 200]);
  for (const [width, h] of sizes) {
    const svg = String(treemap({ groups: [group], width, height: h }));
    const printed = svg.includes('chart-tree__label');
    // A header's band (30 units) is reserved exactly where the label is printed: the tiles start below it, else at the top.
    assert.equal(tileTop(svg) >= 30, printed, `${width} x ${h}: header iff label`);
  }
  // Heights in the gap the two thresholds used to leave (above a header and a gap, at or under the label's): a sliver.
  for (const h of [35, 36, 37, 38]) {
    const svg = String(treemap({ groups: [group], width: PAGE, height: h }));
    assert.ok(!svg.includes('chart-tree__label'), `${h}: no label`);
    assert.ok(tileTop(svg) < 5, `${h}: its tiles fill the box, no blank header above them`);
  }
  assert.ok(String(treemap({ groups: [group], width: PAGE, height: 39 })).includes('chart-tree__label'), 'a taller box keeps its header');
  // Too narrow for the label: the same, whatever the height.
  assert.ok(tileTop(String(treemap({ groups: [group], width: 69, height: 200 }))) < 5, 'a narrow box has no blank header either');
});

test('acrossLine: a phone\'s drawing has smaller, plain dots; a wide one names each dot with a tip, and a dot with no tip stays plain', () => {
  const dots = [
    { x: 0.1, value: 100, over: false, mine: true, tip: 'Mine' },
    { x: 0.2, value: 400, over: true, mine: false, tip: null },
    { x: 0.3, value: 900, over: true, mine: true, tip: 'Also mine' },
  ];
  const args = { dots, domain: [0, 0.4], line: 0.25, labels: { under: ['a', 'b'], over: ['c', 'd'], line: 'Line', axis: 'Score' }, values: { under: 100, over: 1300 } };
  const phone = String(acrossLine({ ...args, width: WIDTH }));
  const wide = String(acrossLine({ ...args, width: PAGE }));
  assert.ok(!phone.includes('Mine'), 'no tooltips on a phone');
  assert.equal([...wide.matchAll(/<g class="chart-mark" data-mark><title>(Mine|Also mine)<\/title>/g)].length, 2, 'only the dots with a tip');
  assert.equal([...wide.matchAll(/chart-across__dot--faint/g)].length, 1, 'the one not mine is faint');
  const radius = (svg) => Math.max(...[...svg.matchAll(/<circle class="chart-across__dot[^"]*" cx="[\d.]+" cy="[\d.-]+" r="([\d.]+)"/g)].map((m) => Number(m[1])));
  assert.ok(radius(phone) < radius(wide));
  // The same dots at the same width are laid out alike, and the dodge itself is what the layout reads.
  assert.equal(String(acrossLine({ ...args, width: PAGE })), wide);
  assert.deepEqual(dodge([{ cx: 5, r: 2 }, { cx: 5, r: 2 }]).map(Math.abs), [0, 4.6]);
});

test('usBubbles: the decorative land is drawn to whole units, so the one map that draws it ships less markup', () => {
  const shapes = stateShapes(JSON.parse(readPinned('us-atlas-counties-3.0.1')));
  const states = { AL: { value: 10, label: 'ten' }, TX: { value: 40, label: 'forty' } };
  const svg = String(usBubbles({ shapes, layers: [{ id: 'total', states }], width: WIDTH }));
  const land = /<path class="chart-land" d="([^"]*)"/.exec(svg)[1];
  assert.ok(land.length > 100 && !land.includes('.'), 'whole units');
  const radius = (w) => Number(/<circle class="chart-bubble"[^>]* r="([\d.]+)"/.exec(String(usBubbles({ shapes, layers: [{ id: 'total', states }], width: w })))[1]);
  assert.ok(radius(WIDTH) < radius(PAGE), 'larger circles across a page');
});

test('pairBars: the name column holds its longest label at a phone\'s width and a page\'s, so no name runs off the drawing\'s left edge', () => {
  const row = (label) => ({ label, a: 0.2, b: 0.4, aText: '20%', bText: '40%', tipA: 'a', tipB: 'b' });
  const sections = [{ heading: 'Beds', rows: [row('A label longer than the column ever was'), row('Short')] }];
  for (const width of [358, 640]) {
    const svg = String(pairBars({ sections, labels: { a: 'Count', b: 'Money' }, width }));
    // Each name ends 8 units left of the bars' baseline; the longest must start at or right of the drawing's edge.
    const end = Number(/<text class="chart-label" x="([\d.]+)"[^>]*text-anchor="end">A label longer/.exec(svg)[1]);
    assert.ok(end - textWidth('A label longer than the column ever was', 12) >= 0, `${width}: the longest name starts at ${end - textWidth('A label longer than the column ever was', 12)}`);
    const base = Number(/<line class="chart-baseline" x1="([\d.]+)"/.exec(svg)[1]);
    assert.equal(base, end + 8, `${width}: the bars start just right of the names`);
  }
  // Short names keep the column's usual width.
  const plain = String(pairBars({ sections: [{ heading: 'Beds', rows: [row('Short')] }], labels: { a: 'Count', b: 'Money' }, width: 358 }));
  assert.match(plain, /<line class="chart-baseline" x1="92"/);
});
