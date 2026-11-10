// columns(): the optional bands shade the axis's groups behind the columns; without them the chart is as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columns } from '../charts/columns.js';

const args = { bins: [{ x0: 0, x1: 1, n: 3, cls: 'chart-col', tip: 'a' }, { x0: 1, x1: 2, n: 5, cls: 'chart-col', tip: 'b' }], domain: [0, 4], ticks: [0, 2, 4], format: String, width: 300, height: 150 };

test('columns: no bands, no band marks; bands add one rect and label each, every other one tinted', () => {
  const plain = columns(args).text;
  assert.ok(!plain.includes('chart-band'));
  assert.equal(columns({ ...args, bands: null }).text, plain);
  const banded = columns({ ...args, bands: [{ x0: 0, x1: 1, label: 'A' }, { x0: 1, x1: 3, label: 'B' }, { x0: 3, x1: 4, label: 'C' }] }).text;
  assert.equal(banded.match(/<rect class="chart-band( chart-band--tint)?"/g).length, 3);
  assert.equal(banded.match(/chart-band--tint/g).length, 2);
  assert.deepEqual([...banded.matchAll(/class="chart-band__label"[^>]*>([^<]+)</g)].map((m) => m[1]), ['A', 'B', 'C']);
  assert.ok(banded.indexOf('chart-band') < banded.indexOf('chart-col'), 'behind the columns');
});

// The tick labels a drawing carries: [{ x, y, text }].
const tickLabels = (svg) => [...svg.matchAll(/<text class="chart-axis__label" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3] }));

test('columns: stagger sets every other tick label a row lower and the drawing a row taller; the columns and ticks stay put', () => {
  const four = { ...args, ticks: [1, 2, 3, 4] };
  const plain = columns(four).text;
  assert.equal(columns({ ...four, stagger: false }).text, plain, 'off by default');
  const staggered = columns({ ...four, stagger: true }).text;
  const [one, two] = [plain, staggered].map(tickLabels);
  assert.deepEqual(two.map((l) => [l.x, l.text]), one.map((l) => [l.x, l.text]), 'every label, each under its own tick');
  const rows = [...new Set(two.map((l) => l.y))];
  assert.equal(rows.length, 2);
  assert.deepEqual(two.map((l) => l.y), [0, 1, 0, 1].map((r) => rows[r]), 'alternating, the first on the upper row');
  assert.equal(rows[0], one[0].y, 'the first row where an unstaggered axis has it');
  const vb = (svg) => /viewBox="0 0 (\d+) (\d+)"/.exec(svg).slice(1).map(Number);
  assert.equal(vb(staggered)[1] - vb(plain)[1], rows[1] - rows[0], 'a row taller, by the row');
  const marks = (svg) => svg.match(/<path class="chart-col"[^>]*>|<line class="chart-(baseline|axis__tick)"[^>]*>/g);
  assert.deepEqual(marks(staggered), marks(plain), 'columns, baseline and ticks unchanged');
});
