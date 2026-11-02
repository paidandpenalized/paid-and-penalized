// relativeD (web/charts/pathd.js): the same points, exactly, in fewer characters; anything it does not read comes back as
// it was. The paths are invented, plus the US map's outlines from the pinned atlas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPinned } from '../../pipeline/files.js';
import { absoluteD, pathNumber, pathNumbers, relativeD } from '../charts/pathd.js';
import { usPaths, stateShapes } from '../charts/geo.js';
import { geoAlbersUsa, geoPath } from 'd3-geo';

// A reader of its own, on purpose, apart from pathd.js's: the check that relativeD keeps every point must not share the
// code it checks. Every point a path visits, in absolute coordinates as whole units of `scale` (one per moveto or line end, and a
// 'Z' for each close), read the way a browser reads path data: implicit repeats, relative commands, and a relative
// moveto at the start taken as absolute.
function points(d, scale) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g);
  const out = [];
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  let cmd = null;
  let i = 0;
  const n = () => Math.round(Number(tokens[i++]) * scale);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'Z':
        x = x0;
        y = y0;
        out.push('Z');
        break;
      case 'M': {
        const [a, b] = [n(), n()];
        [x, y] = rel && out.length ? [x + a, y + b] : [a, b];
        [x0, y0] = [x, y];
        out.push(`M${x},${y}`);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        const [a, b] = [n(), n()];
        [x, y] = rel ? [x + a, y + b] : [a, b];
        out.push(`${x},${y}`);
        break;
      }
      case 'H':
        x = rel ? x + n() : n();
        out.push(`${x},${y}`);
        break;
      case 'V':
        y = rel ? y + n() : n();
        out.push(`${x},${y}`);
        break;
      default:
        throw new Error(`unexpected ${cmd}`);
    }
  }
  return out;
}

const same = (a, b, scale) => assert.deepEqual(points(b, scale), points(a, scale));

test('pathNumber drops the leading zero and keeps the sign', () => {
  assert.equal(pathNumber(0.5), '.5');
  assert.equal(pathNumber(-0.25), '-.25');
  assert.equal(pathNumber(0), '0');
  assert.equal(pathNumber(12.5), '12.5');
  assert.equal(pathNumber(-3), '-3');
  assert.equal(pathNumbers(0.5, 0.5), '.5.5');
  assert.equal(pathNumbers(3, 0.5), '3 .5', 'a decimal point after a whole number needs the space');
  assert.equal(pathNumbers(1.5, -2), '1.5-2');
  assert.equal(pathNumbers(2, 3), '2 3');
});

test('lines become relative, one-axis lines h and v, closes z and the next moveto m', () => {
  assert.equal(relativeD('M10,20L13.5,20L13.5,18L10,20Z'), 'M10 20h3.5v-2l-3.5 2z');
  assert.equal(relativeD('M1,1L2,2L3,1ZM5,5L6,6L7,5Z'), 'M1 1l1 1 1-1zm4 4 1 1 1-1z');
  // A zero-length line is kept (with round caps it draws a dot).
  assert.equal(relativeD('M1 1L1 1'), 'M1 1h0');
  // The roll call's rows: absolute moves and H.
  const row = 'M43.83 129.5H44.14M44.3 129.5H44.61';
  assert.equal(relativeD(row), 'M43.83 129.5h.31m.16 0h.31');
  same(row, relativeD(row), 100);
  // Numbers join where the grammar lets them: before a minus, and a decimal after a decimal.
  assert.equal(relativeD('M0.5 0.5L1 1L1.5 0.5'), 'M.5.5l.5.5.5-.5');
});

test('two relative paths joined end to end still draw both (each starts with an absolute M)', () => {
  const a = 'M1 1L2 2Z';
  const b = 'M10 10L12 10Z';
  assert.deepEqual(points(relativeD(a) + relativeD(b), 1), points(a + b, 1));
});

test('relative input: the treemap\'s tiles, and a path that starts with a relative moveto (absolute, by the SVG rule)', () => {
  const tiles = 'M2 30h39.7v39.3h-39.7zM2 69.3h39.7v37h-39.7z';
  assert.equal(relativeD(tiles), 'M2 30h39.7v39.3h-39.7zm0 39.3h39.7v37h-39.7z');
  same(tiles, relativeD(tiles), 10);
  assert.equal(relativeD('m5 5 1 1h2'), 'M5 5l1 1h2');
  same('m5 5 1 1h2', relativeD('m5 5 1 1h2'), 1);
});

test('a long path restarts from an absolute point every 64 segments; the points stay the same', () => {
  const runs = Array.from({ length: 200 }, (_, k) => `M${(k * 0.37).toFixed(2)} 10.5H${(k * 0.37 + 0.2).toFixed(2)}`).join('');
  const out = relativeD(runs);
  same(runs, out, 100);
  // The first moveto, then every 64th segment after it.
  assert.equal((out.match(/[MLHV]/g) ?? []).length, Math.ceil(400 / 64));
  assert.ok(out.length < runs.length * 0.75, `${out.length} of ${runs.length}`);
});

test('a browser adding the relative steps in single precision stays within a few thousandths of a unit, however long the path', () => {
  // A roll call's row at the wide width: 6,000 runs across 1,180 units, each a move and a line.
  const runs = Array.from({ length: 6000 }, (_, k) => `M${(40 + k * 0.19).toFixed(2)} 198.5H${(40 + k * 0.19 + 0.12).toFixed(2)}`).join('');
  const out = relativeD(runs);
  const exact = points(runs, 100).filter((p) => p !== 'Z').map((p) => p.replace(/^M/, '').split(',').map((v) => v / 100));
  // The browser's sum: each absolute number read as a float32, each relative one added to the point in float32.
  const f = Math.fround;
  const tokens = out.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g);
  const seen = [];
  let [x, y] = [0, 0];
  let cmd = null;
  for (let i = 0; i < tokens.length;) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const n = () => f(Number(tokens[i++]));
    if (cmd === 'M' || cmd === 'L') [x, y] = [n(), n()];
    else if (cmd === 'm' || cmd === 'l') [x, y] = [f(x + n()), f(y + n())];
    else if (cmd === 'H') x = n();
    else if (cmd === 'h') x = f(x + n());
    seen.push([x, y]);
    if (cmd === 'M') cmd = 'L';
    if (cmd === 'm') cmd = 'l';
  }
  assert.equal(seen.length, exact.length);
  const worst = Math.max(...seen.map(([sx, sy], k) => Math.max(Math.abs(sx - exact[k][0]), Math.abs(sy - exact[k][1]))));
  assert.ok(worst < 0.005, `${worst}`);
});

test('a coordinate with more than six decimal places, or too large to add exactly, is left as it was', () => {
  for (const d of ['M1000.1234567890123 5L0.30000000000000004 2', 'M0 0L0.0000001 0', 'M1e3 1L2 2', `M${2 ** 41} 0L1 1`]) assert.equal(relativeD(d), d, d);
  assert.equal(relativeD('M0 0L0.000001 0'), 'M0 0h.000001');
});

test('anything else comes back as it was', () => {
  for (const d of [null, '', 'M1 1A2 2 0 0 1 3 3', 'M1 1C1 2 3 4 5 6', 'M1e3 1L2 2', 'L1 1', 'M1 1Z1 1', 'M1']) assert.equal(relativeD(d), d, String(d));
});

test('the US map draws its outlines in relative commands at both widths', () => {
  const shapes = stateShapes(JSON.parse(readPinned('us-atlas-counties-3.0.1')));
  for (const width of [300, 1180]) {
    for (const [code, d] of usPaths(shapes, width).paths) {
      if (d === null) continue;
      assert.match(d, /^M[\d.]/, code);
      // Relative, but for the absolute point every 64 segments.
      const numbers = d.match(/-?(?:\d+\.?\d*|\.\d+)/g).length;
      assert.ok((d.match(/[LHV]/g) ?? []).length <= numbers / 64 + 1, `${code}: relative`);
    }
  }
});

test('relativeD on every outline d3-geo writes for the US map: exactly the same points', () => {
  const shapes = stateShapes(JSON.parse(readPinned('us-atlas-counties-3.0.1')));
  const features = [...shapes.values()];
  const projection = geoAlbersUsa().fitExtent([[2, 2], [1178, 850]], { type: 'FeatureCollection', features });
  const path = geoPath(projection).digits(1);
  for (const [code, f] of shapes) {
    const d = path(f);
    if (!d) continue;
    same(d, relativeD(d), 10);
  }
});

test('absoluteD reads relativeD\'s output back as the absolute path it was made from', () => {
  for (const d of ['M43.83 129.5H44.14M44.3 129.5H44.61', 'M10 20L13.5 20L13.5 18L10 20Z', 'M1 1L2 2L3 1ZM5 5L6 6L7 5Z']) {
    same(d, absoluteD(relativeD(d)), 100);
  }
  assert.equal(absoluteD(relativeD('M43.83 129.5H44.14M44.3 129.5H44.61')), 'M43.83 129.5H44.14M44.3 129.5H44.61');
  assert.equal(absoluteD('M1 1A2 2 0 0 1 3 3'), 'M1 1A2 2 0 0 1 3 3');
  assert.equal(relativeD('M1 1L2#2'), 'M1 1L2#2', 'a stray character: returned as it was');
});
